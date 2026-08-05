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

    const validCompetitions = ["BSA", "PL", "CL", "BL1", "PD", "SA", "FL1", "DED", "ELC", "PPL"];
    if (competitionCode !== "ALL" && !validCompetitions.includes(competitionCode)) {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiToken = Deno.env.get("FOOTBALL_DATA_API_TOKEN");

    if (!apiToken) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    let supabaseAdmin: any = null;
    if (supabaseUrl && supabaseServiceKey) {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    }

    const competitionsToFetch = competitionCode === "ALL" ? validCompetitions : [competitionCode];
    let allFixtures: any[] = [];
    let isPartial = false;
    let apiCallCount = 0;

    const statusMap: Record<string, string> = {
      "SCHEDULED": "NS", "TIMED": "NS", "IN_PLAY": "LIVE", "PAUSED": "HT",
      "EXTRA_TIME": "ET", "PENALTY_SHOOTOUT": "P", "FINISHED": "FT",
      "AWARDED": "FT", "SUSPENDED": "SUSP", "POSTPONED": "PST", "CANCELLED": "CANC",
    };

    for (const comp of competitionsToFetch) {
      const cacheKey = `${comp}:${date}`;
      let compFixtures: any[] | null = null;

      // 1. Tentar leitura do cache
      if (supabaseAdmin) {
        try {
          const { data: cacheData } = await supabaseAdmin
            .from("football_fixtures_cache")
            .select("payload, expires_at")
            .eq("cache_key", cacheKey)
            .maybeSingle();

          if (cacheData && new Date(cacheData.expires_at) > new Date()) {
            if (Array.isArray(cacheData.payload?.fixtures)) {
              console.log(JSON.stringify({ event: "cache_hit", competition_code: comp, fixture_date: date }));
              compFixtures = cacheData.payload.fixtures;
            }
          }
        } catch (err) {
          console.error(`Cache read error for ${comp}:`, err);
        }
      }

      // 2. Fetch do provedor se necessário
      if (!compFixtures) {
        if (apiCallCount >= 3) {
          console.log(JSON.stringify({ event: "api_limit_reached", competition_code: comp }));
          isPartial = true;
          continue;
        }

        try {
          console.log(JSON.stringify({ event: "provider_fetch", competition_code: comp, fixture_date: date }));
          apiCallCount++;
          const year = date.split('-')[0];
          const url = `https://api.football-data.org/v4/competitions/${comp}/matches?dateFrom=${date}&dateTo=${date}&season=${year}`;
          
          const providerResponse = await fetch(url, {
            headers: { "X-Auth-Token": apiToken },
          });

          if (!providerResponse.ok) {
            console.error(`Provider error for ${comp}: ${providerResponse.status}`);
            isPartial = true;
            continue;
          }

          const data = await providerResponse.json();
          if (!data || !Array.isArray(data.matches)) {
            isPartial = true;
            continue;
          }

          compFixtures = data.matches.map((match: any) => ({
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

          // 3. Upsert Cache
          if (supabaseAdmin) {
            const todayStr = getTodayCampoGrande();
            const tomorrowStr = getTomorrowCampoGrande();
            let ttlSeconds = 900;

            if (compFixtures!.length === 0) {
              if (date < todayStr) ttlSeconds = 7 * 24 * 60 * 60;
              else if (date === todayStr) ttlSeconds = 15 * 60;
              else if (date === tomorrowStr) ttlSeconds = 6 * 60 * 60;
              else ttlSeconds = 12 * 60 * 60;
            } else if (date === todayStr) {
              const hasLive = compFixtures!.some((f: any) => ["LIVE", "HT", "ET", "P"].includes(f.status));
              const allFinished = compFixtures!.every((f: any) => f.status === "FT");
              if (hasLive) ttlSeconds = 60;
              else if (allFinished) ttlSeconds = 24 * 60 * 60;
            }

            const now = new Date().toISOString();
            const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
            
            await supabaseAdmin.from("football_fixtures_cache").upsert({
              cache_key: cacheKey,
              competition_code: comp,
              fixture_date: date,
              payload: { fixtures: compFixtures },
              fetched_at: now,
              expires_at: expiresAt,
              updated_at: now
            });
          }
        } catch (err) {
          console.error(`Fetch error for ${comp}:`, err);
          isPartial = true;
          continue;
        }
      }

      if (compFixtures) {
        allFixtures = [...allFixtures, ...compFixtures];
      }
    }

    // Remover duplicatas e ordenar
    const uniqueFixtures = Array.from(new Map(allFixtures.map(f => [f.fixture_id, f])).values());
    uniqueFixtures.sort((a: any, b: any) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());

    const responsePayload: any = { fixtures: uniqueFixtures };
    if (isPartial) responsePayload.partial = true;

    return new Response(JSON.stringify(responsePayload), {
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
