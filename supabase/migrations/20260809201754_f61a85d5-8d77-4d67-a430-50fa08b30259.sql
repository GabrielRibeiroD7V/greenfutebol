-- Migration: Phase 2B - Markets Admin Metadata
ALTER TABLE public.fixture_market_selections ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Ensure grants are correct
GRANT SELECT ON public.fixture_markets TO anon, authenticated;
GRANT SELECT ON public.fixture_market_selections TO anon, authenticated;
GRANT ALL ON public.fixture_markets TO authenticated;
GRANT ALL ON public.fixture_market_selections TO authenticated;
GRANT ALL ON public.fixture_markets TO service_role;
GRANT ALL ON public.fixture_market_selections TO service_role;
