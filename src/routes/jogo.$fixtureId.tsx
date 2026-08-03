import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Trophy, MapPin, Clock, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/jogo/$fixtureId")({
  head: () => ({
    meta: [
      { title: "Detalhes da Partida | GreenSport" },
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
  const [fixture, setFixture] = useState<FixtureDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const TIMEZONE = "America/Campo_Grande";

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
  }, [fixtureId]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="mt-4 text-slate-500 font-medium">Carregando detalhes...</p>
      </div>
    );
  }

  if (error || !fixture) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">{error || "Algo deu errado"}</h2>
        <button 
          onClick={handleBack}
          className="mt-4 flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={18} />
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button 
            onClick={handleBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold truncate">Detalhes da Partida</h1>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-6 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 text-white p-6 md:p-8">
            <div className="flex flex-col items-center space-y-2 mb-8">
              <div className="flex items-center gap-2 text-blue-400">
                {fixture.league_logo && (
                  <img src={fixture.league_logo} alt={fixture.league_name} className="w-5 h-5 object-contain" />
                )}
                <span className="text-xs font-bold uppercase tracking-widest">{fixture.league_name} - {fixture.country}</span>
              </div>
              <span className="text-[10px] text-white/50">{fixture.round}</span>
            </div>

            <div className="grid grid-cols-3 items-center gap-4">
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="w-20 h-20 md:w-32 md:h-32 bg-white/5 rounded-full flex items-center justify-center p-4">
                  {fixture.home_team_logo ? (
                    <img src={fixture.home_team_logo} alt={fixture.home_team_name} className="w-full h-full object-contain" />
                  ) : (
                    <Trophy className="w-12 h-12 text-white/20" />
                  )}
                </div>
                <h2 className="text-sm md:text-xl font-black uppercase tracking-tight">{fixture.home_team_name}</h2>
              </div>

              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="flex items-center gap-4 text-4xl md:text-6xl font-black italic">
                  {typeof fixture.home_score === 'number' && typeof fixture.away_score === 'number' ? (
                    <>
                      <span>{fixture.home_score}</span>
                      <span className="text-white/20 text-2xl md:text-4xl">x</span>
                      <span>{fixture.away_score}</span>
                    </>
                  ) : (
                    <>
                      <span>–</span>
                      <span className="text-white/20 text-2xl md:text-4xl">x</span>
                      <span>–</span>
                    </>
                  )}
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest",
                  LIVE_STATUSES.includes(fixture.status) ? "bg-red-500 animate-pulse" : "bg-white/10"
                )}>
                  {getStatusDisplay(fixture.status, fixture.elapsed)}
                </div>
              </div>

              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="w-20 h-20 md:w-32 md:h-32 bg-white/5 rounded-full flex items-center justify-center p-4">
                  {fixture.away_team_logo ? (
                    <img src={fixture.away_team_logo} alt={fixture.away_team_name} className="w-full h-full object-contain" />
                  ) : (
                    <Trophy className="w-12 h-12 text-white/20" />
                  )}
                </div>
                <h2 className="text-sm md:text-xl font-black uppercase tracking-tight">{fixture.away_team_name}</h2>
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Informações da Partida</h3>
              <div className="grid gap-3">
                <div className="flex items-center gap-3 text-slate-600">
                  <Clock size={16} className="text-slate-400" />
                  <span className="text-sm font-medium">{formatTime(fixture.kickoff_at)}</span>
                </div>
                {fixture.venue && (
                  <div className="flex items-center gap-3 text-slate-600">
                    <MapPin size={16} className="text-slate-400" />
                    <span className="text-sm font-medium">{fixture.venue}{fixture.city ? `, ${fixture.city}` : ''}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-slate-600">
                  <Trophy size={16} className="text-slate-400" />
                  <span className="text-sm font-medium">{fixture.status_long}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Placares Parciais</h3>
              <div className="grid gap-2">
                {!["NS", "TBD", "PST", "CANC"].includes(fixture.status) ? (
                  <>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-xs font-bold text-slate-500 uppercase">Intervalo (HT)</span>
                      <span className="font-black text-slate-800">
                        {typeof fixture.halftime_home === 'number' && typeof fixture.halftime_away === 'number' 
                          ? `${fixture.halftime_home} - ${fixture.halftime_away}`
                          : "Não disponível"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-xs font-bold text-slate-500 uppercase">Tempo Regulamentar</span>
                      <span className="font-black text-slate-800">
                        {typeof fixture.fulltime_home === 'number' && typeof fixture.fulltime_away === 'number'
                          ? `${fixture.fulltime_home} - ${fixture.fulltime_away}`
                          : (fixture.status === 'FT' || fixture.status === 'AET' || fixture.status === 'PEN') && typeof fixture.home_score === 'number' && typeof fixture.away_score === 'number'
                            ? `${fixture.home_score} - ${fixture.away_score}`
                            : "Não disponível"}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-lg text-center">
                    <span className="text-xs font-bold text-slate-400 uppercase">Partida ainda não iniciada</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
          <p className="text-blue-700 text-sm font-medium italic">
            Mercados de apostas estarão disponíveis em breve.
          </p>
        </div>
      </main>

      <footer className="py-8 text-center text-slate-300 text-xs border-t border-slate-200 mt-auto">
        &copy; 2026 GreenSport. Dados fornecidos por API-Sports.
      </footer>
    </div>
  );
}