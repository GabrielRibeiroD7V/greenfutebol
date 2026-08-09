import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getAdminTickets, getAdminTicketsSummary } from "@/lib/admin.functions";
import { 
  Loader2, Search, Ticket, User, Phone, Calendar, Clock, 
  ChevronRight, Filter, ShieldCheck, RefreshCw, TrendingUp, 
  CheckCircle2, XCircle, AlertCircle, Ban, ArrowRightLeft, CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { maskPhone } from "@/lib/phone-utils";
import { useDebounce } from "@/hooks/use-debounce";

export const Route = createFileRoute("/admin/bilhetes")({
  ssr: false,
  component: AdminTicketsPage,
});

function AdminTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dateRange, setDateRange] = useState("ALL");
  const [paymentMode, setPaymentMode] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const debouncedSearch = useDebounce(search, 500);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [debouncedSearch, status, dateRange, paymentMode, page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ticketsData, summaryData] = await Promise.all([
        getAdminTickets({ 
          data: { 
            search: debouncedSearch, 
            status: status === 'ALL' ? undefined : status,
            dateRange: dateRange === 'ALL' ? undefined : dateRange,
            paymentMode: paymentMode === 'ALL' ? undefined : paymentMode,
            page,
            pageSize: 50
          } 
        }),
        getAdminTicketsSummary()
      ]);
      
      setTickets(ticketsData.tickets || []);
      setTotalCount(ticketsData.totalCount || 0);
      setSummary(summaryData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'WON': return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'LOST': return <XCircle size={16} className="text-red-500" />;
      case 'VOID': return <Ban size={16} className="text-slate-400" />;
      case 'CANCELLED': return <AlertCircle size={16} className="text-slate-400" />;
      default: return <Clock size={16} className="text-amber-500" />;
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 rounded-[8px] flex items-center justify-center text-emerald-600 border border-emerald-100">
              <Ticket size={24} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 uppercase tracking-tight">Auditório de Bilhetes</h1>
              <p className="text-slate-500 text-[11px] font-medium uppercase tracking-wider">Gestão e Auditoria Operacional</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate({ to: "/" })} variant="outline" className="border-[#E5E7EB] hover:bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-widest h-9 px-4 rounded-[6px]">Home</Button>
            <Button onClick={loadData} variant="outline" className="border-emerald-200 hover:bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-widest h-9 px-4 rounded-[6px]">
              <RefreshCw size={14} className={cn("mr-2", loading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </header>

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {[
            { label: 'Bilhetes Hoje', value: summary?.todayCount || 0, icon: Ticket, color: 'emerald' },
            { label: 'Stake Hoje', value: formatCurrency(summary?.todayStake || 0), icon: CreditCard, color: 'emerald' },
            { label: 'Pendentes', value: summary?.pendingCount || 0, icon: Clock, color: 'amber' },
            { label: 'Ganhos', value: summary?.wonCount || 0, icon: CheckCircle2, color: 'emerald' },
            { label: 'Perdidos', value: summary?.lostCount || 0, icon: XCircle, color: 'red' },
            { label: 'Exposição Total', value: formatCurrency(summary?.potentialExposure || 0), icon: TrendingUp, color: 'slate' },
          ].map((item, idx) => (
            <div key={idx} className="bg-white border border-[#E5E7EB] p-4 rounded-[8px]">
              <div className={cn("w-7 h-7 rounded-[4px] flex items-center justify-center mb-3", 
                item.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                item.color === 'amber' ? "bg-amber-50 text-amber-600" :
                item.color === 'red' ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600"
              )}>
                <item.icon size={16} />
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">{item.label}</p>
              <p className="text-base font-bold text-slate-900 leading-none">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Filtros e Busca */}
        <div className="bg-[#F6F7F7] border border-[#E5E7EB] rounded-[8px] p-4 mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input 
                placeholder="Buscar por código, ID do bilhete..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-white border-[#E5E7EB] text-slate-900 placeholder:text-slate-400 focus:ring-emerald-500 rounded-[6px] text-xs h-10"
              />
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full bg-white border-[#E5E7EB] font-bold text-[11px] h-10 rounded-[6px] uppercase tracking-wider">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos Status</SelectItem>
                  <SelectItem value="PENDING">Pendentes</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmados</SelectItem>
                  <SelectItem value="WON">Ganhos</SelectItem>
                  <SelectItem value="LOST">Perdidos</SelectItem>
                  <SelectItem value="VOID">Anulados</SelectItem>
                  <SelectItem value="CANCELLED">Cancelados</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-full bg-white border-[#E5E7EB] font-bold text-[11px] h-10 rounded-[6px] uppercase tracking-wider">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todo Período</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7days">Últimos 7 dias</SelectItem>
                  <SelectItem value="30days">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>

              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger className="w-full bg-white border-[#E5E7EB] font-bold text-[11px] h-10 rounded-[6px] uppercase tracking-wider">
                  <SelectValue placeholder="Pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos Meios</SelectItem>
                  <SelectItem value="SIMULATED">Simulado</SelectItem>
                  <SelectItem value="REAL">Real (Pix)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Listagem */}
        {loading && tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-emerald-600 w-10 h-10 mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Carregando auditoria...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center p-20 bg-white rounded-[8px] border border-[#E5E7EB]">
            <Ticket className="mx-auto h-12 w-12 text-slate-200 mb-4" />
            <h3 className="text-sm font-bold text-slate-900 uppercase">Nenhum bilhete encontrado</h3>
            <p className="text-slate-500 mt-2 text-[11px] font-medium uppercase tracking-wider">Ajuste os filtros para encontrar registros específicos.</p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="bg-[#F6F7F7] border border-[#E5E7EB] rounded-[4px] p-3 grid grid-cols-12 gap-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest px-6 hidden lg:grid">
              <div className="col-span-2">Código / Data</div>
              <div className="col-span-3">Cliente / Contato</div>
              <div className="col-span-1 text-center">Itens</div>
              <div className="col-span-2 text-right">Stake / Odd</div>
              <div className="col-span-2 text-right">Retorno</div>
              <div className="col-span-2 text-right">Status</div>
            </div>

            {tickets.map(t => (
              <div 
                key={t.id} 
                onClick={() => navigate({ to: `/admin/bilhetes/${t.id}` })}
                className="bg-white border-b border-[#E5E7EB] p-4 lg:p-6 grid grid-cols-12 gap-4 items-center cursor-pointer hover:bg-[#F6F7F7] transition-all group last:border-b-0"
              >
                <div className="col-span-6 lg:col-span-2 space-y-1">
                  <span className="text-xs font-bold text-emerald-600 tracking-tighter group-hover:underline uppercase">{t.code}</span>
                  <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
                    {new Date(t.created_at).toLocaleDateString('pt-BR')} {new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div className="col-span-6 lg:col-span-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-[4px] bg-slate-50 flex items-center justify-center text-[9px] font-bold text-slate-500 border border-[#E5E7EB]">
                    {(t.profiles?.name || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[11px] font-bold text-slate-900 block truncate uppercase">{t.profiles?.name || "Anônimo"}</span>
                    <span className="text-[9px] text-slate-400 font-bold block truncate uppercase tracking-tighter">{t.profiles?.phone ? maskPhone(t.profiles.phone) : (t.profiles?.email || "-")}</span>
                  </div>
                </div>

                <div className="col-span-4 lg:col-span-1 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Tipo</span>
                  <span className="text-[10px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full uppercase">
                    {t.selection_count === 1 ? 'Simples' : 'Múltipla'}
                  </span>
                </div>

                <div className="col-span-4 lg:col-span-2 text-right space-y-0.5">
                  <span className="text-xs font-black text-slate-900 block">{formatCurrency(t.stake)}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase italic block">Odd {t.total_odd.toFixed(2)}</span>
                </div>

                <div className="col-span-4 lg:col-span-2 text-right">
                  <span className="text-sm font-black text-emerald-600 block">{formatCurrency(t.potential_return)}</span>
                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter block">{t.selection_count} seleções</span>
                </div>

                <div className="col-span-12 lg:col-span-2 flex flex-col items-end gap-1 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(t.status)}
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                      {t.status === 'PAID' ? 'Pago' : 
                       t.status === 'WAITING_PAYMENT' ? 'Aguardando PIX' :
                       t.status === 'PENDING_PAYMENT' ? 'Pendente Pag.' :
                       t.status === 'WON' ? 'Ganho' :
                       t.status === 'LOST' ? 'Perdido' :
                       t.status === 'VOID' ? 'Anulado' :
                       t.status === 'CONFIRMED' ? 'Confirmado' :
                       t.status === 'CANCELLED' ? 'Cancelado' : t.status}
                    </span>
                  </div>
                  <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">
                    {t.payment_mode === 'SIMULATED' ? 'Modo Simulado' : 'Transação Real'}
                  </span>
                </div>
              </div>
            ))}

            {/* Paginação Simples */}
            <div className="flex items-center justify-between py-6">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total: {totalCount} bilhetes</span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1} 
                  onClick={() => setPage(p => p - 1)}
                  className="text-xs font-black uppercase tracking-widest border-slate-200"
                >
                  Anterior
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={tickets.length < 50} 
                  onClick={() => setPage(p => p + 1)}
                  className="text-xs font-black uppercase tracking-widest border-slate-200"
                >
                  Próxima
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
