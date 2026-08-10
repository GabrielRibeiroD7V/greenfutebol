-- 1. Garante que status DRAFT existe e market_type suporta null odds se necessário
-- Nota: Pelo schema atual 'odd' é numeric. Vamos usar status DRAFT no market para bloquear.

-- 2. RPC de Preparação em Lote
CREATE OR REPLACE FUNCTION public.prepare_fixture_markets_batch(p_fixture_ids bigint[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_fixture_id bigint;
    v_market_id uuid;
    v_fixture record;
    v_count int := 0;
BEGIN
    -- Verificação básica de admin (opcional se já validado no middleware/RLS)
    -- IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;

    FOREACH v_fixture_id IN ARRAY p_fixture_ids LOOP
        -- Busca metadados da fixture persistida
        SELECT * INTO v_fixture FROM public.fixtures WHERE provider_fixture_id = v_fixture_id;

        IF NOT FOUND THEN CONTINUE; END IF;

        -- Mercado: Resultado Final (1X2)
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

        -- Mercado: Dupla Chance (DC)
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

        -- Mercado: Ambas Marcam (BTTS)
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
$$;

-- 3. Adiciona UNIQUE constraint necessária para ON CONFLICT no prepare_fixture_markets_batch
-- Nota: Isso assume que market_type + fixture_id + line identifica o mercado
ALTER TABLE public.fixture_markets DROP CONSTRAINT IF EXISTS fixture_markets_unique_identity;
ALTER TABLE public.fixture_markets ADD CONSTRAINT fixture_markets_unique_identity UNIQUE (fixture_id, market_type, line);