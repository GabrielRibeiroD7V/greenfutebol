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
  User,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";

import logoAsset from "@/assets/logo.png.asset.json";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { BetSlip } from "@/components/BetSlip";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/")({
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
  component: Dashboard,
});

function Dashboard() {
  const [activeTab, setActiveTab] = useState<"hoje" | "amanha" | "data">("hoje");
  
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
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

      {/* Hero */}
      <section className="relative overflow-hidden pt-12 pb-20 border-b border-emerald-500/5">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0%,transparent_70%)] pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-widest uppercase mb-6 animate-pulse">
              <Zap className="w-3 h-3" /> Status do Sistema: Online
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-none">
              A ELITE DO <br/>
              <span className="text-emerald-500 drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]">FUTEBOL NACIONAL</span>
            </h1>
            <p className="text-zinc-400 text-lg md:text-xl max-w-xl mb-8 leading-relaxed">
              Plataforma premium de análise e bilhetes esportivos com liquidação instantânea via PIX.
            </p>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="container mx-auto px-4 -mt-8 relative z-20">
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/5 p-1 rounded-2xl flex gap-1 shadow-2xl inline-flex">
          <button 
            onClick={() => setActiveTab("hoje")}
            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "hoje" ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}
          >
            Jogos de Hoje
          </button>
          <button 
            onClick={() => setActiveTab("amanha")}
            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "amanha" ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}
          >
            Amanhã
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                Principais Campeonatos
              </h2>
            </div>
            
            {/* Mock Matches */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="group bg-zinc-900/50 border border-white/5 rounded-3xl p-6 hover:border-emerald-500/30 transition-all cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Zap className="w-12 h-12 text-emerald-500" />
                </div>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10">BRASILEIRÃO SÉRIE A</span>
                  <span className="text-xs text-zinc-500 font-mono">HOJE • 21:00</span>
                </div>
                <div className="flex items-center justify-around gap-4 mb-8">
                  <div className="flex flex-col items-center gap-3 flex-1 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:border-emerald-500/20 transition-colors">
                       <ShieldCheck className="w-8 h-8 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <span className="font-bold text-sm md:text-base">PALMEIRAS</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-2xl font-black text-zinc-700">VS</span>
                  </div>
                  <div className="flex flex-col items-center gap-3 flex-1 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:border-emerald-500/20 transition-colors">
                       <ShieldCheck className="w-8 h-8 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <span className="font-bold text-sm md:text-base">CORINTHIANS</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" className="h-12 bg-black/20 border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/10 group/btn">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-zinc-500 group-hover/btn:text-emerald-500 transition-colors uppercase font-bold">CASA</span>
                      <span className="font-black text-emerald-500">1.85</span>
                    </div>
                  </Button>
                  <Button variant="outline" className="h-12 bg-black/20 border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/10 group/btn">
                     <div className="flex flex-col items-center">
                      <span className="text-[10px] text-zinc-500 group-hover/btn:text-emerald-500 transition-colors uppercase font-bold">EMPATE</span>
                      <span className="font-black text-emerald-500">3.40</span>
                    </div>
                  </Button>
                  <Button variant="outline" className="h-12 bg-black/20 border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/10 group/btn">
                     <div className="flex flex-col items-center">
                      <span className="text-[10px] text-zinc-500 group-hover/btn:text-emerald-500 transition-colors uppercase font-bold">FORA</span>
                      <span className="font-black text-emerald-500">4.20</span>
                    </div>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div className="bg-zinc-900 border border-emerald-500/20 rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
              <div className="p-6 border-b border-emerald-500/10 bg-emerald-500/5">
                <h3 className="font-black italic flex items-center gap-2 text-emerald-500 tracking-tighter uppercase">
                  <Zap className="w-4 h-4 fill-emerald-500" />
                  Bilhete de Apostas
                </h3>
              </div>
              <div className="p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-zinc-700" />
                </div>
                <p className="text-zinc-500 text-sm font-medium">Seu bilhete está vazio.</p>
                <p className="text-xs text-zinc-600">Selecione uma cotação para começar seu bilhete premiado.</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-3xl p-6">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Por que a GreenFutebol?
              </h4>
              <ul className="space-y-3">
                <li className="flex gap-3 text-sm text-zinc-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  Pagamento automático via PIX
                </li>
                <li className="flex gap-3 text-sm text-zinc-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  Odds com as melhores taxas
                </li>
                <li className="flex gap-3 text-sm text-zinc-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  Segurança e transparência total
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-white/5 py-12 mt-20">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-6 h-6 bg-emerald-500/20 rounded-md flex items-center justify-center">
              <Trophy className="w-3 h-3 text-emerald-500" />
            </div>
            <span className="text-sm font-black tracking-tighter italic text-emerald-500">GREENFUTEBOL</span>
          </div>
          <p className="text-zinc-600 text-xs max-w-lg mx-auto leading-relaxed">
            &copy; 2026 GreenFutebol. Proibido para menores de 18 anos. Aposte com responsabilidade.
            Plataforma homologada em conformidade com os padrões de segurança PIX.
          </p>
        </div>
      </footer>
    </div>
  );
}
