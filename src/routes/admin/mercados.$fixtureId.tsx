import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Plus, Save, Trash2, Edit2, AlertCircle, CheckCircle2, LayoutGrid, X, Power, PowerOff, ListPlus, Settings2, Trophy, UserPlus, Users, ShieldCheck, ShieldAlert, Search } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/mercados/$fixtureId")({
  component: AdminMarketManagerPage,
});

const MARKET_TEMPLATES = [
  { id: "1X2", name: "Resultado Final", group: "RESULT", selections: ["Casa", "Empate", "Visitante"], keys: ["H", "D", "A"] },
  { id: "DC", name: "Dupla Chance", group: "RESULT", selections: ["Casa ou Empate", "Casa ou Visitante", "Empate ou Visitante"], keys: ["1X", "12", "X2"] },
  { id: "DNB", name: "Empate Anula", group: "RESULT", selections: ["Casa", "Visitante"], keys: ["H", "A"] },
  { id: "OU", name: "Total de Gols", group: "GOALS", selections: ["Mais de 2.5", "Menos de 2.5"], keys: ["OVER", "UNDER"], line: 2.5 },
  { id: "BTTS", name: "Ambas Marcam", group: "GOALS", selections: ["Sim", "Não"], keys: ["YES", "NO"] },
  { id: "CS", name: "Placar Exato", group: "SCORE", selections: ["1 x 0", "0 x 0", "0 x 1"], keys: ["1:0", "0:0", "0:1"] },
  { id: "CORNERS", name: "Escanteios", group: "CORNERS", selections: ["Mais de 9.5", "Menos de 9.5"], keys: ["OVER", "UNDER"], line: 9.5 },
  { id: "CARDS", name: "Cartões", group: "CARDS", selections: ["Mais de 4.5", "Menos de 4.5"], keys: ["OVER", "UNDER"], line: 4.5 },
  { id: "CUSTOM", name: "Mercado Personalizado", group: "CUSTOM", selections: ["Opção 1"], keys: ["OP1"] },
  { id: "PLAYER_GOAL", name: "Jogador Marca Gol", group: "PLAYER", selections: [], keys: [], isPlayerMarket: true, playerMarketType: 'ANYTIME_GOALSCORER' },
  { id: "PLAYER_CARDS", name: "Jogador Recebe Cartão", group: "PLAYER", selections: [], keys: [], isPlayerMarket: true, playerMarketType: 'PLAYER_CARD' },
  { id: "PLAYER_ASSIST", name: "Jogador Dá Assistência", group: "PLAYER", selections: [], keys: [], isPlayerMarket: true, playerMarketType: 'PLAYER_ASSIST' },
  { id: "PLAYER_SHOTS", name: "Finalizações do Jogador", group: "PLAYER", selections: [], keys: [], isPlayerMarket: true, playerMarketType: 'PLAYER_SHOTS', hasLine: true },
];

function AdminMarketManagerPage() {
  const { fixtureId } = useParams({ from: "/admin/mercados/$fixtureId" });
  const [fixture, setFixture] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [newPlayer, setNewPlayer] = useState({ name: "", team_side: "HOME", shirt_number: "", position: "" });
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [fixtureId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: fData, error: fError } = await supabase
        .from("fixtures")
        .select("*")
        .eq("provider_fixture_id", parseInt(fixtureId))
        .single();
      
      if (fData) {
        setFixture({
          fixture_id: fData.provider_fixture_id,
          home_team_name: fData.home_team_name,
          away_team_name: fData.away_team_name,
          kickoff_at: fData.kickoff_at,
          league_name: fData.competition_name,
          league_id: fData.competition_code
        });
      } else {
        // Fallback para cache se não persistido ainda
        const { data: cData } = await supabase.functions.invoke("get-football-fixture", {
          body: { fixture_id: parseInt(fixtureId) }
        });
        if (cData?.fixture) setFixture(cData.fixture);
      }

      const { data: mData, error: mError } = await supabase
        .from("fixture_markets")
        .select("*, fixture_market_selections(*)")
        .eq("fixture_id", parseInt(fixtureId))
        .order("created_at", { ascending: false });
      
      if (mError) throw mError;
      setMarkets(mData || []);

      const { data: pData, error: pError } = await supabase
        .from("fixture_players")
        .select("*, players(*)")
        .eq("fixture_id", parseInt(fixtureId));
      
      if (pError) throw pError;
      setPlayers(pData || []);
    } catch (err: any) {
      toast.error("Erro ao carregar dados: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addPlayer = async () => {
    if (!newPlayer.name) {
      toast.error("Nome é obrigatório");
      return;
    }
    setIsActionLoading(true);
    try {
      // 1. Create player globally if needed (simplified for manual)
      const { data: player, error: pError } = await supabase
        .from("players")
        .insert({
          name: newPlayer.name,
          provider: 'MANUAL'
        })
        .select()
        .single();
      
      if (pError) throw pError;

      // 2. Link to fixture
      const { error: fpError } = await supabase
        .from("fixture_players")
        .insert({
          fixture_id: parseInt(fixtureId),
          player_id: player.id,
          team_side: newPlayer.team_side,
          team_name: newPlayer.team_side === 'HOME' ? fixture.home_team_name : fixture.away_team_name,
          shirt_number: newPlayer.shirt_number ? parseInt(newPlayer.shirt_number) : null,
          position: newPlayer.position || null,
          source: 'MANUAL',
          status: 'AVAILABLE'
        });
      
      if (fpError) throw fpError;

      toast.success("Jogador adicionado");
      setNewPlayer({ name: "", team_side: "HOME", shirt_number: "", position: "" });
      setIsAddingPlayer(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const updatePlayerStatus = async (fpId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("fixture_players")
        .update({ status })
        .eq("id", fpId);
      if (error) throw error;
      toast.success("Status atualizado");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const addPlayerMarket = async (template: any, selectedPlayerIds: string[]) => {
    if (selectedPlayerIds.length === 0) return toast.error("Selecione pelo menos um jogador");
    setIsActionLoading(true);
    try {
      const marketData = {
        fixture_id: parseInt(fixtureId),
        competition_code: fixture.league_id.toString(),
        market_type: template.id,
        market_name: template.name,
        market_group: template.group,
        status: "DRAFT", // Manual player markets start as DRAFT
        kickoff_at: fixture.kickoff_at,
        home_team: fixture.home_team_name,
        away_team: fixture.away_team_name,
        period: "FULL_TIME"
      };

      const { data: market, error: mError } = await supabase
        .from("fixture_markets")
        .insert(marketData)
        .select()
        .single();

      if (mError) throw mError;

      const selections = selectedPlayerIds.map((pid, i) => {
        const fp = players.find(p => p.player_id === pid);
        return {
          market_id: market.id,
          selection_key: `PLAYER_${pid}`,
          selection_name: fp.players.name,
          odd: 1.90,
          sort_order: i,
          status: "OPEN",
          metadata: {
            player_id: pid,
            player_name: fp.players.name,
            team_side: fp.team_side,
            player_market_type: template.playerMarketType
          }
        };
      });

      const { error: sError } = await supabase
        .from("fixture_market_selections")
        .insert(selections);
      
      if (sError) throw sError;

      toast.success("Mercado de jogador criado em DRAFT");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const createMarket = async (template: typeof MARKET_TEMPLATES[0]) => {
    if (!fixture) return;
    setIsActionLoading(true);
    
    try {
      const marketData = {
        fixture_id: parseInt(fixtureId),
        competition_code: fixture.league_id.toString(),
        market_type: template.id,
        market_name: template.name,
        market_group: template.group,
        line: template.line || null,
        status: "OPEN",
        kickoff_at: fixture.kickoff_at,
        home_team: fixture.home_team_name,
        away_team: fixture.away_team_name,
        period: "FULL_TIME"
      };

      const { data: market, error: mError } = await supabase
        .from("fixture_markets")
        .insert(marketData)
        .select()
        .single();

      if (mError) throw mError;

      const selectionsData = template.selections.map((name, i) => ({
        market_id: market.id,
        selection_key: template.keys[i] || `OP${i+1}`,
        selection_name: name,
        odd: 1.90,
        sort_order: i,
        status: "OPEN"
      }));

      const { error: sError } = await supabase
        .from("fixture_market_selections")
        .insert(selectionsData);

      if (sError) throw sError;

      toast.success(`${template.name} criado com sucesso!`);
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao criar mercado: " + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const updateMarketStatus = async (marketId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("fixture_markets")
        .update({ status: newStatus })
        .eq("id", marketId);
      if (error) throw error;
      toast.success("Status do mercado atualizado");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateSelectionOdd = async (selectionId: string, odd: string) => {
    const val = parseFloat(odd);
    if (isNaN(val) || val <= 1.0) {
      toast.error("Odd inválida. Deve ser > 1.00");
      return;
    }
    try {
      const { error } = await supabase
        .from("fixture_market_selections")
        .update({ odd: val })
        .eq("id", selectionId);
      if (error) throw error;
      toast.success("Odd atualizada");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const addSelection = async (marketId: string, name: string, key: string, metadata: any = {}) => {
    try {
      const { error } = await supabase
        .from("fixture_market_selections")
        .insert({
          market_id: marketId,
          selection_name: name,
          selection_key: key,
          odd: 1.90,
          status: "OPEN",
          metadata
        });
      if (error) throw error;
      toast.success("Opção adicionada");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const addScoreSelection = async (marketId: string) => {
    const home = prompt("Gols Mandante:");
    const away = prompt("Gols Visitante:");
    if (home === null || away === null) return;
    const name = `${home} x ${away}`;
    const key = `${home}:${away}`;
    const metadata = { home_score: parseInt(home), away_score: parseInt(away) };
    addSelection(marketId, name, key, metadata);
  };

  const addLineSelection = async (market: any) => {
    const line = prompt("Qual a linha? (Ex: 1.5)");
    if (line === null) return;
    const l = parseFloat(line);
    
    // For Over/Under we usually add both
    try {
      await supabase
        .from("fixture_market_selections")
        .insert([
          { market_id: market.id, selection_name: `Mais de ${l}`, selection_key: `OVER_${l}`, odd: 1.90, status: "OPEN", metadata: { line: l, type: 'OVER' } },
          { market_id: market.id, selection_name: `Menos de ${l}`, selection_key: `UNDER_${l}`, odd: 1.90, status: "OPEN", metadata: { line: l, type: 'UNDER' } }
        ]);
      toast.success("Linhas adicionadas");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteMarket = async (marketId: string) => {
    if (!confirm("Tem certeza que deseja excluir este mercado? Bilhetes vinculados podem impedir a exclusão.")) return;
    try {
      const { error } = await supabase
        .from("fixture_markets")
        .delete()
        .eq("id", marketId);
      if (error) throw error;
      toast.success("Mercado excluído");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao excluir: Possui tickets vinculados.");
    }
  };



  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
      <Loader2 className="animate-spin text-emerald-500" size={48} />
      <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Carregando mercados...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate({ to: "/admin/mercados" })}
              className="border-white/10 hover:bg-white/5 rounded-full w-10 h-10 p-0"
            >
              <ArrowLeft size={18} />
            </Button>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-emerald-500">Gestão de Odds</h1>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Fixture ID: {fixtureId}</p>
            </div>
          </div>
          <div className="bg-zinc-900 border border-white/5 px-6 py-4 rounded-3xl flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-black uppercase italic">{fixture?.home_team_name}</p>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Mandante</p>
              </div>
              <span className="text-emerald-500 font-black italic">VS</span>
              <div>
                <p className="text-sm font-black uppercase italic">{fixture?.away_team_name}</p>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Visitante</p>
              </div>
            </div>
            <div className="border-l border-white/10 pl-6 space-y-1">
              <p className="text-[10px] font-black text-zinc-300 uppercase">{fixture?.league_name}</p>
              <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                {fixture?.kickoff_at && new Date(fixture.kickoff_at).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </header>

        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <LayoutGrid size={14} /> Adicionar Novo Mercado
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {MARKET_TEMPLATES.map(template => (
              <Button 
                key={template.id}
                disabled={isActionLoading}
                onClick={() => createMarket(template)}
                className="bg-zinc-900/50 hover:bg-emerald-600 border border-white/5 h-auto py-4 rounded-2xl flex flex-col gap-2 transition-all group"
              >
                <Plus size={16} className="text-zinc-600 group-hover:text-black" />
                <span className="text-[10px] font-black uppercase tracking-tighter group-hover:text-black">{template.name}</span>
              </Button>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Settings2 size={14} /> Mercados Ativos ({markets.length})
            </h3>
          </div>
          
          <div className="grid gap-6">
            {markets.length === 0 ? (
              <div className="py-20 bg-zinc-900/20 border border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center opacity-30">
                <AlertCircle size={32} className="mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Nenhum mercado cadastrado</p>
              </div>
            ) : (
              markets.map(m => (
                <div key={m.id} className="bg-zinc-900/50 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md">
                  <div className="p-4 bg-zinc-900/80 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                        <Trophy size={14} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-tight">{m.market_name} {m.line && <span className="text-emerald-500 ml-1">({m.line})</span>}</h4>
                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">{m.market_type} • {m.market_group}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select 
                        value={m.status}
                        onChange={(e) => updateMarketStatus(m.id, e.target.value)}
                        className={cn(
                          "bg-black border-white/10 text-[9px] font-black uppercase rounded-lg px-2 h-8 outline-none",
                          m.status === 'OPEN' ? "text-emerald-500" : m.status === 'SUSPENDED' ? "text-amber-500" : "text-red-500"
                        )}
                      >
                        <option value="OPEN">Aberto (OPEN)</option>
                        <option value="SUSPENDED">Suspenso (SUSPENDED)</option>
                        <option value="CLOSED">Fechado (CLOSED)</option>
                      </select>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => deleteMarket(m.id)}
                        className="text-zinc-600 hover:text-red-500 h-8 w-8 p-0"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {m.fixture_market_selections?.sort((a: any, b: any) => a.sort_order - b.sort_order).map((s: any) => (
                      <div key={s.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-black uppercase text-zinc-500 tracking-tight">{s.selection_name}</span>
                          <span className="text-[8px] font-black uppercase text-zinc-700">{s.selection_key}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Input 
                              type="number" 
                              step="0.01"
                              defaultValue={s.odd.toFixed(2)}
                              onBlur={(e) => updateSelectionOdd(s.id, e.target.value)}
                              className="bg-zinc-900 border-white/5 text-center font-black text-emerald-500 text-lg h-12 rounded-xl focus:ring-emerald-500/20"
                            />
                            <div className="absolute -top-1.5 -right-1.5 p-1 bg-zinc-800 border border-white/10 rounded-full shadow-lg">
                              <Edit2 size={8} className="text-zinc-400" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {m.market_type === 'CS' && (
                       <Button 
                         onClick={() => addScoreSelection(m.id)}
                         variant="outline" 
                         className="border-dashed border-white/10 text-zinc-600 hover:text-emerald-500 h-full rounded-2xl flex flex-col gap-1 py-4"
                       >
                         <Plus size={16} />
                         <span className="text-[9px] font-black uppercase">Adicionar Placar</span>
                       </Button>
                    )}

                    {(m.market_type === 'OU' || m.market_type === 'CORNERS' || m.market_type === 'CARDS') && (
                       <Button 
                         onClick={() => addLineSelection(m)}
                         variant="outline" 
                         className="border-dashed border-white/10 text-zinc-600 hover:text-emerald-500 h-full rounded-2xl flex flex-col gap-1 py-4"
                       >
                         <Plus size={16} />
                         <span className="text-[9px] font-black uppercase">Adicionar Linha</span>
                       </Button>
                    )}

                    {m.market_type === 'CUSTOM' && (
                       <Button 
                         onClick={() => {
                           const name = prompt("Nome da opção:");
                           if (name) addSelection(m.id, name, `OP_${Date.now()}`);
                         }}
                         variant="outline" 
                         className="border-dashed border-white/10 text-zinc-600 hover:text-emerald-500 h-full rounded-2xl flex flex-col gap-1 py-4"
                       >
                         <ListPlus size={16} />
                         <span className="text-[9px] font-black uppercase">Adicionar Opção</span>
                       </Button>
                    )}
                  </div>

                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
