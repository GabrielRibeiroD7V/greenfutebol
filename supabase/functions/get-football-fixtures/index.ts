import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { date } = await req.json();

    if (!date) {
      return new Response(
        JSON.stringify({ error: "Date parameter is required (YYYY-MM-DD)" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const apiKey = Deno.env.get("FOOTBALL_API_KEY");
    if (!apiKey) {
      throw new Error("Missing FOOTBALL_API_KEY secret");
    }

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${date}`,
      {
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": "v3.football.api-sports.io",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    // Normalizing response fields
    const fixtures = (data.response || []).map((item: any) => ({
      id: item.fixture.id,
      league: item.league.name,
      homeTeam: item.teams.home.name,
      awayTeam: item.teams.away.name,
      time: new Date(item.fixture.date).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: item.fixture.status.short === "NS" ? "scheduled" : 
              ["1H", "HT", "2H", "ET", "P"].includes(item.fixture.status.short) ? "live" : "finished",
      odds: {
        home: 0, // Odds usually come from a different endpoint in API-Football
        draw: 0,
        away: 0,
      },
    }));

    return new Response(JSON.stringify({ fixtures }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
