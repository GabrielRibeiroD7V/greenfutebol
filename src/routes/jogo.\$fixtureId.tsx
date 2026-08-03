import { createFileRoute, useNavigate, useParams, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Trophy, 
  ChevronLeft, 
  Calendar, 
  MapPin, 
  Clock, 
  AlertCircle, 
  Loader2 
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/jogo/$fixtureId")({
  component: JogoDetalhes,
});

interface FixtureDetail {
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

function JogoDetalhes() {
  const { fixtureId } = useParams({ from: "/jogo/$fixtureId" });
  const navigate = useNavigate();
  const router = useRouter();
  const [fixture, setFixture] = useState<FixtureDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fixtureIdNum = Number(fixtureId);
  const isValidId = Number.isInteger(fixtureIdNum) && fixtureIdNum > 0;

  const TIMEZONE = "America/Campo_Grande";

  useEffect(() => {
    const fetchFixture = async () => {
      if (!isValidId) {
        setError("Identificador da partida inválido.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: invokeError } = await supabase.functions.invoke("get-football-fixture", {
          body: { fixture_id: fixtureIdNum }
        });

        if (invokeError) {
          if (invokeError.status === 404) {
            setError("Partida não encontrada.");
          } else {
            setError("Erro ao carregar detalhes da partida.");
          }
          return;
        }

        if (!data?.fixture) {
          setError("Resposta inválida do servidor.");
          return;
        }

        setFixture(data.fixture);
      } catch (err) {
        console.error("Erro ao buscar detalhes:", err);
        setError("Não foi possível conectar ao servidor.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFixture();
  }, [fixtureIdNum, isValidId]);

  const handleBack = () => {
    if (router.history.canGoBack()) {
      router.history.back();
    } else {
      navigate({ to: "/" });
    }
  };

  const formatTime = (isoString: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(isoString));
  };

  const getStatusDisplay = (status: string, elapsed: number | null) => {
    const translated = STATUS_MAP[status] || status;
    if (LIVE_STATUSES.includes(status) && elapsed !== null && status !== "HT") {
      return `${translated} ${elapsed}'`;
    }
    return translated;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
          <p className="text-slate-500 font-medium">Carregando detalhes do jogo...</p>
        </div>
      </div>
    );
  }

  if (error || !fixture) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h3 className="text-slate-800 font-bold text-lg">Ops!</h3>
          <p className="text-slate-600">{error || "Algo deu errado."}</p>
          <button 
            onClick={handleBack}
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <button 
            onClick={handleBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="text-blue-400 h-6 w-6" />
            <h1 className="text-lg font-bold tracking-tight">GreenSport</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8 space-y-6">
        {/* League Info */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {fixture.league_logo ? (
              <img src={fixture.league_logo} alt={fixture.league_name} className="w-10 h-10 object-contain" />
            ) : (
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400 font-bold">⚽</div>
            )}
            <div>
              <h2 className="font-bold text-slate-800">{fixture.league_name}</h2>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                <span>{fixture.country}</span>
                {fixture.round && (
                  <>
                    <span className="w-1 h-1 bg-slate-200 rounded-full" />
                    <span>{fixture.round}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-slate-400 uppercase">Temporada</span>
            <p className="text-sm font-black text-slate-800">{fixture.season}</p>
          </div>
        </div>

        {/* Match Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
          <div className="p-6 md:p-10">
            <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-8">
              {/* Home Team */}
              <div className="flex flex-col items-center gap-4 text-center order-2 md:order-1">
                <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-50 rounded-full flex items-center justify-center p-4 border border-slate-100">
                  {fixture.home_team_logo ? (
                    <img src={fixture.home_team_logo} alt={fixture.home_team_name} className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-4xl">🛡️</div>
                  )}
                </div>
                <h3 className="text-lg md:text-xl font-black text-slate-800 leading-tight">
                  {fixture.home_team_name}
                </h3>
              </div>

              {/* Score / Status */}
              <div className="flex flex-col items-center justify-center gap-4 order-1 md:order-2">
                <div className={cn(
                  "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                  LIVE_STATUSES.includes(fixture.status) ? "bg-red-100 text-red-600 animate-pulse" : "bg-slate-100 text-slate-500"
                )}>
                  {getStatusDisplay(fixture.status, fixture.elapsed)}
                </div>
                
                <div className="flex items-center gap-4 text-5xl md:text-7xl font-black text-slate-900 tabular-nums">
                  <span>{fixture.home_score ?? 0}</span>
                  <span className="text-slate-200 text-3xl md:text-4xl">:</span>
                  <span>{fixture.away_score ?? 0}</span>
                </div>

                {fixture.status === "FT" && (
                  <span className="text-xs font-bold text-slate-400 uppercase">Fim de Jogo</span>
                )}
              </div>

              {/* Away Team */}
              <div className="flex flex-col items-center gap-4 text-center order-3">
                <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-50 rounded-full flex items-center justify-center p-4 border border-slate-100">
                  {fixture.away_team_logo ? (
                    <img src={fixture.away_team_logo} alt={fixture.away_team_name} className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-4xl">🛡️</div>
                  )}
                </div>
                <h3 className="text-lg md:text-xl font-black text-slate-800 leading-tight">
                  {fixture.away_team_name}
                </h3>
              </div>
            </div>
          </div>

          {/* Detailed Scores */}
          {(fixture.halftime_home !== null || fixture.fulltime_home !== null) && (
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4">
              <div className="max-w-xs mx-auto space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Placares Parciais</span>
                  <span>{fixture.home_team_name[0]} x {fixture.away_team_name[0]}</span>
                </div>
                {fixture.halftime_home !== null && (
                  <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-xs font-medium text-slate-500">1º Tempo</span>
                    <span className="text-sm font-black text-slate-800">{fixture.halftime_home} - {fixture.halftime_away}</span>
                  </div>
                )}
                {fixture.fulltime_home !== null && (
                  <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-xs font-medium text-slate-500">Tempo Normal</span>
                    <span className="text-sm font-black text-slate-800">{fixture.fulltime_home} - {fixture.fulltime_away}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Venue / Time Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-blue-600">
              <Clock size={18} />
              <h4 className="font-bold text-sm uppercase tracking-wider">Horário da Partida</h4>
            </div>
            <div className="space-y-1">
              <p className="text-xl font-black text-slate-800">{formatTime(fixture.kickoff_at)}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Fuso Horário: {TIMEZONE}</p>
            </div>
          </div>

          {(fixture.venue || fixture.city) && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <MapPin size={18} />
                <h4 className="font-bold text-sm uppercase tracking-wider">Local do Jogo</h4>
              </div>
              <div className="space-y-1">
                <p className="text-xl font-black text-slate-800">{fixture.venue || "Não informado"}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{fixture.city || "Localização desconhecida"}</p>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="py-8 text-center text-slate-300 text-xs border-t border-slate-200 mt-auto">
        &copy; 2026 GreenSport. Dados fornecidos por API-Sports.
      </footer>
    </div>
  );
}
