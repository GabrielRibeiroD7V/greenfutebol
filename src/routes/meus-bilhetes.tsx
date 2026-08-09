import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Ticket, Search, AlertCircle, Loader2, ChevronRight, Filter, Clock, CheckCircle2, XCircle, ArrowLeft, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { getMyTickets } from "@/lib/tickets.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { requireAuthenticatedUser } from "@/lib/auth-guard";
import { supabase } from "@/integrations/supabase/client";


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
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

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
      const data = await getMyTickets();
      
      // Fetch details for each ticket to show selections
      const ticketsWithDetails = await Promise.all(
        (data || []).map(async (ticket: any) => {
          try {
            const { data: details, error } = await supabase
              .from('tickets')
              .select('*, ticket_selections(*)')
              .eq('id', ticket.id)
              .single();
            return details || ticket;
          } catch (e) {
            return ticket;
          }
        })
      );

      setTickets(ticketsWithDetails);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getSelectionStatusColor = (status: string) => {
    switch (status) {
      case 'WON': return 'text-emerald-500';
      case 'LOST': return 'text-red-500';
      case 'VOID':
      case 'PUSH': return 'text-slate-400';
      case 'CANCELLED': return 'text-slate-500';
      default: return 'text-amber-500';
    }
  };

  if (authLoading || loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-emerald-500" /></div>;

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 font-sans">
      <header className="bg-black border-b border-emerald-500/10 text-white shadow-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-14 sm:h-16 gap-4">
          <button 
            onClick={() => navigate({ to: "/" })}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-emerald-500"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-sm sm:text-lg font-black uppercase tracking-tight leading-tight">Meus Bilhetes</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
          {["ALL", "PENDING_PAYMENT", "WAITING_PAYMENT", "PAID", "CANCELLED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                status === s ? "bg-emerald-600 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-white/5 border-white/5 text-slate-500 hover:bg-white/10"
              )}
            >
              {s === 'ALL' ? 'Todos' : s === 'PENDING_PAYMENT' ? 'Iniciados' : s === 'WAITING_PAYMENT' ? 'Aguardando PIX' : s === 'PAID' ? 'Pagos' : 'Cancelados'}
            </button>
          ))}
        </div>

        <div className="grid gap-4">
          {tickets.length === 0 ? (
            <div className="text-center p-12 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm">
              <Ticket className="mx-auto h-12 w-12 text-slate-700 mb-4" />
              <h3 className="text-lg font-bold text-white">Nenhum bilhete encontrado.</h3>
              <p className="text-slate-500 mb-6">Suas apostas aparecerão aqui quando você confirmar um bilhete.</p>
              <Button onClick={() => navigate({ to: "/" })} className="bg-emerald-600 hover:bg-emerald-500">Começar a Apostar</Button>
            </div>
          ) : (
            tickets.map((t) => (
              <div 
                key={t.id} 
                className={cn(
                  "bg-white/5 rounded-2xl border border-white/5 overflow-hidden transition-all duration-300",
                  expandedTicketId === t.id ? "ring-1 ring-emerald-500/30" : "hover:border-white/10"
                )}
              >
                <div 
                  className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                  onClick={() => setExpandedTicketId(expandedTicketId === t.id ? null : t.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
                      <Ticket size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-black text-lg tracking-widest">{t.code}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                          t.status === 'WON' ? "bg-emerald-500/10 text-emerald-500" : 
                          t.status === 'LOST' ? "bg-red-500/10 text-red-500" :
                          t.status === 'VOID' ? "bg-slate-500/10 text-slate-500" :
                          "bg-amber-500/10 text-amber-500"
                        )}>
                        {t.status === 'PAID' ? 'Pago' : 
                           t.status === 'WAITING_PAYMENT' ? 'Aguardando PIX' :
                           t.status === 'PENDING_PAYMENT' ? 'Iniciado' :
                           t.status === 'WON' ? 'Ganho' :
                           t.status === 'LOST' ? 'Perdido' :
                           t.status === 'VOID' ? 'Anulado' :
                           t.status === 'PUSH' ? 'Devolvido (Push)' :
                           t.status === 'CANCELLED' ? 'Cancelado' : t.status}

                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-2">
                        <Clock size={12} />
                        {new Date(t.created_at).toLocaleString('pt-BR')}
                        <span className="mx-1">•</span>
                        {(t.selections?.length || t.ticket_selections?.length || 0)} {(t.selections?.length || t.ticket_selections?.length || 0) === 1 ? 'Seleção' : 'Seleções'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:text-right gap-6 pt-4 sm:pt-0 border-t sm:border-t-0 border-white/5">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Valor Apostado</span>
                      <span className="text-lg font-black text-white">R$ {t.stake.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-emerald-500/50 font-black uppercase tracking-widest">Retorno Possível</span>
                      <span className="text-lg font-black text-emerald-400">R$ {t.potential_return.toFixed(2)}</span>
                    </div>
                    <ChevronRight 
                      className={cn("text-slate-600 transition-transform duration-300 hidden sm:block", expandedTicketId === t.id && "rotate-90")} 
                      size={20} 
                    />
                  </div>
                </div>

                {expandedTicketId === t.id && (
                  <div className="border-t border-white/5 bg-black/20 p-5 sm:p-6 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Filter size={12} />
                        Detalhes do Bilhete
                      </h4>
                      <div className="grid gap-3">
                        {t.selections ? (
                          t.selections.map((sel: any, idx: number) => (
                            <div key={idx} className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-black uppercase">
                                    {sel.market || sel.market_name_snapshot}
                                  </span>
                                  <span className="text-sm font-black text-white">
                                    {sel.option || sel.option_label_snapshot}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-400 font-medium">
                                  {sel.home_team || sel.home_team_snapshot} x {sel.away_team || sel.away_team_snapshot}
                                </div>
                                <div className="text-[10px] text-slate-600">
                                  {sel.competition || sel.league_name_snapshot} • {sel.kickoff_at_snapshot ? new Date(sel.kickoff_at_snapshot).toLocaleString('pt-BR') : 'Aposta Realizada'}
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5">
                                <div className="flex flex-col sm:items-end">
                                  <span className="text-[9px] text-slate-500 font-bold uppercase">Cotação</span>
                                  <span className="text-base font-black text-emerald-400">{(sel.odd || sel.odd_snapshot).toFixed(2)}</span>
                                </div>
                                <div className="flex flex-col sm:items-end">
                                  <span className="text-[9px] text-slate-500 font-bold uppercase">Status</span>
                                  <span className={cn("text-xs font-black uppercase tracking-wider", getSelectionStatusColor(sel.status || t.status))}>
                                    {sel.status === 'WON' ? 'Vencedora' :
                                     sel.status === 'LOST' ? 'Perdida' :
                                     sel.status === 'VOID' ? 'Anulada' :
                                     sel.status === 'PUSH' ? 'Push' :
                                     t.status === 'PAID' ? 'Confirmada' : 
                                     t.status === 'WAITING_PAYMENT' ? 'Aguardando' : 'Pendente'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          t.ticket_selections?.map((sel: any, idx: number) => (
                            <div key={idx} className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-black uppercase">
                                    {sel.market_name_snapshot}
                                  </span>
                                  <span className="text-sm font-black text-white">
                                    {sel.option_label_snapshot}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-400 font-medium">
                                  {sel.home_team_snapshot} x {sel.away_team_snapshot}
                                </div>
                                <div className="text-[10px] text-slate-600">
                                  {sel.league_name_snapshot} • {new Date(sel.kickoff_at_snapshot).toLocaleString('pt-BR')}
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5">
                                <div className="flex flex-col sm:items-end">
                                  <span className="text-[9px] text-slate-500 font-bold uppercase">Cotação</span>
                                  <span className="text-base font-black text-emerald-400">{sel.odd_snapshot.toFixed(2)}</span>
                                </div>
                                <div className="flex flex-col sm:items-end">
                                  <span className="text-[9px] text-slate-500 font-bold uppercase">Status</span>
                                  <span className={cn("text-xs font-black uppercase tracking-wider", getSelectionStatusColor(sel.status))}>
                                    {sel.status === 'PENDING' ? 'Pendente' : 
                                     sel.status === 'WON' ? 'Vencedora' :
                                     sel.status === 'LOST' ? 'Perdida' :
                                     sel.status === 'VOID' ? 'Anulada' : 
                                     sel.status === 'PUSH' ? 'Push' : sel.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5">
                        <div className="flex gap-4">
                          <div className="text-xs text-slate-500 italic">
                            Odd Total: <span className="font-bold text-white">{t.total_odd.toFixed(2)}</span>
                          </div>
                          {(t.status === 'PENDING_PAYMENT' || t.status === 'WAITING_PAYMENT') && (
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest border border-white/10 px-2 py-0.5 rounded">
                              Simulado (Aguardando)
                            </span>
                          )}


                        </div>

                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-slate-500 hover:text-white"
                          onClick={() => setExpandedTicketId(null)}
                        >
                          Fechar Detalhes
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
