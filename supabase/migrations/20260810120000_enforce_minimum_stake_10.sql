-- Definitive stake policy: any cent-preserving monetary value from BRL 10.00.
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_stake_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_stake_check CHECK (stake >= 10);

CREATE OR REPLACE FUNCTION public.create_ticket_atomic(
  p_stake numeric,
  p_idempotency_key uuid,
  p_selections jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_ticket public.tickets;
  v_count int;
  v_distinct int;
  v_matched int;
  v_changes jsonb;
  v_total_odd numeric := 1;
  v_stake numeric;
  v_return numeric;
  v_code text;
  v_type text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'INVALID_SELECTIONS' USING detail = 'idempotency_key obrigatorio';
  END IF;

  -- Idempotencia
  SELECT * INTO v_ticket FROM public.tickets
   WHERE user_id = v_user AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ticket_id', v_ticket.id, 'ticket_code', v_ticket.code,
      'ticket_type', CASE WHEN v_ticket.selection_count = 1 THEN 'SIMPLE' ELSE 'MULTIPLE' END,
      'stake', v_ticket.stake, 'total_odd', v_ticket.total_odd,
      'potential_return', v_ticket.potential_return, 'status', v_ticket.status,
      'payment_status', v_ticket.payment_status, 'payment_mode', v_ticket.payment_mode,
      'is_duplicate', true
    );
  END IF;

  IF p_selections IS NULL OR jsonb_typeof(p_selections) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_SELECTIONS';
  END IF;

  CREATE TEMP TABLE _input (sid uuid, eodd numeric) ON COMMIT DROP;
  INSERT INTO _input
  SELECT (e->>'selection_id')::uuid, (e->>'expected_odd')::numeric
    FROM jsonb_array_elements(p_selections) e;

  SELECT count(*), count(DISTINCT sid) INTO v_count, v_distinct FROM _input;
  IF v_count < 1 OR v_count > 20 THEN
    RAISE EXCEPTION 'INVALID_SELECTIONS';
  END IF;
  IF v_distinct <> v_count THEN
    RAISE EXCEPTION 'DUPLICATE_SELECTIONS' USING detail = 'selection_id duplicado';
  END IF;
  IF EXISTS (SELECT 1 FROM _input WHERE sid IS NULL OR eodd IS NULL) THEN
    RAISE EXCEPTION 'INVALID_SELECTIONS';
  END IF;

  IF p_stake IS NULL OR p_stake < 10 THEN
    RAISE EXCEPTION 'INVALID_STAKE';
  END IF;
  v_stake := round(p_stake::numeric, 2);

  CREATE TEMP TABLE _resolved ON COMMIT DROP AS
  SELECT i.sid, i.eodd, s.market_id, s.selection_key, s.selection_name, s.odd, s.metadata,
         s.status AS sel_status, m.status AS mk_status, m.fixture_id, m.competition_code,
         m.market_type, m.market_name, m.line, m.opens_at, m.suspends_at,
         m.kickoff_at, m.home_team, m.away_team
    FROM _input i
    JOIN public.fixture_market_selections s ON s.id = i.sid
    JOIN public.fixture_markets m ON m.id = s.market_id;

  SELECT count(*) INTO v_matched FROM _resolved;
  IF v_matched <> v_count THEN
    RAISE EXCEPTION 'SELECTION_NOT_FOUND';
  END IF;

  IF EXISTS (SELECT 1 FROM _resolved WHERE sel_status <> 'OPEN') THEN
    RAISE EXCEPTION 'SELECTION_UNAVAILABLE' USING detail = 'selecao nao esta aberta';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _resolved
     WHERE mk_status <> 'OPEN'
  ) THEN
    RAISE EXCEPTION 'MARKET_UNAVAILABLE' USING detail = 'mercado nao esta aberto';
  END IF;

  -- AUDITORIA CRÍTICA: Impedir apostas em odds NULL ou <= 1.00
  IF EXISTS (SELECT 1 FROM _resolved WHERE odd IS NULL OR odd <= 1.00) THEN
    RAISE EXCEPTION 'SELECTION_UNAVAILABLE' USING detail = 'odd invalida ou nao precificada';
  END IF;

  IF EXISTS (SELECT 1 FROM _resolved WHERE kickoff_at <= now()) THEN
    RAISE EXCEPTION 'MATCH_ALREADY_STARTED';
  END IF;

  -- OBS: Removida a restrição de market_id (Permitir múltiplas seleções no mesmo mercado)

  SELECT jsonb_agg(jsonb_build_object('selection_id', sid, 'old_odd', eodd, 'new_odd', odd))
    INTO v_changes FROM _resolved WHERE round(eodd, 2) <> round(odd, 2);
  IF v_changes IS NOT NULL THEN
    RAISE EXCEPTION 'ODDS_CHANGED' USING detail = v_changes::text;
  END IF;

  SELECT round(exp(sum(ln(odd)))::numeric, 4) INTO v_total_odd FROM _resolved;
  v_return := round(v_stake * v_total_odd, 2);
  v_type := CASE WHEN v_count = 1 THEN 'SIMPLE' ELSE 'MULTIPLE' END;
  v_code := 'GF-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.tickets (
    user_id, code, stake, total_odd, potential_return, status, payment_status,
    payment_mode, selection_count, idempotency_key
  ) VALUES (
    v_user, v_code, v_stake, v_total_odd, v_return, 'PENDING_PAYMENT', 'PENDING',
    'SIMULATED', v_count, p_idempotency_key
  ) RETURNING * INTO v_ticket;

  INSERT INTO public.ticket_selections (
    ticket_id, fixture_id, fixture_market_id, fixture_market_option_id,
    market_type_code_snapshot, market_name_snapshot, option_code_snapshot,
    option_label_snapshot, parameter_snapshot, odd_snapshot,
    home_team_snapshot, away_team_snapshot, competition_snapshot,
    kickoff_at_snapshot, settlement_status, metadata
  )
  SELECT v_ticket.id, fixture_id, market_id, sid,
         market_type, market_name, selection_key,
         selection_name, line, odd,
         home_team, away_team, competition_code,
         kickoff_at, 'PENDING', metadata
    FROM _resolved;

  RETURN jsonb_build_object(
    'ticket_id', v_ticket.id, 'ticket_code', v_ticket.code, 'ticket_type', v_type,
    'stake', v_stake, 'total_odd', v_total_odd, 'potential_return', v_return,
    'status', 'PENDING_PAYMENT', 'payment_status', 'PENDING',
    'payment_mode', 'SIMULATED', 'is_duplicate', false
  );
END;
$$;
