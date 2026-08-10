import { useState } from "react";
import { Ticket, X, Trash2, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Info, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { createTicket } from "@/lib/tickets.functions";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { formatBRL, MIN_STAKE } from "@/lib/bet-slip-finance";

interface BetSlipProps {
  className?: string;
  isMobile?: boolean;
}

export function BetSlip({ className, isMobile }: BetSlipProps) {
  const { 
    betSlips,
    activeBetSlipId,
    activeBetSlip,
    setActiveBetSlipId,
    createBetSlip,
    deleteActiveBetSlip,
    selections,
    stakeInput,
    stake,
    setStakeInput,
    removeSelection, 
    clearSlip,
    completeActiveSlip,
    totalOdd, 
    potentialReturn,
    potentialProfit,
    isValidating,
    updateChangedOdds,
    refreshIdempotency,
    returnToConfirm,
    setReturnToConfirm
  } = useBetSlip();
  
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isConfirming, setIsConfirming] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedTicket, setConfirmedTicket] = useState<{ code: string; id: string } | null>(null);
  const [oddsChangedError, setOddsChangedError] = useState<boolean>(false);

  const handleConfirm = async () => {
    if (!isAuthenticated) {
      setReturnToConfirm(true);
      toast.info("Entre ou crie sua conta para confirmar este bilhete.");
      navigate({ to: "/login", search: { redirect: window.location.pathname } });
      return;
    }

    if (selections.length === 0) return;
    if (stake === null || stake < MIN_STAKE) {
      toast.error(`Valor mínimo da aposta: ${formatBRL(MIN_STAKE)}`);
      return;
    }

    setIsConfirming(true);
    setOddsChangedError(false);

    try {
      const result = await createTicket({
        data: {
          stake,
          idempotency_key: activeBetSlip.idempotencyKey,
          selections: selections.map(s => ({
            selection_id: s.selection_id,
            expected_odd: s.odd
          }))
        }
      });

      if (result.success && result.ticketCode && result.ticketId) {
        setConfirmedTicket({ 
          code: result.ticketCode, 
          id: result.ticketId 
        });

        setShowConfirmation(true);
        completeActiveSlip();
        setReturnToConfirm(false);
        toast.success("Bilhete confirmado com sucesso!");
      } else if (result.error_code === 'ODDS_CHANGED') {
        setOddsChangedError(true);
        updateChangedOdds(result.changed_selections || []);
        toast.warning("As odds do seu bilhete foram atualizadas. Revise antes de confirmar.");
      }
    } catch (err: any) {
      console.error("Error confirming ticket:", err);
      toast.error(err.message || "Erro ao confirmar bilhete.");
      refreshIdempotency();
    } finally {
      setIsConfirming(false);
    }
  };

  if (showConfirmation && confirmedTicket) {
    return (
      <div className={cn("bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-4 backdrop-blur-xl animate-in fade-in zoom-in duration-300", className)}>
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h3 className="text-xl font-black text-white uppercase tracking-tight">Bilhete Confirmado!</h3>
        <p className="text-emerald-300 font-medium text-sm">Seu bilhete foi registrado com sucesso.</p>
        
        <div className="bg-black/40 border border-emerald-500/20 rounded-xl p-4 my-4">
          <span className="text-[10px] text-emerald-500/50 uppercase font-black tracking-widest block mb-1">Código do Bilhete</span>
          <span className="text-2xl font-black text-white tracking-widest">{confirmedTicket.code}</span>
        </div>

        <div className="flex flex-col gap-2">
          <button 
            onClick={() => navigate({ to: "/meus-bilhetes" })}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
          >
            Ver meus bilhetes
          </button>
          <button 
            onClick={() => setShowConfirmation(false)}
            className="w-full py-3 bg-white/5 text-white/50 rounded-xl font-bold uppercase text-xs hover:text-white transition-all"
          >
            Fazer novo bilhete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex max-h-[calc(100vh-6rem)] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm", isMobile && "max-h-none rounded-none border-0 shadow-none", className)}>
      <div className="p-4 bg-emerald-600 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Ticket size={20} className="brightness-125" />
          <h3 className="font-black uppercase tracking-tight">Bilhete Acumulado</h3>
        </div>
        <div className="flex items-center gap-2">
          {isValidating && <Loader2 size={12} className="animate-spin text-white/70" />}
          <span className="bg-black/20 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
            {selections.length} {selections.length === 1 ? 'SELEÇÃO' : 'SELEÇÕES'}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 p-2" aria-label="Bilhetes">
        {betSlips.map((slip, index) => (
          <button
            key={slip.id}
            onClick={() => setActiveBetSlipId(slip.id)}
            className={cn("shrink-0 rounded-md px-3 py-1.5 text-[10px] font-black uppercase", slip.id === activeBetSlipId ? "bg-emerald-600 text-white" : "bg-white text-slate-500 hover:text-emerald-600")}
          >
            Bilhete {index + 1} · {slip.selections.length}
          </button>
        ))}
        <button onClick={createBetSlip} className="shrink-0 rounded-md border border-dashed border-emerald-400 p-1.5 text-emerald-600" aria-label="Criar novo bilhete">
          <Plus size={14} />
        </button>
        {betSlips.length > 1 && (
          <button onClick={deleteActiveBetSlip} className="ml-auto shrink-0 p-1.5 text-slate-400 hover:text-red-500" aria-label="Excluir bilhete ativo">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="min-h-[220px] flex-1 space-y-2 overflow-y-auto p-3">
        {selections.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-10 opacity-40">
            <Ticket size={48} className="text-slate-600" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-400">Seu bilhete está vazio</p>
              <p className="text-[10px] text-slate-500">Selecione uma cotação para começar</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
              <Info className="text-amber-500 shrink-0" size={16} />
              <p className="text-[9px] font-bold leading-relaxed uppercase tracking-tighter text-amber-800">
                Você só recebe se TODAS as seleções vencerem. Uma seleção perdida encerra este bilhete. Sem cash out.
              </p>
            </div>

            {oddsChangedError && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertTriangle className="text-amber-500 shrink-0" size={16} />
                <p className="text-[10px] text-amber-200 font-bold leading-relaxed">
                  As odds do seu bilhete foram atualizadas. Revise os novos valores antes de confirmar.
                </p>
              </div>
            )}

            {returnToConfirm && isAuthenticated && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />
                <p className="text-[10px] text-emerald-100 font-bold leading-relaxed">
                  Bem-vindo de volta! Revise seu bilhete e clique em confirmar para finalizar.
                </p>
                <button onClick={() => setReturnToConfirm(false)} className="text-white/30 hover:text-white">
                  <X size={14} />
                </button>
              </div>
            )}
            
            {selections.map((s) => (
              <div key={s.selection_id} className="group relative space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5 animate-in slide-in-from-right-4 duration-300">
                <button 
                  onClick={() => removeSelection(s.selection_id)}
                  className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
                
                <div className="flex flex-col">
                  <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">{s.market_name}</span>
                  <span className="text-sm font-black leading-tight text-slate-900">{s.label}</span>
                </div>

                <div className="flex flex-col border-t border-slate-200 pt-1.5">
                  <span className="text-[10px] text-slate-500 font-bold truncate">
                    {s.home_team} x {s.away_team}
                  </span>
                  <div className="flex justify-between items-end mt-1">
                    <span className="text-[9px] text-slate-600 font-bold uppercase">Odd</span>
                    <span className="text-base font-black text-emerald-400">{s.odd.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {selections.length > 0 && (
        <div className="space-y-3 border-t border-slate-200 bg-white p-3">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Odd total</span>
              <span className="text-xl font-black text-slate-950">{totalOdd.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block">Valor da Aposta (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  placeholder="50,00"
                  aria-label="Valor da aposta em reais"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-lg font-black text-slate-950 outline-none transition-all focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              {stakeInput && (stake === null || stake < MIN_STAKE) && <p className="text-[10px] font-bold text-red-500">Valor mínimo da aposta: {formatBRL(MIN_STAKE)}</p>}
            </div>

            <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-600/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Retorno potencial</span>
                <span className="text-lg font-black text-emerald-700">{formatBRL(potentialReturn)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Lucro potencial</span>
                <span className="font-black text-slate-800">{formatBRL(Math.max(0, potentialProfit))}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button 
              onClick={handleConfirm}
              disabled={isConfirming || selections.length === 0 || isValidating || stake === null || stake < MIN_STAKE}
              className={cn(
                "w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)] active:scale-95 flex items-center justify-center gap-2",
                isConfirming || isValidating ? "bg-emerald-800 text-white/50" : "bg-emerald-600 text-white hover:bg-emerald-500"
              )}
            >
              {isConfirming ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Confirmando...
                </>
              ) : isValidating ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Validando...
                </>
              ) : (
                "Confirmar Bilhete Acumulado"
              )}
            </button>
            
            <button 
              onClick={clearSlip}
              disabled={isConfirming}
              className="w-full py-2 text-slate-600 hover:text-red-400 font-bold uppercase text-[9px] tracking-widest transition-colors flex items-center justify-center gap-1"
            >
              <Trash2 size={10} />
              Limpar Bilhete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
