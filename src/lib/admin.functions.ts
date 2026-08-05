import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const generateMockOddsInput = z.object({
  fixture_id: z.number(),
});

export const generateMockOdds = createServerFn({ method: "POST" })
  .inputValidator((data) => generateMockOddsInput.parse(data))
  .handler(async ({ data }) => {
    const { fixture_id } = data;

    // 1. Get all market types and their options
    const { data: marketTypes, error: mtError } = await supabase
      .from('market_types')
      .select('*, market_options(*)');

    if (mtError || !marketTypes) {
      throw new Error("Erro ao buscar tipos de mercado.");
    }

    // 2. For each market type, create a fixture_market
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

      // 3. For each option in the market, create a fixture_market_option with mock odds
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
