UPDATE public.football_fixtures_cache 
SET expires_at = now() - interval '1 hour' 
WHERE cache_key = 'BSA:2026-01-28';
