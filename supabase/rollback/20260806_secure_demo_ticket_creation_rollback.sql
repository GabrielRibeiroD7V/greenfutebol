-- ROLLBACK do estado anterior a "secure simulated ticket creation"
-- Ponto de recuperacao registrado em 2026-08-06 15:29 UTC
-- Estado do banco no momento: 0 tickets, 0 ticket_selections, 0 ticket_audit_logs, 0 fixture_market_selections.
-- Executar apenas manualmente, em transacao.

BEGIN;

-- 1. Constraints originais de tickets
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check CHECK (status = ANY (ARRAY[
  'PENDING_PAYMENT','WAITING_PAYMENT','PAID','CANCELLED','LOST','WON','REFUNDED'
]));

-- payment_status nao possuia constraint antes
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_payment_status_check;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_stake_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_stake_check CHECK (stake >= 5 AND stake <= 5000);

-- 2. payment_mode e guarda de artefatos reais (nao existiam)
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_simulated_no_real_artifacts;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_payment_mode_check;
ALTER TABLE public.tickets DROP COLUMN IF EXISTS payment_mode;

-- 3. Metadados adicionados a fixture_markets (nao existiam)
ALTER TABLE public.fixture_markets DROP COLUMN IF EXISTS kickoff_at;
ALTER TABLE public.fixture_markets DROP COLUMN IF EXISTS home_team;
ALTER TABLE public.fixture_markets DROP COLUMN IF EXISTS away_team;

-- 4. FKs de ticket_selections como estavam
ALTER TABLE public.ticket_selections DROP CONSTRAINT IF EXISTS ticket_selections_selection_id_fkey;
ALTER TABLE public.ticket_selections DROP CONSTRAINT IF EXISTS ticket_selections_fixture_market_id_fkey;
ALTER TABLE public.ticket_selections
  ADD CONSTRAINT ticket_selections_fixture_market_option_id_fkey
  FOREIGN KEY (fixture_market_option_id) REFERENCES public.fixture_market_options(id);

-- 5. Policies e grants de escrita direta (estado anterior)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_selections TO authenticated;

CREATE POLICY "Users can create own tickets" ON public.tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tickets" ON public.tickets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own draft tickets" ON public.tickets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status = 'DRAFT');
CREATE POLICY "Users can create own selections" ON public.ticket_selections
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.tickets WHERE tickets.id = ticket_selections.ticket_id
      AND tickets.user_id = auth.uid()));
CREATE POLICY "Users can read own selections" ON public.ticket_selections
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.tickets WHERE tickets.id = ticket_selections.ticket_id
      AND (tickets.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))));

-- 6. RPC anterior
-- A definicao anterior de public.create_ticket_atomic(numeric, uuid, jsonb)
-- consultava fixture_market_options + football_fixtures_cache (CROSS JOIN obrigatorio)
-- e gravava status='CONFIRMED', payment_status='NOT_REQUIRED'.
-- Para restaurar, reaplicar a migration original:
--   supabase/migrations/*_entrega1_odds_model.sql (bloco create_ticket_atomic)
DROP FUNCTION IF EXISTS public.create_ticket_atomic(numeric, uuid, jsonb);

COMMIT;
