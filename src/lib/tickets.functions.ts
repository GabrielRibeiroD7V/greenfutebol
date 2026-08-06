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

    const total_odd = data.selections.reduce((acc, s) => acc * s.odd, 1);
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
        selections: data.selections as any,
        selection_count: data.selections.length
      })
      .select()
      .single();

    if (ticketError) throw ticketError;

    // Create ticket selections (matching current DB schema)
    const ticketSelections = data.selections.map(s => ({
      ticket_id: ticket.id,
      fixture_id: s.fixture_id,
      fixture_market_id: s.market_id,
      fixture_market_option_id: s.selection_id,
      market_snapshot: s.market,
      selection_snapshot: s.option,
      odd_snapshot: s.odd,
      home_team_snapshot: s.home_team,
      away_team_snapshot: s.away_team,
      competition_snapshot: s.competition,
    }));

    const { error: selectionsError } = await supabase
      .from('ticket_selections')
      .insert(ticketSelections as any);

    if (selectionsError) console.error("Error creating ticket selections:", selectionsError);

    return { success: true, ticketId: ticket.id };
  });

export const getMyTickets = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Não autenticado");

    const { data, error } = await supabase
      .from('tickets')
      .select('*, ticket_selections(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  });

export const getTicketDetail = createServerFn({ method: "GET" })
  .validator((data: any) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Não autenticado");

    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('*, ticket_selections(*)')
      .eq('id', data.id)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    return ticket;
  });
