import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  QrCode, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowLeft,
  ExternalLink,
  Zap,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getTicketDetail } from "@/lib/tickets.functions";
import { generatePix, checkPixStatus } from "@/lib/payments.functions";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/pagamento/$ticketId")({
  head: () => ({
    meta: [{ title: "Pagamento PIX - GreenFutebol" }],
  }),
  component: PaymentPage,
});

function PaymentPage() {
  const { ticketId } = Route.useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data: ticket, isLoading: loadingTicket, error: ticketError } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => getTicketDetail({ data: { ticketId } }),
  });

  const generatePixMutation = useMutation({
    mutationFn: () => generatePix({ data: { ticketId } }),
    onSuccess: () => {
      window.location.reload();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao gerar cobrança");
    }
  });

  useEffect(() => {
    if (!ticket || ticket.status === "PAID" || !ticket.payment_id) return;

    const interval = setInterval(async () => {
      try {
        const result = await checkPixStatus({ data: { ticketId } });
        if (result.ticket_status === "PAID") {
          toast.success("Pagamento confirmado!");
          navigate({ to: "/meus-bilhetes" });
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [ticket, ticketId, navigate]);

  const handleCopy = () => {
    if (!ticket?.pix_copy_paste) return;
    navigator.clipboard.writeText(ticket.pix_copy_paste);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const checkManual = async () => {
    toast.loading("Verificando pagamento...", { id: "check" });
    try {
      const result = await checkPixStatus({ data: { ticketId } });
      if (result.ticket_status === "PAID") {
        toast.success("Pagamento confirmado!", { id: "check" });
        navigate({ to: "/meus-bilhetes" });
      } else {
        toast.info("Pagamento ainda não detectado. Tente em instantes.", { id: "check" });
      }
    } catch (e) {
      toast.error("Erro ao verificar.", { id: "check" });
    }
  };

  if (loadingTicket) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-600" size={48} />
      </div>
    );
  }

  if (ticketError || !ticket) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="text-red-500 mb-4" size={64} />
        <h1 className="text-xl font-black text-slate-900 uppercase italic">Erro ao carregar bilhete</h1>
        <Link to="/" className="text-emerald-600 font-bold hover:underline mt-4">Voltar para Início</Link>
      </div>
    );
  }

  if (ticket.status === "PENDING_PAYMENT" && !ticket.payment_id) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <Zap className="text-emerald-600" size={40} />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tighter mb-2 italic">Finalizar Aposta</h1>
        <p className="text-slate-500 mb-8 max-w-xs font-medium">
          Seu bilhete foi reservado. Clique abaixo para gerar o código PIX e confirmar sua aposta.
        </p>
        <button
          onClick={() => generatePixMutation.mutate()}
          disabled={generatePixMutation.isPending}
          className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.98]"
        >
          {generatePixMutation.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <>GERAR PIX AGORA</>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="border-b border-slate-200 p-4 flex items-center gap-4 bg-white sticky top-0 z-10 shadow-sm">
        <button onClick={() => navigate({ to: "/meus-bilhetes" })} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
          <ArrowLeft size={20} />
        </button>
        <span className="font-black uppercase tracking-widest text-xs text-emerald-600 italic">
          Pagamento PIX
        </span>
      </header>

      <main className="max-w-md mx-auto p-6 space-y-8">
        <div className="text-center space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Total a Pagar</div>
          <div className="text-4xl font-black text-slate-900">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ticket.stake)}
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-emerald-700 font-bold bg-emerald-100 py-1.5 px-4 rounded-full w-fit mx-auto shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
            </span>
            AGUARDANDO PAGAMENTO
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200 flex flex-col items-center">
            {ticket.pix_qr_code ? (
              <img 
                src={`data:image/png;base64,${ticket.pix_qr_code}`} 
                alt="QR Code PIX"
                className="w-full max-w-[240px] aspect-square object-contain"
              />
            ) : (
              <div className="w-full max-w-[240px] aspect-square bg-slate-100 animate-pulse rounded-2xl" />
            )}

          <p className="text-[10px] text-slate-400 font-bold mt-6 uppercase tracking-widest">
            Aponte a câmera para pagar
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pix Copia e Cola</label>
            <div className="relative group">
              <input
                readOnly
                value={ticket.pix_copy_paste || ""}
                className="w-full bg-white border border-slate-200 rounded-xl py-4 pl-4 pr-12 text-xs font-mono text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button 
                onClick={handleCopy}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-all"
              >
                {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
              <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Código</div>
              <div className="text-xs font-bold text-slate-900">{ticket.code}</div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
              <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Expira em</div>
              <div className="text-xs font-bold text-slate-900">24 horas</div>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <button
            onClick={checkManual}
            className="w-full bg-white hover:bg-slate-50 text-slate-900 font-black uppercase tracking-widest py-4 rounded-xl transition-all text-xs border border-slate-200 shadow-sm"
          >
            Já realizei o pagamento
          </button>
          
          <a
            href={ticket.invoice_url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors text-[10px] font-black uppercase tracking-widest"
          >
            Abrir link externo <ExternalLink size={12} />
          </a>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex gap-3 shadow-sm">
          <Info className="text-emerald-600 shrink-0" size={18} />
          <p className="text-[10px] text-emerald-800 leading-relaxed font-bold uppercase tracking-tight">
            Após a confirmação, seu bilhete aparecerá automaticamente em <span className="text-emerald-600">Meus Bilhetes</span> e passará a concorrer aos prêmios.
          </p>
        </div>
      </main>
    </div>
  );
}