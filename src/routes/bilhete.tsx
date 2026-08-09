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

    if (state === 'NEEDS_REVIEW') {
      oddChanges.forEach(change => {
        const selection = selections.find(s => s.selectionId === change.selection_id);
        if (selection) {
          addSelection({ ...selection, displayedOdd: change.new_odd });
        }
      });
      setOddChanges([]);
      const newKey = generateIdempotencyKey();
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
          expected_odd: s.displayedOdd,
          metadata: s.metadata
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
      } else if (msg.includes("MATCH_ALREADY_STARTED")) {
        setState('IDLE');
        toast.error("Uma ou mais partidas já começaram. Remova-as para continuar.");
      } else if (msg.includes("INVALID_STAKE")) {
        setState('IDLE');
        toast.error("Valor da aposta inválido (Mínimo R$ 5,00).");
      } else {
        setState('IDLE');
        toast.error(msg || "Erro ao confirmar bilhete.");
      }
    }
  };

  if (ticketResult) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4 max-w-2xl mx-auto text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 animate-in zoom-in duration-500 shadow-sm">
          <CheckCircle2 size={48} />
        </div>
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-emerald-600">Bilhete Confirmado!</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">Seu bilhete foi gerado em modo demonstrativo</p>
        </div>

        <div className="w-full bg-white border border-slate-200 rounded-3xl p-6 space-y-4 text-left shadow-sm">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Código</span>
            <span className="font-black text-slate-900">{ticketResult.ticket_code}</span>
          </div>
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Valor</span>
            <span className="font-black text-slate-900">R$ {ticketResult.stake.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Retorno</span>
            <span className="font-black text-emerald-600">R$ {ticketResult.potential_return.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</span>
            <span className="bg-emerald-100 text-emerald-700 text-[9px] px-2 py-0.5 rounded font-black uppercase">
              {ticketResult.status}
            </span>
          </div>
        </div>

        <div className="w-full grid grid-cols-2 gap-3">
          <Button onClick={() => navigate({ to: "/meus-bilhetes" })} className="h-14 bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 font-black uppercase tracking-widest rounded-xl shadow-sm">
            Meus Bilhetes
          </Button>
          <Button onClick={() => navigate({ to: "/" })} className="h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl shadow-md">
            Novos Jogos
          </Button>
        </div>
      </div>
    );
  }


  if (selections.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4">
        <Ticket size={64} className="text-slate-200 mb-4" />
        <h2 className="text-xl font-black mb-2 uppercase tracking-tighter italic">Bilhete Vazio</h2>
        <Button onClick={() => navigate({ to: "/" })} variant="outline" className="border-emerald-200 text-emerald-600 hover:bg-emerald-50">Voltar para Jogos</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate({ to: "/" })} className="p-2 hover:bg-slate-200 rounded-full text-slate-600"><ArrowLeft size={20} /></button>
          <h1 className="text-2xl font-black italic text-emerald-600 uppercase tracking-tighter leading-none">Rascunho do Bilhete</h1>
        </div>
        <button onClick={clearBetSlip} className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
          <Trash2 size={12} /> Limpar
        </button>
      </header>
      
      {state === 'NEEDS_REVIEW' && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3 animate-in slide-in-from-top-2 duration-300 shadow-sm">
          <AlertCircle className="shrink-0 text-amber-600" size={20} />
          <div className="space-y-1">
            <p className="text-sm font-black text-amber-700 uppercase tracking-tight">Atenção: As odds foram atualizadas</p>
            <p className="text-xs text-amber-800/70 font-medium">Alguns mercados no seu bilhete tiveram alteração de cotação. Verifique os novos valores abaixo antes de confirmar.</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {selections.map((s) => {
          const change = oddChanges.find(c => c.selection_id === s.selectionId);
          return (
            <div key={s.selectionId} className={`bg-white border ${change ? 'border-amber-400 shadow-md' : 'border-slate-200'} p-4 rounded-2xl flex justify-between items-center group relative transition-all shadow-sm`}>
              <div>
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{s.marketName}</span>
                <p className="font-black text-base text-slate-900 leading-tight">{s.selectionName}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{s.fixtureName}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 font-black uppercase block">Odd</span>
                  {change ? (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-slate-400 line-through font-bold">{s.displayedOdd.toFixed(2)}</span>
                      <span className="font-black text-xl text-amber-600 leading-none">{change.new_odd.toFixed(2)}</span>
                    </div>
                  ) : (
                    <span className="font-black text-xl text-emerald-600 leading-none">{s.displayedOdd.toFixed(2)}</span>
                  )}
                </div>
                <button 
                  onClick={() => removeSelection(s.selectionId)} 
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-6 shadow-sm">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Cotação Total</span>
            <span className="font-black text-3xl text-slate-900">{previewTotalOdd.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Retorno Possível</span>
            <span className="text-xl font-black text-emerald-600">R$ {(stake * previewTotalOdd).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex gap-3 text-slate-500 text-[10px] font-bold uppercase leading-relaxed">
          <Info className="shrink-0 text-emerald-600" size={16} />
          As odds são validadas em tempo real. O modo atual é demonstrativo.
        </div>

        <div className="space-y-3">
          <Button 
            onClick={handleConfirm}
            disabled={state === 'SUBMITTING' || isInvalid}
            className={`w-full h-14 font-black uppercase tracking-widest rounded-xl shadow-md disabled:opacity-50 transition-all ${
              state === 'NEEDS_REVIEW' 
                ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {state === 'SUBMITTING' ? (
              <Loader2 className="animate-spin" />
            ) : state === 'NEEDS_REVIEW' ? (
              'Aceitar Novas Odds e Confirmar'
            ) : (
              'Confirmar Bilhete'
            )}
          </Button>
          <p className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
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