import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Loader2, ShieldCheck, RefreshCw, Search, Save, PlayCircle, Eye, AlertTriangle, CheckCircle2, Trophy, Clock, Filter, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getFixtureResults, saveFixtureResult, previewSettlement, settleFixture } from "@/lib/settlement.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/resultados")({
  ssr: false,
  component: AdminResultsPage,
});

function AdminResultsPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [selectedFixture, setSelectedFixture] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    setLoading(true);
    try {
      const { results: data } = await getFixtureResults({ data: {} });
      setResults(data || []);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar resultados.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchFixture = async () => {
    if (!search) return;
    const fixtureId = parseInt(search);
    if (isNaN(fixtureId)) {
      toast.error("ID da partida deve ser um número.");
      return;
    }

    setLoading(true);
    try {
      // Find in local results first
      const existing = results.find(r => r.fixture_id === fixtureId);
      if (existing) {
        setSelectedFixture(existing);
      } else {
        // Mocking or fetching from API if not in results table yet
        // For simplicity in Phase 2A, we allow manual entry if ID is known
        setSelectedFixture({
          fixture_id: fixtureId,
          status: 'FINISHED',
          home_score: 0,
          away_score: 0,
          first_half_home_score: 0,
          first_half_away_score: 0,
          home_corners: null,
          away_corners: null,
          home_cards: null,
          away_cards: null
        });
      }
    } catch (e) {
      toast.error("Partida não encontrada.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (confirmed: boolean = false) => {
    if (!selectedFixture) return;
    setIsSaving(confirmed ? 'settle' : 'save' as any);
    try {
      await saveFixtureResult({ data: { ...selectedFixture, confirmed } });
      toast.success(confirmed ? "Resultado confirmado!" : "Rascunho salvo com sucesso.");
      loadResults();
      if (confirmed) {
        // Trigger preview after confirmation
        const { preview } = await previewSettlement({ data: { fixture_id: selectedFixture.fixture_id } });
        setPreviewData(preview);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar.");
    } finally {
      setIsSaving(false as any);
    }
  };

  const handleSettle = async () => {
    if (!selectedFixture) return;
    setIsSettling(true);
    try {
      const result = await settleFixture({ data: { fixture_id: selectedFixture.fixture_id } }) as any;
      if (result && result.success) {
        toast.success(`Liquidação concluída! ${result.settled_selections} seleções afetadas.`);
        setPreviewData(null);
        setSelectedFixture(null);
        loadResults();
      }
    } catch (e: any) {
      toast.error(e.message || "Erro na liquidação atômica.");
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <Trophy size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">Gestão de Resultados</h1>
              <p className="text-slate-500 text-sm">Liquidação de bilhetes e auditoria de placares.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate({ to: "/" as any })} variant="outline" className="border-slate-200">Home</Button>
            <Button onClick={loadResults} variant="outline" className="border-emerald-200 text-emerald-600 hover:bg-emerald-50">
              <RefreshCw size={16} className={cn("mr-2", loading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </header>

        <div className="grid lg:grid-cols-[400px_1fr] gap-8">
          {/* Sidebar: Search & Results List */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Search size={14} />
                Localizar Partida
              </h3>
              <div className="flex gap-2">
                <Input 
                  placeholder="ID da Fixture (ex: 12345)" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-emerald-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchFixture()}
                />
                <Button onClick={handleSearchFixture} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
                  Buscar
                </Button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Últimos Lançamentos</h3>
                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">{results.length}</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto no-scrollbar">
                {results.map(r => (
                  <div 
                    key={r.fixture_id} 
                    className={cn(
                      "p-4 hover:bg-slate-50 cursor-pointer transition-colors group",
                      selectedFixture?.fixture_id === r.fixture_id && "bg-emerald-50 border-l-2 border-l-emerald-600"
                    )}
                    onClick={() => {
                      setSelectedFixture(r);
                      setPreviewData(null);
                    }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-black text-slate-900">ID: {r.fixture_id}</span>
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded font-black uppercase",
                        r.confirmed_at ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      )}>
                        {r.confirmed_at ? 'Confirmado' : 'Rascunho'}
                      </span>
                    </div>
                    <div className="text-lg font-black text-slate-900 italic tracking-tighter">
                      {r.home_score} <span className="text-emerald-600/50 not-italic mx-1">x</span> {r.away_score}
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                      {new Date(r.updated_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                ))}
                {results.length === 0 && (
                  <div className="p-10 text-center text-slate-600">
                    <Clock size={24} className="mx-auto mb-2 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Nenhum resultado lançado</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content: Edit & Settlement */}
          <div className="space-y-6">
            {!selectedFixture ? (
              <div className="h-[400px] bg-white border border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 border-dashed shadow-sm">
                <ShieldCheck size={48} className="mb-4 opacity-10 text-emerald-600" />
                <p className="text-sm font-bold uppercase tracking-[0.2em]">Selecione uma partida para gerenciar</p>
              </div>
            ) : (
              <>
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                  <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Fixture #{selectedFixture.fixture_id}</h2>
                      <p className="text-slate-500 text-xs">Configure os dados oficiais da partida para liquidação.</p>
                    </div>
                    {selectedFixture.confirmed_at && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-200">
                        <CheckCircle2 size={14} />
                        Confirmado
                      </div>
                    )}
                  </div>

                  <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
                    {/* Score Inputs */}
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gols Mandante</label>
                          <Input 
                            type="number" 
                            value={selectedFixture.home_score ?? 0}
                            onChange={(e) => setSelectedFixture({...selectedFixture, home_score: parseInt(e.target.value)})}
                            className="bg-slate-50 border-slate-200 text-slate-900 text-xl font-black text-center"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gols Visitante</label>
                          <Input 
                            type="number" 
                            value={selectedFixture.away_score ?? 0}
                            onChange={(e) => setSelectedFixture({...selectedFixture, away_score: parseInt(e.target.value)})}
                            className="bg-slate-50 border-slate-200 text-slate-900 text-xl font-black text-center"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1º Tempo (Mandante)</label>
                          <Input 
                            type="number" 
                            value={selectedFixture.first_half_home_score ?? 0}
                            onChange={(e) => setSelectedFixture({...selectedFixture, first_half_home_score: parseInt(e.target.value)})}
                            className="bg-slate-50 border-slate-200 text-slate-900 font-bold text-center"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1º Tempo (Visitante)</label>
                          <Input 
                            type="number" 
                            value={selectedFixture.first_half_away_score ?? 0}
                            onChange={(e) => setSelectedFixture({...selectedFixture, first_half_away_score: parseInt(e.target.value)})}
                            className="bg-slate-50 border-slate-200 text-slate-900 font-bold text-center"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Stats Inputs */}
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escanteios (Mandante)</label>
                          <Input 
                            type="number" 
                            placeholder="N/A"
                            value={selectedFixture.home_corners ?? ""}
                            onChange={(e) => setSelectedFixture({...selectedFixture, home_corners: e.target.value ? parseInt(e.target.value) : null})}
                            className="bg-slate-50 border-slate-200 text-slate-900 text-center"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escanteios (Visitante)</label>
                          <Input 
                            type="number" 
                            placeholder="N/A"
                            value={selectedFixture.away_corners ?? ""}
                            onChange={(e) => setSelectedFixture({...selectedFixture, away_corners: e.target.value ? parseInt(e.target.value) : null})}
                            className="bg-slate-50 border-slate-200 text-slate-900 text-center"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cartões (Mandante)</label>
                          <Input 
                            type="number" 
                            placeholder="N/A"
                            value={selectedFixture.home_cards ?? ""}
                            onChange={(e) => setSelectedFixture({...selectedFixture, home_cards: e.target.value ? parseInt(e.target.value) : null})}
                            className="bg-slate-50 border-slate-200 text-slate-900 text-center text-amber-600 font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cartões (Visitante)</label>
                          <Input 
                            type="number" 
                            placeholder="N/A"
                            value={selectedFixture.away_cards ?? ""}
                            onChange={(e) => setSelectedFixture({...selectedFixture, away_cards: e.target.value ? parseInt(e.target.value) : null})}
                            className="bg-slate-50 border-slate-200 text-slate-900 text-center text-amber-600 font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-4">
                      <Button 
                        onClick={() => handleSave(false)} 
                        variant="outline" 
                        disabled={isSaving as any}
                        className="border-slate-200 hover:bg-white"
                      >
                        <Save size={16} className="mr-2" />
                        Salvar Rascunho
                      </Button>
                      <Button 
                        onClick={() => handleSave(true)} 
                        disabled={isSaving as any}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        <ShieldCheck size={16} className="mr-2" />
                        Confirmar Resultado
                      </Button>
                    </div>

                    {selectedFixture.confirmed_at && (
                      <Button 
                        onClick={async () => {
                          const { preview } = await previewSettlement({ data: { fixture_id: selectedFixture.fixture_id } });
                          setPreviewData(preview);
                        }}
                        variant="ghost"
                        className="text-emerald-600 hover:bg-emerald-50"
                      >
                        <Eye size={16} className="mr-2" />
                        Ver Prévia de Liquidação
                      </Button>
                    )}
                  </div>
                </div>

                {/* Preview Section */}
                {previewData && (
                  <div className="bg-white border border-emerald-200 rounded-3xl overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-500">
                    <div className="p-6 md:p-8 border-b border-emerald-100 flex items-center justify-between bg-emerald-50">
                      <div className="flex items-center gap-3">
                        <PlayCircle className="text-emerald-600 animate-pulse" />
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Prévia de Impacto</h3>
                      </div>
                      <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Simulação Atômica</div>
                    </div>
                    
                    <div className="p-6 md:p-8">
                      <div className="grid md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Seleções Afetadas</span>
                          <div className="text-2xl font-black text-slate-900">{previewData.affected_selections?.length || 0}</div>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                          <span className="text-[9px] text-emerald-600 font-black uppercase tracking-widest">Vencedoras (Est.)</span>
                          <div className="text-2xl font-black text-emerald-600">---</div>
                        </div>
                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                          <span className="text-[9px] text-red-600 font-black uppercase tracking-widest">Bilhetes Perdidos (Est.)</span>
                          <div className="text-2xl font-black text-red-600">---</div>
                        </div>
                      </div>

                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 no-scrollbar mb-8">
                        {previewData.affected_selections?.map((sel: any) => (
                          <div key={sel.selection_id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{sel.market}</div>
                              <div className="text-sm font-bold text-slate-900">{sel.option}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[9px] text-slate-400 font-bold uppercase">Status Atual</div>
                              <div className="text-xs font-black text-amber-600 uppercase tracking-widest">{sel.current_status}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6">
                        <AlertTriangle className="text-amber-600 shrink-0" size={32} />
                        <div className="flex-1">
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Atenção: Ação Irreversível</h4>
                          <p className="text-xs text-slate-500 mt-1">
                            A liquidação atualizará o status de todos os bilhetes vinculados a esta fixture. 
                            Certifique-se de que os placares estão corretos antes de prosseguir.
                          </p>
                        </div>
                        <Button 
                          onClick={handleSettle} 
                          disabled={isSettling}
                          className="bg-emerald-600 hover:bg-emerald-500 font-black uppercase tracking-widest h-12 px-8 shadow-lg shadow-emerald-500/20"
                        >
                          {isSettling ? <Loader2 className="animate-spin" /> : "Executar Liquidação"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}