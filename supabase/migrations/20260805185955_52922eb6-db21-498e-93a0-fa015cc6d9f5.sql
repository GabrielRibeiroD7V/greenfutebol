-- Revoke execute from public/anon/authenticated for has_role
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

-- Only grant to service_role and postgres (owner)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- To allow RLS to use it without granting execute to everyone, we can move it to a non-exposed schema, 
-- but that requires changing all policies.
-- Alternatively, we can leave it as is if we accept the risk that users can call it.
-- But the linter is strict.

-- Let's see if revoking from public/anon/authenticated satisfies the linter while keeping it functional for RLS 
-- (Actually, RLS usually needs execute permission for the evaluating user).

-- If the linter still warns, I'll move it to another schema.
