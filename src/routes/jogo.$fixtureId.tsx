import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Trophy, MapPin, Clock, AlertCircle, Loader2, ChevronDown, ChevronUp, Ticket, Info, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { BetSlip } from "@/components/BetSlip";
import { PublicSidebar } from "@/components/PublicSidebar";
import { useAuth } from "@/hooks/use-auth";
import {
  countMarketsByCategory,
  filterMarketsByCategory,
  MARKET_CATEGORIES,
  type MarketCategory,
  sortCatalogMarkets,
} from "@/lib/market-catalog";

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
  marketType: string;
  name: string;
  category: string;
  sortOrder: number;
  line: number | null;
  settlementMode: string;
  selections: FixtureMarketSelection[];
}

interface FixtureMarketSelection {
  id: string;
  odd: number;
  key: string;
  label: string;
  sortOrder: number;
}

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
  const { selections, addSelection, totalOdd } = useBetSlip();
  const [fixture, setFixture] = useState<FixtureDetails | null>(null);
  const [markets, setMarkets] = useState<FixtureMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);
  const [marketsError, setMarketsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<MarketCategory>("ALL");
  const [collapsedMarkets, setCollapsedMarkets] = useState<Record<string, boolean>>({});
  const [isBetSlipOpen, setIsBetSlipOpen] = useState(false);

  const TIMEZONE = "America/Campo_Grande";

  const fetchMarkets = async () => {
    setIsLoadingMarkets(true);
    setMarketsError(null);
    try {
      const marketsClient = supabase as any;
      const { data: dbMarkets, error: marketQueryError } = await marketsClient
        .from('fixture_markets')
        .select('id,status,market_type,market_name,market_group,line,period,sort_order,settlement_mode')
        .eq('fixture_id', parseInt(fixtureId))
        .eq('status', 'OPEN')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (marketQueryError) throw marketQueryError;

      const marketIds = (dbMarkets || []).map((market: any) => market.id);
      let dbSelections: any[] = [];
      if (marketIds.length > 0) {
        const { data, error: selectionQueryError } = await marketsClient
          .from('fixture_market_selections')
          .select('id,market_id,selection_key,selection_name,odd,status,sort_order')
          .in('market_id', marketIds)
          .eq('status', 'OPEN')
          .gt('odd', 1)
          .order('sort_order', { ascending: true });
        if (selectionQueryError) throw selectionQueryError;
        dbSelections = data || [];
      }

      const formattedMarkets: FixtureMarket[] = (dbMarkets || [])
        .map((market: any) => ({
          id: market.id,
          status: market.status,
          marketType: market.market_type,
          name: market.market_name,
          category: market.market_group,
          sortOrder: market.sort_order ?? 999,
          line: market.line,
          settlementMode: market.settlement_mode ?? "MANUAL_SETTLE",
          selections: dbSelections
            .filter((selection: any) =>
              selection.market_id === market.id &&
              selection.status === 'OPEN' && Number(selection.odd) > 1
            )
            .map((selection: any) => ({
              id: selection.id,
              odd: Number(selection.odd),
              key: selection.selection_key,
              label: selection.selection_name,
              sortOrder: selection.sort_order,
            })),
        }))
        .filter((market: FixtureMarket) => market.selections.length > 0);

      setMarkets(sortCatalogMarkets(formattedMarkets));
    } catch (err) {
      console.error("Erro ao buscar mercados:", err);
      setMarketsError("Não foi possível carregar os mercados desta partida.");
      setMarkets([]);
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

      const loadPersistedFixture = async (): Promise<FixtureDetails | null> => {
        const { data: persisted, error: persistedError } = await supabase
          .from('fixtures')
          .select('provider_fixture_id,competition_name,country,season,home_team_id,home_team_name,home_team_crest,away_team_id,away_team_name,away_team_crest,kickoff_at,venue,status,home_score,away_score')
          .eq('provider_fixture_id', id)
          .maybeSingle();

        if (persistedError) throw persistedError;
        if (!persisted) return null;

        const parsedSeason = Number.parseInt(persisted.season || "", 10);
        return {
          fixture_id: Number(persisted.provider_fixture_id),
          league_id: 0,
          league_name: persisted.competition_name || "Competição",
          league_logo: null,
          country: persisted.country || "",
          season: Number.isFinite(parsedSeason) ? parsedSeason : new Date(persisted.kickoff_at).getUTCFullYear(),
          round: null,
          home_team_id: Number(persisted.home_team_id || 0),
          home_team_name: persisted.home_team_name,
          home_team_logo: persisted.home_team_crest,
          away_team_id: Number(persisted.away_team_id || 0),
          away_team_name: persisted.away_team_name,
          away_team_logo: persisted.away_team_crest,
          kickoff_at: persisted.kickoff_at,
          venue: persisted.venue,
          city: null,
          status: persisted.status,
          status_long: STATUS_MAP[persisted.status] || persisted.status,
          elapsed: null,
          home_score: persisted.home_score,
          away_score: persisted.away_score,
          halftime_home: null,
          halftime_away: null,
          fulltime_home: persisted.home_score,
          fulltime_away: persisted.away_score,
        };
      };

      try {
        const { data, error: invokeError } = await supabase.functions.invoke("get-football-fixture", {
          body: { fixture_id: id }
        });

        if (invokeError) {
          const persistedFixture = await loadPersistedFixture();
          if (persistedFixture) setFixture(persistedFixture);
          else setError(invokeError.status === 404 ? "Partida não encontrada." : "Não foi possível carregar os detalhes da partida.");
          return;
        }

        if (data?.fixture) {
          setFixture(data.fixture);
        } else {
          const persistedFixture = await loadPersistedFixture();
          if (persistedFixture) setFixture(persistedFixture);
          else setError("Dados da partida indisponíveis.");
        }
      } catch (err) {
        console.error("Erro ao buscar detalhes:", err);
        try {
          const persistedFixture = await loadPersistedFixture();
          if (persistedFixture) setFixture(persistedFixture);
          else setError("Não foi possível carregar os detalhes da partida.");
        } catch (fallbackError) {
          console.error("Erro ao buscar fixture persistida:", fallbackError);
          setError("Não foi possível carregar os detalhes da partida.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchFixture();
    fetchMarkets();
  }, [fixtureId]);

  const visibleMarkets = useMemo(
    () => filterMarketsByCategory(markets, activeCategory),
    [markets, activeCategory],
  );
  const categoryCounts = useMemo(() => countMarketsByCategory(markets), [markets]);

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

  const toggleMarket = (marketId: string) => {
    setCollapsedMarkets((current) => ({ ...current, [marketId]: !current[marketId] }));
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
    <div className="min-h-screen overflow-x-hidden bg-slate-50 pl-[88px] font-sans text-slate-800 md:pl-64">
      <PublicSidebar />
      <div className="flex min-h-screen min-w-0 flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white text-slate-950">
        <div className="mx-auto flex h-14 min-w-0 max-w-[1920px] items-center justify-between px-2 sm:h-16 sm:px-4">
          <div className="flex min-w-0 items-center gap-1 sm:gap-4">
            <button 
              onClick={handleBack}
              className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-[11px] font-black uppercase leading-tight tracking-tight sm:text-sm">
                {fixture.home_team_name} x {fixture.away_team_name}
              </h1>
              <span className="block truncate text-[9px] font-bold uppercase tracking-wider text-emerald-600/70 sm:tracking-widest">{fixture.league_name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

      <main className="mx-auto w-full min-w-0 max-w-[1920px] flex-1 items-start p-2 pb-24 sm:p-4 sm:pb-24 md:p-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-5 lg:pb-6">
        <div className="min-w-0 space-y-4 sm:space-y-6">
          {/* Match Scoreboard Card */}
          <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="space-y-3 p-3 md:p-4">
              <div className="flex flex-col items-center space-y-2">
                <div className="flex items-center gap-3">
                  {fixture.league_logo && (
                    <img src={fixture.league_logo} alt={fixture.league_name} className="w-6 h-6 object-contain brightness-110" />
                  )}
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{fixture.league_name}</span>
                </div>
              </div>

              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-8">
                <div className="flex min-w-0 flex-col items-center space-y-2 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2 md:h-16 md:w-16">
                    {fixture.home_team_logo ? (
                      <img src={fixture.home_team_logo} alt={fixture.home_team_name} className="w-full h-full object-contain brightness-110" />
                    ) : (
                      <Trophy className="w-8 h-8 text-white/5" />
                    )}
                  </div>
                  <h2 className="max-w-full break-words text-[10px] font-black uppercase leading-tight tracking-tight text-slate-950 sm:text-xs md:text-sm">{fixture.home_team_name}</h2>
                </div>

                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="flex items-center gap-3 text-3xl font-black italic tracking-tighter text-slate-950 md:text-4xl">
                    {typeof fixture.home_score === 'number' ? (
                      <>
                        <span>{fixture.home_score}</span>
                        <span className="text-emerald-500/30 text-xl not-italic tracking-normal">x</span>
                        <span>{fixture.away_score}</span>
                      </>
                    ) : (
                      <span className="text-xl font-black uppercase tracking-widest text-slate-300">VS</span>
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

                <div className="flex min-w-0 flex-col items-center space-y-2 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2 md:h-16 md:w-16">
                    {fixture.away_team_logo ? (
                      <img src={fixture.away_team_logo} alt={fixture.away_team_name} className="w-full h-full object-contain brightness-110" />
                    ) : (
                      <Trophy className="w-8 h-8 text-white/5" />
                    )}
                  </div>
                  <h2 className="max-w-full break-words text-[10px] font-black uppercase leading-tight tracking-tight text-slate-950 sm:text-xs md:text-sm">{fixture.away_team_name}</h2>
                </div>
              </div>
            </div>
          </div>

          {/* Mercados Filtros Chips */}
          <div className="flex w-full min-w-0 gap-2 overflow-x-auto whitespace-nowrap pb-2 no-scrollbar">
            {MARKET_CATEGORIES.map(category => (
              <button 
                key={category.key}
                onClick={() => setActiveCategory(category.key)}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                  activeCategory === category.key ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-emerald-300"
                )}
              >
                {category.label} <span className="ml-1 opacity-60">{categoryCounts[category.key] || 0}</span>
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
            ) : marketsError ? (
              <div className="bg-red-500/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-3 border border-red-500/20">
                <AlertCircle className="text-red-400" />
                <span className="text-xs font-bold text-red-300">{marketsError}</span>
              </div>
            ) : markets.length === 0 ? (
              <div className="bg-white/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-6 border border-white/5 backdrop-blur-sm">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sem mercados para esta partida</span>
              </div>
            ) : (
              <div className="space-y-3" data-testid="market-catalog" data-market-count={visibleMarkets.length}>
                {visibleMarkets.length === 0 ? (
                  <div className="rounded-xl border border-white/5 bg-white/[0.03] p-8 text-center text-xs text-slate-500">
                    Nenhum mercado publicado nesta categoria.
                  </div>
                ) : (
                  visibleMarkets.map(market => (
                        <div key={market.id} className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() => toggleMarket(market.id)}
                            className="flex w-full items-center justify-between border-b border-slate-200 px-3 py-2.5 text-left"
                          >
                            <span className="min-w-0 break-words text-[10px] font-black uppercase tracking-wider text-slate-700 sm:tracking-widest">
                              {market.name}{market.line !== null ? ` · ${market.line}` : ""}
                            </span>
                            {collapsedMarkets[market.id] ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                          </button>
                          {!collapsedMarkets[market.id] && <div className="grid grid-cols-1 gap-1.5 p-2 sm:grid-cols-2 xl:grid-cols-4">
                            {market.selections.map(opt => {
                              const isSelected = selections.some(s => s.selection_id === opt.id);
                              return (
                                <button 
                                  key={opt.id}
                                  onClick={() => addSelection({
                                    selection_id: opt.id,
                                    market_id: market.id,
                                    odd: opt.odd,
                                    label: opt.label,
                                    market_name: market.name,
                                    home_team: fixture.home_team_name,
                                    away_team: fixture.away_team_name,
                                    fixture_id: fixture.fixture_id
                                  })}
                                  className={cn(
                                    "flex min-h-12 min-w-0 items-center justify-between gap-2 overflow-hidden rounded-md border px-2.5 py-2 transition-all active:scale-[0.99]",
                                    isSelected 
                                      ? "bg-emerald-600 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]" 
                                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-400 hover:bg-emerald-50"
                                  )}
                                >
                                  <span className="min-w-0 flex-1 truncate text-left text-[10px] font-bold uppercase">{opt.label}</span>
                                  <span className="shrink-0 tabular-nums text-base font-black" data-testid={`selection-odd-${opt.id}`}>{opt.odd.toFixed(2)}</span>
                                </button>
                              );
                            })}
                          </div>}
                        </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="hidden lg:block w-80 shrink-0 sticky top-20">
          <BetSlip />
        </aside>
      </main>

      {/* Mobile Bet Slip */}
      {!isBetSlipOpen && selections.length > 0 && (
        <div className="fixed bottom-0 left-[88px] right-0 z-40 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden">
          <button 
            onClick={() => setIsBetSlipOpen(true)}
            className="flex w-full items-center justify-between rounded-lg bg-emerald-600 px-4 py-3 font-black uppercase tracking-widest text-white shadow-lg"
          >
            <span className="flex items-center gap-2"><Ticket size={20} /> Bilhete · {selections.length}</span>
            <span className="rounded-full bg-black/20 px-3 py-1 text-xs tabular-nums">Odd {totalOdd.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
          </button>
        </div>
      )}

      {/* Mobile Drawer */}
      {isBetSlipOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/35 backdrop-blur-sm">
          <div className="absolute bottom-0 left-0 flex max-h-[92dvh] w-full min-w-0 flex-col rounded-t-xl border-t border-emerald-200 bg-white pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between border-b border-slate-200 p-3">
              <span className="text-sm font-black uppercase tracking-widest text-slate-900">Seu Bilhete</span>
              <button onClick={() => setIsBetSlipOpen(false)} className="p-2 text-slate-400"><X size={20} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-4">
              <BetSlip isMobile />
            </div>
          </div>
        </div>
      )}

      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-center">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">&copy; 2026 GREENSPORT</span>
      </footer>
      </div>
    </div>
  );
}
