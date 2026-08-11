import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getFixtures = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ 
    date: z.string().optional(),
    competition_code: z.string().optional(),
    live_only: z.boolean().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    const { date, competition_code, live_only } = data;
    
    const { data: response, error } = await supabase.functions.invoke("get-football-fixtures", {
      body: { 
        date, 
        competition_code,
        live_only
      }
    });

    if (error) throw error;
    return response;
  });
