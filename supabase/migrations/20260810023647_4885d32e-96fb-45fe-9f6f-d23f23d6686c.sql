-- 1. Prevent privilege escalation via profiles UPDATE
DROP POLICY IF EXISTS "Users can update own name" ON public.profiles;
CREATE POLICY "Users can update own name"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.phone IS DISTINCT FROM OLD.phone OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Alteração de role/telefone não permitida' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_privilege_change ON public.profiles;
CREATE TRIGGER profiles_prevent_privilege_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_change();

-- 2. Fix mutable search_path on trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 3. Trigger functions must not be callable via the API
REVOKE ALL ON FUNCTION public.handle_updated_at() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_profile_privilege_change() FROM anon, authenticated;

-- 4. Remove anonymous execute on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.acquire_payment_lock(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.add_fixture_market_from_template(bigint, text, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.create_ticket_atomic(numeric, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.get_admin_tickets_summary(timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.prepare_fixture_markets(bigint) FROM anon;
REVOKE ALL ON FUNCTION public.prepare_fixture_markets_batch(bigint[]) FROM anon;
REVOKE ALL ON FUNCTION public.preview_fixture_settlement(integer) FROM anon;
REVOKE ALL ON FUNCTION public.settle_fixture_atomic(bigint, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.settle_fixture_atomic(integer) FROM anon;
REVOKE ALL ON FUNCTION public.transition_fixture_market(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.update_market_selection_odd(uuid, numeric) FROM anon;

-- 5. Admin-only definer functions: enforce role checks in-function
CREATE OR REPLACE FUNCTION public.get_admin_tickets_summary(_since timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today_count bigint;
  v_today_stake numeric;
  v_pending_count bigint;
  v_won_count bigint;
  v_lost_count bigint;
  v_potential_return numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT count(*), coalesce(sum(stake), 0)
    INTO v_today_count, v_today_stake
    FROM public.tickets
    WHERE created_at >= _since;

  SELECT 
    count(*) FILTER (WHERE status = 'CONFIRMED'),
    count(*) FILTER (WHERE status = 'WON'),
    count(*) FILTER (WHERE status = 'LOST'),
    coalesce(sum(potential_return) FILTER (WHERE status = 'CONFIRMED'), 0)
  INTO v_pending_count, v_won_count, v_lost_count, v_potential_return
  FROM public.tickets;

  RETURN jsonb_build_object(
    'todayCount', v_today_count,
    'todayStake', v_today_stake,
    'pendingCount', v_pending_count,
    'wonCount', v_won_count,
    'lostCount', v_lost_count,
    'potentialExposure', v_potential_return
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.preview_fixture_settlement(p_fixture_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result RECORD;
    v_selections_summary JSONB;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_result FROM public.fixture_results WHERE fixture_id = p_fixture_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Fixture result not found');
    END IF;

    SELECT jsonb_agg(jsonb_build_object(
        'selection_id', ts.id,
        'market', ts.market_name_snapshot,
        'option', ts.option_label_snapshot,
        'current_status', ts.status,
        'potential_status', 'WON'
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
$function$;

CREATE OR REPLACE FUNCTION public.prepare_fixture_markets_batch(p_fixture_ids bigint[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_fixture_id bigint;
    v_market_id uuid;
    v_fixture record;
    v_count int := 0;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
    END IF;

    FOREACH v_fixture_id IN ARRAY p_fixture_ids LOOP
        SELECT * INTO v_fixture FROM public.fixtures WHERE provider_fixture_id = v_fixture_id;
        IF NOT FOUND THEN CONTINUE; END IF;

        INSERT INTO public.fixture_markets (
            fixture_id, competition_code, market_type, market_name, market_group, status, 
            kickoff_at, home_team, away_team
        )
        VALUES (
            v_fixture_id, v_fixture.competition_code, '1X2', 'Resultado Final', 'Resultado Final', 'DRAFT',
            v_fixture.kickoff_at, v_fixture.home_team_name, v_fixture.away_team_name
        )
        ON CONFLICT (fixture_id, market_type, COALESCE(line, 0)) DO NOTHING
        RETURNING id INTO v_market_id;

        IF v_market_id IS NOT NULL THEN
            INSERT INTO public.fixture_market_selections (market_id, selection_key, selection_name, odd, status, sort_order)
            VALUES 
                (v_market_id, '1', v_fixture.home_team_name, 0, 'DRAFT', 1),
                (v_market_id, 'X', 'Empate', 0, 'DRAFT', 2),
                (v_market_id, '2', v_fixture.away_team_name, 0, 'DRAFT', 3)
            ON CONFLICT DO NOTHING;
            v_count := v_count + 1;
        END IF;

        INSERT INTO public.fixture_markets (
            fixture_id, competition_code, market_type, market_name, market_group, status, 
            kickoff_at, home_team, away_team
        )
        VALUES (
            v_fixture_id, v_fixture.competition_code, 'DC', 'Dupla Chance', 'Dupla Chance', 'DRAFT',
            v_fixture.kickoff_at, v_fixture.home_team_name, v_fixture.away_team_name
        )
        ON CONFLICT (fixture_id, market_type, COALESCE(line, 0)) DO NOTHING
        RETURNING id INTO v_market_id;

        IF v_market_id IS NOT NULL THEN
            INSERT INTO public.fixture_market_selections (market_id, selection_key, selection_name, odd, status, sort_order)
            VALUES 
                (v_market_id, '1X', 'Casa ou Empate', 0, 'DRAFT', 1),
                (v_market_id, '12', 'Casa ou Fora', 0, 'DRAFT', 2),
                (v_market_id, 'X2', 'Empate ou Fora', 0, 'DRAFT', 3)
            ON CONFLICT DO NOTHING;
        END IF;

        INSERT INTO public.fixture_markets (
            fixture_id, competition_code, market_type, market_name, market_group, status, 
            kickoff_at, home_team, away_team
        )
        VALUES (
            v_fixture_id, v_fixture.competition_code, 'BTTS', 'Ambas Marcam', 'Gols', 'DRAFT',
            v_fixture.kickoff_at, v_fixture.home_team_name, v_fixture.away_team_name
        )
        ON CONFLICT (fixture_id, market_type, COALESCE(line, 0)) DO NOTHING
        RETURNING id INTO v_market_id;

        IF v_market_id IS NOT NULL THEN
            INSERT INTO public.fixture_market_selections (market_id, selection_key, selection_name, odd, status, sort_order)
            VALUES 
                (v_market_id, 'YES', 'Sim', 0, 'DRAFT', 1),
                (v_market_id, 'NO', 'Não', 0, 'DRAFT', 2)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'markets_created', v_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_fixture_atomic(_fixture_id bigint, _admin_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_res FROM public.fixture_results WHERE fixture_id = _fixture_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Result not found for fixture');
    END IF;

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

            WHEN 'DC' THEN
                IF v_sel.selection_key = '1X' THEN
                    v_new_sel_status := CASE WHEN v_res.home_score >= v_res.away_score THEN 'WON' ELSE 'LOST' END;
                ELSIF v_sel.selection_key = '12' THEN
                    v_new_sel_status := CASE WHEN v_res.home_score <> v_res.away_score THEN 'WON' ELSE 'LOST' END;
                ELSIF v_sel.selection_key = 'X2' THEN
                    v_new_sel_status := CASE WHEN v_res.away_score >= v_res.home_score THEN 'WON' ELSE 'LOST' END;
                END IF;

            WHEN 'DNB' THEN
                IF v_res.home_score = v_res.away_score THEN
                    v_new_sel_status := 'VOID';
                ELSIF v_res.home_score > v_res.away_score THEN
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'H' THEN 'WON' ELSE 'LOST' END;
                ELSE
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'A' THEN 'WON' ELSE 'LOST' END;
                END IF;

            WHEN 'OU' THEN
                IF (v_res.home_score + v_res.away_score) > v_sel.line THEN
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'OVER' THEN 'WON' ELSE 'LOST' END;
                ELSIF (v_res.home_score + v_res.away_score) < v_sel.line THEN
                    v_new_sel_status := CASE WHEN v_sel.selection_key = 'UNDER' THEN 'WON' ELSE 'LOST' END;
                ELSE
                    v_new_sel_status := 'VOID';
                END IF;

            WHEN 'BTTS' THEN
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
            VALUES (_fixture_id, v_sel.ticket_id, v_sel.id, 'PENDING', v_new_sel_status, row_to_json(v_res)::jsonb, COALESCE(_admin_id, auth.uid()), 'settle_fixture_atomic_v2');
            
            v_log_count := v_log_count + 1;
        END IF;
    END LOOP;

    FOR v_ticket_id IN 
        SELECT DISTINCT ts.ticket_id 
        FROM public.ticket_selections ts
        JOIN public.fixture_markets fm ON ts.fixture_market_id = fm.id
        WHERE fm.fixture_id = _fixture_id
    LOOP
        v_any_lost := EXISTS (SELECT 1 FROM public.ticket_selections WHERE ticket_id = v_ticket_id AND status = 'LOST');
        
        IF v_any_lost THEN
            v_final_status := 'LOST';
            v_total_odd := 0;
            v_return := 0;
        ELSE
            v_any_pending := EXISTS (SELECT 1 FROM public.ticket_selections WHERE ticket_id = v_ticket_id AND status = 'PENDING');
            
            IF v_any_pending THEN
                CONTINUE;
            END IF;

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
$function$;

REVOKE ALL ON FUNCTION public.get_admin_tickets_summary(timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.preview_fixture_settlement(integer) FROM anon;
REVOKE ALL ON FUNCTION public.prepare_fixture_markets_batch(bigint[]) FROM anon;
REVOKE ALL ON FUNCTION public.settle_fixture_atomic(bigint, uuid) FROM anon;