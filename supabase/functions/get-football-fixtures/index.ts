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

    const apiToken = Deno.env.get("FOOTBALL_DATA_API_TOKEN");
    if (!apiToken) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const year = date.split('-')[0];
    const url = new URL("https://api.football-data.org/v4/competitions/BSA/matches");
    url.searchParams.set("dateFrom", date);
    url.searchParams.set("dateTo", date);
    url.searchParams.set("season", year);

    const response = await fetch(url.toString(), {
      headers: {
        "X-Auth-Token": apiToken,
      },
    });

    if (response.status === 401) {
      return new Response(JSON.stringify({ error: "Invalid API token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    if (response.status === 403) {
      return new Response(JSON.stringify({ error: "Access to this competition is restricted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    if (response.status === 429) {
      const resetSeconds = response.headers.get("X-RequestCounter-Reset");
      const errorBody: any = { error: "Rate limit reached" };
      if (resetSeconds) {
        errorBody.retry_after_seconds = parseInt(resetSeconds, 10);
      }
      return new Response(JSON.stringify(errorBody), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Football provider error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: response.status === 404 ? 404 : 502,
      });
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.matches)) {
      return new Response(JSON.stringify({ error: "Invalid structural response" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502,
      });
    }

    const statusMap: Record<string, string> = {
      "SCHEDULED": "NS",
      "TIMED": "NS",
      "IN_PLAY": "LIVE",
      "PAUSED": "HT",
      "EXTRA_TIME": "ET",
      "PENALTY_SHOOTOUT": "P",
      "FINISHED": "FT",
      "AWARDED": "FT",
      "SUSPENDED": "SUSP",
      "POSTPONED": "PST",
      "CANCELLED": "CANC",
    };

    const fixtures = data.matches.map((match: any) => ({
      fixture_id: match.id,
      league_name: match.competition?.name || "Campeonato Brasileiro Série A",
      league_logo: match.competition?.emblem ?? null,
      country: match.area?.name || "Brazil",
      home_team_name: match.homeTeam?.name ?? "Unknown",
      home_team_logo: match.homeTeam?.crest ?? null,
      away_team_name: match.awayTeam?.name ?? "Unknown",
      away_team_logo: match.awayTeam?.crest ?? null,
      kickoff_at: match.utcDate,
      venue: match.venue ?? null,
      status: statusMap[match.status] || match.status,
      elapsed: typeof match.minute === 'number' ? match.minute : null,
      home_score: match.score?.fullTime?.home ?? null,
      away_score: match.score?.fullTime?.away ?? null,
    }));

    // Sort by kickoff_at
    fixtures.sort((a: any, b: any) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());

    return new Response(JSON.stringify({ fixtures }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Internal error:", error);
    return new Response(JSON.stringify({ error: "Unexpected error occurred" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
