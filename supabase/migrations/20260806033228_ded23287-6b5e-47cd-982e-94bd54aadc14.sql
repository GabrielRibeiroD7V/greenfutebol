DO $$ 
BEGIN 
    ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
    ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check 
        CHECK (status IN ('PENDING_PAYMENT', 'WAITING_PAYMENT', 'PAID', 'CANCELLED', 'LOST', 'WON', 'REFUNDED'));
END $$;

ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS payment_id TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT,
ADD COLUMN IF NOT EXISTS invoice_url TEXT,
ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
ADD COLUMN IF NOT EXISTS pix_copy_paste TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

GRANT SELECT, UPDATE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

DROP POLICY IF EXISTS "Users can update own tickets" ON public.tickets;
CREATE POLICY "Users can update own tickets" ON public.tickets
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);
