-- Restrict the market catalog to read-only access for public application roles.
REVOKE ALL ON TABLE public.market_catalog_templates FROM anon, authenticated;
GRANT SELECT ON TABLE public.market_catalog_templates TO anon, authenticated;
GRANT ALL ON TABLE public.market_catalog_templates TO service_role;

-- Administrative RPCs remain callable only by authenticated users and the
-- service role. Each function still enforces the admin guard internally.
REVOKE EXECUTE ON FUNCTION public.add_fixture_market_from_template(bigint, text, numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_fixture_market_from_template(bigint, text, numeric)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.prepare_fixture_markets(bigint)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_fixture_markets(bigint)
  TO authenticated, service_role;
