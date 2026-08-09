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
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 bg-emerald-600 flex items-center justify-between shadow-sm">
        <h3 className="font-black italic text-white uppercase tracking-tight flex items-center gap-2">
          <Ticket size={18} />
          Bilhete
        </h3>
        <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded font-black uppercase">
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
            <div key={s.selectionId} className="bg-slate-50 border border-slate-200 rounded-xl p-3 relative group animate-in slide-in-from-right-2 shadow-sm">
              <button 
                onClick={() => removeSelection(s.selectionId)}
                className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={14} />
              </button>
              <div className="space-y-1">
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{s.marketName}</span>
                <p className="text-sm font-black text-slate-900 leading-none">{s.selectionName}</p>
                <p className="text-[10px] text-slate-500 font-bold truncate">{s.fixtureName}</p>
                <div className="flex justify-between items-end pt-1 border-t border-slate-200 mt-1">
                  <span className="text-[9px] text-slate-400 font-black uppercase">Odd</span>
                  <span className="text-base font-black text-emerald-600">{s.displayedOdd.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selections.length > 0 && (
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Cotação Total</span>
              <span className="text-xl font-black text-slate-900">{previewTotalOdd.toFixed(2)}</span>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Valor demonstrativo (R$)</label>
              <input 
                type="number" 
                value={stake}
                onChange={(e) => setStake(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-slate-900 font-black text-lg focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="bg-emerald-100/50 border border-emerald-100 rounded-xl p-3 flex justify-between items-center">
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Retorno Possível</span>
              <span className="text-lg font-black text-emerald-700">R$ {(stake * previewTotalOdd).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-100 p-2 rounded-lg flex items-start gap-2 shadow-sm">
            <Info size={12} className="text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-[8px] text-zinc-500 font-bold leading-relaxed uppercase">
              As odds serão verificadas novamente na confirmação.
            </p>
          </div>

          <div className="space-y-2">
            <Button 
              onClick={handleContinue}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            >
              Continuar
            </Button>
            <button onClick={clearBetSlip} className="w-full text-[9px] text-zinc-600 hover:text-zinc-400 font-black uppercase tracking-widest flex items-center justify-center gap-1">
              <Trash2 size={10} /> Limpar bilhete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
