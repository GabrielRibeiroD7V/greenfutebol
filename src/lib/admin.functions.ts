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

export const prepareFixtureMarkets = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({ fixture_id: z.number() }).parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { fixture_id } = data;

    // Get competition code
    const { data: fixture } = await supabase
      .from('fixtures')
      .select('competition_code')
      .eq('provider_fixture_id', fixture_id)
      .single();
    
    const compCode = fixture?.competition_code || 'DEMO';

    // Market templates for homologation
    const templates = [
      { type: '1X2', name: 'Resultado Final', group: 'RESULT', selections: [{ k: 'H', n: 'Casa' }, { k: 'D', n: 'Empate' }, { k: 'A', n: 'Fora' }] },
      { type: 'DC', name: 'Dupla Chance', group: 'RESULT', selections: [{ k: '1X', n: '1X' }, { k: '12', n: '12' }, { k: 'X2', n: 'X2' }] },
      { type: 'DNB', name: 'Empate Anula', group: 'RESULT', selections: [{ k: 'H', n: 'Casa' }, { k: 'A', n: 'Fora' }] },
      { type: 'BTTS', name: 'Ambas Marcam', group: 'RESULT', selections: [{ k: 'YES', n: 'Sim' }, { k: 'NO', n: 'Não' }] },
      { type: 'OU', name: 'Total de Gols', group: 'GOALS', line: 1.5, selections: [{ k: 'OVER', n: 'Mais de 1.5' }, { k: 'UNDER', n: 'Menos de 1.5' }] },
      { type: 'OU', name: 'Total de Gols', group: 'GOALS', line: 2.5, selections: [{ k: 'OVER', n: 'Mais de 2.5' }, { k: 'UNDER', n: 'Menos de 2.5' }] },
      { type: 'CS', name: 'Placar Exato', group: 'SCORE', selections: [{ k: '0:0', n: '0 x 0' }, { k: '1:0', n: '1 x 0' }, { k: '0:1', n: '0 x 1' }, { k: '1:1', n: '1 x 1' }, { k: '2:1', n: '2 x 1' }] },
      { type: 'OU', name: 'Escanteios', group: 'CORNERS', line: 8.5, selections: [{ k: 'OVER', n: 'Mais de 8.5' }, { k: 'UNDER', n: 'Menos de 8.5' }] },
    ];

    for (const t of templates) {
      const { data: fm, error: fmError } = await supabase
        .from('fixture_markets')
        .insert({
          fixture_id,
          competition_code: compCode,
          market_type: t.type,
          market_name: t.name,
          market_group: t.group,
          line: t.line || null,
          status: 'DRAFT'
        })
        .select()
        .single();

      if (fmError) continue;

      const selections = t.selections.map((s, idx) => ({
        market_id: fm.id,
        selection_key: s.k,
        selection_name: s.n,
        odd: 0, // Zero tolerance for mocks. Must be 0 (technically invalid odd) until manually set.
        sort_order: idx,
        status: 'DRAFT'
      }));

      await supabase.from('fixture_market_selections').insert(selections);
    }

    return { success: true };
  });
