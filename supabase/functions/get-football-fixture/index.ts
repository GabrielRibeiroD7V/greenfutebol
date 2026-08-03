const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (_err) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { fixture_id } = body;

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
      return new Response(JSON.stringify({ error: "Erro interno no servidor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    if (!data || typeof data !== "object" || !Array.isArray(data.response)) {
      return new Response(JSON.stringify({ error: "Invalid response from football provider" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (data.response.length === 0) {
      return new Response(JSON.stringify({ error: "Fixture not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const match = data.response[0];

    if (!match.fixture || !match.league || !match.teams?.home || !match.teams?.away) {
      return new Response(JSON.stringify({ error: "Invalid response from football provider" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = {
      fixture: {
        fixture_id: match.fixture.id,
        league_id: match.league.id,
        league_name: match.league.name,
        league_logo: match.league.logo ?? null,
        country: match.league.country,
        season: match.league.season,
        round: match.league.round ?? null,
        home_team_id: match.teams.home.id,
        home_team_name: match.teams.home.name,
        home_team_logo: match.teams.home.logo ?? null,
        away_team_id: match.teams.away.id,
        away_team_name: match.teams.away.name,
        away_team_logo: match.teams.away.logo ?? null,
        kickoff_at: match.fixture.date,
        venue: match.fixture.venue?.name ?? null,
        city: match.fixture.venue?.city ?? null,
        status: match.fixture.status.short,
        status_long: match.fixture.status.long,
        elapsed: match.fixture.status.elapsed ?? null,
        home_score: match.goals?.home ?? null,
        away_score: match.goals?.away ?? null,
        halftime_home: match.score?.halftime?.home ?? null,
        halftime_away: match.score?.halftime?.away ?? null,
        fulltime_home: match.score?.fulltime?.home ?? null,
        fulltime_away: match.score?.fulltime?.away ?? null,
      },
    };

    return new Response(JSON.stringify(normalized), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro na Edge Function:", err);
    return new Response(JSON.stringify({ error: "Erro interno no servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});