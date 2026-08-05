-- 1. Market Option Audit Logs
CREATE TABLE IF NOT EXISTS public.market_option_audit_logs (
    id uuid primary key default gen_random_uuid(),
    fixture_market_option_id uuid references public.fixture_market_options(id),
    admin_user_id uuid references auth.users(id),
    old_odd numeric,
    new_odd numeric,
    old_active boolean,
    new_active boolean,
    action text not null, -- 'UPDATE_ODD', 'TOGGLE_ACTIVE', 'SUSPEND_MARKET', etc.
    created_at timestamptz not null default now()
);

GRANT SELECT ON public.market_option_audit_logs TO authenticated;
GRANT ALL ON public.market_option_audit_logs TO service_role;

ALTER TABLE public.market_option_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
ON public.market_option_audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Ensure tickets and ticket_selections have RLS properly configured for 1C
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own tickets" ON public.tickets;
CREATE POLICY "Users can read own tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can read own ticket selections" ON public.ticket_selections;
CREATE POLICY "Users can read own ticket selections"
ON public.ticket_selections
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tickets t 
        WHERE t.id = ticket_id 
        AND (t.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
);

-- 3. Update fixture_markets status to include more states
-- We'll just rely on the existing TEXT field for now as it's flexible.

-- 4. View to help admin with user identification (Phone Masking in SQL if possible, or just handle in frontend/server-fn)
-- For security, let's keep it simple.
