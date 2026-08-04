import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Determina a data YYYY-MM-DD em America/Campo_Grande
function getTodayCampoGrande(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Campo_Grande",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

function getTomorrowCampoGrande(): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Campo_Grande",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(tomorrow);
}

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

    const { date, competition_code } = body;
    const competitionCode = competition_code || "BSA";
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!date || !dateRegex.test(date)) {
      return new Response(JSON.stringify({ error: "Invalid or missing date format (YYYY-MM-DD)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!["BSA", "PL", "CL"].includes(competitionCode)) {
      return new Response(JSON.stringify({ error: "Invalid competition code" }), {
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

    const cacheKey = `${competitionCode}:${date}`;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    let supabaseAdmin: any = null;
    if (supabaseUrl && supabaseServiceKey) {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    } else {
      console.log(JSON.stringify({ event: "cache_read_error", competition_code: competitionCode, fixture_date: date }));
    }

    // 1. Tentar leitura do cache
    if (supabaseAdmin) {
      try {
        const { data: cacheData, error: cacheError } = await supabaseAdmin
          .from("football_fixtures_cache")
          .select("payload, expires_at, fetched_at")
          .eq("cache_key", cacheKey)
          .maybeSingle();

        if (cacheError) {
          console.log(JSON.stringify({ event: "cache_read_error", competition_code: competitionCode, fixture_date: date }));
        } else if (cacheData) {
          const expiresAt = new Date(cacheData.expires_at);
          if (expiresAt > new Date()) {
            // Cache hit
            const payload = cacheData.payload;
            if (payload && typeof payload === "object" && Array.isArray(payload.fixtures)) {
              console.log(JSON.stringify({ event: "cache_hit", competition_code: competitionCode, fixture_date: date }));
              return new Response(JSON.stringify(payload), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              });
            } else {
              // Corrompido
              console.log(JSON.stringify({ event: "cache_expired", competition_code: competitionCode, fixture_date: date }));
            }
          } else {
            console.log(JSON.stringify({ event: "cache_expired", competition_code: competitionCode, fixture_date: date }));
          }
        } else {
          console.log(JSON.stringify({ event: "cache_miss", competition_code: competitionCode, fixture_date: date }));
        }
      } catch (err) {
        console.log(JSON.stringify({ event: "cache_read_error", competition_code: competitionCode, fixture_date: date }));
      }
    }

    // 2. Fetch do provedor
    const apiToken = Deno.env.get("FOOTBALL_DATA_API_TOKEN");
    if (!apiToken) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log(JSON.stringify({ event: "provider_fetch", competition_code: competitionCode, fixture_date: date }));
    const year = date.split('-')[0];
    const url = new URL(`https://api.football-data.org/v4/competitions/${competitionCode}/matches`);
    url.searchParams.set("dateFrom", date);
    url.searchParams.set("dateTo", date);
    url.searchParams.set("season", year);

    const providerResponse = await fetch(url.toString(), {
      headers: { "X-Auth-Token": apiToken },
    });

    if (!providerResponse.ok) {
      let errorCode: number | null = null;
      try {
        const errorData = await providerResponse.json();
        errorCode = errorData.errorCode || null;
      } catch (_e) {}

      if (providerResponse.status === 400 && errorCode === 404) {
        return new Response(JSON.stringify({ error: "Matches not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }

      if ([400, 401, 403, 404, 429].includes(providerResponse.status)) {
        const errorBody: any = { error: `Football provider error: ${providerResponse.status}` };
        if (providerResponse.status === 429) {
          const resetSeconds = providerResponse.headers.get("X-RequestCounter-Reset");
          if (resetSeconds) errorBody.retry_after_seconds = parseInt(resetSeconds, 10);
        }
        return new Response(JSON.stringify(errorBody), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: providerResponse.status,
        });
      }
      return new Response(JSON.stringify({ error: "Football provider error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502,
      });
    }

    const data = await providerResponse.json();
    if (!data || !Array.isArray(data.matches)) {
      return new Response(JSON.stringify({ error: "Invalid structural response" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502,
      });
    }

    const statusMap: Record<string, string> = {
      "SCHEDULED": "NS", "TIMED": "NS", "IN_PLAY": "LIVE", "PAUSED": "HT",
      "EXTRA_TIME": "ET", "PENALTY_SHOOTOUT": "P", "FINISHED": "FT",
      "AWARDED": "FT", "SUSPENDED": "SUSP", "POSTPONED": "PST", "CANCELLED": "CANC",
    };

    for (const match of data.matches) {
      const isValid = 
        match &&
        Number.isInteger(match.id) && match.id > 0 &&
        match.competition?.name &&
        match.area?.name &&
        match.homeTeam?.name &&
        match.awayTeam?.name &&
        match.utcDate && !isNaN(new Date(match.utcDate).getTime()) &&
        typeof match.status === "string" &&
        match.score && typeof match.score === "object";

      if (!isValid) {
        return new Response(JSON.stringify({ error: "Football provider structural error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        });
      }
    }

    const fixtures = data.matches.map((match: any) => ({
      fixture_id: match.id,
      league_name: match.competition.name,
      league_logo: match.competition.emblem ?? null,
      country: match.area.name,
      home_team_name: match.homeTeam.name,
      home_team_logo: match.homeTeam.crest ?? null,
      away_team_name: match.awayTeam.name,
      away_team_logo: match.awayTeam.crest ?? null,
      kickoff_at: match.utcDate,
      venue: match.venue ?? null,
      status: statusMap[match.status] || match.status,
      elapsed: typeof match.minute === 'number' ? match.minute : null,
      home_score: match.score.fullTime?.home ?? null,
      away_score: match.score.fullTime?.away ?? null,
    }));

    fixtures.sort((a: any, b: any) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
    const payload = { fixtures };

    // 3. TTL Logic
    const todayStr = getTodayCampoGrande();
    const tomorrowStr = getTomorrowCampoGrande();
    let ttlSeconds = 900; // Default 15 min

    const isToday = date === todayStr;
    const isTomorrow = date === tomorrowStr;
    const isPast = date < todayStr;
    const isFuture = date > tomorrowStr;

    if (fixtures.length === 0) {
      if (isPast) ttlSeconds = 7 * 24 * 60 * 60;
      else if (isToday) ttlSeconds = 15 * 60;
      else if (isTomorrow) ttlSeconds = 6 * 60 * 60;
      else ttlSeconds = 12 * 60 * 60;
    } else if (isToday) {
      const hasLive = fixtures.some((f: any) => ["LIVE", "HT", "ET", "P"].includes(f.status));
      const allFinished = fixtures.every((f: any) => f.status === "FT");
      if (hasLive) ttlSeconds = 60;
      else if (allFinished) ttlSeconds = 24 * 60 * 60;
      else ttlSeconds = 15 * 60;
    } else if (isTomorrow) {
      ttlSeconds = 6 * 60 * 60;
    } else if (isFuture) {
      ttlSeconds = 12 * 60 * 60;
    } else if (isPast) {
      const allFinished = fixtures.every((f: any) => f.status === "FT");
      if (allFinished) ttlSeconds = 7 * 24 * 60 * 60;
      else ttlSeconds = 15 * 60;
    }

    // 4. Upsert
    if (supabaseAdmin) {
      try {
        const nowIso = new Date().toISOString();
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
        const { error: upsertError } = await supabaseAdmin
          .from("football_fixtures_cache")
          .upsert({
            cache_key: cacheKey,
            competition_code: competitionCode,
            fixture_date: date,
            payload,
            fetched_at: nowIso,
            expires_at: expiresAt,
            updated_at: nowIso,
          }, { onConflict: "cache_key" });

        if (upsertError) {
          console.log(JSON.stringify({ event: "cache_write_error", competition_code: competitionCode, fixture_date: date }));
        }
      } catch (err) {
        console.log(JSON.stringify({ event: "cache_write_error", competition_code: competitionCode, fixture_date: date }));
      }
    }

    return new Response(JSON.stringify(payload), {
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
