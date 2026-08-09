

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef, useDeferredValue } from "react";
import {
  Search,
  Ticket,
  Calendar,
  Clock,
  PlayCircle,
  AlertCircle,
  LogIn,
  LogOut,
  Info,
  Menu,
  X,
  ChevronRight,
  Star,
  Trophy,
  Target,
  Zap,
} from "lucide-react";

import logoAsset from "@/assets/logo.png.asset.json";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { BetSlip } from "@/components/BetSlip";
import { maskPhone } from "@/lib/phone-utils";
import {
  APP_TIMEZONE,
  FIXTURES_REQUEST_TIMEOUT_MS,
  FUTURE_SEARCH_LIMIT,
  addCalendarDays,
  formatFixtureDateTime,
  getDateInTimezone,
  getFixturesErrorMessage,
  isValidIsoDate,
  withTimeout,
} from "@/lib/fixtures-utils";

import { z } from "zod";

const homeSearchSchema = z.object({
  tab: z.enum(["today", "tomorrow", "live", "custom"]).optional().catch("today"),
  comp: z.enum(["BSA", "PL", "CL", "BL1", "PD", "SA", "FL1", "DED", "ELC", "PPL", "ALL"]).optional().catch("ALL"),
  date: z.string().optional().catch(""),
});

export const Route = createFileRoute("/")({
  validateSearch: homeSearchSchema,
  head: () => ({
    meta: [
      { title: "GreenFutebol - Plataforma Premium de Futebol" },
      {
        name: "description",
        content:
          "Acompanhe jogos de futebol em tempo real na GreenFutebol com tecnologia de ponta.",
      },
    ],
  }),
  component: Index,
});

interface Fixture {
  fixture_id: number;
  league_name: string;
  league_logo: string | null;
  country: string;
  home_team_name: string;
  home_team_logo: string | null;
  away_team_name: string;
  away_team_logo: string | null;
  kickoff_at: string;
  venue: string | null;
  status: string;
  elapsed: number | null;
  home_score: number | null;
  away_score: number | null;
}

const LIVE_STATUSES = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"];
const COMPETITION_CODES = ["BSA", "PL", "CL", "BL1", "PD", "SA", "FL1", "DED", "ELC", "PPL"] as const;

function FixturesSkeleton() {
  return (
    <div className="space-y-6" aria-label="Carregando jogos" aria-busy="true">
      {[0, 1].map((section) => (
        <div key={section} className="space-y-3 animate-pulse">
          <div className="h-4 w-44 rounded bg-white/10" />
          <div className="h-8 rounded-xl border border-white/5 bg-white/[0.04]" />
          {[0, 1, 2].map((card) => (
            <div key={card} className="flex items-center gap-4 rounded-xl border border-white/5 bg-[#0c0c0c] p-4">
              <div className="h-8 w-14 rounded bg-white/10" />
              <div className="flex-1 space-y-3">
                <div className="h-3 w-3/5 rounded bg-white/10" />
                <div className="h-3 w-2/5 rounded bg-white/[0.07]" />
              </div>
              <div className="h-8 w-8 rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
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

function getStatusClass(status: string): string {
  if (LIVE_STATUSES.includes(status)) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (["NS", "TBD"].includes(status)) return "bg-blue-500/10 text-blue-300 border-blue-500/20";
  if (["FT", "AET", "PEN"].includes(status)) return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  if (["PST", "SUSP", "INT", "ABD"].includes(status)) return "bg-amber-500/10 text-amber-300 border-amber-500/20";
  if (status === "CANC") return "bg-red-500/10 text-red-300 border-red-500/20";
  return "bg-white/5 text-slate-400 border-white/10";
}

function Index() {
  const { user, profile, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { selections } = useBetSlip();

  const [activeTab, setActiveTab] = useState<"today" | "tomorrow" | "live" | "custom">(search.tab || "today");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [isPartial, setIsPartial] = useState(false);
  const [displayedDate, setDisplayedDate] = useState<string | null>(null);
  const [isShowingNextAvailable, setIsShowingNextAvailable] = useState(false);
  const [competitionCode, setCompetitionCode] = useState<
    "BSA" | "PL" | "CL" | "BL1" | "PD" | "SA" | "FL1" | "DED" | "ELC" | "PPL" | "ALL"
  >(search.comp || "ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [customDate, setCustomDate] = useState(search.date || "");
  const [reachedLimit, setReachedLimit] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBetSlipOpen, setIsBetSlipOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Sync state to URL
  useEffect(() => {
    navigate({
      search: {
        tab: activeTab,
        comp: competitionCode,
        date: customDate || undefined,
      },
      replace: true,
    });
  }, [activeTab, competitionCode, customDate, navigate]);

  const requestIdRef = useRef(0);
  const fixturesCacheRef = useRef(
    new Map<string, { fixtures: Fixture[]; partial: boolean; expiresAt: number }>(),
  );

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate({ to: "/" });
    } catch (err: unknown) {
      console.error("Erro ao sair:", err);
      toast.error(
        err instanceof Error ? err.message : "Não foi possível sair da conta. Tente novamente.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  const normalizeText = (text: string | null | undefined) => {
    return (text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  const TIMEZONE = APP_TIMEZONE;

  const getCGRDateString = getDateInTimezone;

  const getTomorrowCGRDateString = () => {
    return addCalendarDays(getCGRDateString(new Date()), 1);
  };

  const getNextCGRDateString = (dateStr: string) => {
    return addCalendarDays(dateStr, 1);
  };

  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  useEffect(() => {
    const currentRequestId = ++requestIdRef.current;

    const fetchFixtures = async () => {
      if (activeTab === "custom") {
        if (!isValidIsoDate(customDate)) {
          if (currentRequestId === requestIdRef.current) {
            setFixtures([]);
            setDisplayedDate(null);
            setIsShowingNextAvailable(false);
            setReachedLimit(false);
            setIsLoading(false);
          }
          return;
        }
      }

      setIsLoading(true);
      setError(null);
      setIsPartial(false);
      setReachedLimit(false);

      try {
        let requestedDate: string;
        if (activeTab === "tomorrow") {
          requestedDate = getTomorrowCGRDateString();
        } else if (activeTab === "custom") {
          requestedDate = customDate;
        } else {
          requestedDate = getCGRDateString(new Date());
        }

        // 1. Tentar carregar da nossa tabela persistente 'fixtures'
        const { data: dbFixtures, error: dbError } = await supabase
          .from('fixtures')
          .select('*')
          .gte('kickoff_at', `${requestedDate}T00:00:00Z`)
          .lte('kickoff_at', `${requestedDate}T23:59:59Z`)
          .order('kickoff_at', { ascending: true });

        if (!dbError && dbFixtures && dbFixtures.length > 0) {
          const formatted: Fixture[] = dbFixtures.map(f => ({
            fixture_id: Number(f.provider_fixture_id),
            league_name: f.competition_name || "Competição",
            league_logo: null,
            country: f.country || "Internacional",
            home_team_name: f.home_team_name,
            home_team_logo: f.home_team_crest,
            away_team_name: f.away_team_name,
            away_team_logo: f.away_team_crest,
            kickoff_at: f.kickoff_at,
            venue: f.venue,
            status: f.status,
            elapsed: null,
            home_score: f.home_score,
            away_score: f.away_score
          }));

          if (currentRequestId === requestIdRef.current) {
            setFixtures(formatted);
            setDisplayedDate(requestedDate);
            setIsShowingNextAvailable(false);
            setIsLoading(false);
          }
          return;
        }

        // 2. Se não houver no banco, fallback para o fluxo original de cache/API
        let currentDate = requestedDate;
        let foundFixtures: Fixture[] = [];
        let searchCount = 0;
        const maxSearchDays = FUTURE_SEARCH_LIMIT;
        let finalPartial = false;

        const fetchDate = async (date: string, publishProgress = true) => {
          const codes = competitionCode === "ALL" ? COMPETITION_CODES : [competitionCode];
          const progressiveFixtures: Fixture[] = [];
          let partial = false;
          let successfulRequests = 0;
          let lastRequestError: unknown = null;

          await Promise.all(codes.map(async (code) => {
            if (currentRequestId !== requestIdRef.current) return;
            try {
              const cacheKey = `${code}:${date}:${activeTab === "live" ? "live" : "all"}`;
              const cached = fixturesCacheRef.current.get(cacheKey);
              let results: Fixture[];
              let responsePartial = false;

              if (cached && cached.expiresAt > Date.now()) {
                results = cached.fixtures;
                responsePartial = cached.partial;
              } else {
                const { data, error: invokeError } = await withTimeout(
                  supabase.functions.invoke("get-football-fixtures", {
                    body: { date, competition_code: code },
                  }),
                  FIXTURES_REQUEST_TIMEOUT_MS,
                );
                if (invokeError) throw invokeError;
                results = Array.isArray(data?.fixtures) ? data.fixtures : [];
                responsePartial = !!data?.partial;
                fixturesCacheRef.current.set(cacheKey, {
                  fixtures: results,
                  partial: responsePartial,
                  expiresAt: Date.now() + (activeTab === "live" ? 30_000 : 5 * 60_000),
                });
                while (fixturesCacheRef.current.size > 100) {
                  const oldestKey = fixturesCacheRef.current.keys().next().value;
                  if (!oldestKey) break;
                  fixturesCacheRef.current.delete(oldestKey);
                }
              }

              successfulRequests++;

              if (activeTab === "live") {
                results = results.filter((fixture) => LIVE_STATUSES.includes(fixture.status));
              }
              partial ||= responsePartial;
              progressiveFixtures.push(...results);

              if (
                publishProgress &&
                results.length > 0 &&
                currentRequestId === requestIdRef.current
              ) {
                const unique = Array.from(
                  new Map(progressiveFixtures.map((fixture) => [fixture.fixture_id, fixture])).values(),
                ).sort(
                  (a, b) =>
                    new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
                );
                setFixtures(unique);
                setDisplayedDate(date);
                setIsShowingNextAvailable(date !== requestedDate);
                setIsLoading(false);
              }
            } catch (requestError) {
              partial = true;
              lastRequestError = requestError;
              console.error(`Erro ao consultar ${code}:`, requestError);
            }
          }));

          if (successfulRequests === 0 && lastRequestError) throw lastRequestError;

          return { fixtures: progressiveFixtures, partial };
        };

        // Sequence search loop
        while (searchCount < maxSearchDays) {
          const result = await fetchDate(currentDate);
          finalPartial ||= result.partial;

          if (result.fixtures.length > 0) {
            foundFixtures = result.fixtures;
            break;
          }

          if (activeTab === "live" || activeTab === "custom") break;

          // If no results, try next day
          currentDate = getNextCGRDateString(currentDate);
          searchCount++;

          if (searchCount >= maxSearchDays) {
            setReachedLimit(true);
          }
        }

        if (currentRequestId !== requestIdRef.current) return;

        foundFixtures.sort(
          (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
        );

        setFixtures(foundFixtures);
        setDisplayedDate(currentDate);
        setIsShowingNextAvailable(currentDate !== requestedDate);
        setIsPartial(finalPartial);

        if ((activeTab === "today" || activeTab === "tomorrow") && foundFixtures.length > 0) {
          const prefetchDate = addCalendarDays(currentDate, 1);
          void fetchDate(prefetchDate, false).catch(() => undefined);
        }
      } catch (err: unknown) {
        if (currentRequestId !== requestIdRef.current) return;
        console.error("Erro ao buscar jogos:", err);
        setError(getFixturesErrorMessage(err));
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchFixtures();
  }, [activeTab, customDate, competitionCode, retryCount]);

  const groupedFixtures = useMemo(() => {
    const search = normalizeText(deferredSearchQuery);
    const filtered = search
      ? fixtures.filter(
          (f) =>
            normalizeText(f.home_team_name).includes(search) ||
            normalizeText(f.away_team_name).includes(search) ||
            normalizeText(f.league_name).includes(search) ||
            normalizeText(f.country).includes(search),
        )
      : fixtures;

    // First, group by Date (YYYY-MM-DD)
    const dateGroups: Record<
      string,
      Record<string, { name: string; country: string; logo: string | null; matches: Fixture[] }>
    > = {};

    filtered.forEach((f) => {
      // Get the date in the local timezone for grouping
      const dateKey = getCGRDateString(new Date(f.kickoff_at));

      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = {};
      }

      const leagueKey = `${f.country}-${f.league_name}`;
      if (!dateGroups[dateKey][leagueKey]) {
        dateGroups[dateKey][leagueKey] = {
          name: f.league_name,
          country: f.country,
          logo: f.league_logo,
          matches: [],
        };
      }
      dateGroups[dateKey][leagueKey].matches.push(f);
    });

    // Convert to sorted array structure
    return Object.entries(dateGroups)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, leagues]) => ({
        date,
        leagues: Object.values(leagues).sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [fixtures, deferredSearchQuery]);

  const formatGroupHeader = (dateStr: string) => {
    // Adicionar T12:00:00 para evitar problemas de timezone ao criar o objeto Date apenas da data
    const date = new Date(dateStr + "T12:00:00");
    const today = getCGRDateString(new Date());
    const tomorrow = getTomorrowCGRDateString();

    const parts = dateStr.split("-");
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    const formattedDate = `${day}/${month}/${year}`;

    let prefix = "";
    if (dateStr === today) {
      prefix = "Hoje";
    } else if (dateStr === tomorrow) {
      prefix = "Amanhã";
    } else {
      const weekDay = new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
      }).format(date);
      prefix = weekDay.charAt(0).toUpperCase() + weekDay.slice(1);
    }

    return `${prefix} — ${formattedDate}`;
  };

  const getStatusDisplay = (status: string, elapsed: number | null) => {
    const translated = STATUS_MAP[status] || status;
    if (LIVE_STATUSES.includes(status) && elapsed !== null && status !== "HT") {
      return `${translated} ${elapsed}'`;
    }
    return translated;
  };

  return (
    <div
      className="min-h-screen bg-[#050505] flex flex-col font-sans text-slate-200 overflow-x-hidden w-full max-w-[100vw]"
      data-testid="main-container"
    >
      {/* Header Fixo e Denso */}
      <header className="bg-black border-b border-emerald-500/10 text-white shadow-2xl sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-[1920px] mx-auto px-4 flex justify-between items-center h-14 sm:h-16">
          <div className="flex items-center gap-4">
            <button
              aria-label={isMenuOpen ? "Fechar menu" : "Menu"}
              aria-expanded={isMenuOpen}
              className="p-2 text-emerald-500 hover:bg-white/5 rounded-lg transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu size={24} />
            </button>
            <div
              className="flex items-center gap-2 group cursor-pointer"
              onClick={() => navigate({ to: "/" })}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full scale-150 group-hover:bg-emerald-500/20 transition-colors" />
                <img
                  src={logoAsset.url}
                  alt="GreenFutebol"
                  className="h-6 sm:h-8 w-auto relative z-10 brightness-110 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]"
                />
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-8 font-black uppercase tracking-widest text-[11px]">
            <button
              onClick={() => {
                navigate({ to: "/" });
                setCompetitionCode("ALL");
              }}
              className={cn(
                "pb-5 pt-5 transition-all border-b-2",
                competitionCode === "ALL"
                  ? "text-emerald-500 border-emerald-500"
                  : "text-slate-400 border-transparent hover:text-white",
              )}
            >
              Futebol
            </button>
            <button
              onClick={() => {
                setActiveTab("live");
                navigate({ to: "/" });
              }}
              className={cn(
                "pb-5 pt-5 transition-all border-b-2",
                activeTab === "live"
                  ? "text-emerald-500 border-emerald-500"
                  : "text-slate-400 border-transparent hover:text-white",
              )}
            >
              Ao Vivo
            </button>
            <button
              onClick={() => navigate({ to: "/meus-bilhetes" })}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Minhas Apostas
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:relative md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Buscar jogo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg py-1.5 pl-9 pr-4 text-xs focus:ring-1 focus:ring-emerald-500/50 w-40 text-white placeholder:text-white/20 transition-all outline-none"
              />
            </div>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end mr-2">
                  <span className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">
                    Saldo
                  </span>
                  <span className="text-sm font-black text-white">R$ 0,00</span>
                </div>
                <div
                  className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 cursor-pointer"
                  onClick={() => navigate({ to: "/meus-bilhetes" })}
                >
                  {(profile?.name || "U").charAt(0).toUpperCase()}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate({ to: "/login" })}
                  className="px-3 py-1.5 rounded-lg text-xs font-black text-slate-300 hover:text-white transition-all uppercase tracking-widest"
                >
                  Entrar
                </button>
                <button
                  onClick={() => navigate({ to: "/cadastro" })}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest transition-all"
                >
                  Cadastrar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Estrutura 3 Colunas Desktop */}
      <div className="flex-1 flex w-full max-w-[1920px] mx-auto overflow-hidden">
        {/* Sidebar Esquerda: Ligas e Favoritos */}
        <aside
          className={cn(
            "bg-[#080808] border-r border-white/5 overflow-y-auto no-scrollbar transition-all duration-300 z-40 shrink-0",
            isMenuOpen ? "w-64 fixed inset-y-0 left-0 pt-14 lg:pt-0 lg:static" : "w-0 lg:w-64",
          )}
        >
          <div className="p-4 space-y-6">
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">
                Principais Ligas
              </h4>
              <div className="space-y-1">
                {[
                  { id: "ALL", name: "Todas as Ligas", icon: Trophy },
                  { id: "BSA", name: "Brasileirão Série A", icon: Trophy },
                  { id: "PL", name: "Premier League", icon: Star },
                  { id: "BL1", name: "Bundesliga", icon: Trophy },
                  { id: "CL", name: "Champions League", icon: Zap },
                  { id: "PD", name: "La Liga", icon: Star },
                  { id: "SA", name: "Serie A (Itália)", icon: Target },
                  { id: "FL1", name: "Ligue 1", icon: Star },
                  { id: "ELC", name: "Championship", icon: Trophy },
                  { id: "DED", name: "Eredivisie", icon: Target },
                  { id: "PPL", name: "Primeira Liga", icon: Zap },
                ].map((league) => (
                  <button
                    key={league.id}
                    onClick={() => {
                      setCompetitionCode(league.id as any);
                      if (window.innerWidth < 1024) setIsMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-bold group",
                      competitionCode === league.id
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "text-slate-400 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <league.icon
                      size={16}
                      className={cn(
                        competitionCode === league.id
                          ? "text-emerald-500"
                          : "text-slate-500 group-hover:text-emerald-500",
                      )}
                    />
                    {league.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">
                Filtros
              </h4>
              <div className="space-y-1">
                {[
                  { id: "today", name: "Hoje", icon: Clock },
                  { id: "tomorrow", name: "Amanhã", icon: Calendar },
                  { id: "live", name: "Ao Vivo", icon: PlayCircle },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      if (window.innerWidth < 1024) setIsMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-bold",
                      activeTab === tab.id
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "text-slate-400 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <tab.icon
                      size={16}
                      className={cn(activeTab === tab.id ? "text-emerald-500" : "text-slate-500")}
                    />
                    {tab.name}
                  </button>
                ))}
                <label className="block px-3 pt-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Escolher data
                  <input
                    type="date"
                    value={customDate}
                    onChange={(event) => {
                      setCustomDate(event.target.value);
                      setActiveTab("custom");
                    }}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none focus:border-emerald-500/40"
                  />
                </label>
              </div>
            </div>
          </div>
        </aside>

        {/* Conteúdo Central: Jogos */}
        <main className="flex-1 overflow-y-auto no-scrollbar bg-[#050505] p-2 sm:p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Banner e Filtros Mobile */}
            <div className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {["ALL", ...COMPETITION_CODES].map((id) => (
                <button
                  key={id}
                  onClick={() => setCompetitionCode(id as any)}
                  className={cn(
                    "px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap border transition-all",
                    competitionCode === id
                      ? "bg-emerald-600 border-emerald-400 text-white"
                      : "bg-white/5 border-white/10 text-slate-400",
                  )}
                >
                  {id}
                </button>
              ))}
            </div>

            {isLoading ? (
              <FixturesSkeleton />
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
                <h3 className="text-white font-black uppercase tracking-widest text-sm">
                  Erro de Conexão
                </h3>
                <p className="text-slate-400 text-xs">{error}</p>
                <button
                  onClick={() => setRetryCount((value) => value + 1)}
                  className="mt-4 px-6 py-2 bg-red-600/20 text-red-400 border border-red-500/30 rounded-xl text-[10px] font-black uppercase transition-all"
                >
                  Atualizar
                </button>
              </div>
            ) : groupedFixtures.length === 0 ? (
              <div className="bg-white/5 border border-white/5 rounded-2xl p-20 text-center space-y-4 backdrop-blur-sm">
                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">
                  {isPartial
                    ? "Algumas competições não puderam ser atualizadas. Tente novamente."
                    : reachedLimit
                      ? "Sem jogos para este filtro nos próximos 14 dias"
                      : "Nenhum jogo encontrado"}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {isPartial && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                    Algumas competições não puderam ser atualizadas. Os jogos disponíveis continuam sendo exibidos.
                  </div>
                )}
                {isShowingNextAvailable && displayedDate && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-3 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                    <Info size={16} className="shrink-0" />
                    <p className="font-bold text-[10px] uppercase tracking-widest">
                      Não há jogos na data selecionada. Exibindo os próximos jogos disponíveis.
                      Data: {formatDateBR(displayedDate)}
                    </p>
                  </div>
                )}

                {groupedFixtures.map((dateGroup) => (
                  <div key={dateGroup.date} className="space-y-4">
                    <div className="flex items-center gap-3 px-2 border-l-2 border-emerald-500/50">
                      <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">
                        {formatGroupHeader(dateGroup.date)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {dateGroup.leagues.map((league) => (
                        <div
                          key={`${dateGroup.date}-${league.country}-${league.name}`}
                          className="space-y-2"
                        >
                          <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                            {league.logo ? (
                              <img
                                src={league.logo}
                                alt={league.name}
                                className="w-4 h-4 object-contain brightness-125"
                              />
                            ) : (
                              <div className="w-4 h-4 bg-white/10 rounded-sm flex items-center justify-center text-[8px]">
                                ⚽
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="block truncate text-[10px] font-black uppercase tracking-widest text-slate-300">{league.name}</span>
                              <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-600">{league.country}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {league.matches.map((match) => (
                              <div key={match.fixture_id} className="relative group">
                                <Link
                                  to="/jogo/$fixtureId"
                                  params={{ fixtureId: String(match.fixture_id) }}
                                >
                                  <div className="bg-[#0c0c0c] rounded-xl border border-white/5 p-3 sm:p-4 hover:border-emerald-500/30 transition-all group-hover:bg-[#101010]">
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="flex flex-col min-w-[60px]">
                                        <span className="text-[10px] font-black text-white whitespace-nowrap">
                                          {formatFixtureDateTime(match.kickoff_at)}
                                        </span>
                                        <span className={cn("mt-1 w-fit rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter", getStatusClass(match.status), LIVE_STATUSES.includes(match.status) && "animate-pulse")}>
                                          {getStatusDisplay(match.status, match.elapsed)}
                                        </span>
                                        {match.venue && <span className="mt-1 max-w-[150px] truncate text-[8px] font-medium text-slate-600">{match.venue}</span>}
                                      </div>

                                      <div className="flex-1 flex flex-col gap-2">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            {match.home_team_logo && (
                                              <img
                                                src={match.home_team_logo}
                                                className="w-4 h-4 object-contain"
                                              />
                                            )}
                                            <span className="text-xs font-bold text-slate-200 truncate">
                                              {match.home_team_name}
                                            </span>
                                          </div>
                                          <span className="text-xs font-black text-white">
                                            {match.home_score ?? 0}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            {match.away_team_logo && (
                                              <img
                                                src={match.away_team_logo}
                                                className="w-4 h-4 object-contain"
                                              />
                                            )}
                                            <span className="text-xs font-bold text-slate-200 truncate">
                                              {match.away_team_name}
                                            </span>
                                          </div>
                                          <span className="text-xs font-black text-white">
                                            {match.away_score ?? 0}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="hidden sm:flex items-center gap-2">
                                        <ChevronRight size={16} className="text-slate-700" />
                                      </div>
                                    </div>
                                  </div>
                                </Link>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Bilhete Lateral Desktop */}
        <aside className="hidden xl:block w-80 shrink-0 border-l border-white/5 p-4 overflow-y-auto no-scrollbar bg-[#080808]">
          <BetSlip />
        </aside>
      </div>

      {/* Mobile Bet Slip Toggle */}
      {!isBetSlipOpen && selections.length > 0 && (
        <div className="lg:hidden fixed bottom-6 left-0 w-full px-4 z-50">
          <button
            onClick={() => setIsBetSlipOpen(true)}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-between px-6"
          >
            <span className="flex items-center gap-2">
              <Ticket size={20} /> Bilhete
            </span>
            <span className="bg-black/20 px-3 py-1 rounded-full text-xs">{selections.length}</span>
          </button>
        </div>
      )}

      {/* Mobile Drawer */}
      {isBetSlipOpen && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md">
          <div className="absolute bottom-0 w-full max-h-[90vh] bg-[#0c0c0c] rounded-t-3xl border-t border-emerald-500/20 flex flex-col">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <span className="text-sm font-black text-white uppercase tracking-widest">
                Seu Bilhete
              </span>
              <button onClick={() => setIsBetSlipOpen(false)} className="p-2 text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <BetSlip isMobile />
            </div>
          </div>
        </div>
      )}

      <footer className="py-6 border-t border-white/5 text-center bg-black">
        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
          &copy; 2026 GREENFUTEBOL &bull; PREMIUM EXPERIENCE
        </span>
      </footer>
    </div>
  );
}
