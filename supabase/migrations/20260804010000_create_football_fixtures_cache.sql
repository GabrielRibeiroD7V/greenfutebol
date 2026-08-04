CREATE TABLE public.football_fixtures_cache (
  cache_key text PRIMARY KEY,
  competition_code text NOT NULL,
  fixture_date date NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT football_fixtures_cache_key_format
    CHECK (cache_key = competition_code || ':' || fixture_date::text),
  CONSTRAINT football_fixtures_cache_payload_structure
    CHECK (
      jsonb_typeof(payload) = 'object'
      AND payload ? 'fixtures'
      AND jsonb_typeof(payload->'fixtures') = 'array'
    )
);

CREATE INDEX football_fixtures_cache_expires_at_idx
  ON public.football_fixtures_cache (expires_at);

CREATE INDEX football_fixtures_cache_fixture_date_idx
  ON public.football_fixtures_cache (fixture_date);

ALTER TABLE public.football_fixtures_cache ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.football_fixtures_cache
TO service_role;
