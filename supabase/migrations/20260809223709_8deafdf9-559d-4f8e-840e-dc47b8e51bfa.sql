
CREATE OR REPLACE FUNCTION public.get_admin_tickets_summary(_since timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_count bigint;
  v_today_stake numeric;
  v_pending_count bigint;
  v_won_count bigint;
  v_lost_count bigint;
  v_potential_return numeric;
BEGIN
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
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_tickets_summary(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_tickets_summary(timestamptz) TO service_role;
