import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Este endpoint é público e deve ser chamado por um cron externo ou admin
// Deve conter verificação de segurança no futuro
export const Route = createFileRoute("/api/public/sync-fixtures")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // No ambiente TSS, usamos o admin client importado dinamicamente para evitar vazamento
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const body = await request.json();
          const { date, competition_code } = body;
          
          const apiKey = process.env["API_FOOTBALL_KEY"];
          if (!apiKey) {
            return new Response("API_FOOTBALL_KEY not set", { status: 500 });
          }

          // 1. Buscar no Provedor
          const url = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}${competition_code && competition_code !== 'ALL' ? `&competitions=${competition_code}` : ''}`;
          
          const response = await fetch(url, {
            headers: { "X-Auth-Token": apiKey }
          });

          if (!response.ok) {
            const errorText = await response.text();
            return new Response(`Provider error: ${response.status} - ${errorText}`, { status: response.status });
          }

          const data = await response.json();
          const matches = data.matches || [];

          // 2. Upsert na tabela persistente 'fixtures'
          const fixturesToUpsert = matches.map((m: any) => ({
            provider: 'football-data.org',
            provider_fixture_id: m.id,
            competition_code: m.competition.code,
            competition_name: m.competition.name,
            country: m.area?.name,
            season: m.season?.startDate,
            home_team_id: m.homeTeam.id,
            home_team_name: m.homeTeam.name,
            home_team_crest: m.homeTeam.crest,
            away_team_id: m.awayTeam.id,
            away_team_name: m.awayTeam.name,
            away_team_crest: m.awayTeam.crest,
            kickoff_at: m.utcDate,
            status: m.status,
            home_score: m.score?.fullTime?.home,
            away_score: m.score?.fullTime?.away,
            venue: m.venue,
            last_synced_at: new Date().toISOString()
          }));

          if (fixturesToUpsert.length > 0) {
            const { error: upsertError } = await supabaseAdmin
              .from('fixtures')
              .upsert(fixturesToUpsert, { 
                onConflict: 'provider,provider_fixture_id' 
              });

            if (upsertError) {
              console.error("Upsert error:", upsertError);
              return new Response(`Upsert error: ${upsertError.message}`, { status: 500 });
            }
          }

          return Response.json({ 
            success: true, 
            count: fixturesToUpsert.length,
            date 
          });

        } catch (error: any) {
          console.error("Sync error:", error);
          return new Response(error.message, { status: 400 });
        }
      }
    }
  }
});
