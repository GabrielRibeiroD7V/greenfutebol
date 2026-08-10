DO $$
DECLARE
    target_user_id uuid := 'e8e3ba6a-9a96-42ba-b7cc-49f31f415805';
BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = target_user_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (target_user_id, 'admin') ON CONFLICT DO NOTHING;
END $$;
