import { useState } from "react";
import { Ticket, X, Trash2, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { createTicket } from "@/lib/tickets.functions";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

interface BetSlipProps {
  className?: string;
  isMobile?: boolean;
}

export function BetSlip({ className, isMobile }: BetSlipProps) {
  const { 
    selections, 
    stake, 
    setStake, 
    removeSelection, 
    clearSlip, 
    totalOdd, 
    potentialReturn,
    isValidating,
    idempotencyKey,
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
    if (stake < 5) {
      toast.error("O valor mínimo da aposta é R$ 5,00.");
      return;
    }

    setIsConfirming(true);
    setOddsChangedError(false);

    try {
      const result = await createTicket({
        data: {
          stake,
          idempotency_key: idempotencyKey,
          selections: selections.map(s => ({
            fixture_market_option_id: s.fixture_market_option_id,
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
        clearSlip();
        setReturnToConfirm(false);
        toast.success("Bilhete confirmado com sucesso!");
      } else if (result.error_code === 'ODDS_CHANGED') {
        setOddsChangedError(true);
        refreshIdempotency(); // New attempt, new key
        toast.warning("As odds do seu bilhete foram atualizadas. Revise antes de confirmar.");
        
        // Update local odds based on result
        // We'll trigger a re-render by manually updating selections if the hook allowed it,
        // but here we just show the error and the user sees the new odds (which they should fetch again or the RPC should return).
        // For Phase 1A, the user must click again.
      }
    } catch (err: any) {
      console.error("Error confirming ticket:", err);
      toast.error(err.message || "Erro ao confirmar bilhete.");
      refreshIdempotency(); // Reset key on error to allow retry
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
    <div className={cn("flex flex-col h-full bg-[#0a0a0a] border border-white/5 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl", className)}>
      <div className="p-4 bg-emerald-600 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Ticket size={20} className="brightness-125" />
          <h3 className="font-black uppercase tracking-tight">Bilhete de Aposta</h3>
        </div>
        <div className="flex items-center gap-2">
          {isValidating && <Loader2 size={12} className="animate-spin text-white/70" />}
          <span className="bg-black/20 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
            {selections.length} {selections.length === 1 ? 'SELEÇÃO' : 'SELEÇÕES'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
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
              <div key={s.fixture_market_option_id} className="bg-white/5 border border-white/5 rounded-xl p-3 space-y-2 relative group animate-in slide-in-from-right-4 duration-300">
                <button 
                  onClick={() => removeSelection(s.fixture_market_option_id)}
                  className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
                
                <div className="flex flex-col">
                  <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">{s.market_name}</span>
                  <span className="text-sm font-black text-white leading-tight">{s.label}</span>
                </div>

                <div className="flex flex-col border-t border-white/5 pt-2">
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
        <div className="p-4 bg-black/60 border-t border-white/10 space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cotação Total</span>
              <span className="text-xl font-black text-white">{totalOdd.toFixed(2)}</span>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block">Valor da Aposta (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                <input 
                  type="number" 
                  value={stake}
                  onChange={(e) => setStake(Number(e.target.value))}
                  min={5}
                  max={5000}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white font-black text-lg focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                />
              </div>
            </div>

            <div className="bg-emerald-600/10 border border-emerald-500/20 rounded-xl p-3 flex justify-between items-center">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Retorno Possível</span>
              <span className="text-xl font-black text-emerald-400">R$ {potentialReturn.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button 
              onClick={handleConfirm}
              disabled={isConfirming || selections.length === 0 || isValidating}
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
                "Confirmar Bilhete"
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