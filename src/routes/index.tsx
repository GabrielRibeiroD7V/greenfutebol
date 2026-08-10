import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { 
  Search, Ticket, Calendar, Clock, PlayCircle, AlertCircle, 
  Loader2, LogIn, LogOut, Info, X, ChevronRight,
  ShieldCheck, RefreshCw, Star, Trophy, Target, Zap
} from "lucide-react";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { BetSlip } from "@/components/BetSlip";
import { PublicSidebar } from "@/components/PublicSidebar";
import { maskPhone } from "@/lib/phone-utils";

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
  const { user, profile, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();
  const { selections } = useBetSlip();
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
  const [reachedLimit, setReachedLimit] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBetSlipOpen, setIsBetSlipOpen] = useState(false);
  
  const requestIdRef = useRef(0);

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
    
    // Configurar o formatador para America/Campo_Grande
    const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      weekday: "short"
    });

    const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      day: "2-digit",
      month: "2-digit"
    });

    const yearFormatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      year: "numeric"
    });

    const timeStr = timeFormatter.format(date);
    let weekDay = dayFormatter.format(date).replace(".", "");
    weekDay = weekDay.charAt(0).toUpperCase() + weekDay.slice(1);
    
    const datePart = dateFormatter.format(date);
    const yearPart = yearFormatter.format(date);
    const currentYear = yearFormatter.format(now);

    const isDifferentYear = yearPart !== currentYear;
    
    if (isDifferentYear) {
      return `${weekDay}, ${datePart}/${yearPart} • ${timeStr}`;
    }
    
    return `${weekDay}, ${datePart} • ${timeStr}`;
  };

  const formatTime = (isoString: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(isoString));
  };


  const formatGroupHeader = (dateStr: string) => {
    // Adicionar T12:00:00 para evitar problemas de timezone ao criar o objeto Date apenas da data
    const date = new Date(dateStr + "T12:00:00");
    const today = getCGRDateString(new Date());
    const tomorrow = getTomorrowCGRDateString();

    const parts = dateStr.split('-');
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
        weekday: "long"
      }).format(date);
      prefix = weekDay.charAt(0).toUpperCase() + weekDay.slice(1);
    }

    return `${prefix} — ${formattedDate}`;
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
    <div className="min-h-screen overflow-x-hidden bg-slate-50 pl-[120px] font-sans text-slate-800 md:pl-64" data-testid="main-container">
      <PublicSidebar />
      <div className="flex min-h-screen flex-col">
      {/* Header Fixo e Denso */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white text-slate-950">
        <div className="max-w-[1920px] mx-auto px-4 flex justify-between items-center h-14 sm:h-16">
          <div className="flex items-center gap-4">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-700">Jogos</span>
          </div>

          <div className="hidden lg:flex items-center gap-8 font-black uppercase tracking-widest text-[11px]">
            <button 
              onClick={() => { navigate({ to: "/" }); setCompetitionCode('ALL'); }} 
              className={cn("pb-5 pt-5 transition-all border-b-2", competitionCode === 'ALL' ? "text-emerald-500 border-emerald-500" : "text-slate-400 border-transparent hover:text-white")}
            >
              Futebol
            </button>
            <button 
              onClick={() => { setActiveTab('live'); navigate({ to: "/" }); }} 
              className={cn("pb-5 pt-5 transition-all border-b-2", activeTab === 'live' ? "text-emerald-500 border-emerald-500" : "text-slate-400 border-transparent hover:text-white")}
            >
              Ao Vivo
            </button>
            <button onClick={() => navigate({ to: "/meus-bilhetes" })} className="text-slate-400 hover:text-white transition-colors">Minhas Apostas</button>
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
                  <span className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">Saldo</span>
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
      <div className="mx-auto flex w-auto max-w-[1920px] flex-1 overflow-hidden">
        {/* Sidebar Esquerda: Ligas e Favoritos */}
        <aside className={cn(
          "hidden"
        )}>
          <div className="p-4 space-y-6">
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Principais Ligas</h4>
              <div className="space-y-1">
                {[
                  { id: 'BSA', name: 'Brasileirão Série A', icon: Trophy },
                  { id: 'PL', name: 'Premier League', icon: Star },
                  { id: 'CL', name: 'Champions League', icon: Zap },
                  { id: 'SA', name: 'Serie A (Itália)', icon: Target },
                  { id: 'PD', name: 'La Liga', icon: Star },
                  { id: 'BL1', name: 'Bundesliga', icon: Trophy },
                ].map((league) => (
                  <button 
                    key={league.id}
                    onClick={() => { setCompetitionCode(league.id as any); if (window.innerWidth < 1024) setIsMenuOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-bold group",
                      competitionCode === league.id ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-slate-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <league.icon size={16} className={cn(competitionCode === league.id ? "text-emerald-500" : "text-slate-500 group-hover:text-emerald-500")} />
                    {league.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Filtros</h4>
              <div className="space-y-1">
                {[
                  { id: 'today', name: 'Hoje', icon: Clock },
                  { id: 'tomorrow', name: 'Amanhã', icon: Calendar },
                  { id: 'live', name: 'Ao Vivo', icon: PlayCircle },
                ].map((tab) => (
                  <button 
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as any); if (window.innerWidth < 1024) setIsMenuOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-bold",
                      activeTab === tab.id ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-slate-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <tab.icon size={16} className={cn(activeTab === tab.id ? "text-emerald-500" : "text-slate-500")} />
                    {tab.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Conteúdo Central: Jogos */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-2 sm:p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Banner e Filtros Mobile */}
            <div className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {['BSA', 'PL', 'CL', 'BL1'].map(id => (
                <button 
                  key={id} 
                  onClick={() => setCompetitionCode(id as any)}
                  className={cn("px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap border transition-all", 
                    competitionCode === id ? "bg-emerald-600 border-emerald-400 text-white" : "bg-white/5 border-white/10 text-slate-400")}
                >
                  {id}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                <p className="text-slate-400 font-medium text-xs uppercase tracking-widest">Buscando cotações reais...</p>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
                <h3 className="text-white font-black uppercase tracking-widest text-sm">Erro de Conexão</h3>
                <p className="text-slate-400 text-xs">{error}</p>
                <button 
                  onClick={() => setActiveTab(activeTab)}
                  className="mt-4 px-6 py-2 bg-red-600/20 text-red-400 border border-red-500/30 rounded-xl text-[10px] font-black uppercase transition-all"
                >
                  Tentar novamente
                </button>
              </div>
            ) : groupedFixtures.length === 0 ? (
              <div className="bg-white/5 border border-white/5 rounded-2xl p-20 text-center space-y-4 backdrop-blur-sm">
                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">
                  {reachedLimit ? "Sem jogos para este filtro" : "Nenhum jogo encontrado"}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {isShowingNextAvailable && displayedDate && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-3 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                    <Info size={16} className="shrink-0" />
                    <p className="font-bold text-[10px] uppercase tracking-widest">Exibindo próximos jogos em {formatDateBR(displayedDate)}</p>
                  </div>
                )}
                
                {groupedFixtures.map((dateGroup) => (
                  <div key={dateGroup.date} className="space-y-4">
                    <div className="flex items-center gap-3 px-2 border-l-2 border-emerald-500/50">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">
                        {formatGroupHeader(dateGroup.date)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {dateGroup.leagues.map((league) => (
                        <div key={`${dateGroup.date}-${league.country}-${league.name}`} className="space-y-2">
                          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
                            {league.logo ? (
                              <img src={league.logo} alt={league.name} className="w-4 h-4 object-contain brightness-125" />
                            ) : (
                              <div className="w-4 h-4 bg-white/10 rounded-sm flex items-center justify-center text-[8px]">⚽</div>
                            )}
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{league.name}</span>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {league.matches.map((match) => (
                              <div key={match.fixture_id} className="relative group">
                                <Link to="/jogo/$fixtureId" params={{ fixtureId: String(match.fixture_id) }}>
                                  <div className="rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-emerald-400 hover:bg-emerald-50/30 sm:p-4">
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="flex flex-col min-w-[60px]">
                                        <span className="text-[11px] font-black text-slate-950">{formatTimeOnly(match.kickoff_at)}</span>
                                        <span className={cn(
                                          "text-[9px] font-black uppercase tracking-tighter",
                                          LIVE_STATUSES.includes(match.status) ? "text-emerald-500 animate-pulse" : "text-slate-600"
                                        )}>
                                          {getStatusDisplay(match.status, match.elapsed)}
                                        </span>
                                      </div>

                                      <div className="flex-1 flex flex-col gap-2">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            {match.home_team_logo && <img src={match.home_team_logo} className="w-4 h-4 object-contain" />}
                                            <span className="truncate text-xs font-bold text-slate-800">{match.home_team_name}</span>
                                          </div>
                                          <span className="text-xs font-black text-slate-950">{match.home_score ?? 0}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            {match.away_team_logo && <img src={match.away_team_logo} className="w-4 h-4 object-contain" />}
                                            <span className="truncate text-xs font-bold text-slate-800">{match.away_team_name}</span>
                                          </div>
                                          <span className="text-xs font-black text-slate-950">{match.away_score ?? 0}</span>
                                        </div>
                                      </div>

                                      <div className="hidden sm:flex items-center gap-2">
                                        {[
                                          { label: 'Casa', value: '1', odd: 1.95 },
                                          { label: 'Empate', value: 'X', odd: 3.40 },
                                          { label: 'Fora', value: '2', odd: 3.85 }
                                        ].map(o => (
                                          <div key={o.value} className="min-w-[60px] rounded-md border border-slate-200 bg-slate-50 p-2 text-center">
                                            <span className="text-[8px] font-black text-slate-500 block uppercase leading-none mb-1">{o.label}</span>
                                            <span className="text-xs font-black text-emerald-400">{o.odd.toFixed(2)}</span>
                                          </div>
                                        ))}
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
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4 xl:block">
          <BetSlip />
        </aside>
      </div>

      {/* Mobile Bet Slip Toggle */}
      {!isBetSlipOpen && selections.length > 0 && (
        <div className="fixed bottom-6 left-0 z-50 w-full px-4 xl:hidden">
          <button 
            onClick={() => setIsBetSlipOpen(true)}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-between px-6"
          >
            <span className="flex items-center gap-2"><Ticket size={20} /> Bilhete</span>
            <span className="bg-black/20 px-3 py-1 rounded-full text-xs">{selections.length}</span>
          </button>
        </div>
      )}

      {/* Mobile Drawer */}
      {isBetSlipOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/35 backdrop-blur-sm">
          <div className="absolute bottom-0 flex max-h-[90vh] w-full flex-col rounded-t-xl border-t border-emerald-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 p-3">
              <span className="text-sm font-black uppercase tracking-widest text-slate-900">Seu Bilhete</span>
              <button onClick={() => setIsBetSlipOpen(false)} className="p-2 text-slate-400"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <BetSlip isMobile />
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-200 bg-white py-4 text-center">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">&copy; 2026 GREENSPORT</span>
      </footer>
      </div>
    </div>
  );
}
