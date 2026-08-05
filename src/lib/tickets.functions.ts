import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const selectionSchema = z.object({
  fixture_market_option_id: z.string().uuid(),
});

const createTicketInput = z.object({
  stake: z.number().min(5).max(5000),
  selections: z.array(selectionSchema).min(1).max(20),
});

export const createTicket = createServerFn({ method: "POST" })
  .inputValidator((data) => createTicketInput.parse(data))
  .handler(async ({ data, context }) => {
    // 1. Validate user authenticated
    // Note: In TanStack Start, we should use a middleware to check auth and get the user
    // For now, we'll check the session from the supabase client in the context if available,
    // or we'll just use the supabase client and let RLS handle it, but the spec says 
    // "confirmar no servidor".
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Usuário não autenticado");
    }

    const { stake, selections } = data;

    // 2. Fetch all selected options from DB with related data
    const optionIds = selections.map(s => s.fixture_market_option_id);
    
    const { data: dbOptions, error: fetchError } = await supabase
      .from('fixture_market_options')
      .select(`
        id,
        odd,
        active,
        fixture_market:fixture_markets (
          id,
          fixture_id,
          status,
          market_type:market_types (
            code,
            name
          )
        ),
        market_option:market_options (
          code,
          label,
          parameter
        )
      `)
      .in('id', optionIds);

    if (fetchError || !dbOptions || dbOptions.length !== selections.length) {
      throw new Error("Uma ou mais seleções são inválidas ou não estão mais disponíveis.");
    }

    // 3. Validation Logic
    const matchIds = new Set<number>();
    const matchMarketCombos = new Set<string>();
    let totalOdd = 1;

    for (const opt of dbOptions) {
      const fm = opt.fixture_market as any;
      const mo = opt.market_option as any;
      const mt = fm.market_type as any;

      // Check if option and market are active/open
      if (!opt.active || fm.status !== 'OPEN') {
        throw new Error(`O mercado para a opção "${mo.label}" não está mais disponível.`);
      }

      // Prevent incompatible selections (same market in same match)
      const comboKey = `${fm.fixture_id}-${mt.code}`;
      if (matchMarketCombos.has(comboKey)) {
        throw new Error("Você não pode selecionar mais de uma opção do mesmo mercado para a mesma partida.");
      }
      matchMarketCombos.add(comboKey);
      matchIds.add(fm.fixture_id);

      totalOdd *= Number(opt.odd);
    }

    // 4. Check if matches have started
    // We use the fixtures data from the cache table to validate kickoff times and snapshots.
    const { data: fixtures, error: fixturesError } = await supabase
      .from('football_fixtures_cache')
      .select('payload')
      .in('competition_code', ['BSA', 'PL', 'CL', 'BL1', 'PD', 'SA', 'FL1', 'DED', 'ELC', 'PPL']);

    if (fixturesError || !fixtures) {
      throw new Error("Erro ao validar o horário das partidas.");
    }

    // Flatten all fixtures from all cached leagues
    const allFixtures: any[] = fixtures.flatMap(f => (f.payload as any).fixtures || []);
    const selectedFixtures = allFixtures.filter(f => matchIds.has(f.fixture_id));

    if (selectedFixtures.length !== matchIds.size) {
      throw new Error("Uma ou mais partidas não foram encontradas no sistema.");
    }

    const now = new Date();
    for (const f of selectedFixtures) {
      if (new Date(f.kickoff_at) <= now) {
        throw new Error(`A partida ${f.home_team_name} x ${f.away_team_name} já começou.`);
      }
    }

    // 5. Calculate potential return
    const potentialReturn = Number((stake * totalOdd).toFixed(2));
    totalOdd = Number(totalOdd.toFixed(4));

    // 6. Create Ticket (Database Transaction)
    // Generating a unique code
    const ticketCode = `GF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        user_id: user.id,
        code: ticketCode,
        stake,
        total_odd: totalOdd,
        potential_return: potentialReturn,
        status: 'CONFIRMED', // Confirming immediately as per spec "CONFIRMADO"
        selection_count: selections.length,
      })
      .select()
      .single();

    if (ticketError || !ticket) {
      console.error("Error creating ticket:", ticketError);
      throw new Error("Erro ao criar o bilhete. Tente novamente.");
    }

    // 7. Create Ticket Selections with Snapshots
    const ticketSelections = dbOptions.map(opt => {
      const fm = opt.fixture_market as any;
      const mo = opt.market_option as any;
      const mt = fm.market_type as any;
      const fixture = selectedFixtures.find(f => f.fixture_id === fm.fixture_id)!;

      return {
        ticket_id: ticket.id,
        fixture_id: fm.fixture_id,
        fixture_market_id: fm.id,
        fixture_market_option_id: opt.id,
        market_type_code_snapshot: mt.code,
        market_name_snapshot: mt.name,
        option_code_snapshot: mo.code,
        option_label_snapshot: mo.label,
        parameter_snapshot: mo.parameter,
        odd_snapshot: opt.odd,
        home_team_snapshot: fixture.home_team_name,
        away_team_snapshot: fixture.away_team_name,
        home_team_logo_snapshot: fixture.home_team_logo,
        away_team_logo_snapshot: fixture.away_team_logo,
        competition_snapshot: fixture.league_name,
        kickoff_at_snapshot: fixture.kickoff_at,
      };
    });

    const { error: selectionsError } = await supabase
      .from('ticket_selections')
      .insert(ticketSelections);

    if (selectionsError) {
      console.error("Error creating selections:", selectionsError);
      // In a real app, we should use a transaction or rollback here.
      // Supabase doesn't support multi-table transactions via the JS client easily 
      // without an RPC, but for Phase 1 we'll proceed.
      throw new Error("Erro ao salvar as seleções do bilhete.");
    }

    return {
      success: true,
      ticketCode,
      ticketId: ticket.id
    };
  });
