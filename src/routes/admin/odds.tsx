import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Plus, Save, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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
      
      // Load existing markets
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
        // Check if market already exists to avoid duplicates
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
            competition_code: fixtureData.league_id.toString(), // Simplified
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
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-emerald-500">Gestão de Odds</h1>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Painel Administrativo GreenFutebol</p>
          </div>
          <div className="flex items-center gap-2">
            <Input 
              placeholder="Fixture ID (ex: 12345)" 
              value={fixtureId}
              onChange={(e) => setFixtureId(e.target.value)}
              className="bg-white/5 border-white/10 w-40"
            />
            <Button onClick={searchFixture} disabled={isSearching} className="bg-emerald-600 hover:bg-emerald-500">
              {isSearching ? <Loader2 className="animate-spin" /> : <Search size={18} />}
            </Button>
          </div>
        </header>

        {fixtureData && (
          <div className="bg-white/5 border border-white/5 rounded-2xl p-6 backdrop-blur-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xl font-black">{fixtureData.home_team_name}</p>
                </div>
                <span className="text-slate-700 italic">vs</span>
                <div className="text-center">
                  <p className="text-xl font-black">{fixtureData.away_team_name}</p>
                </div>
              </div>
              <Button 
                onClick={generateDefaultMarkets} 
                disabled={isLoading}
                variant="outline"
                className="border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10"
              >
                {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Plus size={18} className="mr-2" />}
                Gerar Mercados Padrão (DEMO)
              </Button>
            </div>

            <div className="space-y-4">
              {markets.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-xl">
                  <AlertCircle className="mx-auto text-slate-700 mb-2" size={32} />
                  <p className="text-slate-500 font-bold uppercase text-xs">Nenhum mercado cadastrado para esta partida.</p>
                </div>
              ) : (
                markets.map((m) => (
                  <div key={m.id} className="bg-black/40 border border-white/5 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-black uppercase tracking-tight text-sm text-emerald-400">{m.market_name}</h3>
                      <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-slate-500 font-black">{m.market_type}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {m.fixture_market_selections?.map((s: any) => (
                        <div key={s.id} className="bg-white/5 border border-white/5 p-3 rounded-lg flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-300">{s.selection_name}</span>
                          <span className="text-sm font-black text-emerald-500">{s.odd.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
