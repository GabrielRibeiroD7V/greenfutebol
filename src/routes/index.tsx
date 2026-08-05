import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { Search, Ticket, Calendar, Clock, PlayCircle, AlertCircle, Loader2, LogIn, LogOut, Info } from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GreenFutebol - Plataforma Premium de Futebol" },
      { name: "description", content: "Acompanhe jogos de futebol em tempo real na GreenFutebol com tecnologia de ponta." },
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

function Index() {
  const { user, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'today' | 'tomorrow' | 'live' | 'custom'>('today');
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [isPartial, setIsPartial] = useState(false);
  const [displayedDate, setDisplayedDate] = useState<string | null>(null);
  const [isShowingNextAvailable, setIsShowingNextAvailable] = useState(false);
  const [competitionCode, setCompetitionCode] = useState<'BSA' | 'PL' | 'CL' | 'BL1' | 'PD' | 'SA' | 'FL1' | 'DED' | 'ELC' | 'PPL' | 'ALL'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [customDate, setCustomDate] = useState("");
  const requestIdRef = useRef(0);
  const [reachedLimit, setReachedLimit] = useState(false);

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
        err instanceof Error
          ? err.message
          : "Não foi possível sair da conta. Tente novamente."
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  const normalizeText = (text: string | null | undefined) => {
    return (text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  const TIMEZONE = "America/Campo_Grande";

  const getCGRDateString = (dateObj: Date) => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(dateObj);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  };

  const getTomorrowCGRDateString = () => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(new Date());
    const year = parseInt(parts.find(p => p.type === 'year')!.value);
    const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1;
    const day = parseInt(parts.find(p => p.type === 'day')!.value);

    const utcDate = new Date(Date.UTC(year, month, day));
    utcDate.setUTCDate(utcDate.getUTCDate() + 1);

    const y = utcDate.getUTCFullYear();
    const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(utcDate.getUTCDate()).padStart(2, '0');
    
    return `${y}-${m}-${d}`;
  };

  const getNextCGRDateString = (dateStr: string) => {
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3) return dateStr;
    const year = parts[0]!;
    const month = parts[1]!;
    const day = parts[2]!;
    
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + 1);
    
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    
    return `${y}-${m}-${d}`;
  };

  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  useEffect(() => {
    const currentRequestId = ++requestIdRef.current;
    
    const fetchFixtures = async () => {
      if (activeTab === 'custom') {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const yearStr = customDate?.split('-')[0];
        const year = yearStr ? parseInt(yearStr) : NaN;
        const parsedDate = new Date(customDate || "");
        const isValidDate = customDate && 
                           dateRegex.test(customDate) && 
                           customDate.length === 10 &&
                           year >= 2000 && year <= 2100 &&
                           !isNaN(parsedDate.getTime()) && 
                           parsedDate.toISOString().slice(0, 10) === customDate;

        if (!isValidDate) {
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
        if (activeTab === 'tomorrow') {
          requestedDate = getTomorrowCGRDateString();
        } else if (activeTab === 'custom') {
          requestedDate = customDate;
        } else {
          requestedDate = getCGRDateString(new Date());
        }

        let currentDate = requestedDate;
        let foundFixtures: Fixture[] = [];
        let searchCount = 0;
        const maxSearchDays = 14;
        let finalPartial = false;

        // Sequence search loop
        while (searchCount < maxSearchDays) {
          // If live or custom, we only search once
          if (activeTab === 'live' || activeTab === 'custom') {
             const { data, error: invokeError } = await supabase.functions.invoke("get-football-fixtures", {
              body: { 
                date: currentDate,
                competition_code: competitionCode
              }
            });
            if (invokeError) throw invokeError;
            
            let results: Fixture[] = Array.isArray(data?.fixtures) ? data.fixtures : [];
            if (activeTab === 'live') {
              results = results.filter(f => LIVE_STATUSES.includes(f.status));
            }
            foundFixtures = results;
            finalPartial = !!data?.partial;
            break; // Stop after first try for live/custom
          }

          // Search for today/tomorrow
          const { data, error: invokeError } = await supabase.functions.invoke("get-football-fixtures", {
            body: { 
              date: currentDate,
              competition_code: competitionCode
            }
          });

          if (invokeError) throw invokeError;

          const results: Fixture[] = Array.isArray(data?.fixtures) ? data.fixtures : [];
          finalPartial = finalPartial || !!data?.partial;

          if (results.length > 0) {
            foundFixtures = results;
            break;
          }

          // If no results, try next day
          currentDate = getNextCGRDateString(currentDate);
          searchCount++;
          
          if (searchCount >= maxSearchDays) {
            setReachedLimit(true);
          }
        }

        if (currentRequestId !== requestIdRef.current) return;

        foundFixtures.sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
        
        setFixtures(foundFixtures);
        setDisplayedDate(currentDate);
        setIsShowingNextAvailable(currentDate !== requestedDate);
        setIsPartial(finalPartial);
      } catch (err: any) {
        if (currentRequestId !== requestIdRef.current) return;
        console.error("Erro ao buscar jogos:", err);
        setError("Não foi possível carregar os jogos. Tente novamente mais tarde.");
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchFixtures();
  }, [activeTab, customDate, competitionCode]);

  const groupedFixtures = useMemo(() => {
    const search = normalizeText(searchQuery);
    const filtered = search
      ? fixtures.filter(f => 
          normalizeText(f.home_team_name).includes(search) ||
          normalizeText(f.away_team_name).includes(search) ||
          normalizeText(f.league_name).includes(search) ||
          normalizeText(f.country).includes(search)
        )
      : fixtures;

    // First, group by Date (YYYY-MM-DD)
    const dateGroups: Record<string, Record<string, { name: string; country: string; logo: string | null; matches: Fixture[] }>> = {};
    
    filtered.forEach(f => {
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
          matches: []
        };
      }
      dateGroups[dateKey][leagueKey].matches.push(f);
    });

    // Convert to sorted array structure
    return Object.entries(dateGroups)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, leagues]) => ({
        date,
        leagues: Object.values(leagues).sort((a, b) => a.name.localeCompare(b.name))
      }));
  }, [fixtures, searchQuery]);

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    
    const timeStr = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);

    const weekDay = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      weekday: "short"
    }).format(date).replace(".", "");
    
    const capitalizedWeekDay = weekDay.charAt(0).toUpperCase() + weekDay.slice(1);

    const isDifferentYear = date.getFullYear() !== now.getFullYear();
    
    const dateStr = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      ...(isDifferentYear ? { year: "numeric" } : {})
    }).format(date);

    return `${capitalizedWeekDay}, ${dateStr} • ${timeStr}`;
  };

  const formatTime = (isoString: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(isoString));
  };


  const formatGroupHeader = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const today = getCGRDateString(new Date());
    const tomorrow = getTomorrowCGRDateString();

    const formattedDate = formatDateBR(dateStr);
    
    if (dateStr === today) return `Hoje — ${formattedDate}`;
    if (dateStr === tomorrow) return `Amanhã — ${formattedDate}`;

    const weekDay = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long"
    }).format(date);
    
    const capitalizedWeekDay = weekDay.charAt(0).toUpperCase() + weekDay.slice(1);
    
    return `${capitalizedWeekDay} — ${formattedDate}`;
  };

  const formatTimeOnly = (isoString: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col font-sans text-slate-200">
      <header className="bg-black/80 backdrop-blur-md border-b border-white/10 text-white p-4 shadow-2xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 group">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full scale-150 group-hover:bg-emerald-500/30 transition-colors" />
              <img 
                src={logoAsset.url} 
                alt="GreenFutebol" 
                className="h-10 w-auto relative z-10 brightness-110 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]" 
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500/50 w-48 text-white placeholder:text-white/30 transition-all focus:bg-white/10 outline-none"
              />
            </div>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden flex-col items-end sm:flex">
                  <span className="text-[10px] font-medium text-white/70 uppercase tracking-widest">{user?.email}</span>
                  <button 
                    onClick={() => navigate({ to: "/meus-bilhetes" })}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 transition-colors"
                  >
                    <Ticket size={10} />
                    Meus Bilhetes
                  </button>
                </div>
                <button 
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex h-9 items-center gap-2 rounded-lg bg-white/5 px-3 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50"
                >
                  {isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={() => navigate({ to: "/login" })}
                className="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 transition-all shadow-[0_0_15px_rgba(5,150,105,0.4)] hover:shadow-[0_0_20px_rgba(5,150,105,0.6)]"
              >
                <LogIn size={16} />
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 bg-white/5 rounded-xl p-1 shadow-2xl border border-white/5 gap-1 backdrop-blur-sm">
            {[
              { label: 'Todos', value: 'ALL' },
              { label: 'Brasileirão', value: 'BSA' },
              { label: 'Premier League', value: 'PL' },
              { label: 'Champions League', value: 'CL' },
              { label: 'Bundesliga', value: 'BL1' },
              { label: 'La Liga', value: 'PD' },
              { label: 'Serie A', value: 'SA' },
              { label: 'Ligue 1', value: 'FL1' },
              { label: 'Eredivisie', value: 'DED' },
              { label: 'Championship', value: 'ELC' },
              { label: 'Primeira Liga', value: 'PPL' },

              
            ].map((comp) => (
              <button
                key={comp.value}
                onClick={() => setCompetitionCode(comp.value as any)}
                disabled={isLoading}
                className={cn(
                  "py-2 px-3 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 border",
                  competitionCode === comp.value
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-[0_0_10px_rgba(5,150,105,0.3)] scale-[1.02]"
                    : "text-slate-400 border-transparent hover:bg-white/5 hover:text-white disabled:opacity-50"
                )}
              >
                {comp.label}
              </button>
            ))}
          </div>

          <div className="flex bg-white/5 rounded-xl p-1 shadow-2xl border border-white/5 backdrop-blur-sm">
            {(['today', 'tomorrow', 'live', 'custom'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                disabled={isLoading && tab !== 'live' && tab !== 'custom'}
                className={cn(
                  "flex-1 py-3 px-4 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2",
                  activeTab === tab 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                )}
              >
                {tab === 'today' && <Calendar className="w-4 h-4" />}
                {tab === 'tomorrow' && <Clock className="w-4 h-4" />}
                {tab === 'live' && <PlayCircle className="w-4 h-4" />}
                {tab === 'custom' && <Calendar className="w-4 h-4" />}
                {tab === 'today' && "Hoje"}
                {tab === 'tomorrow' && "Amanhã"}
                {tab === 'live' && "Ao vivo"}
                {tab === 'custom' && "Escolher data"}
              </button>
            ))}
          </div>

          {activeTab === 'custom' && (
            <div className="flex flex-col items-center gap-2">
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none w-full md:w-auto text-white"
              />
              {customDate && (() => {
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                const yearStr = customDate.split('-')[0];
                const year = yearStr ? parseInt(yearStr) : NaN;
                const parsedDate = new Date(customDate);
                const isValidDate = dateRegex.test(customDate) && 
                                   customDate.length === 10 &&
                                   year >= 2000 && year <= 2100 &&
                                   !isNaN(parsedDate.getTime()) && 
                                   parsedDate.toISOString().slice(0, 10) === customDate;
                
                return !isValidDate && (
                  <span className="text-xs text-red-400 font-medium">Selecione uma data válida.</span>
                );
              })()}
            </div>
          )}
        </div>


        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            <p className="text-slate-400 font-medium">Buscando jogos reais...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h3 className="text-red-800 font-bold text-lg">Ops! Algo deu errado</h3>
            <p className="text-red-600">{error}</p>
            <button 
              onClick={() => setActiveTab(activeTab)}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        ) : groupedFixtures.length === 0 ? (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-20 text-center space-y-4 backdrop-blur-sm">
              <div className="space-y-2">
                <p className="text-slate-600 font-bold text-lg">
                  {reachedLimit 
                    ? "Não encontramos jogos nos próximos 14 dias para este filtro."
                    : activeTab === 'custom' && !customDate 
                      ? "Selecione uma data" 
                      : searchQuery 
                        ? "Nenhum resultado" 
                        : "Não há jogos destas competições nesta data."}
                </p>
                <p className="text-slate-400 font-medium text-sm">
                  {reachedLimit
                    ? "Escolha outra competição ou consulte uma data específica."
                    : activeTab === 'custom' && !customDate 
                      ? "Escolha um dia no calendário para ver os jogos disponíveis." 
                      : searchQuery 
                        ? "Tente ajustar sua busca para encontrar o que procura." 
                        : "Escolha outra data para consultar as próximas partidas."}
                </p>
              </div>
              {(!customDate || reachedLimit) && activeTab !== 'custom' && (
                <button
                  onClick={() => setActiveTab('custom')}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-colors text-sm"
                >
                  <Calendar size={16} />
                  Escolher data
                </button>
              )}
            </div>
            {isPartial && (
              <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 border border-amber-100 p-3 rounded-lg text-sm font-medium">
                <AlertCircle size={16} />
                <span>Algumas competições não puderam ser atualizadas.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {isShowingNextAvailable && displayedDate && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-3 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                <Info size={20} className="shrink-0" />
                <div className="space-y-0.5">
                  <p className="font-bold text-sm">Não há jogos na data selecionada. Exibindo os próximos jogos disponíveis.</p>
                  <p className="text-emerald-300 font-medium text-xs">Próximos jogos: {formatDateBR(displayedDate)}</p>
                </div>
              </div>
            )}
            {isPartial && (
              <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 border border-amber-100 p-3 rounded-lg text-sm font-medium">
                <AlertCircle size={16} />
                <span>Algumas competições não puderam ser atualizadas.</span>
              </div>
            )}
            {groupedFixtures.map((dateGroup) => (
              <div key={dateGroup.date} className="space-y-6">
                <div className="sticky top-[160px] z-10 py-2 bg-[#0a0a0a]/80 backdrop-blur-sm">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Calendar size={18} className="text-emerald-500" />
                    {formatGroupHeader(dateGroup.date)}
                  </h3>
                </div>

                <div className="space-y-6 pl-4 border-l-2 border-white/5 ml-2">
                  {dateGroup.leagues.map((league) => (
                    <div key={`${dateGroup.date}-${league.country}-${league.name}`} className="space-y-3">
                      <div className="flex items-center gap-3 px-2">
                        {league.logo ? (
                          <img src={league.logo} alt={league.name} className="w-6 h-6 object-contain brightness-125" />
                        ) : (
                          <div className="w-6 h-6 bg-white/10 rounded-md flex items-center justify-center text-[10px]">⚽</div>
                        )}
                        <div>
                          <h2 className="font-bold text-slate-100 leading-none">{league.name}</h2>
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{league.country}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {league.matches.map((match) => (
                          <Link
                            key={match.fixture_id}
                            to="/jogo/$fixtureId"
                            params={{ fixtureId: String(match.fixture_id) }}
                            className="block group"
                          >
                            <div className="bg-white/5 rounded-2xl border border-white/5 shadow-2xl overflow-hidden group-hover:border-emerald-500/50 group-hover:bg-white/[0.08] transition-all duration-300">
                              <div className="p-4 grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                                <div className="flex flex-col items-center md:items-start space-y-1">
                                  <span className="text-sm font-black text-white">{formatDateTime(match.kickoff_at)}</span>
                                  <span className={cn(
                                    "text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider",
                                    LIVE_STATUSES.includes(match.status) ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse" : "bg-white/5 text-slate-400"
                                  )}>
                                    {getStatusDisplay(match.status, match.elapsed)}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between gap-4 md:col-span-2">
                                  <div className="flex-1 flex items-center justify-end gap-3 text-right">
                                    <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{match.home_team_name}</span>
                                    {match.home_team_logo ? (
                                      <img src={match.home_team_logo} alt={match.home_team_name} className="w-8 h-8 object-contain brightness-110" />
                                    ) : (
                                      <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-[10px] text-slate-500">🛡️</div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 px-4 py-1 bg-black/40 border border-white/5 text-white rounded-xl font-black text-xl min-w-[85px] justify-center shadow-2xl group-hover:border-emerald-500/30 transition-all">
                                    <span>{match.home_score ?? 0}</span>
                                    <span className="text-white/20 text-xs">x</span>
                                    <span>{match.away_score ?? 0}</span>
                                  </div>

                                  <div className="flex-1 flex items-center gap-3">
                                    {match.away_team_logo ? (
                                      <img src={match.away_team_logo} alt={match.away_team_name} className="w-8 h-8 object-contain brightness-110" />
                                    ) : (
                                      <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-[10px] text-slate-500">🛡️</div>
                                    )}
                                    <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{match.away_team_name}</span>
                                  </div>
                                </div>
                              </div>

                              {match.venue && (
                                <div className="px-4 py-2 bg-white/[0.02] border-t border-white/5 flex items-center gap-2">
                                  <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">ESTÁDIO</span>
                                  <span className="text-[10px] font-bold text-slate-400">{match.venue}</span>
                                </div>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="py-8 text-center text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] border-t border-white/5 mt-auto bg-black/40">
        &copy; 2026 GREENFUTEBOL. DADOS POR FOOTBALL-DATA.ORG.
      </footer>
    </div>
  );
}
