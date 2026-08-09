-- Financial invariant: any LOST selection makes the ticket LOST with zero return.
-- This migration patches the already-versioned settle_fixture_atomic body while
-- failing closed if the expected implementation is not present.
DO $$
DECLARE
  v_function regprocedure := to_regprocedure('public.settle_fixture_atomic(integer)');
  v_definition text;
  v_original_update text := $fragment$
            settled_total_odd = v_effective_odd,
            settled_return = round(stake * v_effective_odd, 2),
            settled_at = now()
$fragment$;
  v_safe_update text := $fragment$
            settled_total_odd = CASE
                WHEN v_ticket_status = 'CONFIRMED' THEN NULL
                ELSE v_effective_odd
            END,
            settled_return = CASE
                WHEN v_ticket_status = 'LOST' THEN 0.00::numeric
                WHEN v_ticket_status = 'CONFIRMED' THEN NULL
                ELSE round(stake * v_effective_odd, 2)
            END,
            settled_at = CASE
                WHEN v_ticket_status = 'CONFIRMED' THEN NULL
                ELSE now()
            END
$fragment$;
BEGIN
  IF v_function IS NULL THEN
    RAISE EXCEPTION 'public.settle_fixture_atomic(integer) does not exist';
  END IF;

  SELECT pg_get_functiondef(v_function) INTO v_definition;

  IF position(v_safe_update IN v_definition) > 0 THEN
    RETURN;
  END IF;

  IF position(v_original_update IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected settle_fixture_atomic implementation; refusing unsafe patch';
  END IF;

  v_definition := replace(v_definition, v_original_update, v_safe_update);
  EXECUTE v_definition;
END;
$$;

COMMENT ON FUNCTION public.settle_fixture_atomic(integer) IS
  'Atomic all-or-nothing settlement: LOST returns zero; pending tickets are not paid.';
