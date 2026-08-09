import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Save, ShieldCheck, Zap, Globe, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { prepareFixtureMarkets, updateMarketSelection, updateMarketStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/mercados/$fixtureId")({
  component: AdminMarketManagerPage,
});

function AdminMarketManagerPage() {
  const { fixtureId } = useParams({ from: "/admin/mercados/$fixtureId" });
  const [fixture, setFixture] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    const { data: fData } = await supabase.from("fixtures").select("*").eq("provider_fixture_id", parseInt(fixtureId)).single();
    if (fData) setFixture(fData);
    const { data: mData } = await supabase.from("fixture_markets").select("*, fixture_market_selections(*)").eq("fixture_id", parseInt(fixtureId)).order('created_at', { ascending: true });
    setMarkets(mData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [fixtureId]);

  const handlePrepareMatch = async () => {
    setActionLoading(true);
    try {
      await prepareFixtureMarkets({ data: { fixture_id: parseInt(fixtureId) } });
      toast.success("Partida preparada com mercados em DRAFT.");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateOdd = async (selectionId: string, odd: string) => {
    const numericOdd = parseFloat(odd);
    if (odd !== "" && (isNaN(numericOdd) || numericOdd < 1.01)) return;
    try {
      await updateMarketSelection({ 
        data: { 
          selectionId, 
          odd: odd === "" ? null : numericOdd, 
          action: 'UPDATE_ODD' 
        } 
      });
      toast.success("Odd atualizada");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao atualizar odd");
    }
  };

  const handlePublishMarket = async (marketId: string) => {
    const market = markets.find(m => m.id === marketId);
    const allOddsSet = market.fixture_market_selections.every((s: any) => s.odd >= 1.01);
    
    if (!allOddsSet) {
      toast.error("Defina todas as odds antes de publicar");
      return;
    }

    setActionLoading(true);
    try {
      // Step 1: Update selections to OPEN
      for (const s of market.fixture_market_selections) {
        await updateMarketSelection({ data: { selectionId: s.id, status: 'OPEN', action: 'PUBLISH' } });
      }
      // Step 2: Update market to OPEN
      await updateMarketStatus({ data: { marketId, status: 'OPEN' } });
      
      toast.success("Mercado publicado com sucesso!");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao publicar mercado");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-600 w-8 h-8" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate({ to: "/admin/mercados" })} className="border-slate-200 rounded-full w-10 h-10 p-0 shadow-sm">
              <ArrowLeft size={18} />
            </Button>
            <div>
              <h1 className="text-xl font-black uppercase text-emerald-600 italic">Precificação de Odds</h1>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{fixture?.home_team_name} x {fixture?.away_team_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate({ to: `/jogo/${fixtureId}` as any })} variant="outline" className="border-slate-200 font-black uppercase text-[10px] h-10 rounded-xl shadow-sm">
              <Globe size={14} className="mr-2" /> Visualizar Jogo
            </Button>
            {markets.length === 0 && (
              <Button onClick={handlePrepareMatch} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] h-10 rounded-xl shadow-md">
                <Zap size={14} className="mr-2" /> Preparar Partida
              </Button>
            )}
          </div>
        </header>

        {markets.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-20 text-center space-y-6 shadow-sm">
            <AlertTriangle size={48} className="mx-auto text-amber-500 opacity-50" />
            <div className="max-w-md mx-auto">
              <h3 className="text-sm font-black uppercase text-slate-900">Nenhum mercado disponível</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 leading-relaxed">
                Clique em "Preparar Partida" para gerar os modelos de mercados em modo Rascunho.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map(m => (
              <div key={m.id} className={cn(
                "bg-white border rounded-3xl overflow-hidden shadow-sm flex flex-col",
                m.status === 'OPEN' ? "border-emerald-200" : "border-slate-200"
              )}>
                <div className={cn(
                  "px-6 py-4 border-b flex items-center justify-between",
                  m.status === 'OPEN' ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100"
                )}>
                  <h3 className="text-[10px] font-black uppercase text-slate-900 italic tracking-tight">{m.market_name}</h3>
                  <span className={cn(
                    "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                    m.status === 'OPEN' ? "bg-emerald-200 text-emerald-800" : "bg-amber-100 text-amber-800"
                  )}>
                    {m.status === 'OPEN' ? 'Publicado' : 'Draft'}
                  </span>
                </div>
                
                <div className="p-6 flex-1 space-y-4">
                  <div className="grid gap-3">
                    {m.fixture_market_selections.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between gap-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase flex-1">{s.selection_name}</span>
                        <div className="w-24">
                          <Input 
                            type="number" 
                            step="0.01" 
                            defaultValue={s.odd}
                            onBlur={(e) => handleUpdateOdd(s.id, e.target.value)}
                            className="bg-slate-50 border-slate-200 h-9 text-center font-black text-xs rounded-lg"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-slate-50/50 border-t border-slate-100">
                  <Button 
                    onClick={() => handlePublishMarket(m.id)}
                    disabled={m.status === 'OPEN' || actionLoading}
                    className={cn(
                      "w-full font-black uppercase text-[10px] h-10 rounded-xl shadow-sm transition-all",
                      m.status === 'OPEN' ? "bg-slate-100 text-slate-400" : "bg-emerald-600 hover:bg-emerald-500 text-white"
                    )}
                  >
                    {m.status === 'OPEN' ? (
                      <><ShieldCheck size={14} className="mr-2" /> Publicado</>
                    ) : (
                      'Publicar Mercado'
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
