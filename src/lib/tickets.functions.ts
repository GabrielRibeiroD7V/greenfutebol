import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const createTicketInput = z.object({
  stake: z.number().min(5),
  idempotency_key: z.string().uuid(),
  selections: z.array(z.object({
    fixture_id: z.number(),
    market_id: z.string().uuid(),
    selection_id: z.string().uuid(),
    market: z.string(),
    option: z.string(),
    odd: z.number(),
    home_team: z.string(),
    away_team: z.string(),
    competition: z.string(),
  }))
});

export const createTicket = createServerFn({ method: "POST" })
  .validator((data: any) => createTicketInput.parse(data))
  .handler(async ({ data }) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Acesso negado: Login necessário");

    // 1. Lock and validate ticket creation (Simplified for Phase 5)
    // Check idempotency first
    const { data: existingTicket } = await supabase
      .from('tickets')
      .select('id')
      .eq('user_id', user.id)
      .eq('payment_idempotency_key', data.idempotency_key)
      .maybeSingle();

    if (existingTicket) {
      return { success: true, ticketId: existingTicket.id };
    }

    // Calculate total odd again for safety
    const total_odd = data.selections.reduce((acc, s) => acc * s.odd, 1);
    
    // Generate unique code
    const code = `GF-${Math.floor(100000 + Math.random() * 900000)}`;

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        user_id: user.id,
        code,
        status: 'PENDING_PAYMENT',
        stake: data.stake,
        total_odd,
        potential_return: data.stake * total_odd,
        payment_idempotency_key: data.idempotency_key,
        selections: data.selections // Store as JSONB in this simplified version
      })
      .select()
      .single();

    if (ticketError) throw ticketError;

    // Create ticket selections for easy query/audit
    const ticketSelections = data.selections.map(s => ({
      ticket_id: ticket.id,
      fixture_id: s.fixture_id,
      market_name: s.market,
      selection_name: s.option,
      odd: s.odd,
      home_team: s.home_team,
      away_team: s.away_team,
      competition_name: s.competition,
      // We could also store market_id/selection_id here if we want to link them formally
    }));

    const { error: selectionsError } = await supabase
      .from('ticket_selections')
      .insert(ticketSelections);

    if (selectionsError) console.error("Error creating ticket selections:", selectionsError);

    return { success: true, ticketId: ticket.id };
  });
