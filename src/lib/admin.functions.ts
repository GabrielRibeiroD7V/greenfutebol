import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/**
 * Validates that the current user is an administrator.
 */
async function requireAdmin() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Não autenticado");

  const { data: hasRole, error: roleError } = await supabase.rpc('has_role', {
    _user_id: user.id,
    _role: 'admin'
  });

  if (roleError || !hasRole) throw new Error("Acesso negado: Administrador necessário");
  return user;
}

// --- ADMIN BILLS (TICKETS) ---

export const getAdminTickets = createServerFn({ method: "GET" })
  .validator((data: any) => z.object({
    page: z.number().default(1),
    pageSize: z.number().default(20),
    status: z.string().optional(),
    search: z.string().optional(), // code, name, or phone
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }).parse(data))
  .handler(async ({ data: input }) => {
    const adminUser = await requireAdmin();
    const { page, pageSize, status, search, dateFrom, dateTo } = input;
    
    let query = supabase
      .from('tickets')
      .select('*, profiles(name, phone)', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);
    
    if (search) {
       query = query.or(`code.ilike.%${search}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      tickets: data,
      totalCount: count || 0,
      page,
      pageSize
    };
  });

export const getAdminTicketDetail = createServerFn({ method: "GET" })
  .validator((data: any) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*, profiles(*), ticket_selections(*)')
      .eq('id', data.id)
      .single();

    if (ticketError) throw ticketError;
    return ticket;
  });
