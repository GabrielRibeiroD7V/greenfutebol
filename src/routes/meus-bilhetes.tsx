import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Ticket, Search, AlertCircle, Loader2, ChevronRight, Filter, Clock, CheckCircle2, XCircle, ArrowLeft, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { getMyTickets } from "@/lib/tickets.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { requireAuthenticatedUser } from "@/lib/auth-guard";

export const Route = createFileRoute("/meus-bilhetes")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const user = await requireAuthenticatedUser();
    if (!user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href }
      });
    }
  },
  component: MeusBilhetesComponent,
});

function MeusBilhetesComponent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("ALL");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
      return;
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      loadTickets();
    }
  }, [isAuthenticated, status]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const { tickets: data } = await getMyTickets({ data: { status } });
      setTickets(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-emerald-500" /></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight">Meus Bilhetes</h1>
            <p className="text-slate-400">Acompanhe o status das suas apostas.</p>
          </div>
          <Button onClick={() => navigate({ to: "/" })} variant="outline" className="border-emerald-500/20">Ver Jogos</Button>
        </header>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {["ALL", "CONFIRMED", "PENDENTE", "GANHO", "PERDIDO"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold uppercase whitespace-nowrap",
                status === s ? "bg-emerald-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="grid gap-4">
          {tickets.length === 0 ? (
            <div className="text-center p-12 bg-white/5 rounded-2xl border border-white/5">
              <Ticket className="mx-auto h-12 w-12 text-slate-600 mb-4" />
              <h3 className="text-lg font-bold text-white">Nenhum bilhete encontrado.</h3>
              <p className="text-slate-400 mb-6">Suas apostas aparecerão aqui.</p>
            </div>
          ) : (
            tickets.map((t) => (
              <div key={t.id} className="bg-white/5 rounded-2xl p-6 border border-white/5 flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                <div>
                  <div className="text-emerald-400 font-black text-lg">{t.code}</div>
                  <div className="text-sm text-slate-400">{new Date(t.created_at).toLocaleString('pt-BR')}</div>
                  <div className="text-sm mt-2"><span className="text-slate-400">Odd:</span> <span className="font-bold text-white">{t.total_odd.toFixed(2)}</span></div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-white">R$ {t.potential_return.toFixed(2)}</div>
                  <div className="px-3 py-1 bg-white/5 rounded-full text-xs font-bold uppercase">{t.status}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
