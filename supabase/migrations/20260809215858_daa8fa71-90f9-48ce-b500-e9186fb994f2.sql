-- FINAL PRE-PUBLICATION CORRECTION: RESTORE FIXTURE 554954 INTEGRITY
UPDATE public.fixtures
SET 
    home_team_name = 'Cruzeiro',
    home_team_crest = 'https://crests.football-data.org/1771.png',
    away_team_name = 'Palmeiras',
    away_team_crest = 'https://crests.football-data.org/1769.png',
    kickoff_at = '2026-08-09 19:00:00+00',
    status = 'TIMED',
    updated_at = now()
WHERE provider = 'FOOTBALL_DATA' AND provider_fixture_id = 554954;

UPDATE public.fixture_markets
SET 
    home_team = 'Cruzeiro',
    away_team = 'Palmeiras',
    kickoff_at = '2026-08-09 19:00:00+00',
    updated_at = now()
WHERE fixture_id = 554954;