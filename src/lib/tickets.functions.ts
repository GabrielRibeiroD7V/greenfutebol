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
  selections: z.array(selectionSchema).min(1).max(20),
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
    const { stake, idempotency_key, selections } = input;

    const { data: rpcResponse, error: rpcError } = await supabase.rpc('create_ticket_atomic', {
      p_stake: stake,
      p_idempotency_key: idempotency_key,
      p_selections: selections.map((s: { fixture_market_option_id: string; expected_odd: number }) => ({
        option_id: s.fixture_market_option_id,
        expected_odd: s.expected_odd
      }))
    });

    if (rpcError) {
      console.error("RPC Error:", rpcError);
      
      if (rpcError.code === 'P0001') {
        throw new Error(rpcError.message.replace('Market or option is suspended: ', 'O mercado ou opção não está mais disponível: '));
      }
      if (rpcError.code === 'P0002') {
        throw new Error(rpcError.message.replace('Match already started: ', 'A partida já começou: '));
      }
      if (rpcError.code === '23505') {
        return { success: true, is_duplicate: true };
      }

      throw new Error("Erro ao processar bilhete. Tente novamente.");
    }

    const result = rpcResponse as unknown as RPCResult;

    if (!result || !result.success) {
      if (result?.error_code === 'ODDS_CHANGED') {
        return {
          success: false,
          error_code: 'ODDS_CHANGED',
          changed_selections: result.changed_selections
        };
      }
      throw new Error("Erro ao validar bilhete.");
    }

    return {
      success: true,
      ticketCode: result.ticket_code,
      ticketId: result.ticket_id,
      is_duplicate: result.is_duplicate || false
    };
  });
