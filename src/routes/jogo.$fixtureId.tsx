import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Trophy, MapPin, Clock, AlertCircle, Loader2, ChevronDown, ChevronUp, Ticket, Info, ShieldAlert, X, Target, Zap, Star, Calendar } from "lucide-react";
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
  const [localSelections, setLocalSelections] = useState<Record<string, string>>({});
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

  const generateMockMarkets = (fixture: FixtureDetails) => {
    const mockMarkets: FixtureMarket[] = [
      {
        id: "mock-1x2",
        status: "OPEN",
        market_type: { code: "1X2", name: "Resultado Final", category: "RESULT" },
        options: [
          { id: "opt-1", odd: 1.42, active: true, market_option: { code: "H", label: "Vitória da Casa", parameter: null, side: "HOME", display_order: 1 } },
          { id: "opt-2", odd: 3.40, active: true, market_option: { code: "D", label: "Empate", parameter: null, side: "DRAW", display_order: 2 } },
          { id: "opt-3", odd: 5.60, active: true, market_option: { code: "A", label: "Vitória Visitante", parameter: null, side: "AWAY", display_order: 3 } },
        ]
      },
      {
        id: "mock-over-under",
        status: "OPEN",
        market_type: { code: "OU", name: "Total de Gols", category: "GOALS" },
        options: [
          { id: "opt-4", odd: 1.12, active: true, market_option: { code: "O05", label: "Over 0.5", parameter: 0.5, side: "OVER", display_order: 1 } },
          { id: "opt-5", odd: 1.65, active: true, market_option: { code: "O15", label: "Over 1.5", parameter: 1.5, side: "OVER", display_order: 2 } },
          { id: "opt-6", odd: 2.10, active: true, market_option: { code: "O25", label: "Over 2.5", parameter: 2.5, side: "OVER", display_order: 3 } },
          { id: "opt-7", odd: 3.80, active: true, market_option: { code: "O35", label: "Over 3.5", parameter: 3.5, side: "OVER", display_order: 4 } },
          { id: "opt-8", odd: 6.50, active: true, market_option: { code: "U05", label: "Under 0.5", parameter: 0.5, side: "UNDER", display_order: 5 } },
          { id: "opt-9", odd: 2.80, active: true, market_option: { code: "U15", label: "Under 1.5", parameter: 1.5, side: "UNDER", display_order: 6 } },
          { id: "opt-10", odd: 1.70, active: true, market_option: { code: "U25", label: "Under 2.5", parameter: 2.5, side: "UNDER", display_order: 7 } },
          { id: "opt-11", odd: 1.25, active: true, market_option: { code: "U35", label: "Under 3.5", parameter: 3.5, side: "UNDER", display_order: 8 } },
        ]
      },
      {
        id: "mock-btts",
        status: "OPEN",
        market_type: { code: "BTTS", name: "Ambas Marcam", category: "GOALS" },
        options: [
          { id: "opt-12", odd: 1.85, active: true, market_option: { code: "YES", label: "Sim", parameter: null, side: null, display_order: 1 } },
          { id: "opt-13", odd: 1.95, active: true, market_option: { code: "NO", label: "Não", parameter: null, side: null, display_order: 2 } },
        ]
      },
      {
        id: "mock-double-chance",
        status: "OPEN",
        market_type: { code: "DC", name: "Dupla Chance", category: "RESULT" },
        options: [
          { id: "opt-14", odd: 1.15, active: true, market_option: { code: "HD", label: "Casa ou Empate", parameter: null, side: null, display_order: 1 } },
          { id: "opt-15", odd: 1.25, active: true, market_option: { code: "HA", label: "Casa ou Visitante", parameter: null, side: null, display_order: 2 } },
          { id: "opt-16", odd: 2.15, active: true, market_option: { code: "DA", label: "Empate ou Visitante", parameter: null, side: null, display_order: 3 } },
        ]
      },
      {
        id: "mock-corners",
        status: "OPEN",
        market_type: { code: "CORNERS", name: "Escanteios", category: "CORNERS" },
        options: [
          { id: "opt-17", odd: 1.55, active: true, market_option: { code: "O75", label: "Over 7.5", parameter: 7.5, side: "OVER", display_order: 1 } },
          { id: "opt-18", odd: 1.85, active: true, market_option: { code: "O85", label: "Over 8.5", parameter: 8.5, side: "OVER", display_order: 2 } },
          { id: "opt-19", odd: 2.25, active: true, market_option: { code: "O95", label: "Over 9.5", parameter: 9.5, side: "OVER", display_order: 3 } },
          { id: "opt-20", odd: 2.85, active: true, market_option: { code: "O105", label: "Over 10.5", parameter: 10.5, side: "OVER", display_order: 4 } },
        ]
      },
      {
        id: "mock-cards",
        status: "OPEN",
        market_type: { code: "CARDS", name: "Cartões", category: "CARDS" },
        options: [
          { id: "opt-21", odd: 1.65, active: true, market_option: { code: "O25", label: "Over 2.5", parameter: 2.5, side: "OVER", display_order: 1 } },
          { id: "opt-22", odd: 2.10, active: true, market_option: { code: "O35", label: "Over 3.5", parameter: 3.5, side: "OVER", display_order: 2 } },
          { id: "opt-23", odd: 3.40, active: true, market_option: { code: "O45", label: "Over 4.5", parameter: 4.5, side: "OVER", display_order: 3 } },
        ]
      }
    ];
    setMarkets(mockMarkets);
    setIsLoadingMarkets(false);
  };

  useEffect(() => {
    if (fixture) {
      generateMockMarkets(fixture);
    }
  }, [fixture]);

  const fetchMarkets = async () => {
    setIsLoadingMarkets(true);
    try {
      // In Phase 2, we are instructed to use MOCK odds.
      // We will skip the DB fetch for now to comply with the requirement of MOCK odds and no persistence.
      if (fixture) {
        generateMockMarkets(fixture);
      }
    } catch (err) {
      console.error("Erro ao buscar mercados:", err);
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
    <div className="min-h-screen bg-[#050505] flex flex-col font-sans text-slate-200">
      <header className="bg-black border-b border-emerald-500/10 text-white shadow-2xl sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-4 flex justify-between items-center h-14 sm:h-16">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleBack}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-emerald-500"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="flex flex-col">
              <h1 className="text-xs sm:text-sm font-black uppercase tracking-tight leading-tight truncate max-w-[200px] sm:max-w-none">
                {fixture.home_team_name} x {fixture.away_team_name}
              </h1>
              <span className="text-[9px] text-emerald-500/70 font-bold uppercase tracking-widest truncate">{fixture.league_name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleGenerateMockOdds}
              disabled={isGeneratingOdds}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-600/10 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-600/20 transition-all disabled:opacity-50"
            >
              {isGeneratingOdds ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
              Odds Teste
            </button>
            
            {isAuthenticated && (
              <button 
                onClick={() => navigate({ to: "/meus-bilhetes" })}
                className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20"
              >
                <Ticket size={20} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1920px] mx-auto w-full p-2 sm:p-4 md:p-6 lg:grid lg:grid-cols-[1fr_350px] lg:gap-8 items-start">
        <div className="space-y-6">
          {/* Match Scoreboard Card */}
          <div className="bg-white/5 rounded-2xl border border-white/5 shadow-2xl overflow-hidden backdrop-blur-sm relative group">
            <div className="relative z-10 p-6 md:p-8 space-y-6">
              <div className="flex flex-col items-center space-y-2">
                <div className="flex items-center gap-3">
                  {fixture.league_logo && (
                    <img src={fixture.league_logo} alt={fixture.league_name} className="w-6 h-6 object-contain brightness-110" />
                  )}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{fixture.league_name}</span>
                    <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                      <Calendar size={10} className="text-emerald-500/50" />
                      <span>{formatTime(fixture.kickoff_at).split(' • ')[0]}</span>
                      <Clock size={10} className="text-emerald-500/50 ml-1" />
                      <span>{formatTime(fixture.kickoff_at).split(' • ')[1]}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
                <div className="flex flex-col items-center space-y-2 text-center">
                  <div className="w-16 h-16 md:w-24 md:h-24 bg-black/40 border border-white/5 rounded-xl flex items-center justify-center p-3">
                    {fixture.home_team_logo ? (
                      <img src={fixture.home_team_logo} alt={fixture.home_team_name} className="w-full h-full object-contain brightness-110" />
                    ) : (
                      <Trophy className="w-8 h-8 text-white/5" />
                    )}
                  </div>
                  <h2 className="text-xs md:text-base font-black uppercase tracking-tight text-white">{fixture.home_team_name}</h2>
                </div>

                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="flex items-center gap-4 text-4xl md:text-6xl font-black italic tracking-tighter text-white">
                    {typeof fixture.home_score === 'number' ? (
                      <>
                        <span>{fixture.home_score}</span>
                        <span className="text-emerald-500/30 text-xl not-italic tracking-normal">x</span>
                        <span>{fixture.away_score}</span>
                      </>
                    ) : (
                      <span className="text-white/20 text-xl font-black tracking-widest uppercase">VS</span>
                    )}
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest border transition-all duration-300",
                    LIVE_STATUSES.includes(fixture.status) 
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse" 
                      : "bg-white/5 text-slate-500 border-white/5"
                  )}>
                    {getStatusDisplay(fixture.status, fixture.elapsed)}
                  </div>
                </div>

                <div className="flex flex-col items-center space-y-2 text-center">
                  <div className="w-16 h-16 md:w-24 md:h-24 bg-black/40 border border-white/5 rounded-xl flex items-center justify-center p-3">
                    {fixture.away_team_logo ? (
                      <img src={fixture.away_team_logo} alt={fixture.away_team_name} className="w-full h-full object-contain brightness-110" />
                    ) : (
                      <Trophy className="w-8 h-8 text-white/5" />
                    )}
                  </div>
                  <h2 className="text-xs md:text-base font-black uppercase tracking-tight text-white">{fixture.away_team_name}</h2>
                </div>
              </div>

              {fixture.venue && (
                <div className="flex items-center justify-center gap-2 text-[9px] text-slate-500 font-bold uppercase tracking-widest pt-2 border-t border-white/5">
                  <MapPin size={10} className="text-emerald-500/50" />
                  <span>{fixture.venue}{fixture.city ? `, ${fixture.city}` : ''}</span>
                </div>
              )}
            </div>
          </div>

          {/* Mercados Filtros Chips */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {CATEGORY_ORDER.map(cat => (
              <button 
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                  expandedCategories[cat] ? "bg-emerald-600 border-emerald-400 text-white" : "bg-white/5 border-white/10 text-slate-500"
                )}
              >
                {CATEGORY_MAP[cat] || cat}
              </button>
            ))}
          </div>

          {/* Markets Section */}
          <div className="space-y-4">
            {isLoadingMarkets ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">Carregando Mercados...</p>
              </div>
            ) : markets.length === 0 ? (
              <div className="bg-white/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-6 border border-white/5 backdrop-blur-sm">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sem mercados para esta partida</span>
              </div>
            ) : (
              <div className="space-y-4">
                {CATEGORY_ORDER.map(cat => {
                  const catMarkets = groupedMarkets[cat];
                  if (!catMarkets || catMarkets.length === 0 || !expandedCategories[cat]) return null;

                  return (
                    <div key={cat} className="space-y-3 animate-in fade-in duration-300">
                      {catMarkets.map(market => (
                        <div key={market.id} className="bg-[#0c0c0c] border border-white/5 rounded-xl overflow-hidden">
                          <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{market.market_type.name}</span>
                          </div>
                          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {market.options.map(opt => {
                              const isSelected = localSelections[market.id] === opt.id;
                              return (
                                <button 
                                  key={opt.id}
                                  onClick={() => {
                                    setLocalSelections(prev => ({
                                      ...prev,
                                      [market.id]: prev[market.id] === opt.id ? "" : opt.id
                                    }));
                                  }}
                                  className={cn(
                                    "p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95",
                                    isSelected 
                                      ? "bg-emerald-600 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]" 
                                      : "bg-white/5 border-white/5 text-slate-400 hover:border-emerald-500/30"
                                  )}
                                >
                                  <span className="text-[9px] font-bold uppercase truncate w-full text-center">{opt.market_option.label}</span>
                                  <span className="text-base font-black">{opt.odd.toFixed(2)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="hidden lg:block w-80 shrink-0 sticky top-20">
          <div className="bg-[#0c0c0c] border border-white/5 rounded-2xl p-6 text-center space-y-4">
            <Info className="w-8 h-8 text-emerald-500 mx-auto" />
            <h3 className="text-sm font-black text-white uppercase tracking-tight">Seleções de Teste</h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-relaxed">
              Fase 2: Estrutura de mercados. Selecione as odds para visualizar o destaque.
            </p>
            <div className="pt-4 border-t border-white/5">
              <span className="text-[9px] font-black text-emerald-500/50 uppercase tracking-[0.2em]">
                GreenFutebol &bull; Phase 2
              </span>
            </div>
          </div>
        </aside>
      </main>

      {/* Mobile Bet Slip */}
      {/* Mobile Indicator */}
      {Object.values(localSelections).filter(id => id !== "").length > 0 && (
        <div className="lg:hidden fixed bottom-6 left-0 w-full px-4 z-50">
          <div className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-between px-6">
            <span className="flex items-center gap-2"><Target size={20} /> Seleções</span>
            <span className="bg-black/20 px-3 py-1 rounded-full text-xs">
              {Object.values(localSelections).filter(id => id !== "").length}
            </span>
          </div>
        </div>
      )}

      <footer className="py-6 border-t border-white/5 text-center bg-black mt-auto">
        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">&copy; 2026 GREENFUTEBOL &bull; PREMIUM EXPERIENCE</span>
      </footer>
    </div>
  );
}
