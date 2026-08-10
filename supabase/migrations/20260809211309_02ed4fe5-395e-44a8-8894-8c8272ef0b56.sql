-- MIGRATION: 20260810110000_phase_2e_players.sql
-- FASE 2E: JOGADORES E MERCADOS DE JOGADORES

-- 1. Tabela global de Jogadores
CREATE TABLE public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT DEFAULT 'MANUAL',
    provider_player_id TEXT,
    name TEXT NOT NULL,
    team_provider_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider, provider_player_id)
);

-- 2. Tabela de vínculo Fixture <-> Player (Lineup/Participação)
-- Corrigido: Usando a constraint unique de fixtures explicitamente ou mudando a referência para a PK se possível
-- Como provider_fixture_id tem UNIQUE(provider, provider_fixture_id), precisamos referenciar a PK id de fixtures ou garantir que provider_fixture_id seja UNIQUE sozinho.
-- Vamos checar se provider_fixture_id é UNIQUE sozinho. Se não, referenciamos pela PK 'id' de fixtures.
-- Mas o requisito diz provider_fixture_id. Vamos ver a PK de fixtures.
CREATE TABLE public.fixture_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_id BIGINT NOT NULL, -- Referência lógica ao provider_fixture_id
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    team_side TEXT CHECK (team_side IN ('HOME', 'AWAY')),
    team_name TEXT NOT NULL,
    shirt_number INTEGER,
    position TEXT,
    status TEXT DEFAULT 'AVAILABLE',
    source TEXT DEFAULT 'MANUAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(fixture_id, player_id)
);

-- 3. Grants
GRANT SELECT ON public.players TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;

GRANT SELECT ON public.fixture_players TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.fixture_players TO authenticated;
GRANT ALL ON public.fixture_players TO service_role;

-- 4. RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixture_players ENABLE ROW LEVEL SECURITY;

-- Polices for Players
CREATE POLICY "Public read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Admins manage players" ON public.players
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Polices for Fixture Players
CREATE POLICY "Public read fixture_players" ON public.fixture_players FOR SELECT USING (true);
CREATE POLICY "Admins manage fixture_players" ON public.fixture_players
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_player_updated BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER on_fixture_player_updated BEFORE UPDATE ON public.fixture_players FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. Indices
CREATE INDEX idx_players_provider ON public.players(provider, provider_player_id);
CREATE INDEX idx_fixture_players_fixture ON public.fixture_players(fixture_id);
CREATE INDEX idx_fixture_players_player ON public.fixture_players(player_id);