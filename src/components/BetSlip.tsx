import { Ticket, X, Trash2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function BetSlip({ isMobile }: { isMobile?: boolean }) {
  const { 
    selections, 
    removeSelection, 
    clearBetSlip, 
    previewTotalOdd, 
    stake, 
    setStake 
  } = useBetSlip();
  
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleContinue = () => {
    if (!isAuthenticated) {
      navigate({ to: "/login", search: { redirect: "/bilhete" } });
    } else {
      navigate({ to: "/bilhete" });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-[#E5E7EB]">
      <div className="p-4 bg-white border-b border-[#E5E7EB] flex items-center justify-between">
        <h3 className="font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2 text-xs">
          <Ticket size={16} />
          Bilhete
        </h3>
        <span className="bg-emerald-50 text-emerald-600 text-[9px] px-2 py-0.5 rounded-[4px] font-bold border border-emerald-100 uppercase">
          {selections.length} {selections.length === 1 ? 'seleção' : 'seleções'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {selections.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-10 opacity-30">
            <Ticket size={48} className="text-zinc-600 mb-4" />
            <p className="text-xs font-bold uppercase tracking-widest">Seu bilhete está vazio</p>
          </div>
        ) : (
          selections.map((s) => (
            <div key={s.selectionId} className="bg-white border-b border-slate-100 py-3 relative group animate-in slide-in-from-right-2">
              <button 
                onClick={() => removeSelection(s.selectionId)}
                className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={14} />
              </button>
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">{s.marketName}</span>
                <p className="text-[13px] font-bold text-slate-900 leading-tight">{s.selectionName}</p>
                <p className="text-[10px] text-slate-500 font-medium truncate">{s.fixtureName}</p>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Odd</span>
                  <span className="text-sm font-bold text-slate-900">{s.displayedOdd.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selections.length > 0 && (
        <div className="p-4 bg-white border-t border-[#E5E7EB] space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cotação Total</span>
              <span className="text-lg font-bold text-slate-900">{previewTotalOdd.toFixed(2)}</span>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Valor da Aposta (R$)</label>
              <input 
                type="number" 
                value={stake}
                onChange={(e) => setStake(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-2 px-3 text-slate-900 font-bold text-base focus:border-emerald-500 outline-none"
              />
            </div>
            
            <div className="bg-emerald-50 border border-emerald-100 rounded-[6px] p-3 flex justify-between items-center">
              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Retorno Possível</span>
              <span className="text-base font-bold text-emerald-700">R$ {(stake * previewTotalOdd).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Info size={12} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[8px] text-slate-500 font-medium leading-relaxed uppercase">
              As odds serão verificadas novamente na confirmação.
            </p>
          </div>

          <div className="space-y-2">
            <Button 
              onClick={handleContinue}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest rounded-[8px]"
            >
              Continuar
            </Button>
            <button onClick={clearBetSlip} className="w-full text-[9px] text-slate-400 hover:text-slate-600 font-bold uppercase tracking-widest flex items-center justify-center gap-1">
              <Trash2 size={10} /> Limpar bilhete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
