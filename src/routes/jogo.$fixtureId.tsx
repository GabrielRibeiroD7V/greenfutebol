import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import { ArrowLeft, Trophy, MapPin, Clock, AlertCircle, Loader2, ChevronDown, ChevronUp, Ticket, Info, ShieldAlert, X, Target, Zap, Star, Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useBetSlip, Selection } from "@/hooks/use-bet-slip";
import { BetSlip } from "@/components/BetSlip";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/jogo/$fixtureId")({
  head: () => ({
    meta: [
      { title: "Detalhes da Partida | GreenFutebol" },
    ],
  }),
  component: MatchDetails,
});

interface FixtureDetails {
  fixture_id: number;
  league_id: number;
  league_name: string;
  league_logo: string | null;
  country: string;
  season: number;
  round: string | null;
  home_team_id: number;
  home_team_name: string;
  home_team_logo: string | null;
  away_team_id: number;
  away_team_name: string;
  away_team_logo: string | null;
  kickoff_at: string;
  venue: string | null;
  city: string | null;
  status: string;
  status_long: string;
  elapsed: number | null;
  home_score: number | null;
  away_score: number | null;
}

interface FixtureMarket {
  id: string;
  market_name: string;
  market_type: string;
  market_group: string;
  line: number | null;
  period: string;
  status: string;
  fixture_market_selections: FixtureMarketSelection[];
}

interface FixtureMarketSelection {
  id: string;
  selection_key: string;
  selection_name: string;
  odd: number;
  status: string;
  sort_order: number;
}

const CATEGORY_MAP: Record<string, string> = {
  RESULT: "Principais",
  GOALS: "Gols",
  CORNERS: "Escanteios",
  CARDS: "Cartões",
  FIRST_HALF: "Primeiro Tempo"
};

const CATEGORY_ORDER = ["RESULT", "GOALS", "CORNERS", "CARDS", "FIRST_HALF"];

const STATUS_MAP: Record<string, string> = {
  NS: "Não iniciado",
  "1H": "1º tempo",
  HT: "Intervalo",
  "2H": "2º tempo",
  FT: "Encerrado",
};

const LIVE_STATUSES = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"];
const TIMEZONE = "America/Campo_Grande";

function MatchDetails() {
  const { fixtureId } = useParams({ from: "/jogo/$fixtureId" });
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fixture, setFixture] = useState<FixtureDetails | null>(null);
  const [markets, setMarkets] = useState<FixtureMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ Principais: true });
  const [isGeneratingOdds, setIsGeneratingOdds] = useState(false);

  const { addSelection, selections } = useBetSlip();

  const fetchMarkets = async () => {
    setIsLoadingMarkets(true);
    try {
      const { data, error: marketsError } = await supabase
        .from("fixture_markets")
        .select("*, fixture_market_selections(*)")
        .eq("fixture_id", parseInt(fixtureId))
        .eq("status", "OPEN");
        
      if (marketsError) throw marketsError;
      
      // Filter out markets with no open selections
      const validMarkets = (data || []).map(m => ({
        ...m,
        fixture_market_selections: (m.fixture_market_selections || [])
          .filter((s: any) => s.status === 'OPEN')
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
      })).filter(m => m.fixture_market_selections.length > 0);

      setMarkets(validMarkets as FixtureMarket[]);
    } catch (err) {
      console.error("Erro ao buscar mercados:", err);
    } finally {
      setIsLoadingMarkets(false);
    }
  };

  useEffect(() => {
    const fetchFixture = async () => {
      const id = parseInt(fixtureId);
      if (isNaN(id) || id <= 0) {
        setError("ID da partida inválido.");
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: invokeError } = await supabase.functions.invoke("get-football-fixture", {
          body: { fixture_id: id }
        });

        if (invokeError) {
          setError(invokeError.status === 404 ? "Partida não encontrada." : "Erro na API.");
          return;
        }

        if (data?.fixture) {
          setFixture(data.fixture);
          fetchMarkets();
        } else {
          setError("Dados indisponíveis.");
        }
      } catch (err) {
        console.error("Erro:", err);
        setError("Erro ao carregar partida.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFixture();
  }, [fixtureId]);

  const groupedMarkets = useMemo(() => {
    const groups: Record<string, FixtureMarket[]> = {};
    markets.forEach(m => {
      const catLabel = CATEGORY_MAP[m.market_group] || m.market_group || "Outros";
      if (!groups[catLabel]) groups[catLabel] = [];
      groups[catLabel].push(m);
    });
    return groups;
  }, [markets]);

  const formatTime = (isoString: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).format(new Date(isoString));
  };

  const handleGenerateDemo = async () => {
    setIsGeneratingOdds(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-football-fixture", {
        body: { fixture_id: parseInt(fixtureId) }
      });
      if (error) throw error;
      
      const { error: genError } = await supabase.functions.invoke("admin-generate-odds", {
        body: { fixture: data.fixture }
      });
      if (genError) throw genError;
      
      toast.success("Odds DEMO geradas!");
      fetchMarkets();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar odds");
    } finally {
      setIsGeneratingOdds(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error || !fixture) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 flex flex-col items-center justify-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-black uppercase">{error || "Erro desconhecido"}</h2>
        <button onClick={() => navigate({ to: "/" })} className="px-6 py-2 bg-emerald-600 rounded-lg font-bold">Voltar</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 p-4 flex items-center gap-4">
          <button onClick={() => navigate({ to: "/" })} className="p-2 hover:bg-white/5 rounded-full"><ArrowLeft size={20} /></button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-black uppercase tracking-tighter truncate text-emerald-500">{fixture.league_name}</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{fixture.country} • {fixture.round || "Detalhes"}</p>
          </div>
        </header>

        <main className="flex-1 p-4 space-y-6 max-w-4xl mx-auto w-full">
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600/20 via-black to-black border border-emerald-500/10 p-8">
            <div className="relative z-10 flex items-center justify-between gap-4 sm:gap-12">
              <div className="flex-1 flex flex-col items-center text-center space-y-4">
                <img src={fixture.home_team_logo || ""} alt="" className="w-16 h-16 sm:w-24 sm:h-24 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] object-contain" />
                <h2 className="text-lg sm:text-2xl font-black uppercase tracking-tighter leading-none">{fixture.home_team_name}</h2>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="bg-black/40 px-3 py-1 rounded-full border border-white/5 flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full", LIVE_STATUSES.includes(fixture.status) ? "bg-red-500 animate-pulse" : "bg-slate-600")} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{STATUS_MAP[fixture.status] || fixture.status}</span>
                </div>
                <div className="text-4xl sm:text-6xl font-black tracking-tighter text-emerald-500 flex items-center gap-4">
                  <span>{fixture.home_score ?? 0}</span>
                  <span className="text-slate-800 text-2xl">-</span>
                  <span>{fixture.away_score ?? 0}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Clock size={12} />
                  <span className="text-[10px] font-bold uppercase">{formatTime(fixture.kickoff_at)}</span>
                </div>
              </div>
              <div className="flex-1 flex flex-col items-center text-center space-y-4">
                <img src={fixture.away_team_logo || ""} alt="" className="w-16 h-16 sm:w-24 sm:h-24 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] object-contain" />
                <h2 className="text-lg sm:text-2xl font-black uppercase tracking-tighter leading-none">{fixture.away_team_name}</h2>
              </div>
            </div>
          </section>

          {markets.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center space-y-6">
              <div className="space-y-2">
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhum mercado aberto</p>
                <p className="text-slate-600 text-[10px] max-w-xs mx-auto">Esta partida ainda não possui mercados ativos para apostas.</p>
              </div>
              <Button onClick={handleGenerateDemo} disabled={isGeneratingOdds} className="bg-emerald-600 hover:bg-emerald-500 h-12 px-8 rounded-xl font-black uppercase tracking-tight">
                {isGeneratingOdds ? <Loader2 className="animate-spin mr-2" /> : <Plus size={20} className="mr-2" />}
                Gerar Odds Demo
              </Button>
            </div>
          ) : (
            <div className="space-y-8 pb-20">
            {CATEGORY_ORDER.map(cat => {
              const groupLabel = CATEGORY_MAP[cat];
              if (!groupLabel || !groupedMarkets[groupLabel]) return null;
              
              return (
                <div key={cat} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-1.5 bg-emerald-500 rounded-full" />
                    <h3 className="text-xl font-black uppercase tracking-tighter italic">{groupLabel}</h3>
                  </div>
                  <div className="grid gap-3">
                    {groupedMarkets[groupLabel].map((market: FixtureMarket) => (
                      <div key={market.id} className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center">
                          <h4 className="text-sm font-black uppercase tracking-tight text-slate-300">{market.market_name}</h4>
                          <Info size={14} className="text-slate-600" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3">
                          {market.fixture_market_selections.map((selection: FixtureMarketSelection) => {
                            const isSelected = selections.some(s => s.id === selection.id);
                            return (
                              <button
                                key={selection.id}
                                onClick={() => addSelection({
                                  id: selection.id,
                                  market_id: market.id,
                                  fixture_id: fixture.fixture_id,
                                  odd: selection.odd,
                                  label: selection.selection_name,
                                  market_name: market.market_name,
                                  home_team: fixture.home_team_name,
                                  away_team: fixture.away_team_name,
                                  competition: fixture.league_name
                                })}
                                className={cn(
                                  "p-4 flex flex-col items-center justify-center gap-1 border-r border-b border-white/5 transition-all",
                                  isSelected ? "bg-emerald-600 text-white" : "hover:bg-white/[0.02]"
                                )}
                              >
                                <span className={cn("text-[10px] font-bold uppercase", isSelected ? "text-emerald-200" : "text-slate-500")}>
                                  {selection.selection_name}
                                </span>
                                <span className="text-lg font-black">{selection.odd.toFixed(2)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      <aside className="lg:w-96 lg:border-l lg:border-white/5 bg-black/40 backdrop-blur-xl shrink-0">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <BetSlip />
        </div>
      </aside>
    </div>
  );
}
