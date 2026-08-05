DO $$
DECLARE
    m_id UUID;
BEGIN
    INSERT INTO public.fixture_markets (fixture_id, market_type_id, status)
    VALUES (558214, '9bc7c779-c13f-4a63-ab2f-84959457f44c', 'OPEN')
    ON CONFLICT (fixture_id, market_type_id) DO UPDATE SET status = 'OPEN'
    RETURNING id INTO m_id;

    INSERT INTO public.fixture_market_options (fixture_market_id, market_option_id, odd, active)
    VALUES 
        (m_id, '0883cce8-bb3a-4ee2-b2aa-d0e47412ba21', 1.85, true),
        (m_id, '0eb56e64-b7f6-4e7c-b5db-119ab6e7edb0', 3.40, true),
        (m_id, '86109354-bd96-478d-81e3-c0b7582718ac', 4.20, true)
    ON CONFLICT (fixture_market_id, market_option_id) DO NOTHING;
END $$;