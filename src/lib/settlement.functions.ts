import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getFixtureResults = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ fixture_id: z.number().optional() }).parse(data))
  .handler(async ({ data }) => {
    let query = supabase.from('fixture_results').select('*');
    if (data.fixture_id) {
      query = query.eq('fixture_id', data.fixture_id);
    }
    const { data: results, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return { results };
  });

export const saveFixtureResult = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    fixture_id: z.number(),
    status: z.string(),
    home_score: z.number().nullable(),
    away_score: z.number().nullable(),
    first_half_home_score: z.number().nullable(),
    first_half_away_score: z.number().nullable(),
    home_corners: z.number().nullable(),
    away_corners: z.number().nullable(),
    home_cards: z.number().nullable(),
    away_cards: z.number().nullable(),
    confirmed: z.boolean().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    const { fixture_id, confirmed, ...payload } = data;
    
    const updateData: any = {
      ...payload,
      updated_at: new Date().toISOString()
    };

    if (confirmed) {
      const { data: userData } = await supabase.auth.getUser();
      updateData.confirmed_at = new Date().toISOString();
      updateData.confirmed_by = userData.user?.id;
    }

    const { error } = await supabase
      .from('fixture_results')
      .upsert({ fixture_id, ...updateData });

    if (error) throw error;
    return { success: true };
  });

export const previewSettlement = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ fixture_id: z.number() }).parse(data))
  .handler(async ({ data }) => {
    const { data: preview, error } = await supabase.rpc('preview_fixture_settlement', { 
      p_fixture_id: data.fixture_id 
    });
    if (error) throw error;
    return { preview };
  });

export const settleFixture = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ fixture_id: z.number() }).parse(data))
  .handler(async ({ data }) => {
    const { data: result, error } = await supabase.rpc('settle_fixture_atomic', { 
      p_fixture_id: data.fixture_id 
    });
    if (error) throw error;
    return result;
  });
