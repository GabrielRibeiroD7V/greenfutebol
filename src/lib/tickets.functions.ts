import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

async function requireUser() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Não autenticado");
  return user;
}

export const getMyTickets = createServerFn({ method: "GET" })
  .validator((data: any) => z.object({
    status: z.string().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(20)
  }).parse(data))
  .handler(async ({ data: input }) => {
    const user = await requireUser();
    const { status, page, pageSize } = input;

    let query = supabase
      .from('tickets')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      tickets: data,
      totalCount: count || 0
    };
  });

export const getTicketDetail = createServerFn({ method: "GET" })
  .validator((data: any) => z.object({ ticketId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    
    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('*, ticket_selections(*)')
      .eq('id', data.ticketId)
      .eq('user_id', user.id) 
      .single();

    if (error) throw error;
    return ticket;
  });

const selectionSchema = z.object({
  fixture_market_option_id: z.string().uuid(),
  expected_odd: z.number(),
});

const createTicketInput = z.object({
  stake: z.number().min(5).max(5000),
  idempotency_key: z.string().uuid(),
  selections: z.array(z.any()).min(1).max(20),
});

interface RPCResult {
  success: boolean;
  ticket_id?: string;
  ticket_code?: string;
  error_code?: string;
  is_duplicate?: boolean;
  changed_selections?: Array<{
    option_id: string;
    old_odd: number;
    current_odd: number;
    label: string;
  }>;
}

export const createTicket = createServerFn({ method: "POST" })
  .validator((data: any) => createTicketInput.parse(data))
  .handler(async ({ data: input }) => {
    const user = await requireUser();
    const { stake, idempotency_key } = input;

    // Fase 5: Criação simplificada e persistência no banco
    const total_odd = input.selections.reduce((acc: number, s: any) => acc * s.odd, 1);
    const potential_return = input.stake * total_odd;
    
    // Gerar um código único para o bilhete (ex: GF-123456)
    const code = `GF-${Math.floor(100000 + Math.random() * 900000)}`;

    const { data: ticket, error: insertError } = await supabase
      .from('tickets')
      .insert({
        user_id: user.id,
        code,
        stake: input.stake,
        total_odd,
        potential_return,
        status: 'PENDING_PAYMENT',
        selection_count: input.selections.length,
        idempotency_key,
        selections: input.selections
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') { // Unique constraint (idempotency)
        const { data: existing } = await supabase
          .from('tickets')
          .select('id, code')
          .eq('idempotency_key', idempotency_key)
          .eq('user_id', user.id)
          .single();
        
        if (existing) {
          return { success: true, ticketId: existing.id, ticketCode: existing.code, is_duplicate: true };
        }
      }
      console.error("Insert error:", insertError);
      throw new Error("Erro ao criar aposta no banco.");
    }

    return {
      success: true,
      ticketId: ticket.id,
      ticketCode: ticket.code
    };
  });
