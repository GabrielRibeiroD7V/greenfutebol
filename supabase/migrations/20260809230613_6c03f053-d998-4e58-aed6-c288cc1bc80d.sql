INSERT INTO public.fixtures (provider, provider_fixture_id, competition_code, competition_name, home_team_name, away_team_name, kickoff_at, status)
VALUES ('FOOTBALL_DATA', 567257, 'PPL', 'Primeira Liga', 'CD Santa Clara', 'CD Nacional', '2026-08-10 19:15:00+00', 'NS')
ON CONFLICT (provider, provider_fixture_id) DO NOTHING;