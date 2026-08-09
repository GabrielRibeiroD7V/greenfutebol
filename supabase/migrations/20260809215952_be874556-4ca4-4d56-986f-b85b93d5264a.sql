-- CORRECTIVE MIGRATION: FINAL RESTORATION OF FIXTURE 554954 (CRUZEIRO X PALMEIRAS)
-- Motivo: Eliminar resquícios de homologação que inseriram dados incorretos (Mirassol FC) e datas artificiais.
-- Impacto: Restaura public.fixtures e sincroniza fixture_markets sem afetar histórico de tickets.

UPDATE public.fixtures
SET 
    home_team_name = 'Cruzeiro EC',
    home_team_crest = 'https://crests.football-data.org/1771.png',
    away_team_name = 'SE Palmeiras',
    away_team_crest = 'https://crests.football-data.org/1769.png',
    kickoff_at = '2026-08-09 19:00:00+00',
    status = 'FT', -- De acordo com o cache que mostra placar 3x1 e status FT
    home_score = 3,
    away_score = 1,
    updated_at = now()
WHERE provider = 'FOOTBALL_DATA' AND provider_fixture_id = 554954;

UPDATE public.fixture_markets
SET 
    home_team = 'Cruzeiro EC',
    away_team = 'SE Palmeiras',
    kickoff_at = '2026-08-09 19:00:00+00',
    updated_at = now()
WHERE fixture_id = 554954;