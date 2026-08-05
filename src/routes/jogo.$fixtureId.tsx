import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Trophy, MapPin, Clock, AlertCircle, Loader2, ChevronDown, ChevronUp, Ticket, Info, ShieldAlert, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { BetSlip } from "@/components/BetSlip";
import { generateMockOdds } from "@/lib/admin.functions";
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
  halftime_home: number | null;
  halftime_away: number | null;
  fulltime_home: number | null;
  fulltime_away: number | null;
}

interface FixtureMarket {
  id: string;
  status: string;
  market_type: {
    code: string;
    name: string;
    category: string;
  };
  options: FixtureMarketOption[];
}

interface FixtureMarketOption {
  id: string;
  odd: number;
  active: boolean;
  market_option: {
    code: string;
    label: string;
    parameter: number | null;
    side: string | null;
    display_order: number;
  };
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
  AET: "Encerrado após prorrogação",
  PEN: "Encerrado nos pênaltis",
  PST: "Adiado",
  CANC: "Cancelado",
  ABD: "Abandonado",
  SUSP: "Suspenso",
  TBD: "A definir",
  INT: "Interrompido",
  LIVE: "Ao vivo",
  ET: "Prorrogação",
  BT: "Intervalo Prorrogação",
  P: "Pênaltis",
};

const LIVE_STATUSES = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"];

function MatchDetails() {
  const { fixtureId } = useParams({ from: "/jogo/$fixtureId" });
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { selections, addSelection } = useBetSlip();
  const [fixture, setFixture] = useState<FixtureDetails | null>(null);
  const [markets, setMarkets] = useState<FixtureMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    RESULT: true,
    GOALS: true
  });
  const [isGeneratingOdds, setIsGeneratingOdds] = useState(false);
  const [isBetSlipOpen, setIsBetSlipOpen] = useState(false);

  const TIMEZONE = "America/Campo_Grande";

  const fetchMarkets = async () => {
    setIsLoadingMarkets(true);
    try {
      const { data: dbMarkets, error: marketsError } = await supabase
        .from('fixture_markets')
        .select(`
          id,
          status,
          market_type:market_types (
            code,
            name,
            category
          ),
          fixture_market_options (
            id,
            odd,
            active,
            market_option:market_options (
              code,
              label,
              parameter,
              side,
              display_order
            )
          )
        `)
        .eq('fixture_id', parseInt(fixtureId))
        .eq('status', 'OPEN');

      if (marketsError) throw marketsError;

      const formattedMarkets: FixtureMarket[] = (dbMarkets || []).map((m: any) => ({
        id: m.id,
        status: m.status,
        market_type: m.market_type,
        options: m.fixture_market_options.map((opt: any) => ({
          id: opt.id,
          odd: Number(opt.odd),
          active: opt.active,
          market_option: opt.market_option
        })).sort((a: any, b: any) => a.market_option.display_order - b.market_option.display_order)
      }));

      setMarkets(formattedMarkets);
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
          if (invokeError.status === 404) {
            setError("Partida não encontrada.");
          } else {
            throw invokeError;
          }
          return;
        }

        if (data?.fixture) {
          setFixture(data.fixture);
        } else {
          setError("Dados da partida indisponíveis.");
        }
      } catch (err) {
        console.error("Erro ao buscar detalhes:", err);
        setError("Não foi possível carregar os detalhes da partida.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFixture();
    fetchMarkets();
  }, [fixtureId]);

  const groupedMarkets = useMemo(() => {
    const groups: Record<string, FixtureMarket[]> = {};
    markets.forEach(m => {
      const cat = m.market_type.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    });
    return groups;
  }, [markets]);

  const formatTime = (isoString: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(isoString));
  };

  const getStatusDisplay = (status: string, elapsed: number | null) => {
    const translated = STATUS_MAP[status] || status;
    if (LIVE_STATUSES.includes(status) && elapsed !== null && status !== "HT") {
      return `${translated} ${elapsed}'`;
    }
    return translated;
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ to: "/" });
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleGenerateMockOdds = async () => {
    if (isGeneratingOdds) return;
    setIsGeneratingOdds(true);
    try {
      const result = await generateMockOdds({ data: { fixture_id: parseInt(fixtureId) } });
      if (result.success) {
        toast.success("Odds de teste geradas com sucesso!");
        fetchMarkets();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar odds.");
    } finally {
      setIsGeneratingOdds(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        <p className="mt-4 text-slate-500 font-medium">Carregando GreenFutebol...</p>
      </div>
    );
  }

  if (error || !fixture) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4 shadow-[0_0_20px_rgba(239,68,68,0.2)]" />
        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">{error || "Algo deu errado"}</h2>
        <button 
          onClick={handleBack}
          className="mt-4 flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
        >
          <ArrowLeft size={18} />
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col font-sans text-slate-200">
      <header className="bg-black/80 backdrop-blur-md border-b border-emerald-500/10 text-white shadow-2xl sticky top-0 z-30 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleBack}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors text-emerald-500"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="flex flex-col">
              <h1 className="text-sm sm:text-lg font-black uppercase tracking-tight leading-tight truncate max-w-[200px] sm:max-w-none">
                {fixture.home_team_name} x {fixture.away_team_name}
              </h1>
              <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-widest truncate">{fixture.league_name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Admin generate odds button (visible in preview for testing) */}
            <button 
              onClick={handleGenerateMockOdds}
              disabled={isGeneratingOdds}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-600/10 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-600/20 transition-all disabled:opacity-50"
            >
              {isGeneratingOdds ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
              Gerar Odds Teste
            </button>

            {isAuthenticated && (
              <button 
                onClick={() => navigate({ to: "/meus-bilhetes" })}
                className="p-2 text-emerald-500 hover:bg-white/5 rounded-xl transition-colors relative"
              >
                <Ticket size={24} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-2 sm:p-4 md:p-6 lg:grid lg:grid-cols-[1fr_350px] lg:gap-8 items-start">
        <div className="space-y-6">
          {/* Match Scoreboard Card */}
          <div className="bg-white/5 rounded-3xl border border-white/5 shadow-2xl overflow-hidden backdrop-blur-sm relative group">
            <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10 p-6 md:p-10 space-y-8">
              <div className="flex flex-col items-center space-y-2">
                <div className="flex items-center gap-3">
                  {fixture.league_logo && (
                    <img src={fixture.league_logo} alt={fixture.league_name} className="w-8 h-8 object-contain brightness-110 drop-shadow-[0_0_5px_rgba(52,211,153,0.3)]" />
                  )}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">{fixture.league_name}</span>
                    <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest">{fixture.country} • {fixture.round}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-12">
                <div className="flex flex-col items-center space-y-4 text-center">
                  <div className="w-20 h-20 md:w-32 md:h-32 bg-black/40 border border-white/5 rounded-3xl flex items-center justify-center p-4 shadow-inner group-hover:border-emerald-500/20 transition-all duration-500">
                    {fixture.home_team_logo ? (
                      <img src={fixture.home_team_logo} alt={fixture.home_team_name} className="w-full h-full object-contain brightness-110" />
                    ) : (
                      <Trophy className="w-12 h-12 text-white/5" />
                    )}
                  </div>
                  <h2 className="text-sm md:text-xl font-black uppercase tracking-tight text-white">{fixture.home_team_name}</h2>
                </div>

                <div className="flex flex-col items-center justify-center space-y-6">
                  <div className="flex items-center gap-4 sm:gap-8 text-5xl md:text-7xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                    {typeof fixture.home_score === 'number' && typeof fixture.away_score === 'number' ? (
                      <>
                        <span className="tabular-nums">{fixture.home_score}</span>
                        <span className="text-emerald-500/30 text-2xl md:text-4xl not-italic tracking-normal">x</span>
                        <span className="tabular-nums">{fixture.away_score}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-white/20">—</span>
                        <span className="text-emerald-500/30 text-2xl md:text-4xl not-italic tracking-normal">x</span>
                        <span className="text-white/20">—</span>
                      </>
                    )}
                  </div>
                  <div className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest border transition-all duration-300",
                    LIVE_STATUSES.includes(fixture.status) 
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                      : "bg-white/5 text-slate-400 border-white/5"
                  )}>
                    {getStatusDisplay(fixture.status, fixture.elapsed)}
                  </div>
                </div>

                <div className="flex flex-col items-center space-y-4 text-center">
                  <div className="w-20 h-20 md:w-32 md:h-32 bg-black/40 border border-white/5 rounded-3xl flex items-center justify-center p-4 shadow-inner group-hover:border-emerald-500/20 transition-all duration-500">
                    {fixture.away_team_logo ? (
                      <img src={fixture.away_team_logo} alt={fixture.away_team_name} className="w-full h-full object-contain brightness-110" />
                    ) : (
                      <Trophy className="w-12 h-12 text-white/5" />
                    )}
                  </div>
                  <h2 className="text-sm md:text-xl font-black uppercase tracking-tight text-white">{fixture.away_team_name}</h2>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-white/20 uppercase tracking-widest block">Início</span>
                  <div className="flex items-center justify-center gap-2 text-white/80">
                    <Clock size={12} className="text-emerald-500" />
                    <span className="text-[11px] font-bold">{formatTime(fixture.kickoff_at)}</span>
                  </div>
                </div>
                {fixture.venue && (
                  <div className="space-y-1 col-span-2 hidden sm:block">
                    <span className="text-[9px] font-black text-white/20 uppercase tracking-widest block">Local</span>
                    <div className="flex items-center justify-center gap-2 text-white/80">
                      <MapPin size={12} className="text-emerald-500" />
                      <span className="text-[11px] font-bold truncate max-w-[200px]">{fixture.venue}{fixture.city ? `, ${fixture.city}` : ''}</span>
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-white/20 uppercase tracking-widest block">Status</span>
                  <div className="flex items-center justify-center gap-2 text-white/80">
                    <Trophy size={12} className="text-emerald-500" />
                    <span className="text-[11px] font-bold uppercase">{fixture.status_long}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Markets Section */}
          <div className="space-y-4">
            {isLoadingMarkets ? (
              <div className="bg-white/5 rounded-2xl p-20 flex flex-col items-center justify-center space-y-4 border border-white/5">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Carregando Mercados...</p>
              </div>
            ) : markets.length === 0 ? (
              <div className="bg-white/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-6 border border-white/5 backdrop-blur-sm">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-emerald-500/20">
                  <Ticket size={32} />
                </div>
                <div className="space-y-2">
                  <p className="text-white font-black uppercase tracking-tight text-lg">Sem mercados disponíveis</p>
                  <p className="text-slate-500 text-sm font-medium max-w-xs">Neste momento não há odds cadastradas para esta partida.</p>
                </div>
                <button 
                  onClick={handleGenerateMockOdds}
                  disabled={isGeneratingOdds}
                  className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center gap-2"
                >
                  {isGeneratingOdds ? <Loader2 size={18} className="animate-spin" /> : <ShieldAlert size={18} />}
                  Gerar Odds de Teste
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {CATEGORY_ORDER.map(cat => {
                  const catMarkets = groupedMarkets[cat];
                  if (!catMarkets || catMarkets.length === 0) return null;
                  const isExpanded = expandedCategories[cat];

                  return (
                    <div key={cat} className="space-y-2">
                      <button 
                        onClick={() => toggleCategory(cat)}
                        className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/[0.08] transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-6 bg-emerald-500 rounded-full group-hover:shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all" />
                          <h3 className="font-black text-white uppercase tracking-widest text-sm">{CATEGORY_MAP[cat] || cat}</h3>
                        </div>
                        {isExpanded ? <ChevronUp size={20} className="text-emerald-500" /> : <ChevronDown size={20} className="text-emerald-500" />}
                      </button>

                      {isExpanded && (
                        <div className="grid gap-4 animate-in slide-in-from-top-4 duration-300">
                          {catMarkets.map(market => (
                            <div key={market.id} className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                              <div className="px-4 py-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
                                <span className="text-[10px] font-black text-emerald-500/80 uppercase tracking-widest">{market.market_type.name}</span>
                                <Info size={14} className="text-white/20" />
                              </div>
                              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                                {market.options.map(opt => {
                                  const isSelected = selections.some(s => s.fixture_market_option_id === opt.id);
                                  
                                  return (
                                    <button 
                                      key={opt.id}
                                      onClick={() => addSelection({
                                        fixture_market_option_id: opt.id,
                                        odd: opt.odd,
                                        label: opt.market_option.label,
                                        market_name: market.market_type.name,
                                        home_team: fixture.home_team_name,
                                        away_team: fixture.away_team_name,
                                        fixture_id: fixture.fixture_id
                                      })}
                                      className={cn(
                                        "p-3 sm:p-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-95 group relative",
                                        isSelected 
                                          ? "bg-emerald-600 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] z-10" 
                                          : "bg-white/5 border-white/5 text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10"
                                      )}
                                    >
                                      {isSelected && <div className="absolute top-1 right-1"><div className="w-1 h-1 bg-white rounded-full animate-ping" /></div>}
                                      <span className={cn("text-[9px] sm:text-[10px] font-bold uppercase text-center transition-colors", isSelected ? "text-white/70" : "text-slate-500 group-hover:text-emerald-400")}>
                                        {opt.market_option.label}
                                      </span>
                                      <span className="text-base sm:text-lg font-black tracking-tighter tabular-nums">{opt.odd.toFixed(2)}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Sidebar Bet Slip */}
        <aside className="hidden lg:block sticky top-28 space-y-6">
          <BetSlip />
          
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6 space-y-4">
            <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
              <Info size={14} />
              Sobre a GreenFutebol
            </h4>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              As odds apresentadas são atualizadas em tempo real. A confirmação do bilhete garante a cotação do momento da aposta.
            </p>
          </div>
        </aside>
      </main>

      {/* Mobile Bet Slip Floating Button */}
      {!isBetSlipOpen && selections.length > 0 && (
        <div className="lg:hidden fixed bottom-6 left-0 w-full px-4 z-40 animate-in slide-in-from-bottom-10 duration-500">
          <button 
            onClick={() => setIsBetSlipOpen(true)}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-[0_0_40px_rgba(16,185,129,0.4)] flex items-center justify-between px-6 border border-emerald-400/30 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <Ticket size={24} className="brightness-125" />
              <span>Ver Bilhete</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-black/20 px-3 py-1 rounded-full text-sm font-black">{selections.length}</span>
            </div>
          </button>
        </div>
      )}

      {/* Mobile Bet Slip Drawer */}
      {isBetSlipOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="absolute bottom-0 left-0 w-full max-h-[90vh] bg-[#0a0a0a] rounded-t-3xl border-t border-emerald-500/20 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] flex flex-col animate-in slide-in-from-bottom duration-500">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div className="w-12 h-1.5 bg-white/10 rounded-full absolute top-2 left-1/2 -translate-x-1/2" />
              <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Ticket className="text-emerald-500" />
                Seu Bilhete
              </h3>
              <button 
                onClick={() => setIsBetSlipOpen(false)}
                className="p-2 bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
              <BetSlip isMobile />
            </div>
          </div>
        </div>
      )}

      <footer className="py-12 px-6 mt-12 text-center border-t border-white/5 bg-black/40">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-6">
          <div className="flex items-center gap-2 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
            <ShieldAlert size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Jogo Responsável • +18</span>
          </div>
          <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest leading-loose max-w-2xl">
            &copy; 2026 GreenFutebol • A maior plataforma tecnológica de futebol do mundo. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
