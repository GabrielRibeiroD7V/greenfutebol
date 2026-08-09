DO $$
DECLARE
    v_fixture_id BIGINT := 567257;
    v_market_id UUID;
BEGIN
    -- Resultado Final
    INSERT INTO public.fixture_markets (fixture_id, competition_code, market_type, market_name, market_group, status)
    VALUES (v_fixture_id, 'PPL', '1X2', 'Resultado Final', 'RESULT', 'DRAFT')
    RETURNING id INTO v_market_id;

    INSERT INTO public.fixture_market_selections (market_id, selection_key, selection_name, odd, sort_order, status)
    VALUES 
        (v_market_id, 'H', 'Casa', NULL, 0, 'DRAFT'),
        (v_market_id, 'D', 'Empate', NULL, 1, 'DRAFT'),
        (v_market_id, 'A', 'Fora', NULL, 2, 'DRAFT');

    -- Total de Gols 2.5
    INSERT INTO public.fixture_markets (fixture_id, competition_code, market_type, market_name, market_group, line, status)
    VALUES (v_fixture_id, 'PPL', 'OU', 'Total de Gols', 'GOALS', 2.5, 'DRAFT')
    RETURNING id INTO v_market_id;

    INSERT INTO public.fixture_market_selections (market_id, selection_key, selection_name, odd, sort_order, status)
    VALUES 
        (v_market_id, 'OVER', 'Mais de 2.5', NULL, 0, 'DRAFT'),
        (v_market_id, 'UNDER', 'Menos de 2.5', NULL, 1, 'DRAFT');
END $$;