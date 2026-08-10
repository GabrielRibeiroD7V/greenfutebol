-- 1. Forçar kickoff no futuro na fixture_markets
UPDATE public.fixture_markets
SET kickoff_at = '2026-12-31T20:00:00Z',
    status = 'OPEN'
WHERE fixture_id = 554954;

-- 2. Abrir seleções
UPDATE public.fixture_market_selections
SET status = 'OPEN'
WHERE market_id IN (SELECT id FROM public.fixture_markets WHERE fixture_id = 554954);

-- 3. Limpar cache para evitar conflitos de exibição
DELETE FROM public.football_fixtures_cache;