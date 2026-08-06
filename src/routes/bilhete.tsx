import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { useAuth } from "@/hooks/use-auth";
import { Ticket, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bilhete")({
  component: BilhetePage,
});

function BilhetePage() {
  const { selections, totalOdd, stake, removeSelection, clearSlip } = useBetSlip();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (selections.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4">
        <Ticket size={64} className="text-zinc-800 mb-4" />
        <h2 className="text-xl font-black mb-2">Bilhete Vazio</h2>
        <Button onClick={() => navigate({ to: "/" })} variant="outline">Ir para Jogos</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-black italic text-emerald-500 mb-6 uppercase tracking-tighter">Rascunho do Bilhete</h1>
      
      <div className="space-y-4 mb-8">
        {selections.map((s) => (
          <div key={s.id} className="bg-zinc-900 border border-white/5 p-4 rounded-xl flex justify-between items-center">
            <div>
              <p className="font-bold text-sm">{s.label}</p>
              <p className="text-xs text-zinc-500">{s.market_name} • {s.home_team} x {s.away_team}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-black text-emerald-500">{s.odd.toFixed(2)}</span>
              <button onClick={() => removeSelection(s.id)} className="text-zinc-600 hover:text-red-500">Remover</button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl space-y-4">
        <div className="flex justify-between">
          <span className="text-zinc-500 font-bold">Odd Total Estimada</span>
          <span className="font-black text-lg">{totalOdd.toFixed(2)}</span>
        </div>
        
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex gap-3 text-amber-200 text-xs font-bold">
          <AlertCircle className="shrink-0" size={16} />
          As odds serão verificadas novamente na confirmação.
        </div>

        <Button disabled className="w-full h-12 bg-zinc-800 text-zinc-500 font-black uppercase tracking-widest">
          A confirmação do bilhete será disponibilizada na próxima etapa.
        </Button>
      </div>
    </div>
  );
}
