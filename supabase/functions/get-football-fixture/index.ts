const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // 10. Confirm e corrija: método OPTIONS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 10. Confirm e corrija: método POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch (_err) {
      // 10. Confirm e corrija: JSON inválido
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fixture_id } = body;

    // 10. Confirm e corrija: fixture_id inteiro positivo
    if (!Number.isInteger(fixture_id) || fixture_id <= 0) {
      return new Response(JSON.stringify({ error: "fixture_id must be a positive integer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 10. Confirm e corrija: secret ausente (sem non-null assertion)
    const apiToken = Deno.env.get("FOOTBALL_DATA_API_TOKEN");
    if (!apiToken) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      `https://api.football-data.org/v4/matches/${fixture_id}`,
      {
        headers: {
          "X-Auth-Token": apiToken,
        },
      }
    );

    // 10. Confirm e corrija: status 400, 401, 403, 404, 429
    if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404 || response.status === 429) {
      const errorBody: any = { error: `Football provider error: ${response.status}` };
      if (response.status === 429) {
        const resetSeconds = response.headers.get("X-RequestCounter-Reset");
        if (resetSeconds) {
          errorBody.retry_after_seconds = parseInt(resetSeconds, 10);
        }
      }
      return new Response(JSON.stringify(errorBody), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Football provider error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const match = await response.json();

    // 10. Confirm e corrija: data individual estruturalmente válida
    if (!match || typeof match !== "object" || !match.id || !match.homeTeam || !match.awayTeam) {
      return new Response(JSON.stringify({ error: "Invalid structural response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const statusLongMap: Record<string, string> = {
      "SCHEDULED": "Não iniciado",
      "TIMED": "Não iniciado",
      "IN_PLAY": "Ao vivo",
      "PAUSED": "Intervalo",
      "EXTRA_TIME": "Prorrogação",
      "PENALTY_SHOOTOUT": "Pênaltis",
      "FINISHED": "Encerrado",
      "AWARDED": "Encerrado",
      "SUSPENDED": "Suspenso",
      "POSTPONED": "Adiado",
      "CANCELLED": "Cancelado",
    };

    // 10. season como number ou null
    const seasonYear = match.season?.startDate ? new Date(match.season.startDate).getFullYear() : null;

    const normalized = {
      fixture: {
        fixture_id: match.id,
        league_id: match.competition?.id ?? null,
        league_name: match.competition?.name ?? null,
        league_logo: match.competition?.emblem ?? null,
        country: match.area?.name ?? null,
        season: typeof seasonYear === 'number' ? seasonYear : null,
        // 10. round como string ou null
        round: match.matchday ? String(match.matchday) : (match.stage ?? null),
        home_team_id: match.homeTeam?.id ?? null,
        home_team_name: match.homeTeam?.name ?? null,
        home_team_logo: match.homeTeam?.crest ?? null,
        away_team_id: match.awayTeam?.id ?? null,
        away_team_name: match.awayTeam?.name ?? null,
        away_team_logo: match.awayTeam?.crest ?? null,
        kickoff_at: match.utcDate,
        venue: match.venue ?? null,
        // 10. city como null
        city: null,
        status: statusMap[match.status] || match.status,
        status_long: statusLongMap[match.status] || match.status,
        // 10. elapsed como number ou null
        elapsed: typeof match.minute === 'number' ? match.minute : null,
        // 10. placares preservando null
        home_score: match.score?.fullTime?.home ?? null,
        away_score: match.score?.fullTime?.away ?? null,
        halftime_home: match.score?.halfTime?.home ?? null,
        halftime_away: match.score?.halfTime?.away ?? null,
        fulltime_home: match.score?.fullTime?.home ?? null,
        fulltime_away: match.score?.fullTime?.away ?? null,
      },
    };

    return new Response(JSON.stringify(normalized), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Internal error:", err);
    return new Response(JSON.stringify({ error: "Unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});