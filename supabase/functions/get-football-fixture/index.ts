import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { fixture_id } = await req.json();

    if (!Number.isInteger(fixture_id) || fixture_id <= 0) {
      return new Response(JSON.stringify({ error: "fixture_id inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("API_FOOTBALL_KEY");
    if (!apiKey) {
      console.error("API_FOOTBALL_KEY não configurada");
      return new Response(JSON.stringify({ error: "Erro interno no servidor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?id=${encodeURIComponent(fixture_id)}`,
      {
        headers: {
          "x-apisports-key": apiKey,
        },
      }
    );

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições atingido" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Erro ao buscar dados do provedor externo" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    if (
      !data ||
      typeof data !== "object" ||
      !Array.isArray(data.response)
    ) {
      return new Response(JSON.stringify({ error: "Resposta estrutural inválida do provedor" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (data.response.length === 0) {
      return new Response(JSON.stringify({ error: "Partida não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const match = data.response[0];
    const { fixture, league, teams, goals, score } = match;

    const normalized = {
      fixture: {
        fixture_id: fixture.id,
        league_id: league.id,
        league_name: league.name,
        league_logo: league.logo ?? null,
        country: league.country,
        season: league.season,
        round: league.round ?? null,
        home_team_id: teams.home.id,
        home_team_name: teams.home.name,
        home_team_logo: teams.home.logo ?? null,
        away_team_id: teams.away.id,
        away_team_name: teams.away.name,
        away_team_logo: teams.away.logo ?? null,
        kickoff_at: fixture.date,
        venue: fixture.venue?.name ?? null,
        city: fixture.venue?.city ?? null,
        status: fixture.status.short,
        status_long: fixture.status.long,
        elapsed: fixture.status.elapsed ?? null,
        home_score: goals.home ?? 0,
        away_score: goals.away ?? 0,
        halftime_home: score.halftime?.home ?? null,
        halftime_away: score.halftime?.away ?? null,
        fulltime_home: score.fulltime?.home ?? null,
        fulltime_away: score.fulltime?.away ?? null,
      },
    };

    return new Response(JSON.stringify(normalized), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro na Edge Function:", err);
    return new Response(JSON.stringify({ error: "Erro ao processar requisição" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
