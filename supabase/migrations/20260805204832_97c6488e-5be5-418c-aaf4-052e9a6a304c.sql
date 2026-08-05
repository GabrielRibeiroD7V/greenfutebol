CREATE OR REPLACE FUNCTION public.create_ticket_atomic(p_stake numeric, p_idempotency_key uuid, p_selections jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_ticket_id UUID;
    v_ticket_code TEXT;
    v_total_odd NUMERIC := 1.0;
    v_potential_return NUMERIC;
    v_selection_count INT;
    v_selection RECORD;
    v_db_option RECORD;
    v_existing_ticket_id UUID;
    v_now TIMESTAMPTZ := now();
    v_changed_selections JSONB := '[]'::jsonb;
    v_market_ids UUID[] := '{}';
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;

    SELECT id INTO v_existing_ticket_id
    FROM public.tickets
    WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'ticket_id', v_existing_ticket_id,
            'is_duplicate', true
        );
    END IF;

    v_selection_count := jsonb_array_length(p_selections);
    IF v_selection_count < 1 OR v_selection_count > 20 THEN
        RAISE EXCEPTION 'Invalid selection count' USING ERRCODE = '23514';
    END IF;

    IF p_stake < 5 OR p_stake > 5000 THEN
        RAISE EXCEPTION 'Invalid stake' USING ERRCODE = '23514';
    END IF;

    FOR v_selection IN SELECT * FROM jsonb_to_recordset(p_selections) AS x(option_id UUID, expected_odd NUMERIC)
    LOOP
        SELECT 
            fmo.*,
            fm.id as fixture_market_id,
            fm.status AS market_status,
            fm.fixture_id,
            mt.code AS market_type_code,
            mt.name AS market_name,
            mo.code AS option_code,
            mo.label AS option_label,
            mo.parameter AS option_parameter,
            fixture_lookup.kickoff_at,
            fixture_lookup.home_team_name,
            fixture_lookup.away_team_name
        INTO v_db_option
        FROM public.fixture_market_options fmo
        JOIN public.fixture_markets fm ON fm.id = fmo.fixture_market_id
        JOIN public.market_types mt ON mt.id = fm.market_type_id
        JOIN public.market_options mo ON mo.id = fmo.market_option_id
        CROSS JOIN LATERAL (
            SELECT 
                (f.p->>'kickoff_at')::TIMESTAMPTZ as kickoff_at,
                (f.p->>'home_team_name') as home_team_name,
                (f.p->>'away_team_name') as away_team_name
            FROM public.football_fixtures_cache f_cache,
            jsonb_array_elements(f_cache.payload->'fixtures') f(p)
            WHERE (f.p->>'fixture_id')::int = fm.fixture_id
            LIMIT 1
        ) AS fixture_lookup
        WHERE fmo.id = v_selection.option_id
        FOR SHARE OF fmo;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Option not found: %', v_selection.option_id;
        END IF;

        -- Incompatibility check: Only one selection per fixture_market_id
        IF v_db_option.fixture_market_id = ANY(v_market_ids) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'INCOMPATIBLE_SELECTIONS',
                'message', 'Múltiplas seleções do mesmo mercado não são permitidas.'
            );
        END IF;
        v_market_ids := v_market_ids || v_db_option.fixture_market_id;

        IF NOT v_db_option.active OR v_db_option.market_status != 'OPEN' THEN
            RAISE EXCEPTION 'Market or option is suspended: %', v_db_option.option_label USING ERRCODE = 'P0001';
        END IF;

        IF v_db_option.kickoff_at <= v_now THEN
            RAISE EXCEPTION 'Match already started: % x %', v_db_option.home_team_name, v_db_option.away_team_name USING ERRCODE = 'P0002';
        END IF;

        IF abs(v_db_option.odd - v_selection.expected_odd) > 0.0001 THEN
            v_changed_selections := v_changed_selections || jsonb_build_object(
                'option_id', v_db_option.id,
                'old_odd', v_selection.expected_odd,
                'current_odd', v_db_option.odd,
                'label', v_db_option.option_label
            );
        END IF;

        v_total_odd := v_total_odd * v_db_option.odd;
    END LOOP;

    IF jsonb_array_length(v_changed_selections) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ODDS_CHANGED',
            'changed_selections', v_changed_selections
        );
    END IF;

    v_total_odd := round(v_total_odd, 4);
    v_potential_return := round(p_stake * v_total_odd, 2);

    v_ticket_code := 'GF-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    
    INSERT INTO public.tickets (
        user_id,
        code,
        stake,
        total_odd,
        potential_return,
        status,
        selection_count,
        idempotency_key
    ) VALUES (
        v_user_id,
        v_ticket_code,
        p_stake,
        v_total_odd,
        v_potential_return,
        'PENDING',
        v_selection_count,
        p_idempotency_key
    ) RETURNING id INTO v_ticket_id;

    FOR v_selection IN SELECT * FROM jsonb_to_recordset(p_selections) AS x(option_id UUID, expected_odd NUMERIC)
    LOOP
        INSERT INTO public.ticket_selections (
            ticket_id,
            fixture_market_option_id,
            odd_at_bet,
            market_snapshot,
            option_snapshot
        )
        SELECT 
            v_ticket_id,
            fmo.id,
            fmo.odd,
            jsonb_build_object(
                'market_type_name', mt.name,
                'market_type_code', mt.code,
                'category', mt.category
            ),
            jsonb_build_object(
                'label', mo.label,
                'code', mo.code,
                'parameter', mo.parameter,
                'side', mo.side
            )
        FROM public.fixture_market_options fmo
        JOIN public.fixture_markets fm ON fm.id = fmo.fixture_market_id
        JOIN public.market_types mt ON mt.id = fm.market_type_id
        JOIN public.market_options mo ON mo.id = fmo.market_option_id
        WHERE fmo.id = v_selection.option_id;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'ticket_id', v_ticket_id,
        'ticket_code', v_ticket_code
    );
END;
$function$
;