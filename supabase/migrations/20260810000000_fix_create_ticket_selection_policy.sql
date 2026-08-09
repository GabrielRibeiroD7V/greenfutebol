-- Keep ticket creation aligned with the UI and database constraints:
-- 1..20 selections, exact duplicates rejected, different selections from the
-- same market allowed, and one selection reported as a SIMPLE ticket.
DO $$
DECLARE
  v_function regprocedure := to_regprocedure('public.create_ticket_atomic(numeric,uuid,jsonb)');
  v_definition text;
BEGIN
  IF v_function IS NULL THEN
    RAISE EXCEPTION 'public.create_ticket_atomic(numeric,uuid,jsonb) does not exist';
  END IF;

  SELECT pg_get_functiondef(v_function) INTO v_definition;

  IF position('v_count > 50' IN v_definition) > 0 THEN
    v_definition := replace(v_definition, 'v_count > 50', 'v_count > 20');
  ELSIF position('v_count > 20' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected selection limit; refusing unsafe patch';
  END IF;

  IF position('INCOMPATIBLE_SELECTIONS' IN v_definition) > 0 THEN
    v_definition := replace(v_definition, 'INCOMPATIBLE_SELECTIONS', 'DUPLICATE_SELECTIONS');
  ELSIF position('DUPLICATE_SELECTIONS' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected duplicate-selection policy; refusing unsafe patch';
  END IF;

  v_definition := replace(v_definition, '''SINGLE''', '''SIMPLE''');

  EXECUTE v_definition;
END;
$$;

COMMENT ON FUNCTION public.create_ticket_atomic(numeric,uuid,jsonb) IS
  'Creates 1..20-selection tickets; rejects exact duplicates and allows selections from the same market.';
