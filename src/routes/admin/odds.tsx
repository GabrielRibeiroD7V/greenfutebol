import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Plus, Save, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/odds")({
  component: AdminOddsPage,
});

function AdminOddsPage() {
  const [fixtureId, setFixtureId] = useState("");
  const [fixtureData, setFixtureData] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const searchFixture = async () => {
    if (!fixtureId) return;
    setIsSearching(true);
    setFixtureData(null);
    setMarkets([]);
    
    try {
      const { data, error } = await supabase.functions.invoke("get-football-fixture", {
        body: { fixture_id: parseInt(fixtureId) }
      });

      if (error) throw error;
      setFixtureData(data.fixture);
      
      const { data: dbMarkets, error: marketsError } = await supabase
        .from("fixture_markets")
        .select("*, fixture_market_selections(*)")
        .eq("fixture_id", parseInt(fixtureId));
        
      if (marketsError) throw marketsError;
      setMarkets(dbMarkets || []);
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar partida");
    } finally {
      setIsSearching(false);
    }
  };

  const generateDefaultMarkets = async () => {
    if (!fixtureData) return;
    setIsLoading(true);
    
    const defaultTemplate = [
      {
        market_type: "1X2",
        market_name: "Resultado Final",
        market_group: "RESULT",
        selections: [
          { selection_key: "H", selection_name: "Casa", odd: 2.00 },
          { selection_key: "D", selection_name: "Empate", odd: 3.20 },
          { selection_key: "A", selection_name: "Fora", odd: 3.80 },
        ]
      },
      {
        market_type: "OU25",
        market_name: "Total de Gols (2.5)",
        market_group: "GOALS",
        line: 2.5,
        selections: [
          { selection_key: "OVER", selection_name: "Mais de 2.5", odd: 1.90 },
          { selection_key: "UNDER", selection_name: "Menos de 2.5", odd: 1.90 },
        ]
      }
    ];

    try {
      for (const m of defaultTemplate) {
        const { data: existing } = await supabase
          .from("fixture_markets")
          .select("id")
          .eq("fixture_id", fixtureData.fixture_id)
          .eq("market_type", m.market_type)
          .maybeSingle();

        if (existing) continue;

        const { data: market, error: mError } = await supabase
          .from("fixture_markets")
          .insert({
            fixture_id: fixtureData.fixture_id,
            competition_code: fixtureData.league_id.toString(),
            market_type: m.market_type,
            market_name: m.market_name,
            market_group: m.market_group,
            line: m.line || null,
          })
          .select()
          .single();

        if (mError) throw mError;

        const { error: sError } = await supabase
          .from("fixture_market_selections")
          .insert(
            m.selections.map((s, idx) => ({
              market_id: market.id,
              selection_key: s.selection_key,
              selection_name: s.selection_name,
              odd: s.odd,
              sort_order: idx
            }))
          );

        if (sError) throw sError;
      }
      
      toast.success("Mercados DEMO gerados com sucesso!");
      searchFixture();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar mercados");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-emerald-600 italic">Gestão de Odds</h1>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Painel Administrativo GreenFutebol</p>
          </div>
          <div className="flex items-center gap-2">
            <Input 
              placeholder="Fixture ID (ex: 12345)" 
              value={fixtureId}
              onChange={(e) => setFixtureId(e.target.value)}
              className="bg-white border-slate-200 w-44 shadow-sm"
            />
            <Button onClick={searchFixture} disabled={isSearching} className="bg-emerald-600 hover:bg-emerald-500 shadow-md">
              {isSearching ? <Loader2 className="animate-spin" /> : <Search size={18} />}
            </Button>
          </div>
        </header>

        {fixtureData && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4">
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6 border-b border-slate-100 pb-8">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xl font-black uppercase italic text-slate-900">{fixtureData.home_team_name}</p>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mandante</span>
                </div>
                <span className="text-slate-200 font-black italic text-2xl">vs</span>
                <div className="text-center">
                  <p className="text-xl font-black uppercase italic text-slate-900">{fixtureData.away_team_name}</p>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visitante</span>
                </div>
              </div>
              <Button 
                onClick={generateDefaultMarkets} 
                disabled={isLoading}
                variant="outline"
                className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-black uppercase text-[10px] tracking-widest h-12 px-6 rounded-xl"
              >
                {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Plus size={18} className="mr-2" />}
                Gerar Mercados Padrão
              </Button>
            </div>

            <div className="space-y-6">
              {markets.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl">
                  <AlertCircle className="mx-auto text-slate-200 mb-2" size={48} />
                  <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">Nenhum mercado cadastrado para esta partida.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {markets.map((m) => (
                    <div key={m.id} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 hover:border-emerald-100 transition-colors group">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-black uppercase tracking-tight text-sm text-slate-900 group-hover:text-emerald-600 transition-colors">{m.market_name}</h3>
                        <span className="text-[9px] bg-white border border-slate-200 px-3 py-1 rounded-full text-slate-500 font-black uppercase tracking-widest shadow-sm">{m.market_type}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {m.fixture_market_selections?.map((s: any) => (
                          <div key={s.id} className="bg-white border border-slate-100 p-3 rounded-xl flex justify-between items-center shadow-sm">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-tight">{s.selection_name}</span>
                            <span className="text-sm font-black text-emerald-600 italic">{s.odd.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}