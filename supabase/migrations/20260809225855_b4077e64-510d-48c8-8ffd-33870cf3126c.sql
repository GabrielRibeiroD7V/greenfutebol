-- MIGRATION: ALL-OR-NOTHING SETTLEMENT RULES
-- DATE: 2026-08-09
-- GOAL: Implement strict settlement logic where ANY loss results in a LOST ticket,
-- and WON tickets require 100% success (VOID counts as 1.0 odd).

CREATE OR REPLACE FUNCTION public.settle_fixture_atomic(_fixture_id BIGINT, _admin_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res RECORD;
    v_sel RECORD;
    v_ticket_id UUID;
    v_new_sel_status TEXT;
    v_total_odd NUMERIC;
    v_return NUMERIC;
    v_any_lost BOOLEAN;
    v_any_pending BOOLEAN;
    v_all_void BOOLEAN;
    v_final_status TEXT;
    v_log_count INTEGER := 0;
    v_stake NUMERIC;
BEGIN
    -- 1. Carregar resultado oficial
    SELECT * INTO v_res FROM public.fixture_results WHERE fixture_id = _fixture_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Result not found for fixture');
    END IF;

    -- 2. Avaliar cada seleção pendente vinculada a esta fixture
    FOR v_sel IN 
        SELECT ts.*, fm.market_type, fm.line, fms.selection_key
        FROM public.ticket_selections ts
        JOIN public.fixture_markets fm ON ts.fixture_market_id = fm.id
        JOIN public.fixture_market_selections fms ON ts.fixture_market_option_id = fms.id
        WHERE fm.fixture_id = _fixture_id AND ts.status = 'PENDING'
        FOR UPDATE
    LOOP
        v_new_sel_status := 'PENDING';
        
        CASE v_sel.market_type
            WHEN '1X2' THEN
                IF v_res.home_score > v_res.away_score THEN
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'H' THEN 'WON' ELSE 'LOST' END;
                ELSIF v_res.home_score < v_res.away_score THEN
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'A' THEN 'WON' ELSE 'LOST' END;
                ELSE
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'D' THEN 'WON' ELSE 'LOST' END;
                END IF;

            WHEN 'DC' THEN -- Dupla Chance
                IF v_sel.selection_key = '1X' THEN
                    v_new_sel_status := CASE WHEN v_res.home_score >= v_res.away_score THEN 'WON' ELSE 'LOST' END;
                ELSIF v_sel.selection_key = '12' THEN
                    v_new_sel_status := CASE WHEN v_res.home_score <> v_res.away_score THEN 'WON' ELSE 'LOST' END;
                ELSIF v_sel.selection_key = 'X2' THEN
                    v_new_sel_status := CASE WHEN v_res.away_score >= v_res.home_score THEN 'WON' ELSE 'LOST' END;
                END IF;

            WHEN 'DNB' THEN -- Empate Anula
                IF v_res.home_score = v_res.away_score THEN
                    v_new_sel_status := 'VOID'; -- PUSH na regra antiga, VOID na nova
                ELSIF v_res.home_score > v_res.away_score THEN
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'H' THEN 'WON' ELSE 'LOST' END;
                ELSE
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'A' THEN 'WON' ELSE 'LOST' END;
                END IF;

            WHEN 'OU' THEN -- Over/Under
                IF (v_res.home_score + v_res.away_score) > v_sel.line THEN
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'OVER' THEN 'WON' ELSE 'LOST' END;
                ELSIF (v_res.home_score + v_res.away_score) < v_sel.line THEN
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'UNDER' THEN 'WON' ELSE 'LOST' END;
                ELSE
                    v_new_sel_status := 'VOID';
                END IF;

            WHEN 'BTTS' THEN -- Ambas Marcam
                IF v_res.home_score > 0 AND v_res.away_score > 0 THEN
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'YES' THEN 'WON' ELSE 'LOST' END;
                ELSE
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'NO' THEN 'WON' ELSE 'LOST' END;
                END IF;

            ELSE
                v_new_sel_status := 'PENDING';
        END CASE;

        IF v_new_sel_status <> 'PENDING' THEN
            UPDATE public.ticket_selections 
            SET status = v_new_sel_status, 
                settled_at = NOW(),
                settlement_reason = 'Settled via All-or-Nothing rule'
            WHERE id = v_sel.id;

            INSERT INTO public.settlement_audit_logs (fixture_id, ticket_id, selection_id, status_before, status_after, result_snapshot, admin_id, process_name)
            VALUES (_fixture_id, v_sel.ticket_id, v_sel.id, 'PENDING', v_new_sel_status, row_to_json(v_res)::jsonb, _admin_id, 'settle_fixture_atomic_v2');
            
            v_log_count := v_log_count + 1;
        END IF;
    END LOOP;

    -- 3. Re-avaliar tickets afetados
    FOR v_ticket_id IN 
        SELECT DISTINCT ts.ticket_id 
        FROM public.ticket_selections ts
        JOIN public.fixture_markets fm ON ts.fixture_market_id = fm.id
        WHERE fm.fixture_id = _fixture_id
    LOOP
        -- REGRA ALL-OR-NOTHING:
        -- 1. Se qualquer uma for LOST -> Ticket LOST
        -- 2. Se houver qualquer PENDING -> Ticket continua PENDING (esperando outros jogos)
        -- 3. Se todas forem VOID -> Ticket VOID
        -- 4. Se todas forem WON ou VOID -> Ticket WON (VOID = odd 1.0)

        v_any_lost := EXISTS (SELECT 1 FROM public.ticket_selections WHERE ticket_id = v_ticket_id AND status = 'LOST');
        
        IF v_any_lost THEN
            v_final_status := 'LOST';
            v_total_odd := 0;
            v_return := 0;
        ELSE
            v_any_pending := EXISTS (SELECT 1 FROM public.ticket_selections WHERE ticket_id = v_ticket_id AND status = 'PENDING');
            
            IF v_any_pending THEN
                -- Ainda esperando outros resultados do bilhete múltiplo
                CONTINUE;
            END IF;

            -- Todas selections do bilhete foram liquidadas e nenhuma é LOST
            v_all_void := NOT EXISTS (SELECT 1 FROM public.ticket_selections WHERE ticket_id = v_ticket_id AND status <> 'VOID');
            
            IF v_all_void THEN
                v_final_status := 'VOID';
                v_total_odd := 1.0;
                SELECT stake INTO v_return FROM public.tickets WHERE id = v_ticket_id;
            ELSE
                v_final_status := 'WON';
                v_total_odd := 1.0;
                FOR v_sel IN SELECT odd_snapshot, status FROM public.ticket_selections WHERE ticket_id = v_ticket_id LOOP
                    IF v_sel.status = 'WON' THEN
                        v_total_odd := v_total_odd * v_sel.odd_snapshot;
                    ELSIF v_sel.status = 'VOID' THEN
                        v_total_odd := v_total_odd * 1.0;
                    END IF;
                END LOOP;
                SELECT stake INTO v_stake FROM public.tickets WHERE id = v_ticket_id;
                v_return := round(v_stake * v_total_odd, 2);
            END IF;
        END IF;

        UPDATE public.tickets 
        SET status = v_final_status,
            settled_total_odd = v_total_odd,
            settled_return = v_return,
            settled_at = NOW()
        WHERE id = v_ticket_id;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'settled_count', v_log_count);
END;
$$;