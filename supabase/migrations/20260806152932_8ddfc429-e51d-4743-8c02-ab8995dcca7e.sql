-- PARTE 1 — STATUS
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check CHECK (status = ANY (ARRAY[
  'DRAFT','PENDING','CONFIRMED','WON','LOST','VOID','CANCELLED',
  'PENDING_PAYMENT','WAITING_PAYMENT','PAID','REFUNDED'
]));

-- PARTE 2 — PAYMENT STATUS (nao existia constraint anterior)
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_payment_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_payment_status_check CHECK (payment_status = ANY (ARRAY[
  'NOT_REQUIRED','SIMULATED_PENDING','SIMULATED_CONFIRMED','FAILED','CANCELLED',
  'PENDING','RECEIVED','CONFIRMED','OVERDUE','PAYMENT_RECEIVED','PAYMENT_CONFIRMED'
]));

-- Stake demonstrativa
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_stake_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_stake_check CHECK (stake >= 5 AND stake <= 1000);

-- PARTE 3 — PAYMENT MODE
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'SIMULATED';
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_payment_mode_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_payment_mode_check CHECK (payment_mode IN ('SIMULATED','REAL'));
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_simulated_no_real_artifacts;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_simulated_no_real_artifacts CHECK (
  payment_mode <> 'SIMULATED' OR (
    payment_id IS NULL AND pix_qr_code IS NULL AND pix_copy_paste IS NULL AND invoice_url IS NULL
  )
);

-- Metadados de jogo nos mercados (elimina dependencia do cache)
ALTER TABLE public.fixture_markets ADD COLUMN IF NOT EXISTS kickoff_at timestamptz;
ALTER TABLE public.fixture_markets ADD COLUMN IF NOT EXISTS home_team text;
ALTER TABLE public.fixture_markets ADD COLUMN IF NOT EXISTS away_team text;

-- FK legada de ticket_selections -> fixture_market_options
ALTER TABLE public.ticket_selections DROP CONSTRAINT IF EXISTS ticket_selections_fixture_market_option_id_fkey;
ALTER TABLE public.ticket_selections
  ADD CONSTRAINT ticket_selections_selection_id_fkey
  FOREIGN KEY (fixture_market_option_id) REFERENCES public.fixture_market_selections(id);
ALTER TABLE public.ticket_selections DROP CONSTRAINT IF EXISTS ticket_selections_fixture_market_id_fkey;
ALTER TABLE public.ticket_selections
  ADD CONSTRAINT ticket_selections_fixture_market_id_fkey
  FOREIGN KEY (fixture_market_id) REFERENCES public.fixture_markets(id);

-- PARTE 4 — ESCRITA DIRETA
DROP POLICY IF EXISTS "Users can create own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can update own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can update own draft tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can create own selections" ON public.ticket_selections;
DROP POLICY IF EXISTS "Users can read own selections" ON public.ticket_selections;

REVOKE INSERT, UPDATE, DELETE ON public.tickets FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ticket_selections FROM authenticated;
REVOKE ALL ON public.tickets FROM anon;
REVOKE ALL ON public.ticket_selections FROM anon;
GRANT SELECT ON public.tickets TO authenticated;
GRANT SELECT ON public.ticket_selections TO authenticated;
GRANT ALL ON public.tickets TO service_role;
GRANT ALL ON public.ticket_selections TO service_role;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_selections ENABLE ROW LEVEL SECURITY;

-- PARTE 5 — AUDIT LOGS
ALTER TABLE public.ticket_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ticket_audit_logs FROM anon;
REVOKE ALL ON public.ticket_audit_logs FROM authenticated;
GRANT SELECT, INSERT ON public.ticket_audit_logs TO service_role;

-- PARTE 6 — RPC
DROP FUNCTION IF EXISTS public.create_ticket_atomic(numeric, uuid, jsonb);

CREATE FUNCTION public.create_ticket_atomic(
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
  v_count int;
  v_distinct int;
  v_matched int;
  v_changes jsonb;
  v_total_odd numeric := 1;
  v_stake numeric;
  v_return numeric;
  v_ticket public.tickets;
  v_code text;
  v_type text;
  r record;
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
      'ticket_type', CASE WHEN v_ticket.selection_count = 1 THEN 'SINGLE' ELSE 'MULTIPLE' END,
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
    RAISE EXCEPTION 'INCOMPATIBLE_SELECTIONS' USING detail = 'selection_id duplicado';
  END IF;
  IF EXISTS (SELECT 1 FROM _input WHERE sid IS NULL OR eodd IS NULL) THEN
    RAISE EXCEPTION 'INVALID_SELECTIONS';
  END IF;

  v_stake := round(coalesce(p_stake, 0)::numeric, 2);
  IF v_stake < 5 OR v_stake > 1000 THEN
    RAISE EXCEPTION 'INVALID_STAKE';
  END IF;

  CREATE TEMP TABLE _resolved ON COMMIT DROP AS
  SELECT i.sid, i.eodd, s.market_id, s.selection_key, s.selection_name, s.odd,
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
    RAISE EXCEPTION 'SELECTION_UNAVAILABLE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _resolved
     WHERE mk_status <> 'OPEN'
        OR (opens_at IS NOT NULL AND opens_at > now())
        OR (suspends_at IS NOT NULL AND suspends_at <= now())
  ) THEN
    RAISE EXCEPTION 'MARKET_UNAVAILABLE';
  END IF;
  IF EXISTS (SELECT 1 FROM _resolved WHERE odd IS NULL OR odd <= 1.00) THEN
    RAISE EXCEPTION 'SELECTION_UNAVAILABLE' USING detail = 'odd invalida';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _resolved
     WHERE kickoff_at IS NULL OR home_team IS NULL OR away_team IS NULL
  ) THEN
    RAISE EXCEPTION 'FIXTURE_METADATA_UNAVAILABLE';
  END IF;
  IF EXISTS (SELECT 1 FROM _resolved WHERE kickoff_at <= now()) THEN
    RAISE EXCEPTION 'MATCH_ALREADY_STARTED';
  END IF;
  IF EXISTS (SELECT 1 FROM _resolved GROUP BY market_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'INCOMPATIBLE_SELECTIONS' USING detail = 'mais de uma selecao no mesmo mercado';
  END IF;

  SELECT jsonb_agg(jsonb_build_object('selection_id', sid, 'old_odd', eodd, 'new_odd', odd))
    INTO v_changes FROM _resolved WHERE round(eodd, 2) <> round(odd, 2);
  IF v_changes IS NOT NULL THEN
    RAISE EXCEPTION 'ODDS_CHANGED' USING detail = v_changes::text;
  END IF;

  SELECT round(exp(sum(ln(odd)))::numeric, 4) INTO v_total_odd FROM _resolved;
  v_return := round(v_stake * v_total_odd, 2);
  v_type := CASE WHEN v_count = 1 THEN 'SINGLE' ELSE 'MULTIPLE' END;
  v_code := 'GF-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.tickets (
    user_id, code, stake, total_odd, potential_return, status, payment_status,
    payment_mode, selection_count, idempotency_key
  ) VALUES (
    v_user, v_code, v_stake, v_total_odd, v_return, 'CONFIRMED', 'SIMULATED_CONFIRMED',
    'SIMULATED', v_count, p_idempotency_key
  ) RETURNING * INTO v_ticket;

  INSERT INTO public.ticket_selections (
    ticket_id, fixture_id, fixture_market_id, fixture_market_option_id,
    market_type_code_snapshot, market_name_snapshot, option_code_snapshot,
    option_label_snapshot, parameter_snapshot, odd_snapshot,
    home_team_snapshot, away_team_snapshot, competition_snapshot,
    kickoff_at_snapshot, settlement_status
  )
  SELECT v_ticket.id, fixture_id, market_id, sid,
         market_type, market_name, selection_key,
         selection_name, line, odd,
         home_team, away_team, competition_code,
         kickoff_at, 'PENDING'
    FROM _resolved;

  INSERT INTO public.ticket_audit_logs (ticket_id, user_id, action, payload)
  VALUES (v_ticket.id, v_user, 'TICKET_CREATED', jsonb_build_object(
    'ticket_id', v_ticket.id,
    'user_id', v_user,
    'idempotency_key', p_idempotency_key,
    'selection_count', v_count,
    'status', 'CONFIRMED',
    'payment_status', 'SIMULATED_CONFIRMED',
    'payment_mode', 'SIMULATED',
    'created_at', now()
  ));

  RETURN jsonb_build_object(
    'ticket_id', v_ticket.id, 'ticket_code', v_ticket.code, 'ticket_type', v_type,
    'stake', v_stake, 'total_odd', v_total_odd, 'potential_return', v_return,
    'status', 'CONFIRMED', 'payment_status', 'SIMULATED_CONFIRMED',
    'payment_mode', 'SIMULATED', 'is_duplicate', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_ticket_atomic(numeric, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_ticket_atomic(numeric, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ticket_atomic(numeric, uuid, jsonb) TO service_role;