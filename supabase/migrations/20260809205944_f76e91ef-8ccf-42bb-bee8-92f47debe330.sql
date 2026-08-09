-- 1. Atualiza kickoff na fixture_markets
UPDATE public.fixture_markets 
SET kickoff_at = '2026-12-31T20:00:00Z', 
    status = 'OPEN' 
WHERE fixture_id = 554954;

-- 2. Atualiza seleções para OPEN usando a coluna correta 'market_id'
UPDATE public.fixture_market_selections 
SET status = 'OPEN' 
WHERE market_id IN (SELECT id FROM public.fixture_markets WHERE fixture_id = 554954);

-- 3. Limpa cache JSONB para forçar recarga da data
DELETE FROM public.football_fixtures_cache;