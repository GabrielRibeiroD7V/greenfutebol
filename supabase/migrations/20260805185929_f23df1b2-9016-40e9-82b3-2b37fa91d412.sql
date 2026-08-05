-- Check grants for has_role
SELECT 
    grantee, 
    privilege_type
FROM information_schema.routine_privileges 
WHERE routine_name = 'has_role';

-- Add policy for football_fixtures_cache
create policy "Anyone can read cache" on public.football_fixtures_cache for select using (true);
create policy "Service role can manage cache" on public.football_fixtures_cache for all to service_role using (true);
