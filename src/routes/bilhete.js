import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { useAuth } from "@/hooks/use-auth";
import { Ticket, AlertCircle, ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/bilhete")({
    component: BilhetePage,
});
function BilhetePage() {
    const { selections, previewTotalOdd, stake, removeSelection, clearBetSlip } = useBetSlip();
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    if (selections.length === 0) {
        return (<div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4">
        <Ticket size={64} className="text-zinc-800 mb-4"/>
        <h2 className="text-xl font-black mb-2 uppercase tracking-tighter italic">Bilhete Vazio</h2>
        <Button onClick={() => navigate({ to: "/" })} variant="outline" className="border-emerald-500/20 text-emerald-500">Voltar para Jogos</Button>
      </div>);
    }
    return (<div className="min-h-screen bg-[#050505] text-white p-4 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate({ to: "/" })} className="p-2 hover:bg-white/5 rounded-full"><ArrowLeft size={20}/></button>
          <h1 className="text-2xl font-black italic text-emerald-500 uppercase tracking-tighter leading-none">Rascunho do Bilhete</h1>
        </div>
        <button onClick={clearBetSlip} className="text-[10px] font-black uppercase text-zinc-600 hover:text-red-500 flex items-center gap-1">
          <Trash2 size={12}/> Limpar
        </button>
      </header>
      
      <div className="space-y-4">
        {selections.map((s) => (<div key={s.selectionId} className="bg-zinc-900 border border-white/5 p-4 rounded-2xl flex justify-between items-center group relative">
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
              <button onClick={() => removeSelection(s.selectionId)} className="p-2 hover:bg-white/5 rounded-full text-zinc-600 hover:text-red-500 transition-colors">
                <X size={18}/>
              </button>
            </div>
          </div>))}
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
          <AlertCircle className="shrink-0 text-emerald-500" size={16}/>
          As odds serão verificadas novamente na confirmação. O valor demonstrativo não será persistido.
        </div>

        <div className="space-y-3">
          <Button disabled className="w-full h-14 bg-zinc-800 text-zinc-500 font-black uppercase tracking-widest rounded-xl cursor-not-allowed">
            Continuar para confirmação
          </Button>
          <p className="text-center text-[9px] font-black text-zinc-600 uppercase tracking-widest">
            A confirmação do bilhete será disponibilizada na próxima etapa.
          </p>
        </div>
      </div>
    </div>);
}
function X({ size }) {
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>);
}
