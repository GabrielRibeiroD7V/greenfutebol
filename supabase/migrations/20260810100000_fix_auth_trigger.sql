-- Fix handle_new_user trigger to handle email-based signups where phone is null
-- The previous version failed because profiles.phone has a NOT NULL constraint
-- but auth.users.phone is null for email signups.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, name, phone, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', 'Usuário'),
        COALESCE(new.phone, 'email_' || new.id), -- Fallback for NOT NULL constraint
        'user'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$;

-- Ensure the trigger is attached correctly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
