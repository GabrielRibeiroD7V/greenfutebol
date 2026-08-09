import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useBetSlip, BetSlipSelection } from "@/hooks/use-bet-slip";
import { useAuth } from "@/hooks/use-auth";
import { Ticket, AlertCircle, ArrowLeft, Trash2, CheckCircle2, Loader2, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { createTicket } from "@/lib/tickets.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

type SubmissionState = 'IDLE' | 'READY' | 'SUBMITTING' | 'NEEDS_REVIEW' | 'SUCCESS';

interface OddChange {
  selection_id: string;
  old_odd: number;
  new_odd: number;
}

export const Route = createFileRoute("/bilhete")({
  component: BilhetePage,
});

function BilhetePage() {
  const { 
    selections, 
    previewTotalOdd, 
    stake, 
    removeSelection, 
    clearBetSlip,
    idempotencyKey,
    generateIdempotencyKey,
    addSelection
  } = useBetSlip();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [state, setState] = useState<SubmissionState>('IDLE');
  const [ticketResult, setTicketResult] = useState<any>(null);
  const [oddChanges, setOddChanges] = useState<OddChange[]>([]);
  const [unavailableSelectionIds, setUnavailableSelectionIds] = useState<string[]>([]);
  
  const createTicketFn = useServerFn(createTicket);

  const isInvalid = useMemo(() => {
    return selections.length === 0 || unavailableSelectionIds.length > 0;
  }, [selections, unavailableSelectionIds]);

  const handleConfirm = async () => {
    if (!isAuthenticated) {
      navigate({ to: "/login", search: { redirect: "/bilhete" } });
      return;
    }

    // Se houve mudança de odds, o usuário precisa aceitar primeiro (o botão muda)
    if (state === 'NEEDS_REVIEW') {
      // O usuário aceitou as novas odds, então aplicamos elas e geramos nova chave
      oddChanges.forEach(change => {
        const selection = selections.find(s => s.selectionId === change.selection_id);
        if (selection) {
          addSelection({ ...selection, displayedOdd: change.new_odd });
        }
      });
      setOddChanges([]);
      const newKey = generateIdempotencyKey();
      
      // Imediatamente tenta submeter com a nova chave e odds
      submit(newKey);
      return;
    }

    let currentKey = idempotencyKey;
    if (!currentKey) {
      currentKey = generateIdempotencyKey();
    }

    submit(currentKey);
  };

  const submit = async (key: string) => {
    setState('SUBMITTING');
    try {
      const payload = {
        stake,
        idempotency_key: key,
        selections: selections.map(s => ({
          selection_id: s.selectionId,
          expected_odd: s.displayedOdd
        }))
      };

      const result = await createTicketFn({ data: payload });
      setTicketResult(result);
      setState('SUCCESS');
      clearBetSlip();
      toast.success("Bilhete confirmado com sucesso!");
    } catch (error: any) {
      const msg = error.message || "";
      console.error("Erro na criação do ticket:", error);
      
      if (msg.includes("UNAUTHORIZED")) {
        setState('IDLE');
        toast.error("Sessão expirada. Por favor, faça login novamente.");
        navigate({ to: "/login", search: { redirect: "/bilhete" } });
      } else if (msg.includes("ODDS_CHANGED")) {
        setState('NEEDS_REVIEW');
        try {
          // Extrai o JSON do detalhe do erro (PostgREST detail)
          const detailMatch = msg.match(/detail = (\[.*\])/);
          if (detailMatch) {
            const changes = JSON.parse(detailMatch[1]) as OddChange[];
            setOddChanges(changes);
            toast.warning("Algumas odds mudaram. Revise antes de confirmar.");
          } else {
            toast.warning("As odds mudaram. Por favor, revise seu bilhete.");
          }
        } catch (e) {
          toast.warning("As odds mudaram. Por favor, revise seu bilhete.");
        }
      } else if (msg.includes("MARKET_UNAVAILABLE") || msg.includes("SELECTION_UNAVAILABLE")) {
        setState('IDLE');
        toast.error("Um ou mais mercados foram suspensos ou fechados.");
        // Em um sistema real, poderíamos extrair qual ID falhou do detalhe
        // Por ora, marcamos todos como suspeitos ou pedimos revisão
      } else if (msg.includes("MATCH_ALREADY_STARTED")) {
        setState('IDLE');
        toast.error("Uma ou mais partidas já começaram. Remova-as para continuar.");
      } else if (msg.includes("INVALID_STAKE")) {
        setState('IDLE');
        toast.error("Valor da aposta inválido (Mínimo R$ 5,00).");
      } else {
        setState('IDLE'); // Permite retry com a mesma chave
        toast.error(msg || "Erro ao confirmar bilhete.");
      }
    }
  };

  if (ticketResult) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 max-w-2xl mx-auto text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 animate-in zoom-in duration-500">
          <CheckCircle2 size={48} />
        </div>
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-emerald-500">Bilhete Confirmado!</h2>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs mt-2">Seu bilhete foi gerado em modo demonstrativo</p>
        </div>

        <div className="w-full bg-zinc-900 border border-white/5 rounded-3xl p-6 space-y-4 text-left">
          <div className="flex justify-between items-center pb-4 border-b border-white/5">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Código</span>
            <span className="font-black text-white">{ticketResult.ticket_code}</span>
          </div>
          <div className="flex justify-between items-center pb-4 border-b border-white/5">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Valor</span>
            <span className="font-black text-white">R$ {ticketResult.stake.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pb-4 border-b border-white/5">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Retorno</span>
            <span className="font-black text-emerald-500">R$ {ticketResult.potential_return.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Status</span>
            <span className="bg-emerald-500/10 text-emerald-500 text-[9px] px-2 py-0.5 rounded font-black uppercase">
              {ticketResult.status}
            </span>
          </div>
        </div>

        <div className="w-full grid grid-cols-2 gap-3">
          <Button onClick={() => navigate({ to: "/meus-bilhetes" })} className="h-14 bg-zinc-800 text-white font-black uppercase tracking-widest rounded-xl">
            Meus Bilhetes
          </Button>
          <Button onClick={() => navigate({ to: "/" })} className="h-14 bg-emerald-600 text-white font-black uppercase tracking-widest rounded-xl">
            Novos Jogos
          </Button>
        </div>
      </div>
    );
  }


  if (selections.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4">
        <Ticket size={64} className="text-zinc-800 mb-4" />
        <h2 className="text-xl font-black mb-2 uppercase tracking-tighter italic">Bilhete Vazio</h2>
        <Button onClick={() => navigate({ to: "/" })} variant="outline" className="border-emerald-500/20 text-emerald-500">Voltar para Jogos</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate({ to: "/" })} className="p-2 hover:bg-white/5 rounded-full"><ArrowLeft size={20} /></button>
          <h1 className="text-2xl font-black italic text-emerald-500 uppercase tracking-tighter leading-none">Rascunho do Bilhete</h1>
        </div>
        <button onClick={clearBetSlip} className="text-[10px] font-black uppercase text-zinc-600 hover:text-red-500 flex items-center gap-1">
          <Trash2 size={12} /> Limpar
        </button>
      </header>
      
      <div className="space-y-4">
        {selections.map((s) => (
          <div key={s.selectionId} className="bg-zinc-900 border border-white/5 p-4 rounded-2xl flex justify-between items-center group relative">
            <div>
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">{s.marketName}</span>
              <p className="font-black text-base leading-tight">{s.selectionName}</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{s.fixtureName}</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-[9px] text-zinc-600 font-black uppercase block">Odd</span>
                <span className="font-black text-xl text-emerald-500 leading-none">{s.displayedOdd.toFixed(2)}</span>
              </div>
              <button 
                onClick={() => removeSelection(s.selectionId)} 
                className="p-2 hover:bg-white/5 rounded-full text-zinc-600 hover:text-red-500 transition-colors"
              >
                  <X size={18} />

              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-emerald-500/20 p-6 rounded-3xl space-y-6 shadow-[0_0_30px_rgba(16,185,129,0.05)]">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Cotação Total</span>
            <span className="font-black text-3xl text-white">{previewTotalOdd.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Retorno Possível</span>
            <span className="text-xl font-black text-emerald-500">R$ {(stake * previewTotalOdd).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        
        <div className="bg-zinc-950/50 border border-white/5 p-4 rounded-xl flex gap-3 text-zinc-400 text-[10px] font-bold uppercase leading-relaxed">
          <AlertCircle className="shrink-0 text-emerald-500" size={16} />
          As odds serão verificadas novamente na confirmação. O valor demonstrativo não será persistido.
        </div>

        <div className="space-y-3">
          <Button 
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              'Confirmar Bilhete'
            )}
          </Button>
          <p className="text-center text-[9px] font-black text-zinc-600 uppercase tracking-widest">
            Aposta mínima: R$ 5,00 • Modo Demonstrativo
          </p>
        </div>

      </div>
    </div>
  );
}

function X({ size }: { size: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
