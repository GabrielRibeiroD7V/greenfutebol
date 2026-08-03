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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch (_e) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { date } = body;

    // Rigorous YYYY-MM-DD validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!date || !dateRegex.test(date)) {
      return new Response(JSON.stringify({ error: "Invalid or missing date format (YYYY-MM-DD)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      return new Response(JSON.stringify({ error: "Invalid date value" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const apiKey = Deno.env.get("API_FOOTBALL_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server secret missing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const apiUrl = `https://v3.football.api-sports.io/fixtures?date=${encodeURIComponent(date)}`;
    const response = await fetch(apiUrl, {
      headers: {
        "x-apisports-key": apiKey,
      },
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "API error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: response.status,
      });
    }

    const data = await response.json();

    const fixtures = (data.response || []).map((item: any) => ({
      fixture_id: item.fixture.id,
      league_name: item.league.name,
      league_logo: item.league.logo || null,
      country: item.league.country,
      home_team_name: item.teams.home.name,
      home_team_logo: item.teams.home.logo || null,
      away_team_name: item.teams.away.name,
      away_team_logo: item.teams.away.logo || null,
      kickoff_at: item.fixture.date, // ISO format preserved
      venue: item.fixture.venue.name || null,
      status: item.fixture.status.short,
      elapsed: item.fixture.status.elapsed || null,
      home_score: item.goals.home,
      away_score: item.goals.away,
    }));

    return new Response(JSON.stringify({ fixtures }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
