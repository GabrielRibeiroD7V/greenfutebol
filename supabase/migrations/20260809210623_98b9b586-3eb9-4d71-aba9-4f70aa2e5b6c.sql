-- 1. Garante kickoff futuro para passar na validação 'kickoff_at <= now()' da RPC
UPDATE public.fixture_markets 
SET kickoff_at = '2026-12-31T20:00:00Z', 
    status = 'OPEN' 
WHERE fixture_id = 554954;

-- 2. Garante que as seleções estejam abertas
UPDATE public.fixture_market_selections 
SET status = 'OPEN' 
WHERE market_id IN (SELECT id FROM public.fixture_markets WHERE fixture_id = 554954);

-- 3. Remove cache obsoleto
DELETE FROM public.football_fixtures_cache;