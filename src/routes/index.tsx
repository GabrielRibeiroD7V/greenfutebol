import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { Search, Ticket, Calendar, Clock, PlayCircle, AlertCircle, Loader2, LogIn, LogOut, Info, Menu, X, ChevronRight, ShieldCheck } from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { BetSlip } from "@/components/BetSlip";
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
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col font-sans text-slate-200 overflow-x-hidden w-full max-w-[100vw]" data-testid="main-container">
      <header className="bg-black/80 backdrop-blur-md border-b border-emerald-500/10 text-white shadow-2xl sticky top-0 z-30 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex justify-between items-center">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => navigate({ to: "/" })}>
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full scale-150 group-hover:bg-emerald-500/20 transition-colors" />
              <img 
                src={logoAsset.url} 
                alt="GreenFutebol" 
                className="h-8 sm:h-12 w-auto relative z-10 brightness-110 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]" 
              />
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <div className="relative">
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
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-medium text-white/50 uppercase tracking-widest">
                    {profile?.name || user?.phone || user?.email}
                  </span>
                  <div className="flex items-center gap-3">
                    {profile?.role === 'admin' && (
                      <button 
                        onClick={() => navigate({ to: "/admin/bilhetes" })}
                        className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 transition-colors font-bold"
                      >
                        <ShieldCheck size={12} />
                        Admin
                      </button>
                    )}
                    <button 
                      onClick={() => navigate({ to: "/meus-bilhetes" })}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 transition-colors font-bold"
                    >
                      <Ticket size={12} />
                      Bilhetes
                    </button>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex h-10 items-center gap-2 rounded-xl bg-white/5 px-4 text-sm font-bold text-white hover:bg-white/10 transition-all disabled:opacity-50 border border-white/5"
                >
                  <LogOut size={16} className="text-emerald-500" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate({ to: "/login" })}
                  className="h-10 px-6 rounded-xl text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                >
                  Entrar
                </button>
                <button 
                  onClick={() => navigate({ to: "/cadastro" })}
                  className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                >
                  Criar Conta
                </button>
              </div>
            )}
                  {isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                  <span>Sair</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={() => navigate({ to: "/login" })}
                className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white hover:bg-emerald-500 transition-all shadow-[0_0_20px_rgba(5,150,105,0.3)] hover:shadow-[0_0_30px_rgba(5,150,105,0.5)] active:scale-95"
              >
                <LogIn size={18} />
                <span>Entrar</span>
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-emerald-500 hover:bg-white/5 rounded-lg transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Menu Panel */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-black/95 backdrop-blur-xl border-t border-emerald-500/10 shadow-2xl animate-in slide-in-from-top duration-300 z-50 overflow-y-auto max-h-[calc(100vh-64px)]">
            <div className="p-4 space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Buscar times ou ligas..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-base w-full text-white placeholder:text-white/30 focus:ring-2 focus:ring-emerald-500/50 outline-none"
                />
              </div>

              <nav className="grid grid-cols-1 gap-2">
                {[
                  { label: 'Início', icon: PlayCircle, onClick: () => { navigate({ to: "/" }); setIsMenuOpen(false); } },
                  { label: 'Hoje', icon: Clock, onClick: () => { setActiveTab('today'); setIsMenuOpen(false); } },
                  { label: 'Amanhã', icon: Calendar, onClick: () => { setActiveTab('tomorrow'); setIsMenuOpen(false); } },
                  { label: 'Ao vivo', icon: Info, onClick: () => { setActiveTab('live'); setIsMenuOpen(false); } },
                  { label: 'Escolher data', icon: Calendar, onClick: () => { setActiveTab('custom'); setIsMenuOpen(false); } },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 text-slate-200 hover:bg-emerald-500/10 hover:text-emerald-400 transition-all font-bold text-lg active:scale-[0.98]"
                  >
                    <item.icon size={22} />
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="pt-4 border-t border-white/5">
                {isAuthenticated ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold">
                        {(profile?.name || user?.phone || user?.email || "U").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-white truncate">
                          {profile?.name || (user?.phone ? maskPhone(user.phone) : user?.email)}
                        </span>
                        <div className="flex items-center gap-3">
                          {profile?.role === 'admin' && (
                            <button 
                              onClick={() => { navigate({ to: "/admin/bilhetes" }); setIsMenuOpen(false); }}
                              className="text-xs text-amber-400 font-bold flex items-center gap-1"
                            >
                              <ShieldCheck size={12} />
                              Admin
                            </button>
                          )}
                          <button 
                            onClick={() => { navigate({ to: "/meus-bilhetes" }); setIsMenuOpen(false); }}
                            className="text-xs text-emerald-400 font-bold flex items-center gap-1"
                          >
                            <Ticket size={12} />
                            Meus Bilhetes
                          </button>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                      className="w-full py-4 rounded-2xl bg-white/5 text-red-400 font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <LogOut size={20} />
                      Sair da Conta
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => { navigate({ to: "/login" }); setIsMenuOpen(false); }}
                    className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black text-lg shadow-[0_0_20px_rgba(5,150,105,0.3)] active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <LogIn size={22} />
                    ENTRAR AGORA
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-2 sm:p-4 md:p-6 lg:grid lg:grid-cols-[1fr_350px] lg:gap-8 items-start overflow-x-hidden">
        <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex sm:grid sm:grid-cols-3 md:grid-cols-6 bg-white/5 rounded-2xl p-1 shadow-2xl border border-white/5 gap-1 backdrop-blur-sm mx-1 sm:mx-0 overflow-x-auto sm:overflow-x-visible no-scrollbar scroll-smooth touch-pan-x px-2 sm:px-1">
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
                  "px-4 sm:px-3 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all duration-300 active:scale-95 flex items-center justify-center text-center border whitespace-nowrap flex-shrink-0 sm:flex-shrink",
                  competitionCode === comp.value 
                    ? "bg-emerald-600 text-white border-emerald-400/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]" 
                    : "text-slate-400 border-transparent hover:text-white hover:bg-white/5 disabled:opacity-50"
                )}
              >
                {comp.label}
              </button>
            ))}
          </div>

          <div className="flex bg-white/5 rounded-2xl p-1 shadow-2xl border border-white/5 backdrop-blur-sm mx-1 sm:mx-0">
            {(['today', 'tomorrow', 'live', 'custom'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                disabled={isLoading && tab !== 'live' && tab !== 'custom'}
                className={cn(
                  "flex-1 py-3 sm:py-3.5 px-2 sm:px-4 text-[11px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 border",
                  activeTab === tab 
                    ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                    : "text-slate-500 hover:bg-white/5 disabled:opacity-50 border-transparent"
                )}
              >
                {tab === 'today' && <Clock size={14} className="sm:w-4 sm:h-4" />}
                {tab === 'tomorrow' && <Calendar size={14} className="sm:w-4 sm:h-4" />}
                {tab === 'live' && <PlayCircle size={14} className="sm:w-4 sm:h-4" />}
                {tab === 'custom' && <Search size={14} className="sm:w-4 sm:h-4" />}
                <span className={cn(activeTab === tab ? "block" : "hidden sm:block")}>
                  {tab === 'today' && "Hoje"}
                  {tab === 'tomorrow' && "Amanhã"}
                  {tab === 'live' && "Ao vivo"}
                  {tab === 'custom' && "Data"}
                </span>
                {activeTab !== tab && <span className="sm:hidden text-[9px]">
                  {tab === 'today' && "HJ"}
                  {tab === 'tomorrow' && "AM"}
                  {tab === 'live' && "LIVE"}
                  {tab === 'custom' && "DATA"}
                </span>}
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
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {isShowingNextAvailable && displayedDate && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 sm:p-4 rounded-xl flex items-center gap-3 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.05)] mx-2 sm:mx-0">
                <Info size={18} className="shrink-0 sm:w-5 sm:h-5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-[12px] sm:text-sm leading-tight">Não há jogos na data selecionada. Exibindo os próximos jogos disponíveis.</p>
                  <p className="text-emerald-300 font-medium text-[10px] sm:text-xs">Próximos jogos: {formatDateBR(displayedDate)}</p>
                </div>
              </div>
            )}
            {groupedFixtures.map((dateGroup) => (
              <div key={dateGroup.date} className="space-y-6">
                <div className="sticky top-16 sm:top-20 z-10 py-3 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-emerald-500/5 px-2 sm:px-0">
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2 px-2">
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
                          <div key={match.fixture_id} className="relative group">
                            <Link
                              to="/jogo/$fixtureId"
                              params={{ fixtureId: String(match.fixture_id) }}
                              className="block"
                            >
                              <div className="bg-white/5 rounded-2xl border border-white/5 shadow-2xl overflow-hidden group-hover:border-emerald-500/50 group-hover:bg-white/[0.08] transition-all duration-300">
                                <div className="p-4 flex flex-col gap-6 md:grid md:grid-cols-[1fr_2fr_120px] md:items-center md:gap-4">
                                  {/* Cabeçalho do Card */}
                                  <div className="flex flex-col items-center md:items-start space-y-1">
                                    <span className="text-[12px] sm:text-sm font-black text-white">{formatDateTime(match.kickoff_at)}</span>
                                    <span className={cn(
                                      "text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider",
                                      LIVE_STATUSES.includes(match.status) ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse" : "bg-white/5 text-slate-400"
                                    )}>
                                      {getStatusDisplay(match.status, match.elapsed)}
                                    </span>
                                  </div>

                                  {/* Área da Partida */}
                                  <div className="grid grid-cols-[1fr_auto_1fr] items-start sm:items-center gap-3 sm:gap-4 px-2 sm:px-0">
                                    <div className="flex flex-col items-center sm:flex-row sm:justify-end gap-2 sm:gap-3 text-center sm:text-right min-w-0">
                                      <div className="shrink-0 order-first sm:order-last">
                                        {match.home_team_logo ? (
                                          <img src={match.home_team_logo} alt={match.home_team_name} className="w-10 h-10 sm:w-8 sm:h-8 object-contain brightness-110" />
                                        ) : (
                                          <div className="w-10 h-10 sm:w-8 sm:h-8 bg-white/5 rounded-full flex items-center justify-center text-[10px] text-slate-500">🛡️</div>
                                        )}
                                      </div>
                                      <span className="text-[13px] sm:text-sm font-bold text-white group-hover:text-emerald-400 transition-colors leading-tight sm:leading-normal max-w-full overflow-hidden break-words line-clamp-2 px-1">
                                        {match.home_team_name}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-1 bg-black/40 border border-white/5 text-white rounded-xl font-black text-lg sm:text-xl min-w-[70px] sm:min-w-[85px] justify-center shadow-2xl group-hover:border-emerald-500/30 transition-all self-center">
                                      <span>{match.home_score ?? 0}</span>
                                      <span className="text-white/20 text-xs">x</span>
                                      <span>{match.away_score ?? 0}</span>
                                    </div>

                                    <div className="flex flex-col items-center sm:flex-row gap-2 sm:gap-3 text-center sm:text-left min-w-0">
                                      <div className="shrink-0">
                                        {match.away_team_logo ? (
                                          <img src={match.away_team_logo} alt={match.away_team_name} className="w-10 h-10 sm:w-8 sm:h-8 object-contain brightness-110" />
                                        ) : (
                                          <div className="w-10 h-10 sm:w-8 sm:h-8 bg-white/5 rounded-full flex items-center justify-center text-[10px] text-slate-500">🛡️</div>
                                        )}
                                      </div>
                                      <span className="text-[13px] sm:text-sm font-bold text-white group-hover:text-emerald-400 transition-colors leading-tight sm:leading-normal max-w-full overflow-hidden break-words line-clamp-2 px-1">
                                        {match.away_team_name}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Link p/ Detalhes */}
                                  <div className="hidden md:flex justify-end pr-4">
                                    <div className="p-2 bg-white/5 rounded-full text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                      <ChevronRight size={20} />
                                    </div>
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

        {/* Desktop Sidebar Bet Slip */}
        <aside className="hidden lg:block sticky top-28 space-y-6">
          <BetSlip />
        </aside>
      </main>

      {/* Mobile Bet Slip Floating Button */}
      {!isBetSlipOpen && selections && selections.length > 0 && (
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
            <div className="flex items-center justify-between p-4 border-b border-white/5 relative">
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

      <footer className="py-10 px-4 text-center text-slate-600 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] border-t border-white/5 mt-auto bg-black/40 w-full overflow-hidden">
        <div className="max-w-5xl mx-auto flex flex-col gap-2">
          <span>&copy; 2026 GREENFUTEBOL.</span>
          <span className="opacity-50">DADOS POR FOOTBALL-DATA.ORG.</span>
        </div>
      </footer>
    </div>
  );
}
