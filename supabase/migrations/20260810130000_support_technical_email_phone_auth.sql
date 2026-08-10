CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO public.profiles (id, name, phone, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', 'Usuário'),
        COALESCE(
            NULLIF(new.raw_user_meta_data->>'phone', ''),
            new.phone,
            'email_' || new.id
        ),
        'user'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN new;
END;
$function$;
