CREATE OR REPLACE FUNCTION public.prepare_fixture_markets(p_fixture_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fixture public.fixtures%ROWTYPE;
  v_market_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_fixture
  FROM public.fixtures
  WHERE provider_fixture_id = p_fixture_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIXTURE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_fixture.kickoff_at <= now() OR v_fixture.status <> 'NS' THEN
    RAISE EXCEPTION 'FIXTURE_NOT_ELIGIBLE' USING ERRCODE = 'P0002';
  END IF;

  SELECT id INTO v_market_id
  FROM public.fixture_markets
  WHERE fixture_id = p_fixture_id AND market_type = '1X2' AND line IS NULL
  LIMIT 1;

  IF v_market_id IS NULL THEN
    INSERT INTO public.fixture_markets (
      fixture_id, competition_code, market_type, market_name, market_group,
      line, period, status, kickoff_at, home_team, away_team
    ) VALUES (
      p_fixture_id, v_fixture.competition_code, '1X2', 'Resultado Final', 'RESULT',
      NULL, 'FULL_TIME', 'DRAFT', v_fixture.kickoff_at,
      v_fixture.home_team_name, v_fixture.away_team_name
    ) RETURNING id INTO v_market_id;
  ELSE
    UPDATE public.fixture_markets
    SET competition_code = v_fixture.competition_code,
        kickoff_at = v_fixture.kickoff_at,
        home_team = v_fixture.home_team_name,
        away_team = v_fixture.away_team_name,
        updated_at = now()
    WHERE id = v_market_id;
  END IF;

  INSERT INTO public.fixture_market_selections (
    market_id, selection_key, selection_name, odd, status, sort_order
  ) VALUES
    (v_market_id, 'H', 'Casa', NULL, 'DRAFT', 0),
    (v_market_id, 'D', 'Empate', NULL, 'DRAFT', 1),
    (v_market_id, 'A', 'Fora', NULL, 'DRAFT', 2)
  ON CONFLICT (market_id, selection_key) DO NOTHING;

  v_market_id := NULL;
  SELECT id INTO v_market_id
  FROM public.fixture_markets
  WHERE fixture_id = p_fixture_id AND market_type = 'OU' AND line = 2.5
  LIMIT 1;

  IF v_market_id IS NULL THEN
    INSERT INTO public.fixture_markets (
      fixture_id, competition_code, market_type, market_name, market_group,
      line, period, status, kickoff_at, home_team, away_team
    ) VALUES (
      p_fixture_id, v_fixture.competition_code, 'OU', 'Total de Gols', 'GOALS',
      2.5, 'FULL_TIME', 'DRAFT', v_fixture.kickoff_at,
      v_fixture.home_team_name, v_fixture.away_team_name
    ) RETURNING id INTO v_market_id;
  ELSE
    UPDATE public.fixture_markets
    SET competition_code = v_fixture.competition_code,
        kickoff_at = v_fixture.kickoff_at,
        home_team = v_fixture.home_team_name,
        away_team = v_fixture.away_team_name,
        updated_at = now()
    WHERE id = v_market_id;
  END IF;

  INSERT INTO public.fixture_market_selections (
    market_id, selection_key, selection_name, odd, status, sort_order, metadata
  ) VALUES
    (v_market_id, 'OVER', 'Mais de 2.5', NULL, 'DRAFT', 0, '{"line":2.5,"type":"OVER"}'::jsonb),
    (v_market_id, 'UNDER', 'Menos de 2.5', NULL, 'DRAFT', 1, '{"line":2.5,"type":"UNDER"}'::jsonb)
  ON CONFLICT (market_id, selection_key) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'fixture_id', p_fixture_id,
    'market_count', (SELECT count(*) FROM public.fixture_markets WHERE fixture_id = p_fixture_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_market_selection_odd(
  p_selection_id uuid,
  p_odd numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_market_status text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT fm.status INTO v_market_status
  FROM public.fixture_market_selections fms
  JOIN public.fixture_markets fm ON fm.id = fms.market_id
  WHERE fms.id = p_selection_id
  FOR UPDATE OF fms;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SELECTION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_market_status NOT IN ('DRAFT', 'SUSPENDED') THEN
    RAISE EXCEPTION 'MARKET_NOT_EDITABLE' USING ERRCODE = 'P0001';
  END IF;

  IF p_odd IS NOT NULL AND p_odd <= 1.00 THEN
    RAISE EXCEPTION 'INVALID_ODD' USING ERRCODE = '23514';
  END IF;

  UPDATE public.fixture_market_selections
  SET odd = p_odd, updated_at = now()
  WHERE id = p_selection_id;

  RETURN jsonb_build_object('success', true, 'selection_id', p_selection_id, 'odd', p_odd);
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_fixture_market(
  p_market_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_market public.fixture_markets%ROWTYPE;
  v_invalid_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_market
  FROM public.fixture_markets
  WHERE id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MARKET_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF p_status = 'OPEN' THEN
    IF v_market.status NOT IN ('DRAFT', 'SUSPENDED') THEN
      RAISE EXCEPTION 'INVALID_MARKET_TRANSITION' USING ERRCODE = 'P0001';
    END IF;

    IF COALESCE(v_market.kickoff_at, now()) <= now() THEN
      RAISE EXCEPTION 'FIXTURE_ALREADY_STARTED' USING ERRCODE = 'P0002';
    END IF;

    SELECT count(*) INTO v_invalid_count
    FROM public.fixture_market_selections
    WHERE market_id = p_market_id AND (odd IS NULL OR odd <= 1.00);

    IF NOT EXISTS (SELECT 1 FROM public.fixture_market_selections WHERE market_id = p_market_id)
       OR v_invalid_count > 0 THEN
      RAISE EXCEPTION 'MARKET_NOT_PRICED' USING ERRCODE = '23514';
    END IF;

    UPDATE public.fixture_markets SET status = 'OPEN', updated_at = now() WHERE id = p_market_id;
    UPDATE public.fixture_market_selections SET status = 'OPEN', updated_at = now() WHERE market_id = p_market_id;
  ELSIF p_status = 'SUSPENDED' THEN
    IF v_market.status <> 'OPEN' THEN
      RAISE EXCEPTION 'INVALID_MARKET_TRANSITION' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.fixture_markets SET status = 'SUSPENDED', updated_at = now() WHERE id = p_market_id;
    UPDATE public.fixture_market_selections SET status = 'SUSPENDED', updated_at = now() WHERE market_id = p_market_id;
  ELSE
    RAISE EXCEPTION 'INVALID_TARGET_STATUS' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object('success', true, 'market_id', p_market_id, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_fixture_markets(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_market_selection_odd(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_fixture_market(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_fixture_markets(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_market_selection_odd(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_fixture_market(uuid, text) TO authenticated;
