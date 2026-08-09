-- Mover kickoff_at para o futuro para permitir homologação
UPDATE public.fixture_markets 
SET kickoff_at = '2026-12-31 23:59:59+00' 
WHERE fixture_id = 554954;

-- Garantir que as seleções e mercados estão OPEN
UPDATE public.fixture_markets SET status = 'OPEN' WHERE fixture_id = 554954;
UPDATE public.fixture_market_selections 
SET status = 'OPEN' 
WHERE market_id IN (SELECT id FROM public.fixture_markets WHERE fixture_id = 554954);