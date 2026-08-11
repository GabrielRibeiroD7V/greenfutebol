import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PublicSidebar } from "@/components/PublicSidebar";
import { BetSlip } from "@/components/BetSlip";
import { Trophy, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/futebol" as any)({
  component: Futebol,
});

function Futebol() {
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFixtures = async () => {
      setLoading(true);
      try {
        const { data, error: invokeError } = await supabase.functions.invoke("get-football-fixtures", {
          body: { competition_code: 'ALL' }
        });
        if (invokeError) throw invokeError;
        setFixtures(data?.fixtures || []);
      } catch (err) {
        console.error(err);
        setError("Erro ao carregar partidas.");
      } finally {
        setLoading(false);
      }
    };
    fetchFixtures();
  }, []);

  return (
    <div className="flex min-h-screen bg-white">
      <PublicSidebar />
      <main className="flex-1 pl-[88px] md:pl-64 lg:pr-[350px]">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
          <header className="mb-8 flex items-center gap-3">
            <div className="rounded-xl bg-emerald-600 p-2.5 text-white shadow-lg shadow-emerald-200">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Futebol</h1>
              <p className="text-sm font-medium text-slate-500">Principais ligas e competições</p>
            </div>
          </header>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center text-red-600">
              <AlertCircle className="mx-auto mb-2 h-8 w-8" />
              <p>{error}</p>
            </div>
          ) : fixtures.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-20 text-center text-slate-400">
              Nenhuma partida encontrada.
            </div>
          ) : (
            <div className="grid gap-3">
              {fixtures.map((match: any) => (
                <Link 
                  key={match.fixture_id} 
                  to="/jogo/$fixtureId" 
                  params={{ fixtureId: String(match.fixture_id) }}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-emerald-300 hover:shadow-sm"
                >
                  <div className="flex items-center gap-6">
                    <div className="text-center min-w-[50px]">
                      <div className="text-xs font-black text-slate-900">
                        {new Date(match.kickoff_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">
                        {new Date(match.kickoff_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {match.home_team_logo && <img src={match.home_team_logo} className="h-4 w-4 object-contain" alt="" />}
                        <span className="text-sm font-bold text-slate-800">{match.home_team_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {match.away_team_logo && <img src={match.away_team_logo} className="h-4 w-4 object-contain" alt="" />}
                        <span className="text-sm font-bold text-slate-800">{match.away_team_name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="bg-slate-50 border border-slate-100 rounded px-3 py-1 text-center min-w-[50px]">
                        <div className="text-[8px] text-slate-400 font-bold uppercase">1</div>
                        <div className="text-xs font-black text-emerald-600">1.95</div>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded px-3 py-1 text-center min-w-[50px]">
                        <div className="text-[8px] text-slate-400 font-bold uppercase">X</div>
                        <div className="text-xs font-black text-emerald-600">3.40</div>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded px-3 py-1 text-center min-w-[50px]">
                        <div className="text-[8px] text-slate-400 font-bold uppercase">2</div>
                        <div className="text-xs font-black text-emerald-600">3.85</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <div className="fixed right-0 top-0 hidden h-screen w-[350px] border-l border-slate-200 bg-white lg:block">
        <BetSlip />
      </div>
    </div>
  );
}
