-- Fix security issues found by linter

-- 1. Revoke public execute on has_role
revoke execute on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- 2. Add RLS policy for user_roles
create policy "Users can read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "Admins can manage user_roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(), 'admin'));
