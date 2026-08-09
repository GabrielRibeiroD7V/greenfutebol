import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Trophy, CheckCircle2, AlertCircle, Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/resultados")({
  component: AdminResultsPage,
});

function AdminResultsPage() {
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFixture, setSelectedFixture] = useState<any>(null);
  const [results, setResults] = useState<any>({
    home_score: 0,
    away_score: 0,
    first_half_home_score: 0,
    first_half_away_score: 0,
    home_corners: 0,
    away_corners: 0,
    home_cards: 0,
    away_cards: 0,
    status: 'FT'
  });
  
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchFixtures();
  }, [dateFilter]);

  const fetchFixtures = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fixtures')
        .select('*')
        .gte('kickoff_at', `${dateFilter}T00:00:00Z`)
        .lte('kickoff_at', `${dateFilter}T23:59:59Z`)
        .order('kickoff_at', { ascending: true });

      if (error) throw error;
      setFixtures(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFixture = async (fixture: any) => {
    setSelectedFixture(fixture);
    const { data } = await supabase
      .from('fixture_results')
      .select('*')
      .eq('fixture_id', fixture.provider_fixture_id)
      .single();
    
    if (data) {
      setResults({
        home_score: data.home_score ?? 0,
        away_score: data.away_score ?? 0,
        first_half_home_score: data.first_half_home_score ?? 0,
        first_half_away_score: data.first_half_away_score ?? 0,
        home_corners: data.home_corners ?? 0,
        away_corners: data.away_corners ?? 0,
        home_cards: data.home_cards ?? 0,
        away_cards: data.away_cards ?? 0,
        status: data.status || 'FT'
      });
    } else {
      setResults({
        home_score: 0,
        away_score: 0,
        first_half_home_score: 0,
        first_half_away_score: 0,
        home_corners: 0,
        away_corners: 0,
        home_cards: 0,
        away_cards: 0,
        status: 'FT'
      });
    }
  };

  const saveResult = async () => {
    if (!selectedFixture) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('fixture_results')
        .upsert({
          fixture_id: selectedFixture.provider_fixture_id,
          ...results,
          result_source: 'MANUAL',
          updated_at: new Date().toISOString()
        }, { onConflict: 'fixture_id' });

      if (error) throw error;
      toast.success("Resultado salvo com sucesso!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const settleFixture = async () => {
    if (!selectedFixture) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('settle_fixture_atomic', {
        _fixture_id: Number(selectedFixture.provider_fixture_id),
        _admin_id: user?.id || undefined
      } as any);

      if (error) throw error;
      const result = data as any;
      toast.success(`Liquidação concluída! ${result?.settled_count || 0} seleções processadas.`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 pb-32 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate({ to: "/admin/mercados" })}
              className="border-slate-200 hover:bg-slate-100 rounded-full w-10 h-10 p-0 text-slate-600 shadow-sm"
            >
              <ArrowLeft size={18} />
            </Button>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-emerald-600 italic">Resultados e Liquidação</h1>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Painel Administrativo • GreenFutebol</p>
            </div>
          </div>
        </header>

        <section className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-4">
            <div className="bg-white border border-slate-200 p-4 rounded-3xl space-y-4 shadow-sm">
              <Input 
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-white border-slate-200 h-10 rounded-xl text-xs font-black uppercase text-slate-900"
              />
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {fixtures.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleSelectFixture(f)}
                    className={cn(
                      "w-full p-4 text-left hover:bg-slate-50 transition-all flex flex-col gap-2 rounded-xl",
                      selectedFixture?.id === f.id && "bg-emerald-50 border border-emerald-100 shadow-sm"
                    )}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] font-black uppercase text-slate-400">{f.competition_name}</span>
                      <span className="text-[8px] font-black uppercase text-slate-500 italic">
                        {new Date(f.kickoff_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-[10px] font-black uppercase truncate italic text-slate-900">
                      {f.home_team_name} x {f.away_team_name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-6">
            {!selectedFixture ? (
              <div className="h-full bg-white/50 border border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center opacity-50 py-20 min-h-[400px]">
                <AlertCircle size={32} className="mb-2 text-slate-300" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Selecione uma partida para gerenciar resultados</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-8 shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-6">
                    <div className="text-center space-y-2">
                      <img src={selectedFixture.home_team_crest} className="w-12 h-12 mx-auto" alt="" />
                      <p className="text-xs font-black uppercase italic text-slate-900">{selectedFixture.home_team_name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Input 
                        type="number"
                        value={results.home_score}
                        onChange={e => setResults({...results, home_score: parseInt(e.target.value) || 0})}
                        className="w-16 h-16 bg-white border-emerald-200 text-center font-black text-2xl text-emerald-600 rounded-2xl shadow-sm focus:ring-emerald-500"
                      />
                      <span className="text-slate-300 font-black italic">X</span>
                      <Input 
                        type="number"
                        value={results.away_score}
                        onChange={e => setResults({...results, away_score: parseInt(e.target.value) || 0})}
                        className="w-16 h-16 bg-white border-emerald-200 text-center font-black text-2xl text-emerald-600 rounded-2xl shadow-sm focus:ring-emerald-500"
                      />
                    </div>
                    <div className="text-center space-y-2">
                      <img src={selectedFixture.away_team_crest} className="w-12 h-12 mx-auto" alt="" />
                      <p className="text-xs font-black uppercase italic text-slate-900">{selectedFixture.away_team_name}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block text-center">Intervalo (Mandante)</label>
                      <Input 
                        type="number"
                        value={results.first_half_home_score}
                        onChange={e => setResults({...results, first_half_home_score: parseInt(e.target.value) || 0})}
                        className="bg-white border-slate-200 text-center font-black text-slate-900 shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block text-center">Intervalo (Visitante)</label>
                      <Input 
                        type="number"
                        value={results.first_half_away_score}
                        onChange={e => setResults({...results, first_half_away_score: parseInt(e.target.value) || 0})}
                        className="bg-white border-slate-200 text-center font-black text-slate-900 shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block text-center">Escanteios (Mandante)</label>
                      <Input 
                        type="number"
                        value={results.home_corners}
                        onChange={e => setResults({...results, home_corners: parseInt(e.target.value) || 0})}
                        className="bg-white border-slate-200 text-center font-black text-slate-900 shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block text-center">Escanteios (Visitante)</label>
                      <Input 
                        type="number"
                        value={results.away_corners}
                        onChange={e => setResults({...results, away_corners: parseInt(e.target.value) || 0})}
                        className="bg-white border-slate-200 text-center font-black text-slate-900 shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button 
                      onClick={saveResult} 
                      disabled={loading}
                      className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 font-black uppercase text-[10px] h-12 rounded-xl shadow-sm"
                    >
                      <Save size={14} className="mr-2" /> Salvar Resultado
                    </Button>
                    <Button 
                      onClick={settleFixture} 
                      disabled={loading}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] h-12 rounded-xl shadow-md transition-all active:scale-[0.98]"
                    >
                      <CheckCircle2 size={14} className="mr-2" /> Liquidar Partida
                    </Button>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl space-y-2 shadow-sm">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Atenção</span>
                  </div>
                  <p className="text-[9px] text-amber-800 font-bold leading-relaxed uppercase">
                    A LIQUIDAÇÃO É IRREVERSÍVEL PARA OS SALDOS DOS USUÁRIOS. 
                    CERTIFIQUE-SE DE QUE O PLACAR E AS ESTATÍSTICAS ESTEJAM 100% CORRETOS CONFORME A SÚMULA OFICIAL.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}