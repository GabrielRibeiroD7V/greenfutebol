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
    pageSize: z.number().default(50),
    status: z.string().optional(),
    search: z.string().optional(),
    dateRange: z.string().optional(), // 'today', '7days', '30days'
    paymentMode: z.string().optional(),
    ticketType: z.string().optional(),
  }).parse(data))
  .handler(async ({ data: input }) => {
    await requireAdmin();
    const { page, pageSize, status, search, dateRange, paymentMode, ticketType } = input;
    
    let query = supabase
      .from('tickets')
      .select('*, profiles(name, phone, email)', { count: 'exact' });

    if (status && status !== 'ALL') query = query.eq('status', status);
    if (paymentMode) query = query.eq('payment_mode', paymentMode);
    
    if (dateRange === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.gte('created_at', today.toISOString());
    } else if (dateRange === '7days') {
      const date = new Date();
      date.setDate(date.getDate() - 7);
      query = query.gte('created_at', date.toISOString());
    } else if (dateRange === '30days') {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      query = query.gte('created_at', date.toISOString());
    }
    
    if (search) {
       query = query.or(`code.ilike.%${search}%,id.ilike.%${search}%`);
       // Note: complex profile joins searching needs extra work, but usually ID/Code is enough for admin
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

export const getAdminTicketsSummary = createServerFn({ method: "GET" })
  .handler(async () => {
    await requireAdmin();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const { data: summary, error } = await supabase.rpc('get_admin_tickets_summary', {
      _since: todayIso
    });

    if (error) {
      console.error("Summary error:", error);
      // Fallback for missing RPC
      return {
        todayCount: 0,
        todayStake: 0,
        pendingCount: 0,
        wonCount: 0,
        lostCount: 0,
        potentialExposure: 0
      };
    }
    return summary;
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

// --- ADMIN MARKETS (REFACTORED FOR PHASE 2) ---

export const updateMarketSelection = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({
    selectionId: z.string().uuid(),
    odd: z.number().min(1.01).optional(),
    status: z.string().optional(),
    action: z.string()
  }).parse(data))
  .handler(async ({ data: input }) => {
    const adminUser = await requireAdmin();
    const { selectionId, odd, status } = input;

    const updates: any = { updated_at: new Date().toISOString() };
    if (odd !== undefined) updates.odd = odd;
    if (status !== undefined) updates.status = status;

    const { error: updateError } = await supabase
      .from('fixture_market_selections')
      .update(updates)
      .eq('id', selectionId);

    if (updateError) throw updateError;

    return { success: true };
  });

export const updateMarketStatus = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({
    marketId: z.string().uuid(),
    status: z.string()
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

    // Phase 2: Use hardcoded templates since market_types was dropped
    const templates = [
      {
        market_type: '1X2',
        market_name: 'Resultado Final',
        market_group: 'RESULT',
        selections: [
          { key: 'H', name: 'Casa', odd: 1.85 },
          { key: 'D', name: 'Empate', odd: 3.40 },
          { key: 'A', name: 'Fora', odd: 4.20 },
        ]
      },
      {
        market_type: 'OU25',
        market_name: 'Total de Gols (2.5)',
        market_group: 'GOALS',
        line: 2.5,
        selections: [
          { key: 'OVER', name: 'Mais de 2.5', odd: 1.95 },
          { key: 'UNDER', name: 'Menos de 2.5', odd: 1.85 },
        ]
      }
    ];

    for (const t of templates) {
      const { data: fm, error: fmError } = await supabase
        .from('fixture_markets')
        .insert({
          fixture_id,
          competition_code: 'DEMO', // Required field
          market_type: t.market_type,
          market_name: t.market_name,
          market_group: t.market_group,
          line: t.line || null,
          status: 'OPEN'
        })
        .select()
        .single();

      if (fmError) {
        console.error(`Error creating market:`, fmError);
        continue;
      }

      const selections = t.selections.map((s, idx) => ({
        market_id: fm.id,
        selection_key: s.key,
        selection_name: s.name,
        odd: s.odd,
        sort_order: idx,
        status: 'OPEN'
      }));

      const { error: sError } = await supabase
        .from('fixture_market_selections')
        .insert(selections);

      if (sError) console.error(`Error creating selections:`, sError);
    }

    return { success: true };
  });
