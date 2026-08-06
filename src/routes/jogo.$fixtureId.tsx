import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Clock, Loader2, Info, ShieldAlert, Plus, Calendar, MapPin, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { BetSlip } from "@/components/BetSlip";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

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
        const { data: fixtureData } = await supabase.functions.invoke("get-football-fixture", {
          body: { fixture_id: parseInt(fixtureId) }
        });
        
        if (fixtureData?.fixture) {
          setFixture(fixtureData.fixture);
          
          const { data: marketsData } = await supabase
            .from("fixture_markets")
            .select("*, fixture_market_selections(*)")
            .eq("fixture_id", parseInt(fixtureId))
            .order("market_group")
            .order("sort_order");
            
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
              onClick={() => navigate({ to: `/admin/odds`, search: { fixture_id: fixture.fixture_id } })}
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
              <div className="text-center py-12 opacity-50">Nenhum mercado disponível no momento.</div>
            ) : (
              markets.map(m => (
                <div key={m.id} className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden">
                  <div className="p-4 bg-zinc-800/50 flex justify-between items-center border-b border-white/5">
                    <h3 className="text-sm font-black uppercase tracking-tight text-zinc-300">{m.market_name} {m.line && <span className="text-emerald-500">{m.line}</span>}</h3>
                    <div className="flex items-center gap-2">
                       {m.status !== 'OPEN' && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-500">{m.status}</span>}
                       <Info size={14} className="text-zinc-600" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3">
                    {m.fixture_market_selections?.sort((a:any, b:any) => a.sort_order - b.sort_order).map((s:any) => {
                      const isDisabled = m.status !== 'OPEN' || s.status !== 'OPEN' || s.odd <= 1.0;
                      const isPastKickoff = isStarted && m.market_group !== 'LIVE';
                      const selected = hasSelection(s.id);
                      
                      return (
                        <button
                          key={s.id}
                          disabled={isDisabled || isPastKickoff}
                          onClick={() => {
                            if (isPastKickoff) {
                              toast.error("Mercado indisponível após o início da partida.");
                              return;
                            }
                            toggleSelection({
                              fixtureId: fixture.fixture_id,
                              fixtureName: `${fixture.home_team_name} x ${fixture.away_team_name}`,
                              kickoffAt: fixture.kickoff_at,
                              competitionName: fixture.league_name,
                              marketId: m.id,
                              marketName: m.market_name,
                              marketType: m.market_group,
                              selectionId: s.id,
                              selectionName: s.selection_name,
                              displayedOdd: s.odd,
                              homeTeam: fixture.home_team_name,
                              awayTeam: fixture.away_team_name
                            });
                          }}
                          className={cn(
                            "p-4 border-r border-b border-white/5 flex flex-col items-center justify-center transition-all",
                            selected ? "bg-emerald-600" : "hover:bg-white/5",
                            (isDisabled || isPastKickoff) && "opacity-30 cursor-not-allowed grayscale"
                          )}
                        >
                          <span className={cn("text-[10px] font-bold uppercase", selected ? "text-emerald-100" : "text-zinc-500")}>{s.selection_name}</span>
                          <span className="text-lg font-black">{s.odd.toFixed(2)}</span>
                          {isPastKickoff && !selected && <span className="text-[8px] font-black text-red-500 uppercase">Fechado</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
