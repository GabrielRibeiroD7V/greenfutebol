import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Search, Ticket, Calendar, Clock, PlayCircle, AlertCircle, Loader2, LogIn, LogOut, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GreenSport - Futebol Real" },
      { name: "description", content: "Acompanhe jogos de futebol em tempo real na GreenSport." },
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
  const [activeTab, setActiveTab] = useState<'today' | 'tomorrow' | 'live'>('today');
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  useEffect(() => {
    const fetchFixtures = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        let dateToFetch: string;
        if (activeTab === 'tomorrow') {
          dateToFetch = getTomorrowCGRDateString();
        } else {
          dateToFetch = getCGRDateString(new Date());
        }

        const { data, error: invokeError } = await supabase.functions.invoke("get-football-fixtures", {
          body: { date: dateToFetch }
        });

        if (invokeError) throw invokeError;
        
        let results: Fixture[] = Array.isArray(data?.fixtures)
          ? data.fixtures
          : [];

        if (activeTab === 'live') {
          results = results.filter(f => LIVE_STATUSES.includes(f.status));
        }

        results.sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
        setFixtures(results);
      } catch (err: any) {
        console.error("Erro ao buscar jogos:", err);
        setError("Não foi possível carregar os jogos. Tente novamente mais tarde.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFixtures();
  }, [activeTab]);

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

    const groups: Record<string, { name: string; country: string; logo: string | null; matches: Fixture[] }> = {};
    
    filtered.forEach(f => {
      const key = `${f.country}-${f.league_name}`;
      if (!groups[key]) {
        groups[key] = {
          name: f.league_name,
          country: f.country,
          logo: f.league_logo,
          matches: []
        };
      }
      groups[key].matches.push(f);
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [fixtures, searchQuery]);

  const formatTime = (isoString: string) => {
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Trophy className="text-blue-400 h-8 w-8" />
            <h1 className="text-xl font-bold tracking-tight text-white">GreenSport</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 w-48 text-white"
              />
            </div>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden flex-col items-end sm:flex">
                  <span className="text-[10px] font-medium text-white/70 uppercase tracking-widest">{user?.email}</span>
                  <button 
                    onClick={() => navigate({ to: "/meus-bilhetes" })}
                    className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
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
                className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <LogIn size={16} />
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6 space-y-6">
        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
          {(['today', 'tomorrow', 'live'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              disabled={isLoading}
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
              {tab === 'today' && "Hoje"}
              {tab === 'tomorrow' && "Amanhã"}
              {tab === 'live' && "Ao vivo"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-slate-500 font-medium">Buscando jogos reais...</p>
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
          <div className="bg-white border border-slate-200 rounded-xl p-20 text-center space-y-2">
            <p className="text-slate-400 font-medium italic">
              {searchQuery ? "Nenhum jogo encontrado para esta busca." : "Nenhum jogo encontrado para este filtro."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedFixtures.map((league) => (
              <div key={`${league.country}-${league.name}`} className="space-y-3">
                <div className="flex items-center gap-3 px-2">
                  {league.logo ? (
                    <img src={league.logo} alt={league.name} className="w-6 h-6 object-contain" />
                  ) : (
                    <div className="w-6 h-6 bg-slate-200 rounded-md flex items-center justify-center text-[10px]">⚽</div>
                  )}
                  <div>
                    <h2 className="font-bold text-slate-800 leading-none">{league.name}</h2>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{league.country}</span>
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
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group-hover:border-blue-300 transition-colors">
                      <div className="p-4 grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                        <div className="flex flex-col items-center md:items-start space-y-1">
                          <span className="text-sm font-bold text-slate-800">{formatTime(match.kickoff_at)}</span>
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                            LIVE_STATUSES.includes(match.status) ? "bg-red-100 text-red-600 animate-pulse" : "bg-slate-100 text-slate-500"
                          )}>
                            {getStatusDisplay(match.status, match.elapsed)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-4 md:col-span-2">
                          <div className="flex-1 flex items-center justify-end gap-3 text-right">
                            <span className="text-sm font-bold text-slate-800">{match.home_team_name}</span>
                            {match.home_team_logo ? (
                              <img src={match.home_team_logo} alt={match.home_team_name} className="w-8 h-8 object-contain" />
                            ) : (
                              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-[10px] text-slate-400">🛡️</div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-lg font-black text-lg min-w-[70px] justify-center shadow-inner">
                            <span>{match.home_score ?? 0}</span>
                            <span className="text-slate-500 text-xs">x</span>
                            <span>{match.away_score ?? 0}</span>
                          </div>

                          <div className="flex-1 flex items-center gap-3">
                            {match.away_team_logo ? (
                              <img src={match.away_team_logo} alt={match.away_team_name} className="w-8 h-8 object-contain" />
                            ) : (
                              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-[10px] text-slate-400">🛡️</div>
                            )}
                            <span className="text-sm font-bold text-slate-800">{match.away_team_name}</span>
                          </div>
                        </div>
                      </div>
                      
                      {match.venue && (
                        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">Estádio:</span>
                          <span className="text-[10px] font-bold text-slate-500">{match.venue}</span>
                        </div>
                      )}
                    </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="py-8 text-center text-slate-300 text-xs border-t border-slate-200 mt-auto">
        &copy; 2026 GreenSport. Dados fornecidos por API-Sports.
      </footer>
    </div>
  );
}
