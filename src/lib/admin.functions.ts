import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const generateMockOddsInput = z.object({
  fixture_id: z.number(),
});

export const generateMockOdds = createServerFn({ method: "POST" })
  .inputValidator((data) => generateMockOddsInput.parse(data))
  .handler(async ({ data }) => {
    // 1. Server-side Authentication and Authorization check
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user has 'admin' role using the security function
    const { data: hasRole, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError || !hasRole) {
      console.error("Auth error or non-admin attempt:", roleError);
      throw new Error("Unauthorized: Admin access required");
    }

    const { fixture_id } = data;

    // 2. Get all market types and their options
    const { data: marketTypes, error: mtError } = await supabase
      .from('market_types')
      .select('*, market_options(*)');

    if (mtError || !marketTypes) {
      throw new Error("Erro ao buscar tipos de mercado.");
    }

    // 3. For each market type, create a fixture_market
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

      // 4. For each option in the market, create a fixture_market_option with mock odds
      const options = mt.market_options as any[];
      const fixtureMarketOptions = options.map(opt => {
        // Generate a random odd between 1.10 and 5.00
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
