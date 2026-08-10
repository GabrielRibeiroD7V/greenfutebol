DO $$
DECLARE
    v_fixture_id INTEGER := 554954;
    v_kickoff TIMESTAMP WITH TIME ZONE := '2026-08-09 14:00:00+00';
    v_home TEXT := 'Cruzeiro EC';
    v_away TEXT := 'Mirassol FC';
    v_comp_code TEXT := '2013';

    v_market_id UUID;
BEGIN
    -- 1. RESULTADO FINAL
    INSERT INTO public.fixture_markets (fixture_id, competition_code, market_type, market_name, market_group, status, kickoff_at, home_team, away_team, period)
    VALUES (v_fixture_id, v_comp_code, '1X2', 'Resultado Final', 'RESULT', 'OPEN', v_kickoff, v_home, v_away, 'FULL_TIME')
    RETURNING id INTO v_market_id;

    INSERT INTO public.fixture_market_selections (market_id, selection_key, selection_name, odd, sort_order, status)
    VALUES
        (v_market_id, 'H', 'Casa', 1.80, 0, 'OPEN'),
        (v_market_id, 'D', 'Empate', 3.40, 1, 'OPEN'),
        (v_market_id, 'A', 'Visitante', 4.20, 2, 'OPEN');

    -- Over/Under 1.5
    INSERT INTO public.fixture_markets (fixture_id, competition_code, market_type, market_name, market_group, line, status, kickoff_at, home_team, away_team, period)
    VALUES (v_fixture_id, v_comp_code, 'OU', 'Total de Gols', 'GOALS', 1.5, 'OPEN', v_kickoff, v_home, v_away, 'FULL_TIME')
    RETURNING id INTO v_market_id;
    INSERT INTO public.fixture_market_selections (market_id, selection_key, selection_name, odd, sort_order, status, metadata)
    VALUES
        (v_market_id, 'OVER_1.5', 'Over 1.5', 1.30, 0, 'OPEN', '{"line": 1.5, "type": "OVER"}'),
        (v_market_id, 'UNDER_1.5', 'Under 1.5', 3.40, 1, 'OPEN', '{"line": 1.5, "type": "UNDER"}');

    -- Over/Under 2.5
    INSERT INTO public.fixture_markets (fixture_id, competition_code, market_type, market_name, market_group, line, status, kickoff_at, home_team, away_team, period)
    VALUES (v_fixture_id, v_comp_code, 'OU', 'Total de Gols', 'GOALS', 2.5, 'OPEN', v_kickoff, v_home, v_away, 'FULL_TIME')
    RETURNING id INTO v_market_id;
    INSERT INTO public.fixture_market_selections (market_id, selection_key, selection_name, odd, sort_order, status, metadata)
    VALUES
        (v_market_id, 'OVER_2.5', 'Over 2.5', 1.85, 0, 'OPEN', '{"line": 2.5, "type": "OVER"}'),
        (v_market_id, 'UNDER_2.5', 'Under 2.5', 1.95, 1, 'OPEN', '{"line": 2.5, "type": "UNDER"}');

    -- Over/Under 3.5
    INSERT INTO public.fixture_markets (fixture_id, competition_code, market_type, market_name, market_group, line, status, kickoff_at, home_team, away_team, period)
    VALUES (v_fixture_id, v_comp_code, 'OU', 'Total de Gols', 'GOALS', 3.5, 'OPEN', v_kickoff, v_home, v_away, 'FULL_TIME')
    RETURNING id INTO v_market_id;
    INSERT INTO public.fixture_market_selections (market_id, selection_key, selection_name, odd, sort_order, status, metadata)
    VALUES
        (v_market_id, 'OVER_3.5', 'Over 3.5', 2.70, 0, 'OPEN', '{"line": 3.5, "type": "OVER"}'),
        (v_market_id, 'UNDER_3.5', 'Under 3.5', 1.45, 1, 'OPEN', '{"line": 3.5, "type": "UNDER"}');

    -- 3. AMBAS MARCAM
    INSERT INTO public.fixture_markets (fixture_id, competition_code, market_type, market_name, market_group, status, kickoff_at, home_team, away_team, period)
    VALUES (v_fixture_id, v_comp_code, 'BTTS', 'Ambas Marcam', 'GOALS', 'OPEN', v_kickoff, v_home, v_away, 'FULL_TIME')
    RETURNING id INTO v_market_id;
    INSERT INTO public.fixture_market_selections (market_id, selection_key, selection_name, odd, sort_order, status)
    VALUES
        (v_market_id, 'YES', 'Sim', 1.75, 0, 'OPEN'),
        (v_market_id, 'NO', 'Não', 2.00, 1, 'OPEN');

    -- 4. PLACAR EXATO
    INSERT INTO public.fixture_markets (fixture_id, competition_code, market_type, market_name, market_group, status, kickoff_at, home_team, away_team, period)
    VALUES (v_fixture_id, v_comp_code, 'CS', 'Placar Exato', 'SCORE', 'OPEN', v_kickoff, v_home, v_away, 'FULL_TIME')
    RETURNING id INTO v_market_id;
    INSERT INTO public.fixture_market_selections (market_id, selection_key, selection_name, odd, sort_order, status, metadata)
    VALUES
        (v_market_id, '0:0', '0x0', 9.00, 0, 'OPEN', '{"home_score": 0, "away_score": 0}'),
        (v_market_id, '1:0', '1x0', 7.50, 1, 'OPEN', '{"home_score": 1, "away_score": 0}'),
        (v_market_id, '0:1', '0x1', 8.50, 2, 'OPEN', '{"home_score": 0, "away_score": 1}'),
        (v_market_id, '1:1', '1x1', 6.00, 3, 'OPEN', '{"home_score": 1, "away_score": 1}'),
        (v_market_id, '2:0', '2x0', 9.50, 4, 'OPEN', '{"home_score": 2, "away_score": 0}'),
        (v_market_id, '0:2', '0x2', 11.00, 5, 'OPEN', '{"home_score": 0, "away_score": 2}'),
        (v_market_id, '2:1', '2x1', 8.00, 6, 'OPEN', '{"home_score": 2, "away_score": 1}'),
        (v_market_id, '1:2', '1x2', 9.00, 7, 'OPEN', '{"home_score": 1, "away_score": 2}'),
        (v_market_id, '2:2', '2x2', 12.00, 8, 'OPEN', '{"home_score": 2, "away_score": 2}');

    -- 5. TOTAL DE ESCANTEIOS
    -- Over/Under 8.5
    INSERT INTO public.fixture_markets (fixture_id, competition_code, market_type, market_name, market_group, line, status, kickoff_at, home_team, away_team, period)
    VALUES (v_fixture_id, v_comp_code, 'CORNERS', 'Escanteios', 'CORNERS', 8.5, 'OPEN', v_kickoff, v_home, v_away, 'FULL_TIME')
    RETURNING id INTO v_market_id;
    INSERT INTO public.fixture_market_selections (market_id, selection_key, selection_name, odd, sort_order, status, metadata)
    VALUES
        (v_market_id, 'OVER_8.5', 'Over 8.5', 1.70, 0, 'OPEN', '{"line": 8.5, "type": "OVER"}'),
        (v_market_id, 'UNDER_8.5', 'Under 8.5', 2.10, 1, 'OPEN', '{"line": 8.5, "type": "UNDER"}');

    -- Over/Under 9.5
    INSERT INTO public.fixture_markets (fixture_id, competition_code, market_type, market_name, market_group, line, status, kickoff_at, home_team, away_team, period)
    VALUES (v_fixture_id, v_comp_code, 'CORNERS', 'Escanteios', 'CORNERS', 9.5, 'OPEN', v_kickoff, v_home, v_away, 'FULL_TIME')
    RETURNING id INTO v_market_id;
    INSERT INTO public.fixture_market_selections (market_id, selection_key, selection_name, odd, sort_order, status, metadata)
    VALUES
        (v_market_id, 'OVER_9.5', 'Over 9.5', 1.95, 0, 'OPEN', '{"line": 9.5, "type": "OVER"}'),
        (v_market_id, 'UNDER_9.5', 'Under 9.5', 1.85, 1, 'OPEN', '{"line": 9.5, "type": "UNDER"}');

    -- Over/Under 10.5
    INSERT INTO public.fixture_markets (fixture_id, competition_code, market_type, market_name, market_group, line, status, kickoff_at, home_team, away_team, period)
    VALUES (v_fixture_id, v_comp_code, 'CORNERS', 'Escanteios', 'CORNERS', 10.5, 'OPEN', v_kickoff, v_home, v_away, 'FULL_TIME')
    RETURNING id INTO v_market_id;
    INSERT INTO public.fixture_market_selections (market_id, selection_key, selection_name, odd, sort_order, status, metadata)
    VALUES
        (v_market_id, 'OVER_10.5', 'Over 10.5', 2.20, 0, 'OPEN', '{"line": 10.5, "type": "OVER"}'),
        (v_market_id, 'UNDER_10.5', 'Under 10.5', 1.65, 1, 'OPEN', '{"line": 10.5, "type": "UNDER"}');

END $$;