-- Phase 1 & 2: Normalization and Odds Management Schema

-- 1. fixture_markets (Adapted to requested fields)
CREATE TABLE IF NOT EXISTS public.fixture_markets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_id bigint NOT NULL,
    competition_code text NOT NULL,
    market_type text NOT NULL, -- technical code like '1X2'
    market_name text NOT NULL, -- display name
    market_group text NOT NULL, -- category for navigation
    line numeric,
    period text NOT NULL DEFAULT 'FULL_TIME',
    status text NOT NULL DEFAULT 'OPEN',
    opens_at timestamptz,
    suspends_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. fixture_market_selections
CREATE TABLE IF NOT EXISTS public.fixture_market_selections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id uuid NOT NULL REFERENCES public.fixture_markets(id) ON DELETE CASCADE,
    selection_key text NOT NULL, -- e.g., 'H', 'D', 'A'
    selection_name text NOT NULL, -- e.g., 'Casa', 'Empate', 'Fora'
    odd numeric(10,2) NOT NULL CHECK (odd > 1.00),
    status text NOT NULL DEFAULT 'OPEN',
    result text, -- WON, LOST, VOID, PENDING
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(market_id, selection_key)
);

-- 3. ticket_audit_logs
CREATE TABLE IF NOT EXISTS public.ticket_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL, -- links to tickets.id
    user_id uuid,
    action text NOT NULL,
    payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS & GRANTS
ALTER TABLE public.fixture_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixture_market_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_audit_logs ENABLE ROW LEVEL SECURITY;

-- Grants for authenticated users (Read access)
GRANT SELECT ON public.fixture_markets TO authenticated;
GRANT SELECT ON public.fixture_market_selections TO authenticated;
GRANT SELECT ON public.ticket_audit_logs TO authenticated;

GRANT SELECT ON public.fixture_markets TO anon;
GRANT SELECT ON public.fixture_market_selections TO anon;

-- Grants for service_role (Full access)
GRANT ALL ON public.fixture_markets TO service_role;
GRANT ALL ON public.fixture_market_selections TO service_role;
GRANT ALL ON public.ticket_audit_logs TO service_role;

-- Policies
DO $$ BEGIN
    CREATE POLICY "Allow public read on markets" ON public.fixture_markets FOR SELECT USING (true);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow public read on selections" ON public.fixture_market_selections FOR SELECT USING (true);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow users to view their own ticket logs" ON public.ticket_audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN others THEN NULL; END $$;

-- Admin check function (Reusing has_role if exists, but being explicit for markets)
DO $$ BEGIN
    CREATE POLICY "Admins can manage markets" ON public.fixture_markets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can manage selections" ON public.fixture_market_selections FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN others THEN NULL; END $$;
