
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'selections') THEN
        ALTER TABLE public.tickets ADD COLUMN selections JSONB;
    END IF;
END $$;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED', 'PENDING_PAYMENT', 'WON', 'LOST', 'VOID'));

DROP POLICY IF EXISTS "Users can read own tickets" ON public.tickets;
CREATE POLICY "Users can read own tickets" ON public.tickets 
FOR SELECT TO authenticated 
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can create own tickets" ON public.tickets;
CREATE POLICY "Users can create own tickets" ON public.tickets 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
