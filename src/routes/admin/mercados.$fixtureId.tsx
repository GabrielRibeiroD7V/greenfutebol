import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Plus, Save, Trash2, Edit2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/mercados/$fixtureId")({
  component: AdminMarketManagerPage,
});

function AdminMarketManagerPage() {
  const { fixtureId } = useParams({ from: "/admin/mercados/$fixtureId" });
  const [fixture, setFixture] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [fixtureId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: fData } = await supabase.functions.invoke("get-football-fixture", {
        body: { fixture_id: parseInt(fixtureId) }
      });
      if (fData?.fixture) setFixture(fData.fixture);

      const { data: mData } = await supabase
        .from("fixture_markets")
        .select("*, fixture_market_selections(*)")
        .eq("fixture_id", parseInt(fixtureId))
        .order("created_at", { ascending: false });
        
      setMarkets(mData || []);
    } catch (err: any) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const addMarket = async (type: string) => {
    // Basic implementation for adding a market template
    const market = {
      fixture_id: parseInt(fixtureId),
      competition_code: fixture.league_id.toString(),
      market_type: type,
      market_name: type,
      market_group: "PERSONALIZED",
      status: "OPEN",
      kickoff_at: fixture.kickoff_at,
      home_team: fixture.home_team_name,
      away_team: fixture.away_team_name
    };

    const { data, error } = await supabase
      .from("fixture_markets")
      .insert(market)
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar mercado");
      return;
    }
    fetchData();
    toast.success("Mercado criado!");
  };

  const updateSelectionOdd = async (sId: string, newOdd: number) => {
    const { error } = await supabase
      .from("fixture_market_selections")
      .update({ odd: newOdd })
      .eq("id", sId);
    
    if (error) toast.error("Erro ao atualizar odd");
    else {
      toast.success("Odd atualizada");
      fetchData();
    }
  };

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-emerald-500" /></div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2" /> Voltar
          </Button>
          <h1 className="text-xl font-black uppercase text-emerald-500">Gestão de Mercados #{fixtureId}</h1>
        </header>

        {fixture && (
          <div className="bg-zinc-900 p-6 rounded-2xl border border-white/5">
            <h2 className="text-2xl font-black">{fixture.home_team_name} vs {fixture.away_team_name}</h2>
            <p className="text-zinc-500">{fixture.league_name} • {new Date(fixture.kickoff_at).toLocaleString()}</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Resultado Final", "Total de Gols", "Ambas Marcam", "Personalizado"].map(t => (
            <Button key={t} onClick={() => addMarket(t)} className="bg-emerald-600 hover:bg-emerald-500 uppercase font-black text-[10px]">
              <Plus size={14} className="mr-2" /> {t}
            </Button>
          ))}
        </div>

        <div className="space-y-6">
          {markets.map(m => (
            <div key={m.id} className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black">{m.market_name}</h3>
                <span className="text-[10px] bg-zinc-800 px-2 py-1 rounded">{m.status}</span>
              </div>
              <div className="grid gap-2">
                {m.fixture_market_selections.map((s: any) => (
                  <div key={s.id} className="bg-black/40 p-4 rounded-lg flex items-center justify-between">
                    <span>{s.selection_name}</span>
                    <Input 
                      type="number" 
                      className="w-24 bg-zinc-900 border-zinc-700 text-center" 
                      defaultValue={s.odd.toFixed(2)}
                      onBlur={(e) => updateSelectionOdd(s.id, parseFloat(e.target.value))}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
