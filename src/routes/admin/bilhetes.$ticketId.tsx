import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getAdminTicketDetail } from "@/lib/admin.functions";
import { 
  Loader2, Ticket, User, Calendar, Clock, ChevronLeft, 
  ShieldCheck, CheckCircle2, XCircle, AlertCircle, Ban, 
  CreditCard, TrendingUp, Info, Hash, Activity, History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { maskPhone } from "@/lib/phone-utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/bilhetes/$ticketId")({
  ssr: false,
  component: AdminTicketDetailPage,
});

function AdminTicketDetailPage() {
  const { ticketId } = Route.useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  const loadTicket = async () => {
    setLoading(true);
    try {
      const data = await getAdminTicketDetail({ data: { id: ticketId } });
      setTicket(data);

      // Tenta buscar audit logs se a tabela existir e o admin tiver acesso
      const { data: logs } = await supabase
        .from('ticket_audit_logs' as any)
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });
      
      if (logs) setAuditLogs(logs);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WON': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'LOST': return 'bg-red-100 text-red-700 border-red-200';
      case 'VOID': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'CANCELLED': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="animate-spin text-emerald-600 w-10 h-10 mb-4" />
        <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Acessando registro...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center text-center">
        <AlertCircle size={48} className="text-slate-300 mb-4" />
        <h2 className="text-2xl font-black text-slate-900 uppercase italic mb-2">Bilhete não encontrado</h2>
        <Button onClick={() => navigate({ to: '/admin/bilhetes' })}>Voltar para Listagem</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <button 
          onClick={() => navigate({ to: '/admin/bilhetes' })}
          className="flex items-center gap-2 text-slate-400 hover:text-emerald-600 font-bold uppercase tracking-widest text-[9px] mb-6 transition-colors"
        >
          <ChevronLeft size={14} />
          Voltar para auditoria
        </button>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 border-b border-[#E5E7EB] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-slate-900 tracking-tight uppercase">{ticket.code}</span>
              <div className={cn("px-2 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider border", getStatusColor(ticket.status))}>
                {ticket.status}
              </div>
            </div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
              <Hash size={12} className="text-emerald-500" />
              ID: {ticket.id}
            </p>
          </div>
          
          <div className="flex gap-2">
             <Button 
               variant="outline" 
               className="border-[#E5E7EB] text-slate-600 font-bold uppercase text-[9px] tracking-widest h-9 px-4 rounded-[6px]"
               onClick={() => navigate({ to: '/admin/resultados' })}
             >
               Liquidação Manual
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Seções/Mercados */}
            <section className="bg-white border border-[#E5E7EB] rounded-[8px] overflow-hidden">
              <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F6F7F7]">
                <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Activity size={14} className="text-emerald-600" />
                  Seleções no Bilhete
                </h3>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{ticket.ticket_selections?.length || 0} Itens</span>
              </div>
              
              <div className="divide-y divide-slate-100">
                {ticket.ticket_selections?.map((sel: any, idx: number) => (
                  <div key={idx} className="p-4 space-y-3 hover:bg-[#F6F7F7]/50 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-[4px] font-bold border border-emerald-100 uppercase tracking-tighter">
                            {sel.market_name_snapshot}
                          </span>
                          {sel.parameter_snapshot && (
                            <span className="text-[9px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded-[4px] font-bold border border-slate-100 uppercase tracking-tighter">
                              Linha: {sel.parameter_snapshot}
                            </span>
                          )}
                        </div>
                        <h4 className="text-[15px] font-bold text-slate-900 uppercase">
                          {sel.option_label_snapshot}
                        </h4>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Odd Aposta</span>
                        <span className="text-xl font-bold text-slate-900 leading-none">{sel.odd_snapshot.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between pt-2 border-t border-slate-50 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700 uppercase tracking-tight">
                          {sel.home_team_snapshot} 
                          <span className="text-slate-300 font-medium px-1">vs</span> 
                          {sel.away_team_snapshot}
                        </div>
                        <div className="flex items-center gap-4 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                          <span className="flex items-center gap-1"><Info size={10} /> {sel.competition_snapshot}</span>
                          <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(sel.kickoff_at_snapshot).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                      
                      <div className={cn(
                        "px-2 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider border self-start md:self-center",
                        sel.settlement_status === 'WON' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                        sel.settlement_status === 'LOST' ? "bg-red-50 text-red-600 border-red-100" :
                        "bg-slate-50 text-slate-400 border-slate-200"
                      )}>
                        {sel.settlement_status === 'PENDING' ? 'Aguardando' : 
                         sel.settlement_status === 'WON' ? 'Vencedora' :
                         sel.settlement_status === 'LOST' ? 'Perdida' :
                         sel.settlement_status === 'VOID' ? 'Anulada' : sel.settlement_status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Audit Log */}
            {auditLogs.length > 0 && (
              <section className="bg-white border border-[#E5E7EB] rounded-[8px] overflow-hidden">
                <div className="p-4 border-b border-[#E5E7EB] bg-[#F6F7F7]">
                  <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <History size={14} className="text-emerald-600" />
                    Audit Logs
                  </h3>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    {auditLogs.map((log, idx) => (
                      <div key={idx} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                          {idx !== auditLogs.length - 1 && <div className="w-px flex-1 bg-slate-100 my-1" />}
                        </div>
                        <div className="pb-4">
                          <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-1">{log.action}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mb-2">
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </p>
                          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                             <pre className="text-[9px] text-slate-600 font-mono whitespace-pre-wrap overflow-x-auto">
                               {JSON.stringify(log.payload, null, 2)}
                             </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-emerald-600 rounded-[8px] p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <TrendingUp size={60} />
              </div>
              <div className="relative z-10 space-y-6">
                <div>
                  <p className="text-[9px] font-bold text-emerald-200 uppercase tracking-[0.2em] mb-1.5">Aposta Realizada</p>
                  <p className="text-3xl font-bold">{formatCurrency(ticket.stake)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                  <div>
                    <p className="text-[8px] font-bold text-emerald-200 uppercase tracking-widest mb-1">Odd Total</p>
                    <p className="text-lg font-bold">{ticket.total_odd.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-emerald-200 uppercase tracking-widest mb-1">Retorno</p>
                    <p className="text-lg font-bold">{formatCurrency(ticket.potential_return)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-6 space-y-6">
               <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Identificação do Cliente</h4>
               
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-[6px] bg-slate-50 flex items-center justify-center text-slate-400 border border-[#E5E7EB]">
                   <User size={20} />
                 </div>
                 <div className="min-w-0">
                   <p className="text-[13px] font-bold text-slate-900 truncate uppercase">{ticket.profiles?.name || "Usuário Anônimo"}</p>
                   <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{ticket.profiles?.phone ? maskPhone(ticket.profiles.phone) : (ticket.profiles?.email || "Sem contato")}</p>
                 </div>
               </div>

               <div className="space-y-4 pt-2">
                 <div className="flex justify-between items-center text-[9px]">
                   <span className="font-bold text-slate-400 uppercase tracking-widest">ID Usuário</span>
                   <span className="font-mono text-slate-500">{ticket.user_id.split('-')[0]}...</span>
                 </div>
                 <div className="flex justify-between items-center text-[9px]">
                   <span className="font-bold text-slate-400 uppercase tracking-widest">Canal</span>
                   <span className={cn("font-bold px-1.5 py-0.5 rounded-[4px] uppercase border", ticket.payment_mode === 'SIMULATED' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100")}>
                     {ticket.payment_mode}
                   </span>
                 </div>
                 <div className="flex justify-between items-center text-[9px]">
                   <span className="font-bold text-slate-400 uppercase tracking-widest">Status Pag.</span>
                   <span className="font-bold text-slate-900 uppercase">{ticket.payment_status}</span>
                 </div>
               </div>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-6 space-y-4">
               <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Finalização Operacional</h4>
               
               {ticket.status === 'CONFIRMED' ? (
                  <div className="flex flex-col items-center py-4 text-center space-y-2">
                     <Clock size={24} className="text-amber-500 animate-pulse" />
                     <p className="text-[11px] font-bold text-slate-900 uppercase">Aguardando Encerramento</p>
                     <p className="text-[9px] text-slate-500 font-medium uppercase tracking-tighter">Mercados abertos ou partida em curso.</p>
                  </div>
               ) : (
                 <div className="space-y-4">
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="font-bold text-slate-400 uppercase tracking-widest">Odd Finalizada</span>
                      <span className="font-bold text-slate-900">{ticket.settled_total_odd ? ticket.settled_total_odd.toFixed(2) : ticket.total_odd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="font-bold text-slate-400 uppercase tracking-widest">Retorno Efetivo</span>
                      <span className="text-lg font-bold text-emerald-600">{formatCurrency(ticket.settled_return || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="font-bold text-slate-400 uppercase tracking-widest">Liquidado Em</span>
                      <span className="font-bold text-slate-900 uppercase">{ticket.settled_at ? new Date(ticket.settled_at).toLocaleDateString('pt-BR') : '-'}</span>
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
