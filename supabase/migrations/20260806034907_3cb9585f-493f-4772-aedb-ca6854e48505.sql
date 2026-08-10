-- Migration para Segurança e Idempotência do PIX (Fase 7 - Correção)
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS payment_attempt INTEGER DEFAULT 1 NOT NULL,
ADD COLUMN IF NOT EXISTS payment_idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_payment_id_unique ON public.tickets (payment_id) WHERE payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.acquire_payment_lock(p_ticket_id UUID)
RETURNS TABLE (
    success BOOLEAN,
    current_attempt INTEGER,
    idempotency_key UUID,
    existing_payment_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_ticket RECORD;
BEGIN
    v_user_id := auth.uid();

    -- Selecionar com lock para evitar concorrência
    SELECT * INTO v_ticket
    FROM public.tickets
    WHERE id = p_ticket_id
    FOR UPDATE;

    IF v_ticket IS NULL OR v_ticket.user_id <> v_user_id THEN
        RETURN QUERY SELECT FALSE, 0, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    IF v_ticket.status = 'PAID' THEN
        RETURN QUERY SELECT FALSE, v_ticket.payment_attempt, v_ticket.payment_idempotency_key, v_ticket.payment_id;
        RETURN;
    END IF;

    IF v_ticket.payment_id IS NOT NULL AND v_ticket.status = 'WAITING_PAYMENT' THEN
        RETURN QUERY SELECT TRUE, v_ticket.payment_attempt, v_ticket.payment_idempotency_key, v_ticket.payment_id;
        RETURN;
    END IF;

    IF v_ticket.payment_idempotency_key IS NULL THEN
        UPDATE public.tickets
        SET payment_idempotency_key = gen_random_uuid()
        WHERE id = p_ticket_id;

        SELECT payment_idempotency_key INTO v_ticket.payment_idempotency_key
        FROM public.tickets WHERE id = p_ticket_id;
    END IF;

    RETURN QUERY SELECT TRUE, v_ticket.payment_attempt, v_ticket.payment_idempotency_key, v_ticket.payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_payment_lock(UUID) TO authenticated;
