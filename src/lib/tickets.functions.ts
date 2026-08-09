import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const createTicketInput = z.object({
  stake: z.number().min(5),
  idempotency_key: z.string().uuid(),
  selections: z.array(z.object({
    selection_id: z.string().uuid(),
    expected_odd: z.number(),
  }))
});

export const createTicket = createServerFn({ method: "POST" })
  .validator((data: any) => createTicketInput.parse(data))
  .handler(async ({ data }) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("UNAUTHORIZED");
    }

    const { data: result, error } = await supabase.rpc('create_ticket_atomic', {
      p_stake: data.stake,
      p_idempotency_key: data.idempotency_key,
      p_selections: data.selections
    });

    if (error) {
      // Handle known PostgREST/PostgreSQL exceptions
      if (error.message) {
        throw new Error(error.message);
      }
      throw error;
    }

    return result;
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
