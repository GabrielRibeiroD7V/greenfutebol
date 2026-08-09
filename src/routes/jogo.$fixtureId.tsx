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
        // Fetch markets from DB first
        const { data: marketsData, error: mError } = await supabase
          .from("fixture_markets")
          .select("*, fixture_market_selections(*)")
          .eq("fixture_id", parseInt(fixtureId))
          .order("created_at", { ascending: true }); // Prefer insertion order or custom grouping later
          
        if (mError) {
          console.error("Error fetching markets:", mError);
        }
        
        // Custom Sort: Principais first, then goals, then others, then players
        const sortedMarkets = (marketsData || []).sort((a, b) => {
          const order: Record<string, number> = { 'RESULT': 1, 'GOALS': 2, 'SCORE': 3, 'CORNERS': 4, 'CARDS': 5, 'PLAYER': 10 };
          return (order[a.market_group] || 99) - (order[b.market_group] || 99);
        });

        setMarkets(sortedMarkets);

        // Then fetch fixture details from Edge Function
        const { data: fixtureData, error: fError } = await supabase.functions.invoke("get-football-fixture", {
          body: { fixture_id: parseInt(fixtureId) }
        });
        
        if (fixtureData?.fixture) {
          setFixture(fixtureData.fixture);
        } else if (fError) {
          console.error("Error fetching fixture details:", fError);
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

  if (isLoading) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-emerald-600" /></div>;
  if (!fixture) return <div className="min-h-screen bg-white text-slate-900 p-8">Partida não encontrada</div>;

  const isStarted = markets.length > 0 && markets[0].kickoff_at 
    ? new Date(markets[0].kickoff_at) <= new Date() 
    : (fixture ? new Date(fixture.kickoff_at) <= new Date() : false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate({ to: "/" })} className="p-2 hover:bg-slate-100 rounded-full text-slate-600"><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-sm font-black uppercase text-emerald-600">{fixture.league_name}</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{fixture.country} • {fixture.round}</p>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate({ to: `/admin/resultados` })}
                className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700 underline"
              >
                Liquidar
              </button>
              <button 
                onClick={() => navigate({ to: `/admin/mercados/${fixture.fixture_id}` })}
                className="text-[10px] font-black uppercase text-slate-500 hover:text-emerald-600 underline"
              >
                Gerenciar mercados
              </button>
            </div>
          )}
        </header>

        <main className="p-4 space-y-6 max-w-4xl mx-auto w-full">
          {/* Match Header Card */}
          <section className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-3">
                <img src={fixture.home_team_logo} className="w-16 h-16 mx-auto" alt="" />
                <p className="font-black uppercase tracking-tighter text-slate-900">{fixture.home_team_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-black text-emerald-600">{fixture.home_score ?? 0} - {fixture.away_score ?? 0}</p>
                <p className="text-[10px] font-black text-slate-500 uppercase">{fixture.status_long}</p>
              </div>
              <div className="flex-1 space-y-3">
                <img src={fixture.away_team_logo} className="w-16 h-16 mx-auto" alt="" />
                <p className="font-black uppercase tracking-tighter text-slate-900">{fixture.away_team_name}</p>
              </div>
            </div>
            <div className="flex justify-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-4">
              <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(fixture.kickoff_at)}</span>
              <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(fixture.kickoff_at)}</span>
              <span className="flex items-center gap-1"><MapPin size={12} /> {fixture.venue}</span>
            </div>
          </section>

          {/* Markets List */}
          <div className="space-y-4 pb-24">
            {markets.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-6 shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                  <Info size={32} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900">Mercados ainda não disponíveis</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 leading-relaxed max-w-xs mx-auto">
                    Esta partida está sendo processada ou as odds foram suspensas temporariamente.
                  </p>
                </div>
                {isAdmin && (
                  <div className="pt-4">
                    <Button 
                      onClick={() => navigate({ to: `/admin/mercados/${fixtureId}` as any })}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] h-10 px-6 rounded-xl shadow-md"
                    >
                      Configurar Mercados
                    </Button>
                  </div>
                )}
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

      <aside className="hidden lg:block w-96 bg-white border-l border-slate-200">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <BetSlip />
        </div>
      </aside>

      {/* Mobile Bet Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 pb-safe z-50 shadow-2xl">
         <Button onClick={() => navigate({ to: "/bilhete" })} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-14 rounded-xl flex justify-between px-6 shadow-lg shadow-emerald-500/20">
           <span className="font-black uppercase tracking-tight">Bilhete • {selections.length} {selections.length === 1 ? 'seleção' : 'seleções'}</span>
           <span className="font-black">Total: {selections.reduce((acc, s) => acc * s.displayedOdd, 1).toFixed(2)}</span>
         </Button>
      </div>
    </div>
  );
}
