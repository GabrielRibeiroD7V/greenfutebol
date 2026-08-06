import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Trophy,
  Zap,
  ShieldCheck,
  Clock,
  ChevronRight
} from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { BetSlip } from "@/components/BetSlip";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GreenFutebol - Plataforma Premium de Futebol" },
      {
        name: "description",
        content: "Acompanhe jogos de futebol em tempo real na GreenFutebol com tecnologia de ponta.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { selections } = useBetSlip();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFixtures = async () => {
      try {
        const { data } = await supabase.functions.invoke("get-football-fixtures", {
          body: { date: new Date().toISOString().split('T')[0] }
        });
        if (data?.fixtures) setFixtures(data.fixtures);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFixtures();
  }, []);

  const formatTime = (isoString: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Campo_Grande",
      hour: "2-digit", minute: "2-digit"
    }).format(new Date(isoString));
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-emerald-500/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)]">
              <Trophy className="w-5 h-5 text-black" />
            </div>
            <span className="text-xl font-black tracking-tighter italic text-emerald-500">GREENFUTEBOL</span>
          </Link>
          
          <div className="flex items-center gap-4">
             <Link to="/meus-bilhetes">
               <Button variant="ghost" className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10">
                 Meus Bilhetes
               </Button>
             </Link>
             <Link to="/perfil">
               <Button size="icon" variant="ghost" className="rounded-full border border-emerald-500/20">
                 <ShieldCheck className="w-5 h-5 text-emerald-500" />
               </Button>
             </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Próximas Partidas
            </h2>
            
            {isLoading ? (
              <div className="flex justify-center py-20"><Zap className="animate-spin text-emerald-500" /></div>
            ) : fixtures.length === 0 ? (
              <div className="text-center py-20 text-zinc-600 font-bold uppercase tracking-widest">Nenhuma partida encontrada</div>
            ) : (
              fixtures.map((f) => (
                <div key={f.fixture_id} className="group bg-zinc-900/50 border border-white/5 rounded-3xl p-6 hover:border-emerald-500/30 transition-all relative overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10">{f.league_name}</span>
                    <span className="text-xs text-zinc-500 font-mono flex items-center gap-2">
                      <Clock size={12} /> {formatTime(f.kickoff_at)}
                    </span>
                  </div>
                  
                  <div 
                    onClick={() => navigate({ to: `/jogo/${f.fixture_id}` })}
                    className="flex items-center justify-around gap-4 mb-8 cursor-pointer"
                  >
                    <div className="flex flex-col items-center gap-3 flex-1 text-center">
                      <img src={f.home_team_logo} className="w-12 h-12 object-contain" alt="" />
                      <span className="font-bold text-sm">{f.home_team_name}</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-2xl font-black text-zinc-700 italic">VS</span>
                    </div>
                    <div className="flex flex-col items-center gap-3 flex-1 text-center">
                      <img src={f.away_team_logo} className="w-12 h-12 object-contain" alt="" />
                      <span className="font-bold text-sm">{f.away_team_name}</span>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <Button 
                      onClick={() => navigate({ to: `/jogo/${f.fixture_id}` })}
                      variant="outline" 
                      className="border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-black font-black uppercase tracking-widest text-xs h-10 px-8 rounded-xl"
                    >
                      Ver todos os mercados <ChevronRight size={14} className="ml-2" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <aside className="space-y-6">
            <div className="sticky top-24">
              <BetSlip />
            </div>
          </aside>
        </div>
      </main>
      
      <footer className="border-t border-white/5 py-12 mt-20">
        <div className="container mx-auto px-4 text-center">
          <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">
            &copy; 2026 GreenFutebol • 18+ Aposte com responsabilidade
          </p>
        </div>
      </footer>
    </div>
  );
}
