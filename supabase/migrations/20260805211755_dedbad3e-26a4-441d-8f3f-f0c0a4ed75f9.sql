-- GreenFutebol Phase 2A: Settlement Engine Infrastructure

-- 1. Create fixture_results table
CREATE TABLE public.fixture_results (
    fixture_id integer PRIMARY KEY,
    status text NOT NULL, -- SCHEDULED, LIVE, FINISHED, POSTPONED, CANCELLED, ABANDONED, SUSPENDED
    home_score integer,
    away_score integer,
    first_half_home_score integer,
    first_half_away_score integer,
    home_corners integer,
    away_corners integer,
    home_cards integer,
    away_cards integer,
    result_source text,
    source_updated_at timestamptz,
    confirmed_at timestamptz,
    confirmed_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.fixture_results TO authenticated;
GRANT ALL ON public.fixture_results TO service_role;

ALTER TABLE public.fixture_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fixture results" ON public.fixture_results
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view fixture results" ON public.fixture_results
    FOR SELECT TO authenticated USING (true);

-- 2. Create settlement_audit_logs table
CREATE TABLE public.settlement_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_id integer REFERENCES public.fixture_results(fixture_id),
    ticket_id uuid REFERENCES public.tickets(id),
    ticket_selection_id uuid REFERENCES public.ticket_selections(id),
    previous_status text,
    new_status text,
    previous_result jsonb,
    new_result jsonb,
    reason text,
    admin_user_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT ON public.settlement_audit_logs TO authenticated;
GRANT ALL ON public.settlement_audit_logs TO service_role;

ALTER TABLE public.settlement_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view and insert audit logs" ON public.settlement_audit_logs
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. Update ticket_selections table with settlement fields
ALTER TABLE public.ticket_selections 
    ADD COLUMN settlement_value numeric,
    ADD COLUMN settlement_reason text,
    ADD COLUMN settlement_rule_version integer DEFAULT 1,
    ADD COLUMN settled_at timestamptz,
    ADD COLUMN settled_by uuid REFERENCES auth.users(id),
    ADD COLUMN fixture_result_version integer;

-- 4. Update tickets table with settled values
ALTER TABLE public.tickets
    ADD COLUMN settled_total_odd numeric,
    ADD COLUMN settled_return numeric,
    ADD COLUMN settled_at timestamptz;

-- 5. Preview Settlement Function
CREATE OR REPLACE FUNCTION public.preview_fixture_settlement(p_fixture_id integer)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result RECORD;
    v_selections_summary JSONB;
BEGIN
    -- This function only calculates and returns what WOULD happen
    SELECT * INTO v_result FROM public.fixture_results WHERE fixture_id = p_fixture_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Fixture result not found');
    END IF;

    -- Aggregate selections that would be affected
    SELECT jsonb_agg(jsonb_build_object(
        'selection_id', ts.id,
        'market', ts.market_name_snapshot,
        'option', ts.option_label_snapshot,
        'current_status', ts.status,
        'potential_status', 'WON' -- Logic to be implemented in settle_fixture_atomic helper
    )) INTO v_selections_summary
    FROM public.ticket_selections ts
    JOIN public.fixture_market_options fmo ON fmo.id = ts.fixture_market_option_id
    JOIN public.fixture_markets fm ON fm.id = fmo.fixture_market_id
    WHERE fm.fixture_id = p_fixture_id AND ts.status = 'PENDING';

    RETURN jsonb_build_object(
        'fixture_id', p_fixture_id,
        'home_score', v_result.home_score,
        'away_score', v_result.away_score,
        'affected_selections', COALESCE(v_selections_summary, '[]'::jsonb)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_fixture_settlement(integer) TO authenticated;

-- 6. Settlement Engine RPC (Core logic)
CREATE OR REPLACE FUNCTION public.settle_fixture_atomic(p_fixture_id integer)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id uuid;
    v_result RECORD;
    v_selection RECORD;
    v_ticket_id uuid;
    v_all_selections_settled boolean;
    v_any_lost boolean;
    v_any_won boolean;
    v_any_pending boolean;
    v_effective_odd numeric;
    v_ticket_status text;
    v_settled_count integer := 0;
BEGIN
    v_admin_id := auth.uid();
    IF NOT public.has_role(v_admin_id, 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_result FROM public.fixture_results WHERE fixture_id = p_fixture_id FOR UPDATE;
    IF NOT FOUND OR v_result.status != 'FINISHED' OR v_result.confirmed_at IS NULL THEN
        RAISE EXCEPTION 'Fixture not ready for settlement. Status: %, Confirmed: %', COALESCE(v_result.status, 'NULL'), v_result.confirmed_at;
    END IF;

    -- 1. Liquidate Selections
    FOR v_selection IN 
        SELECT ts.id, ts.ticket_id, ts.odd_snapshot, ts.status, 
               mt.code as market_code, mo.code as option_code, mo.parameter
        FROM public.ticket_selections ts
        JOIN public.fixture_market_options fmo ON fmo.id = ts.fixture_market_option_id
        JOIN public.fixture_markets fm ON fm.id = fmo.fixture_market_id
        JOIN public.market_types mt ON mt.id = fm.market_type_id
        JOIN public.market_options mo ON mo.id = fmo.market_option_id
        WHERE fm.fixture_id = p_fixture_id AND ts.status = 'PENDING'
        FOR UPDATE
    LOOP
        DECLARE
            v_new_status text := 'LOST';
            v_reason text := 'Result: ' || v_result.home_score || '-' || v_result.away_score;
        BEGIN
            -- Logic for each market type
            IF v_selection.market_code = 'RESULT' THEN
                IF (v_selection.option_code = 'HOME' AND v_result.home_score > v_result.away_score) OR
                   (v_selection.option_code = 'DRAW' AND v_result.home_score = v_result.away_score) OR
                   (v_selection.option_code = 'AWAY' AND v_result.home_score < v_result.away_score) THEN
                    v_new_status := 'WON';
                END IF;
            
            ELSIF v_selection.market_code = 'DOUBLE_CHANCE' THEN
                IF (v_selection.option_code = 'HOME_OR_DRAW' AND v_result.home_score >= v_result.away_score) OR
                   (v_selection.option_code = 'HOME_OR_AWAY' AND v_result.home_score != v_result.away_score) OR
                   (v_selection.option_code = 'DRAW_OR_AWAY' AND v_result.home_score <= v_result.away_score) THEN
                    v_new_status := 'WON';
                END IF;

            ELSIF v_selection.market_code = 'DRAW_NO_BET' THEN
                IF v_result.home_score = v_result.away_score THEN
                    v_new_status := 'VOID';
                ELSIF (v_selection.option_code = 'HOME' AND v_result.home_score > v_result.away_score) OR
                      (v_selection.option_code = 'AWAY' AND v_result.home_score < v_result.away_score) THEN
                    v_new_status := 'WON';
                END IF;

            ELSIF v_selection.market_code = 'TOTAL_GOALS' THEN
                IF (v_selection.option_code = 'OVER' AND (v_result.home_score + v_result.away_score) > v_selection.parameter) OR
                   (v_selection.option_code = 'UNDER' AND (v_result.home_score + v_result.away_score) < v_selection.parameter) THEN
                    v_new_status := 'WON';
                END IF;

            ELSIF v_selection.market_code = 'BOTH_TEAMS_TO_SCORE' THEN
                IF (v_selection.option_code = 'YES' AND v_result.home_score > 0 AND v_result.away_score > 0) OR
                   (v_selection.option_code = 'NO' AND (v_result.home_score = 0 OR v_result.away_score = 0)) THEN
                    v_new_status := 'WON';
                END IF;

            ELSIF v_selection.market_code = 'FIRST_HALF_RESULT' THEN
                IF (v_selection.option_code = 'HOME' AND v_result.first_half_home_score > v_result.first_half_away_score) OR
                   (v_selection.option_code = 'DRAW' AND v_result.first_half_home_score = v_result.first_half_away_score) OR
                   (v_selection.option_code = 'AWAY' AND v_result.first_half_home_score < v_result.first_half_away_score) THEN
                    v_new_status := 'WON';
                END IF;

            ELSIF v_selection.market_code = 'FIRST_HALF_TOTAL_GOALS' THEN
                IF (v_selection.option_code = 'OVER' AND (v_result.first_half_home_score + v_result.first_half_away_score) > v_selection.parameter) OR
                   (v_selection.option_code = 'UNDER' AND (v_result.first_half_home_score + v_result.first_half_away_score) < v_selection.parameter) THEN
                    v_new_status := 'WON';
                END IF;

            ELSIF v_selection.market_code = 'TOTAL_CORNERS' THEN
                IF v_result.home_corners IS NULL OR v_result.away_corners IS NULL THEN
                    v_new_status := 'PENDING';
                ELSIF (v_selection.option_code = 'OVER' AND (v_result.home_corners + v_result.away_corners) > v_selection.parameter) OR
                      (v_selection.option_code = 'UNDER' AND (v_result.home_corners + v_result.away_corners) < v_selection.parameter) THEN
                    v_new_status := 'WON';
                END IF;

            ELSIF v_selection.market_code = 'TOTAL_CARDS' THEN
                IF v_result.home_cards IS NULL OR v_result.away_cards IS NULL THEN
                    v_new_status := 'PENDING';
                ELSIF (v_selection.option_code = 'OVER' AND (v_result.home_cards + v_result.away_cards) > v_selection.parameter) OR
                      (v_selection.option_code = 'UNDER' AND (v_result.home_cards + v_result.away_cards) < v_selection.parameter) THEN
                    v_new_status := 'WON';
                END IF;
            END IF;

            IF v_new_status != 'PENDING' THEN
                UPDATE public.ticket_selections SET
                    status = v_new_status,
                    settled_at = now(),
                    settled_by = v_admin_id,
                    settlement_reason = v_reason,
                    fixture_result_version = 1
                WHERE id = v_selection.id;

                INSERT INTO public.settlement_audit_logs (
                    fixture_id, ticket_id, ticket_selection_id, previous_status, new_status, reason, admin_user_id
                ) VALUES (
                    p_fixture_id, v_selection.ticket_id, v_selection.id, v_selection.status, v_new_status, v_reason, v_admin_id
                );
                v_settled_count := v_settled_count + 1;
            END IF;
        END;
    END LOOP;

    -- 2. Recalculate Impacted Tickets
    FOR v_ticket_id IN 
        SELECT DISTINCT ticket_id FROM public.ticket_selections ts
        JOIN public.fixture_market_options fmo ON fmo.id = ts.fixture_market_option_id
        JOIN public.fixture_markets fm ON fm.id = fmo.fixture_market_id
        WHERE fm.fixture_id = p_fixture_id
    LOOP
        SELECT 
            bool_or(status = 'LOST'),
            bool_or(status = 'WON'),
            bool_or(status = 'PENDING'),
            exp(sum(ln(CASE WHEN status = 'VOID' THEN 1.0 ELSE odd_snapshot END)))
        INTO v_any_lost, v_any_won, v_any_pending, v_effective_odd
        FROM public.ticket_selections
        WHERE ticket_id = v_ticket_id;

        IF v_any_lost THEN
            v_ticket_status := 'LOST';
        ELSIF v_any_pending THEN
            v_ticket_status := 'CONFIRMED';
        ELSIF v_any_won THEN
            v_ticket_status := 'WON';
        ELSE
            v_ticket_status := 'VOID';
        END IF;

        UPDATE public.tickets SET
            status = v_ticket_status,
            settled_total_odd = v_effective_odd,
            settled_return = round(stake * v_effective_odd, 2),
            settled_at = now()
        WHERE id = v_ticket_id;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'settled_selections', v_settled_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_fixture_atomic(integer) TO authenticated;
