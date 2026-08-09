INSERT INTO public.fixtures (
    provider,
    provider_fixture_id,
    competition_code,
    competition_name,
    home_team_name,
    home_team_crest,
    away_team_name,
    away_team_crest,
    kickoff_at,
    status
) VALUES (
    'FOOTBALL_DATA',
    554954,
    'BSA',
    'Campeonato Brasileiro Série A',
    'Cruzeiro',
    'https://crests.football-data.org/17.png',
    'Palmeiras',
    'https://crests.football-data.org/17.png',
    '2026-12-31 21:00:00+00',
    'TIMED'
) ON CONFLICT (provider, provider_fixture_id) DO UPDATE SET kickoff_at = EXCLUDED.kickoff_at;
