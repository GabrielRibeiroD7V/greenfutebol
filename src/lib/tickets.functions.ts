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
      .eq('user_id', user.id) // Redundant but safe
      .single();

    if (error) throw error;
    return ticket;
  });
