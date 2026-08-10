-- 1. Criação da tabela de Fixtures Persistentes
CREATE TABLE IF NOT EXISTS public.fixtures (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL DEFAULT 'football-data.org',
    provider_fixture_id bigint NOT NULL,
    competition_code text NOT NULL,
    competition_name text,
    country text,
    season text,
    home_team_id bigint,
    home_team_name text NOT NULL,
    home_team_crest text,
    away_team_id bigint,
    away_team_name text NOT NULL,
    away_team_crest text,
    kickoff_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'NS',
    home_score integer,
    away_score integer,
    venue text,
    metadata jsonb DEFAULT '{}'::jsonb,
    last_synced_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(provider, provider_fixture_id)
);

-- 2. Permissões
GRANT SELECT ON public.fixtures TO authenticated;
GRANT SELECT ON public.fixtures TO anon;
GRANT ALL ON public.fixtures TO service_role;

-- 3. Segurança (RLS)
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view fixtures"
ON public.fixtures FOR SELECT
USING (true);

-- 4. Gatilho de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_fixtures_updated_at
    BEFORE UPDATE ON public.fixtures
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS fixtures_kickoff_at_idx ON public.fixtures (kickoff_at);
CREATE INDEX IF NOT EXISTS fixtures_provider_id_idx ON public.fixtures (provider_fixture_id);
CREATE INDEX IF NOT EXISTS fixtures_competition_code_idx ON public.fixtures (competition_code);