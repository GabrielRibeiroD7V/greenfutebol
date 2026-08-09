-- FASE 2F — LIQUIDAÇÃO DE MERCADOS
-- Migração 20260811000000: Estrutura de Resultados, Liquidação e Auditoria

-- 1. PONTO DE RECUPERAÇÃO / AUDITORIA
CREATE TABLE IF NOT EXISTS public.settlement_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_id BIGINT NOT NULL,
    ticket_id UUID,
    selection_id UUID,
    status_before TEXT,
    status_after TEXT,
    result_snapshot JSONB,
    admin_id UUID REFERENCES auth.users(id),
    process_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT SELECT, INSERT ON public.settlement_audit_logs TO authenticated;
GRANT ALL ON public.settlement_audit_logs TO service_role;
ALTER TABLE public.settlement_audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. AJUSTES EM TABELAS EXISTENTES PARA LIQUIDAÇÃO
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticket_selections' AND column_name='settled_at') THEN
        ALTER TABLE public.ticket_selections ADD COLUMN settled_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE public.ticket_selections ADD COLUMN settlement_reason TEXT;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tickets' AND column_name='settled_total_odd') THEN
        ALTER TABLE public.tickets ADD COLUMN settled_total_odd NUMERIC(10,2);
        ALTER TABLE public.tickets ADD COLUMN settled_return NUMERIC(15,2);
        ALTER TABLE public.tickets ADD COLUMN settled_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 3. GARANTIR ESTRUTURA DE fixture_results
CREATE INDEX IF NOT EXISTS idx_fixture_results_fixture_id ON public.fixture_results(fixture_id);
ALTER TABLE public.fixture_results ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fixture_results' AND policyname = 'Public read access for results') THEN
        CREATE POLICY "Public read access for results" ON public.fixture_results FOR SELECT TO authenticated, anon USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fixture_results' AND policyname = 'Admin insert/update results') THEN
        CREATE POLICY "Admin insert/update results" ON public.fixture_results FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;

GRANT SELECT ON public.fixture_results TO anon, authenticated;
GRANT ALL ON public.fixture_results TO service_role;

-- 4. RPC DE LIQUIDAÇÃO ATÔMICA
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
    v_ticket_status TEXT;
    v_new_sel_status TEXT;
    v_total_odd NUMERIC;
    v_return NUMERIC;
    v_all_won BOOLEAN;
    v_any_lost BOOLEAN;
    v_final_status TEXT;
    v_log_count INTEGER := 0;
BEGIN
    -- 1. Carregar resultado oficial
    SELECT * INTO v_res FROM public.fixture_results WHERE fixture_id = _fixture_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Result not found for fixture');
    END IF;

    -- 2. Avaliar cada seleção pendente vinculada a esta fixture
    FOR v_sel IN 
        SELECT ts.*, fm.market_type, fm.line, fms.selection_key, fms.metadata as market_metadata
        FROM public.ticket_selections ts
        JOIN public.fixture_markets fm ON ts.market_id = fm.id
        JOIN public.fixture_market_selections fms ON ts.selection_id = fms.id
        WHERE fm.fixture_id = _fixture_id AND ts.status = 'PENDING'
        FOR UPDATE
    LOOP
        v_new_sel_status := 'PENDING';
        
        CASE v_sel.market_type
            WHEN '1X2' THEN
                IF v_res.home_score > v_res.away_score THEN
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'HOME' THEN 'WON' ELSE 'LOST' END;
                ELSIF v_res.home_score < v_res.away_score THEN
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'AWAY' THEN 'WON' ELSE 'LOST' END;
                ELSE
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'DRAW' THEN 'WON' ELSE 'LOST' END;
                END IF;

            WHEN 'DOUBLE_CHANCE' THEN
                IF v_sel.selection_key = '1X' THEN
                    v_new_sel_status := CASE WHEN v_res.home_score >= v_res.away_score THEN 'WON' ELSE 'LOST' END;
                ELSIF v_sel.selection_key = '12' THEN
                    v_new_sel_status := CASE WHEN v_res.home_score <> v_res.away_score THEN 'WON' ELSE 'LOST' END;
                ELSIF v_sel.selection_key = 'X2' THEN
                    v_new_sel_status := CASE WHEN v_res.away_score >= v_res.home_score THEN 'WON' ELSE 'LOST' END;
                END IF;

            WHEN 'DRAW_NO_BET' THEN
                IF v_res.home_score = v_res.away_score THEN
                    v_new_sel_status := 'PUSH';
                ELSIF v_res.home_score > v_res.away_score THEN
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'HOME' THEN 'WON' ELSE 'LOST' END;
                ELSE
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'AWAY' THEN 'WON' ELSE 'LOST' END;
                END IF;

            WHEN 'OVER_UNDER' THEN
                IF (v_res.home_score + v_res.away_score) > v_sel.line THEN
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'OVER' THEN 'WON' ELSE 'LOST' END;
                ELSIF (v_res.home_score + v_res.away_score) < v_sel.line THEN
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'UNDER' THEN 'WON' ELSE 'LOST' END;
                ELSE
                    v_new_sel_status := 'PUSH';
                END IF;

            WHEN 'BOTH_TEAMS_TO_SCORE' THEN
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
                settlement_reason = 'Auto-settled via RPC'
            WHERE id = v_sel.id;

            INSERT INTO public.settlement_audit_logs (fixture_id, ticket_id, selection_id, status_before, status_after, result_snapshot, admin_id, process_name)
            VALUES (_fixture_id, v_sel.ticket_id, v_sel.id, 'PENDING', v_new_sel_status, row_to_json(v_res)::jsonb, _admin_id, 'settle_fixture_atomic');
            
            v_log_count := v_log_count + 1;
        END IF;
    END LOOP;

    FOR v_ticket_id IN 
        SELECT DISTINCT ts.ticket_id 
        FROM public.ticket_selections ts
        JOIN public.fixture_markets fm ON ts.market_id = fm.id
        WHERE fm.fixture_id = _fixture_id
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.ticket_selections WHERE ticket_id = v_ticket_id AND status = 'PENDING') THEN
            v_any_lost := EXISTS (SELECT 1 FROM public.ticket_selections WHERE ticket_id = v_ticket_id AND status = 'LOST');
            IF v_any_lost THEN
                v_final_status := 'LOST';
                v_total_odd := 0;
                v_return := 0;
            ELSE
                v_total_odd := 1.0;
                FOR v_sel IN SELECT odd, status FROM public.ticket_selections WHERE ticket_id = v_ticket_id LOOP
                    IF v_sel.status = 'WON' THEN
                        v_total_odd := v_total_odd * v_sel.odd;
                    END IF;
                END LOOP;
                v_final_status := 'WON';
                SELECT stake INTO v_return FROM public.tickets WHERE id = v_ticket_id;
                v_return := v_return * v_total_odd;
            END IF;

            UPDATE public.tickets 
            SET status = v_final_status,
                settled_total_odd = v_total_odd,
                settled_return = v_return,
                settled_at = NOW()
            WHERE id = v_ticket_id;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'settled_count', v_log_count);
END;
$$;