import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Plus, Save, Trash2, Edit2, AlertCircle, CheckCircle2, LayoutGrid, Users, ShieldCheck, ShieldAlert, Search, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/mercados/$fixtureId")({
  component: AdminMarketManagerPage,
});

interface MarketTemplate {
  id: string;
  name: string;
  group: string;
  selections: string[];
  keys: string[];
  line?: number;
  isPlayerMarket?: boolean;
  playerMarketType?: string;
}

const MARKET_TEMPLATES: MarketTemplate[] = [
  { id: "1X2", name: "Resultado Final", group: "PRINCIPAIS", selections: ["Casa", "Empate", "Visitante"], keys: ["H", "D", "A"] },
  { id: "DC", name: "Dupla Chance", group: "PRINCIPAIS", selections: ["1X", "12", "X2"], keys: ["1X", "12", "X2"] },
  { id: "DNB", name: "Empate Anula", group: "PRINCIPAIS", selections: ["Casa", "Visitante"], keys: ["H", "A"] },
  { id: "BTTS", name: "Ambas Marcam", group: "PRINCIPAIS", selections: ["Sim", "Não"], keys: ["YES", "NO"] },
  { id: "OU", name: "Total de Gols", group: "GOLS", selections: ["Mais de 0.5", "Menos de 0.5", "Mais de 1.5", "Menos de 1.5", "Mais de 2.5", "Menos de 2.5"], keys: ["OVER_0.5", "UNDER_0.5", "OVER_1.5", "UNDER_1.5", "OVER_2.5", "UNDER_2.5"] },
  { id: "CS", name: "Placar Exato", group: "PLACAR", selections: ["1 x 0", "0 x 0", "0 x 1", "1 x 1", "2 x 0", "0 x 2", "2 x 1", "1 x 2", "2 x 2"], keys: ["1:0", "0:0", "0:1", "1:1", "2:0", "0:2", "2:1", "1:2", "2:2"] },
  { id: "CORNERS", name: "Escanteios", group: "ESCANTEIOS", selections: ["Mais de 8.5", "Menos de 8.5", "Mais de 9.5", "Menos de 9.5"], keys: ["OVER_8.5", "UNDER_8.5", "OVER_9.5", "UNDER_9.5"] },
  { id: "CARDS", name: "Cartões", group: "CARTÕES", selections: ["Mais de 3.5", "Menos de 3.5", "Mais de 4.5", "Menos de 4.5"], keys: ["OVER_3.5", "UNDER_3.5", "OVER_4.5", "UNDER_4.5"] },
  { id: "PLAYER_GOAL", name: "Marcar Gol", group: "JOGADORES", selections: [], keys: [], isPlayerMarket: true, playerMarketType: 'ANYTIME_GOALSCORER' },
  { id: "PLAYER_CARDS", name: "Receber Cartão", group: "JOGADORES", selections: [], keys: [], isPlayerMarket: true, playerMarketType: 'PLAYER_CARD' },
  { id: "PLAYER_ASSIST", name: "Dar Assistência", group: "JOGADORES", selections: [], keys: [], isPlayerMarket: true, playerMarketType: 'PLAYER_ASSIST' },
];

function PlayerMarketCreator({ template, players, isActionLoading, onConfirm }: any) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  return (
    <DialogContent className="bg-white border-slate-200 text-slate-900">
      <DialogHeader>
        <DialogTitle className="text-emerald-600 font-black uppercase">Selecione jogadores para {template.name}</DialogTitle>
      </DialogHeader>
      <div className="max-h-[300px] overflow-y-auto space-y-2">
        {players.map((p: any) => (
          <div key={p.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedIds(prev => prev.includes(p.player_id) ? prev.filter(id => id !== p.player_id) : [...prev, p.player_id])}>
            <input type="checkbox" checked={selectedIds.includes(p.player_id)} readOnly />
            <span className="text-xs font-bold">{p.players.name}</span>
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button onClick={() => onConfirm(selectedIds)} disabled={isActionLoading}>Confirmar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AdminMarketManagerPage() {
  const { fixtureId } = useParams({ from: "/admin/mercados/$fixtureId" });
  const [fixture, setFixture] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [fixtureId]);

  const fetchData = async () => {
    setLoading(true);
    const { data: fData } = await supabase.from("fixtures").select("*").eq("provider_fixture_id", parseInt(fixtureId)).single();
    if (fData) setFixture(fData);
    const { data: mData } = await supabase.from("fixture_markets").select("*, fixture_market_selections(*)").eq("fixture_id", parseInt(fixtureId));
    setMarkets(mData || []);
    const { data: pData } = await supabase.from("fixture_players").select("*, players(*)").eq("fixture_id", parseInt(fixtureId));
    setPlayers(pData || []);
    setLoading(false);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex justify-between items-center pb-6 border-b border-slate-200">
           <Button variant="outline" onClick={() => navigate({ to: "/admin/mercados" })}><ArrowLeft size={16} /></Button>
           <h1 className="text-xl font-black text-emerald-600 uppercase">Gestão de Odds - {fixture?.home_team_name} x {fixture?.away_team_name}</h1>
        </header>
        <div className="grid grid-cols-2 gap-6">
          {markets.map(m => (
            <div key={m.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <h2 className="text-sm font-black uppercase text-slate-900">{m.market_name}</h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {m.fixture_market_selections.map((s: any) => (
                  <div key={s.id} className="p-2 bg-slate-50 rounded text-xs font-bold">{s.selection_name}: {s.odd}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}