import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Pause, Play, Save, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseOddInput } from "@/lib/market-admin";

export const Route = createFileRoute("/admin/mercados/$fixtureId")({
  component: AdminMarketDetailPage,
});

interface MarketSelection {
  id: string;
  selection_name: string;
  odd: number | null;
  status: string;
  sort_order: number;
}

interface FixtureMarket {
  id: string;
  market_name: string;
  market_group: string;
  line: number | null;
  status: string;
  selections: MarketSelection[];
}

function AdminMarketDetailPage() {
  const { fixtureId } = useParams({ from: "/admin/mercados/$fixtureId" });
  const numericFixtureId = Number(fixtureId);
  const [fixture, setFixture] = useState<any>(null);
  const [markets, setMarkets] = useState<FixtureMarket[]>([]);
  const [oddInputs, setOddInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const client = supabase as any;
      const { data: fixtureRow, error: fixtureError } = await client
        .from("fixtures")
        .select("provider_fixture_id,competition_name,home_team_name,away_team_name,kickoff_at,status")
        .eq("provider_fixture_id", numericFixtureId)
        .single();
      if (fixtureError) throw fixtureError;

      const { data: marketRows, error: marketError } = await client
        .from("fixture_markets")
        .select("id,market_name,market_group,line,status")
        .eq("fixture_id", numericFixtureId)
        .order("created_at", { ascending: true });
      if (marketError) throw marketError;

      const marketIds = (marketRows || []).map((market: any) => market.id);
      let selectionRows: any[] = [];
      if (marketIds.length > 0) {
        const { data, error: selectionError } = await client
          .from("fixture_market_selections")
          .select("id,market_id,selection_name,odd,status,sort_order")
          .in("market_id", marketIds)
          .order("sort_order", { ascending: true });
        if (selectionError) throw selectionError;
        selectionRows = data || [];
      }

      const nextMarkets = (marketRows || []).map((market: any) => ({
        ...market,
        selections: selectionRows.filter((selection) => selection.market_id === market.id),
      }));
      const nextInputs: Record<string, string> = {};
      selectionRows.forEach((selection) => {
        nextInputs[selection.id] = selection.odd === null ? "" : String(selection.odd);
      });

      setFixture(fixtureRow);
      setMarkets(nextMarkets);
      setOddInputs(nextInputs);
    } catch (loadError) {
      console.error(loadError);
      setError("Não foi possível carregar a operação desta fixture.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!Number.isInteger(numericFixtureId) || numericFixtureId <= 0) {
      setError("Fixture inválida.");
      setLoading(false);
      return;
    }
    void load();
  }, [numericFixtureId]);

  const prepare = async () => {
    setSaving(true);
    try {
      const { error: rpcError } = await (supabase as any).rpc("prepare_fixture_markets", { p_fixture_id: numericFixtureId });
      if (rpcError) throw rpcError;
      toast.success("Estrutura DRAFT preparada.");
      await load();
    } catch (prepareError: any) {
      toast.error(prepareError.message || "Falha ao preparar mercados.");
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      for (const market of markets) {
        if (!['DRAFT', 'SUSPENDED'].includes(market.status)) continue;
        for (const selection of market.selections) {
          const odd = parseOddInput(oddInputs[selection.id] ?? "");
          const { error: rpcError } = await (supabase as any).rpc("update_market_selection_odd", {
            p_selection_id: selection.id,
            p_odd: odd,
          });
          if (rpcError) throw rpcError;
        }
      }
      toast.success("Rascunho salvo.");
      await load();
    } catch (saveError: any) {
      toast.error(saveError.message || "Falha ao salvar odds.");
    } finally {
      setSaving(false);
    }
  };

  const transition = async (marketId: string, status: "OPEN" | "SUSPENDED") => {
    setSaving(true);
    try {
      const { error: rpcError } = await (supabase as any).rpc("transition_fixture_market", {
        p_market_id: marketId,
        p_status: status,
      });
      if (rpcError) throw rpcError;
      toast.success(status === "OPEN" ? "Mercado publicado." : "Mercado suspenso.");
      await load();
    } catch (transitionError: any) {
      toast.error(transitionError.message || "Transição recusada pelo servidor.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-emerald-500" /></div>;
  if (error || !fixture) return <div className="m-8 flex items-center gap-3 rounded-xl border border-red-500/20 p-5 text-red-300"><AlertCircle /> {error}</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{fixture.competition_name}</span>
          <h1 className="text-2xl font-black text-white">{fixture.home_team_name} × {fixture.away_team_name}</h1>
          <p className="text-sm text-slate-400">{new Date(fixture.kickoff_at).toLocaleString("pt-BR")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={prepare} variant="outline" disabled={saving}><WandSparkles className="mr-2" size={16} /> Preparar partida</Button>
          <Button onClick={saveDraft} disabled={saving || markets.length === 0}><Save className="mr-2" size={16} /> Salvar rascunho</Button>
        </div>
      </div>

      {markets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-12 text-center text-slate-400">Sem mercados. Use “Preparar partida”.</div>
      ) : (
        <div className="space-y-5">
          {markets.map((market) => (
            <section key={market.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <h2 className="font-black text-white">{market.market_name}{market.line !== null ? ` ${market.line}` : ""}</h2>
                  <span className="text-[10px] font-black text-amber-400">{market.status}</span>
                </div>
                <div className="flex gap-2">
                  {market.status === "OPEN" ? (
                    <Button size="sm" variant="outline" onClick={() => transition(market.id, "SUSPENDED")} disabled={saving}><Pause className="mr-2" size={14} /> Suspender</Button>
                  ) : (
                    <Button size="sm" onClick={() => transition(market.id, "OPEN")} disabled={saving}><Play className="mr-2" size={14} /> {market.status === "SUSPENDED" ? "Reabrir" : "Publicar"}</Button>
                  )}
                </div>
              </header>
              <div className="grid gap-3 p-5 md:grid-cols-3">
                {market.selections.map((selection) => (
                  <label key={selection.id} className="space-y-2">
                    <span className="text-xs font-bold text-slate-300">{selection.selection_name}</span>
                    <Input
                      inputMode="decimal"
                      value={oddInputs[selection.id] ?? ""}
                      disabled={market.status === "OPEN" || saving}
                      placeholder="Sem preço"
                      onChange={(event) => setOddInputs((current) => ({ ...current, [selection.id]: event.target.value }))}
                      className="bg-black/40 text-white"
                    />
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
