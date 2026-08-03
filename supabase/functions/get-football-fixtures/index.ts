import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-apisports-key",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { date } = await req.json();

    // 1. Validate date
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(
        JSON.stringify({ error: "Data inválida. Use o formato YYYY-MM-DD." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Read API Key from Secrets
    const apiKey = Deno.env.get("API_FOOTBALL_KEY");
    if (!apiKey) {
      console.error("API_FOOTBALL_KEY não configurada nos Secrets.");
      return new Response(
        JSON.stringify({ error: "Erro de configuração no servidor." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Call API-Sports
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${date}`,
      {
        method: "GET",
        headers: {
          "x-apisports-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("API-Sports Error:", errorData);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar dados na API externa." }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // 4. Handle API Limits/Errors in body
    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error("API-Sports Logic Error:", data.errors);
      return new Response(
        JSON.stringify({ error: "Limite de requisições atingido ou erro na API.", details: data.errors }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Normalize response
    const normalizedData = data.response.map((item: any) => ({
      fixture_id: item.fixture.id,
      league_name: item.league.name,
      league_logo: item.league.logo,
      country: item.league.country,
      home_team_name: item.teams.home.name,
      home_team_logo: item.teams.home.logo,
      away_team_name: item.teams.away.name,
      away_team_logo: item.teams.away.logo,
      kickoff_at: item.fixture.date,
      venue: item.fixture.venue.name,
      status: item.fixture.status.long,
      elapsed: item.fixture.status.elapsed,
      home_score: item.goals.home,
      away_score: item.goals.away,
    }));

    return new Response(JSON.stringify(normalizedData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar a requisição." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
