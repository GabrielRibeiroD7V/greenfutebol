import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Clock, Loader2, Calendar, MapPin, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { BetSlip } from "@/components/BetSlip";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { MarketRenderer } from "@/components/MatchMarkets/MarketRenderer";

export const Route = createFileRoute("/jogo/$fixtureId")({
  component: MatchDetails,
});

const TIMEZONE = "America/Campo_Grande";

function MatchDetails() {
  const { fixtureId } = useParams({ from: "/jogo/$fixtureId" });
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fixture, setFixture] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ "Principais": true });

  const { addSelection, selections, toggleSelection, hasSelection } = useBetSlip();

  useEffect(() => {
    const fetchMatchData = async () => {
      try {
        const { data: fixtureData, error: fError } = await supabase.functions.invoke("get-football-fixture", {
          body: { fixture_id: parseInt(fixtureId) }
        });
        
        console.log("Fixture data:", fixtureData);
        if (fError) console.error("Fixture error:", fError);

        if (fixtureData?.fixture) {
          setFixture(fixtureData.fixture);
          
          console.log("Fetching markets for fixture_id:", parseInt(fixtureId));
          const { data: marketsData, error: mError } = await supabase
            .from("fixture_markets")
            .select("*, fixture_market_selections(*)")
            .eq("fixture_id", parseInt(fixtureId))
            .order("market_group");
            
          console.log("Markets data from DB:", marketsData);
          if (mError) console.error("Markets error:", mError);
          setMarkets(marketsData || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMatchData();
  }, [fixtureId]);

  const formatTime = (isoString: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      hour: "2-digit", minute: "2-digit"
    }).format(new Date(isoString));
  };

  const formatDate = (isoString: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      day: "2-digit", month: "2-digit", year: "numeric"
    }).format(new Date(isoString));
  };

  const isAdmin = user?.email?.includes('admin') || false;

  if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;
  if (!fixture) return <div className="min-h-screen bg-black text-white p-8">Partida não encontrada</div>;

  const isStarted = new Date(fixture.kickoff_at) <= new Date();

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col lg:flex-row">
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate({ to: "/" })} className="p-2 hover:bg-white/5 rounded-full"><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-sm font-black uppercase text-emerald-500">{fixture.league_name}</h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{fixture.country} • {fixture.round}</p>
            </div>
          </div>
          {isAdmin && (
            <button 
              onClick={() => navigate({ to: `/admin/mercados/${fixture.fixture_id}` })}
              className="text-[10px] font-black uppercase text-zinc-500 hover:text-emerald-500 underline"
            >
              Gerenciar mercados
            </button>
          )}
        </header>

        <main className="p-4 space-y-6 max-w-4xl mx-auto w-full">
          {/* Match Header Card */}
          <section className="bg-zinc-900 border border-white/5 rounded-3xl p-8 text-center space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-3">
                <img src={fixture.home_team_logo} className="w-16 h-16 mx-auto" alt="" />
                <p className="font-black uppercase tracking-tighter">{fixture.home_team_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-black text-emerald-500">{fixture.home_score ?? 0} - {fixture.away_score ?? 0}</p>
                <p className="text-[10px] font-black text-zinc-500 uppercase">{fixture.status_long}</p>
              </div>
              <div className="flex-1 space-y-3">
                <img src={fixture.away_team_logo} className="w-16 h-16 mx-auto" alt="" />
                <p className="font-black uppercase tracking-tighter">{fixture.away_team_name}</p>
              </div>
            </div>
            <div className="flex justify-center gap-6 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-t border-white/5 pt-4">
              <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(fixture.kickoff_at)}</span>
              <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(fixture.kickoff_at)}</span>
              <span className="flex items-center gap-1"><MapPin size={12} /> {fixture.venue}</span>
            </div>
          </section>

          {/* Markets List */}
          <div className="space-y-4 pb-24">
            {markets.length === 0 ? (
              <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-zinc-600">
                  <Info size={32} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-white">Mercados ainda não disponíveis</h3>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">
                    Esta partida está sendo processada ou as odds foram suspensas temporariamente.
                  </p>
                </div>
              </div>
            ) : (
              markets
                .filter(m => m.status !== 'CLOSED')
                .map(m => (
                  <MarketRenderer 
                    key={m.id} 
                    market={m} 
                    fixture={{
                      fixture_id: fixture.fixture_id,
                      home_team_name: fixture.home_team_name,
                      away_team_name: fixture.away_team_name,
                      kickoff_at: fixture.kickoff_at,
                      league_name: fixture.league_name
                    }} 
                  />
                ))
            )}
          </div>
        </main>
      </div>

      <aside className="hidden lg:block w-96 bg-zinc-950 border-l border-white/5">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <BetSlip />
        </div>
      </aside>

      {/* Mobile Bet Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-emerald-500/20 p-4 pb-safe z-50">
         <Button onClick={() => navigate({ to: "/bilhete" })} className="w-full bg-emerald-600 h-14 rounded-xl flex justify-between px-6">
           <span className="font-black uppercase tracking-tight">Bilhete • {selections.length} {selections.length === 1 ? 'seleção' : 'seleções'}</span>
           <span className="font-black">Total: {selections.reduce((acc, s) => acc * s.displayedOdd, 1).toFixed(2)}</span>
         </Button>
      </div>
    </div>
  );
}
