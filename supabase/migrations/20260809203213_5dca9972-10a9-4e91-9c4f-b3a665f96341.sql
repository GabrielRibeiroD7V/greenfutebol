GRANT SELECT ON public.fixture_markets TO anon, authenticated;
GRANT SELECT ON public.fixture_market_selections TO anon, authenticated;

-- Garantir também permissões para service_role (geralmente já tem, mas é boa prática)
GRANT ALL ON public.fixture_markets TO service_role;
GRANT ALL ON public.fixture_market_selections TO service_role;