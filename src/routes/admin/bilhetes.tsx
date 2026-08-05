import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getAdminTickets } from "@/lib/admin.functions";
import { Loader2, Search, Ticket, User, Phone, Calendar, Clock, ChevronRight, Filter, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { maskPhone } from "@/lib/phone-utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/bilhetes")({
  ssr: false,
  component: AdminTicketsPage,
});


function AdminTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadTickets();
  }, [search]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const { tickets: data } = await getAdminTickets({ data: { search } });
      
      // Fetch details for each ticket to show selections
      const ticketsWithDetails = await Promise.all(
        (data || []).map(async (ticket: any) => {
          try {
            const { data: details, error } = await supabase
              .from('tickets')
              .select('*, profiles(*), ticket_selections(*)')
              .eq('id', ticket.id)
              .single();
            return details || ticket;
          } catch (e) {
            return ticket;
          }
        })
      );

      setTickets(ticketsWithDetails);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getSelectionStatusColor = (status: string) => {
    switch (status) {
      case 'WIN': return 'text-emerald-500';
      case 'LOSS': return 'text-red-500';
      case 'CANCELLED': return 'text-slate-500';
      default: return 'text-amber-500';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Gestão de Bilhetes</h1>
              <p className="text-slate-400 text-sm">Monitoramento administrativo em tempo real.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate({ to: "/" })} variant="outline" className="border-white/10 hover:bg-white/5">Home</Button>
            <Button onClick={loadTickets} variant="outline" className="border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-500">
              <RefreshCw size={16} className={cn("mr-2", loading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </header>

        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 md:p-6 mb-8 backdrop-blur-sm">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <Input 
              placeholder="Buscar por código, nome ou ID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        {loading && tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-emerald-500 w-10 h-10 mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Carregando base de bilhetes...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center p-20 bg-white/5 rounded-2xl border border-white/5">
            <Ticket className="mx-auto h-16 w-16 text-slate-800 mb-4" />
            <h3 className="text-xl font-bold text-white uppercase">Nenhum bilhete encontrado</h3>
            <p className="text-slate-500 mt-2">Ajuste os filtros de busca ou aguarde novas apostas.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {tickets.map(t => (
              <div 
                key={t.id} 
                className={cn(
                  "bg-white/5 border border-white/5 rounded-2xl overflow-hidden transition-all duration-300",
                  expandedTicketId === t.id ? "ring-1 ring-amber-500/30" : "hover:border-white/10"
                )}
              >
                <div 
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6 cursor-pointer"
                  onClick={() => setExpandedTicketId(expandedTicketId === t.id ? null : t.id)}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:items-center gap-6 flex-1">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">Código</span>
                      <span className="text-lg font-black text-emerald-400 tracking-widest">{t.code}</span>
                    </div>

                    <div className="space-y-1 min-w-[140px]">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">Usuário</span>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
                          {(t.profiles?.name || "U").charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-bold text-white truncate max-w-[100px]">
                          {t.profiles?.name || "Anônimo"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">Telefone</span>
                      <span className="text-sm font-medium text-slate-300">
                        {t.profiles?.phone ? maskPhone(t.profiles.phone) : "-"}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">Data/Hora</span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Calendar size={12} />
                        {new Date(t.created_at).toLocaleDateString('pt-BR')}
                        <Clock size={12} className="ml-1" />
                        {new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-8 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/5">
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Aposta</span>
                      <span className="text-lg font-black text-white">R$ {t.stake.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-amber-500/50 font-black uppercase tracking-widest">Possível</span>
                      <span className="text-lg font-black text-emerald-400">R$ {t.potential_return.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                        t.status === 'CONFIRMED' || t.status === 'PENDING' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                      )}>
                        {t.status === 'PENDING' ? 'CONFIRMADO' : t.status}
                      </span>
                      <span className="text-[9px] text-slate-600 font-bold uppercase">{t.ticket_selections?.length || 0} SELEÇÕES</span>
                    </div>
                    <ChevronRight 
                      className={cn("text-slate-600 transition-transform duration-300 hidden lg:block", expandedTicketId === t.id && "rotate-90")} 
                      size={20} 
                    />
                  </div>
                </div>

                {expandedTicketId === t.id && (
                  <div className="border-t border-white/5 bg-black/40 p-5 md:p-8 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-amber-500 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Filter size={14} />
                          Composição do Bilhete (Snapshots)
                        </h4>
                        <div className="text-[10px] text-slate-600 font-bold uppercase">Ticket ID: {t.id}</div>
                      </div>
                      
                      <div className="grid gap-4">
                        {t.ticket_selections?.map((sel: any, idx: number) => (
                          <div key={idx} className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-lg font-black uppercase tracking-wider shadow-lg shadow-emerald-900/20">
                                  {sel.market_name_snapshot}
                                </span>
                                <span className="text-base font-black text-white">
                                  {sel.option_label_snapshot}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-slate-300 font-bold">
                                {sel.home_team_snapshot} 
                                <span className="text-emerald-500/50 px-1 font-black">vs</span> 
                                {sel.away_team_snapshot}
                              </div>
                              <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium">
                                <span className="flex items-center gap-1"><Calendar size={12} /> {sel.league_name_snapshot}</span>
                                <span className="flex items-center gap-1"><Clock size={12} /> {new Date(sel.kickoff_at_snapshot).toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between md:justify-end gap-10 pt-4 md:pt-0 border-t md:border-t-0 border-white/5">
                              <div className="flex flex-col md:items-end">
                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Odd Salva</span>
                                <span className="text-xl font-black text-emerald-400">{sel.odd_snapshot.toFixed(2)}</span>
                              </div>
                              <div className="flex flex-col md:items-end">
                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Resultado</span>
                                <span className={cn("text-sm font-black uppercase tracking-widest", getSelectionStatusColor(sel.status))}>
                                  {sel.status === 'PENDING' ? 'Aguardando' : sel.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-white/5 rounded-2xl p-5 border border-white/5 flex flex-wrap items-center justify-between gap-6">
                        <div className="flex items-center gap-8">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Odd Acumulada</span>
                            <span className="text-lg font-black text-white">{t.total_odd.toFixed(2)}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Valor do Bilhete</span>
                            <span className="text-lg font-black text-white">R$ {t.stake.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Potencial Bruto</span>
                          <span className="text-2xl font-black text-emerald-400">R$ {t.potential_return.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
