import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getMarketOperationalStatus } from "@/lib/market-admin";

export const Route = createFileRoute("/admin/mercados")({
  component: AdminMarketsPage,
});

interface AdminFixture {
  provider_fixture_id: number;
  competition_name: string;
  home_team_name: string;
  away_team_name: string;
  kickoff_at: string;
  marketCount: number;
  operationalStatus: string;
}

function AdminMarketsPage() {
  const navigate = useNavigate();
  const [fixtures, setFixtures] = useState<AdminFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFixtures = async () => {
    setLoading(true);
    setError(null);
    try {
      const client = supabase as any;
      const { data: fixtureRows, error: fixtureError } = await client
        .from("fixtures")
        .select("provider_fixture_id,competition_name,home_team_name,away_team_name,kickoff_at,status")
        .eq("status", "NS")
        .gt("kickoff_at", new Date().toISOString())
        .order("kickoff_at", { ascending: true });
      if (fixtureError) throw fixtureError;

      const fixtureIds = (fixtureRows || []).map((fixture: any) => fixture.provider_fixture_id);
      let marketRows: any[] = [];
      if (fixtureIds.length > 0) {
        const { data, error: marketError } = await client
          .from("fixture_markets")
          .select("fixture_id,status")
          .in("fixture_id", fixtureIds);
        if (marketError) throw marketError;
        marketRows = data || [];
      }

      setFixtures(
        (fixtureRows || []).map((fixture: any) => {
          const statuses = marketRows
            .filter((market) => market.fixture_id === fixture.provider_fixture_id)
            .map((market) => market.status);
          return {
            ...fixture,
            marketCount: statuses.length,
            operationalStatus: getMarketOperationalStatus(statuses),
          };
        }),
      );
    } catch (loadError) {
      console.error(loadError);
      setError("Não foi possível carregar as fixtures futuras.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFixtures();
  }, []);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Gestão de Mercados</h1>
          <p className="text-sm text-slate-500">Preparação, precificação e publicação manual.</p>
        </div>
        <Button onClick={loadFixtures} variant="outline" className="border-slate-200" disabled={loading}>
          <RefreshCw className={loading ? "mr-2 animate-spin" : "mr-2"} size={16} /> Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" /></div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-red-300">
          <AlertCircle size={20} /> {error}
        </div>
      ) : fixtures.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400">Nenhuma fixture futura elegível.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
          {fixtures.map((fixture) => (
            <button
              key={fixture.provider_fixture_id}
              onClick={() => navigate({ to: `/admin/mercados/${fixture.provider_fixture_id}` as any })}
              className="grid w-full gap-3 border-b border-slate-100 bg-white p-5 text-left transition hover:bg-slate-50 md:grid-cols-[1fr_180px_160px_30px] md:items-center"
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{fixture.competition_name}</span>
                <div className="font-bold text-slate-900">{fixture.home_team_name} × {fixture.away_team_name}</div>
                <div className="text-xs text-slate-400">{new Date(fixture.kickoff_at).toLocaleString("pt-BR")}</div>
              </div>
              <div className="text-xs text-slate-500">{fixture.marketCount} mercados</div>
              <div className="text-xs font-black text-amber-600">{fixture.operationalStatus}</div>
              <ArrowRight size={18} className="text-slate-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
