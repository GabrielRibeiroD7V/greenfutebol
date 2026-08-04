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

    // 1. Validar a data tanto pelo formato YYYY-MM-DD quanto como data real.
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

    // 2. Validar o secret antes do fetch (sem non-null assertion)
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

    // 5. Preservar os códigos externos corretamente
    if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404 || response.status === 429) {
      const errorBody: any = { error: `Football provider error: ${response.status}` };
      if (response.status === 429) {
        const resetSeconds = response.headers.get("X-RequestCounter-Reset");
        if (resetSeconds) {
          errorBody.retry_after_seconds = parseInt(resetSeconds, 10);
        }
      }
      return new Response(JSON.stringify(errorBody), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: response.status,
      });
    }

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Football provider error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502,
      });
    }

    const data = await response.json();

    // 3. Validar Array.isArray(data.matches)
    if (!data || !Array.isArray(data.matches)) {
      return new Response(JSON.stringify({ error: "Invalid structural response" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502,
      });
    }

    // 4. Incluir no statusMap: EXTRA_TIME e PENALTY_SHOOTOUT
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

    const fixtures = data.matches
      .map((match: any) => {
        // 8. Validar a estrutura mínima de cada match antes de normalizar.
        if (!match.id || !match.homeTeam?.name || !match.awayTeam?.name || !match.utcDate) {
          return null;
        }

        // 7. Usar optional chaining
        return {
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
        };
      })
      .filter((f: any) => f !== null);

    // If any essential records were invalid and we filtered them all, or the response was structurally sound but empty due to invalidity
    if (data.matches.length > 0 && fixtures.length === 0) {
      return new Response(JSON.stringify({ error: "Failed to parse matches safely" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502,
      });
    }

    // Sort by kickoff_at
    fixtures.sort((a: any, b: any) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());

    // 6. Todas as respostas JSON devem incluir Content-Type: application/json
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