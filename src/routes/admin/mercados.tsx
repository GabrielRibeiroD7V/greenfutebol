import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Filter, Calendar, Trophy, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/mercados")({
  component: AdminFixtureListPage,
});

const TIMEZONE = "America/Campo_Grande";

function AdminFixtureListPage() {
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [competitionFilter, setCompetitionFilter] = useState("");
  const [selectedFixtures, setSelectedFixtures] = useState<number[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchFixtures();
  }, [dateFilter]);

  const fetchFixtures = async () => {
    setLoading(true);
    try {
      // Prioridade: Buscar partidas persistidas da nossa tabela
      const { data: persistentFixtures, error: dbError } = await supabase
        .from('fixtures')
        .select('*')
        .gte('kickoff_at', `${dateFilter}T00:00:00Z`)
        .lte('kickoff_at', `${dateFilter}T23:59:59Z`)
        .order('kickoff_at', { ascending: true });

      if (dbError) throw dbError;

      // Buscar mercados para mostrar contagem
      const fixtureIds = persistentFixtures?.map(f => f.provider_fixture_id) || [];
      const { data: marketsData } = await supabase
        .from('fixture_markets')
        .select('fixture_id, id')
        .in('fixture_id', fixtureIds);

      const marketCounts = (marketsData || []).reduce((acc: any, curr) => {
        acc[curr.fixture_id] = (acc[curr.fixture_id] || 0) + 1;
        return acc;
      }, {});

      const formatted = persistentFixtures?.map(f => ({
        fixture_id: f.provider_fixture_id,
        league_name: f.competition_name,
        home_team_name: f.home_team_name,
        home_team_logo: f.home_team_crest,
        away_team_name: f.away_team_name,
        away_team_logo: f.away_team_crest,
        kickoff_at: f.kickoff_at,
        status_long: f.status,
        status_short: f.status,
        market_count: marketCounts[f.provider_fixture_id] || 0
      })) || [];

      setFixtures(formatted);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar partidas");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/public/sync-fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateFilter })
      });

      if (!response.ok) throw new Error(await response.text());
      
      const result = await response.json();
      toast.success(`${result.count} partidas sincronizadas com sucesso!`);
      fetchFixtures();
    } catch (err: any) {
      toast.error(`Erro na sincronização: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedFixtures(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedFixtures.length === filteredFixtures.length) {
      setSelectedFixtures([]);
    } else {
      setSelectedFixtures(filteredFixtures.map(f => f.fixture_id));
    }
  };

  const prepareBatchMarkets = async () => {
    if (selectedFixtures.length === 0) return;
    
    setLoading(true);
    try {
      const { data: result, error } = await supabase.rpc('prepare_fixture_markets_batch', {
        p_fixture_ids: selectedFixtures
      });

      if (error) throw error;
      
      toast.success(`${selectedFixtures.length} partidas preparadas com sucesso.`);
      setSelectedFixtures([]);
      fetchFixtures();
    } catch (err: any) {
      toast.error(`Erro ao preparar mercados: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredFixtures = fixtures.filter(f => {
    const matchesSearch = searchTerm === "" || 
      f.home_team_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      f.away_team_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesComp = competitionFilter === "" || 
      f.league_name.toLowerCase().includes(competitionFilter.toLowerCase());

    return matchesSearch && matchesComp;
  });

  const formatDate = (isoString: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      day: "2-digit", month: "2-digit", year: "numeric"
    }).format(new Date(isoString));
  };

  const formatTime = (isoString: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      hour: "2-digit", minute: "2-digit"
    }).format(new Date(isoString));
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-emerald-500">Gestão de Mercados</h1>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Painel Administrativo • GreenFutebol</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => navigate({ to: "/" })} 
              variant="outline" 
              className="border-white/10 text-zinc-400 hover:bg-white/5 font-black uppercase text-[10px]"
            >
              Voltar ao Site
            </Button>
            <Button 
              onClick={fetchFixtures} 
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-black font-black uppercase text-[10px]"
            >
              <RefreshCw size={14} className={cn("mr-2", loading && "animate-spin")} />
              Sincronizar
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-900/50 border border-white/5 p-6 rounded-3xl backdrop-blur-md">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Buscar Time</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
              <Input 
                placeholder="Ex: Grêmio..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-black border-white/10 pl-10 h-12 rounded-xl focus:ring-emerald-500/20"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Data</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
              <Input 
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-black border-white/10 pl-10 h-12 rounded-xl focus:ring-emerald-500/20"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Competição</label>
            <div className="relative">
              <Trophy className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
              <Input 
                placeholder="Ex: Brasileirão..." 
                value={competitionFilter}
                onChange={(e) => setCompetitionFilter(e.target.value)}
                className="bg-black border-white/10 pl-10 h-12 rounded-xl focus:ring-emerald-500/20"
              />
            </div>
          </div>
        </section>

        <div className="bg-zinc-900/50 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md">
          <div className="p-4 border-b border-white/5 bg-zinc-900/80 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Partidas Disponíveis</h3>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full font-black uppercase">
              {filteredFixtures.length} Encontradas
            </span>
          </div>
          
          <div className="divide-y divide-white/5">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-50">
                <Loader2 className="animate-spin text-emerald-500" size={32} />
                <p className="text-[10px] font-black uppercase tracking-widest">Buscando na API...</p>
              </div>
            ) : filteredFixtures.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-30">
                <AlertCircle size={32} />
                <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma partida para os filtros aplicados</p>
              </div>
            ) : (
              <div className="p-4 bg-zinc-900/80 border-b border-white/5 flex items-center gap-4">
                <Button 
                  onClick={toggleAll}
                  variant="outline" 
                  className="border-white/10 text-zinc-400 hover:bg-white/5 font-black uppercase text-[10px] h-8"
                >
                  {selectedFixtures.length === filteredFixtures.length ? "Desmarcar Todos" : "Selecionar Todos"}
                </Button>
                {selectedFixtures.length > 0 && (
                  <Button 
                    onClick={prepareBatchMarkets}
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-black font-black uppercase text-[10px] h-8"
                  >
                    Preparar Mercados ({selectedFixtures.length})
                  </Button>
                )}
              </div>
              
              <div className="divide-y divide-white/5">
                {loading ? (
                  <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-50">
                    <Loader2 className="animate-spin text-emerald-500" size={32} />
                    <p className="text-[10px] font-black uppercase tracking-widest">Processando...</p>
                  </div>
                ) : filteredFixtures.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-30">
                    <AlertCircle size={32} />
                    <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma partida para os filtros aplicados</p>
                  </div>
                ) : (
                  filteredFixtures.map(f => (
                    <div key={f.fixture_id} className={cn(
                      "p-4 md:p-6 hover:bg-white/5 transition-colors group flex items-start gap-4",
                      selectedFixtures.includes(f.fixture_id) && "bg-emerald-500/5"
                    )}>
                      <div className="pt-2">
                        <input 
                          type="checkbox" 
                          checked={selectedFixtures.includes(f.fixture_id)}
                          onChange={() => toggleSelection(f.fixture_id)}
                          className="w-5 h-5 rounded border-white/10 bg-black text-emerald-500 focus:ring-emerald-500/20 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                              {f.league_name}
                            </span>
                            <span className="text-[9px] font-black uppercase text-zinc-600">
                              ID: {f.fixture_id}
                            </span>
                            {f.market_count > 0 && (
                              <span className="text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">
                                {f.market_count} Mercados
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                              <img src={f.home_team_logo} className="w-8 h-8 opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                              <span className="text-lg font-black uppercase tracking-tighter italic">{f.home_team_name}</span>
                            </div>
                            <span className="text-zinc-700 font-black italic">VS</span>
                            <div className="flex items-center gap-3">
                              <img src={f.away_team_logo} className="w-8 h-8 opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                              <span className="text-lg font-black uppercase tracking-tighter italic">{f.away_team_name}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="text-right space-y-1">
                            <p className="text-xs font-black uppercase text-zinc-300">{formatDate(f.kickoff_at)}</p>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{formatTime(f.kickoff_at)}</p>
                          </div>
                          <div className="text-right space-y-1">
                            <span className={cn(
                              "text-[9px] font-black uppercase px-2 py-0.5 rounded block text-center",
                              f.status_short === 'FT' ? "bg-red-500/10 text-red-500" : 
                              f.status_short === 'NS' ? "bg-emerald-500/10 text-emerald-500" :
                              "bg-amber-500/10 text-amber-500"
                            )}>
                              {f.status_long}
                            </span>
                            <span className="text-[8px] font-bold text-zinc-600 uppercase block text-center mt-1">
                              {f.market_count > 0 ? "Em Preparação" : "Sem Mercados"}
                            </span>
                          </div>
                          <Button 
                            onClick={() => navigate({ to: `/admin/mercados/${f.fixture_id}` })}
                            className="bg-zinc-800 hover:bg-emerald-600 text-white font-black uppercase text-[10px] h-12 px-6 rounded-xl group-hover:bg-emerald-600 transition-colors"
                          >
                            Gerenciar
                            <ChevronRight size={16} className="ml-2" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
