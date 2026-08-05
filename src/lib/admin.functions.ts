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

// --- ADMIN MARKETS ---

export const updateMarketOption = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({
    optionId: z.string().uuid(),
    odd: z.number().min(1.01).optional(),
    active: z.boolean().optional(),
    action: z.string() // 'UPDATE_ODD', 'TOGGLE_ACTIVE', etc.
  }).parse(data))
  .handler(async ({ data: input }) => {
    const adminUser = await requireAdmin();
    const { optionId, odd, active, action } = input;

    const { data: current, error: fetchError } = await supabase
      .from('fixture_market_options')
      .select('*')
      .eq('id', optionId)
      .single();
    
    if (fetchError || !current) throw new Error("Opção não encontrada");

    const updates: any = { updated_at: new Date().toISOString() };
    if (odd !== undefined) {
      updates.odd = odd;
      updates.version = (current.version || 0) + 1;
    }
    if (active !== undefined) updates.active = active;

    const { error: updateError } = await supabase
      .from('fixture_market_options')
      .update(updates)
      .eq('id', optionId);

    if (updateError) throw updateError;

    await supabase.from('market_option_audit_logs').insert({
      fixture_market_option_id: optionId,
      admin_user_id: adminUser.id,
      old_odd: current.odd,
      new_odd: odd !== undefined ? odd : current.odd,
      old_active: current.active,
      new_active: active !== undefined ? active : current.active,
      action: action
    });

    return { success: true };
  });

export const updateMarketStatus = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({
    marketId: z.string().uuid(),
    status: z.enum(['OPEN', 'SUSPENDED', 'CLOSED', 'SETTLED', 'CANCELLED'])
  }).parse(data))
  .handler(async ({ data: input }) => {
    await requireAdmin();
    
    const { error } = await supabase
      .from('fixture_markets')
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq('id', input.marketId);

    if (error) throw error;
    return { success: true };
  });

const generateMockOddsInput = z.object({
  fixture_id: z.number(),
});

export const generateMockOdds = createServerFn({ method: "POST" })
  .validator((data: any) => generateMockOddsInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { fixture_id } = data;

    const { data: marketTypes, error: mtError } = await supabase
      .from('market_types')
      .select('*, market_options(*)');

    if (mtError || !marketTypes) {
      throw new Error("Erro ao buscar tipos de mercado.");
    }

    for (const mt of marketTypes) {
      const { data: fm, error: fmError } = await supabase
        .from('fixture_markets')
        .upsert({
          fixture_id,
          market_type_id: mt.id,
          status: 'OPEN'
        }, { onConflict: 'fixture_id,market_type_id' })
        .select()
        .single();

      if (fmError || !fm) {
        console.error(`Error creating fixture_market for ${mt.code}:`, fmError);
        continue;
      }

      const options = mt.market_options as any[];
      const fixtureMarketOptions = options.map(opt => {
        const odd = (Math.random() * (5.0 - 1.1) + 1.1).toFixed(2);
        return {
          fixture_market_id: fm.id,
          market_option_id: opt.id,
          odd: Number(odd),
          active: true
        };
      });

      const { error: fmoError } = await supabase
        .from('fixture_market_options')
        .upsert(fixtureMarketOptions, { onConflict: 'fixture_market_id,market_option_id' });

      if (fmoError) {
        console.error(`Error creating fixture_market_options for ${mt.code}:`, fmoError);
      }
    }

    return { success: true };
  });
