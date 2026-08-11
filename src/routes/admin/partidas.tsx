import { createFileRoute } from "@tanstack/react-router";
import { Calendar, RefreshCw, PlayCircle, Loader2, AlertCircle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { getAdminFixturesSummary } from "@/lib/admin.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/partidas" as any)({
  component: AdminPartidas,
});

function AdminPartidas() {
  const [summary, setSummary] = useState({ active: 0, scheduled: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadSummary = async () => {
    try {
      const data = await getAdminFixturesSummary();
      setSummary(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-football-fixtures', {
        body: { sync_to_db: true }
      });
      
      if (error) throw error;
      toast.success("Sincronização iniciada com sucesso!");
      loadSummary();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao sincronizar: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8 bg-white min-h-screen">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Gestão de Partidas</h1>
          <p className="text-sm font-medium text-slate-500">Controle a sincronização e os status das fixtures</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] px-6 py-6"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sincronizar Agora
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-emerald-200 transition-all">
          <div className="mb-4 flex items-center gap-3 text-emerald-600">
            <PlayCircle className="h-5 w-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Partidas Ativas</span>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {loading ? <Loader2 className="h-8 w-8 animate-spin text-slate-200" /> : summary.active}
          </div>
          <p className="mt-1 text-[10px] font-black uppercase tracking-tighter text-slate-400">Em andamento no momento</p>
        </div>
        
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-200 transition-all">
          <div className="mb-4 flex items-center gap-3 text-blue-600">
            <Calendar className="h-5 w-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Agendadas</span>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {loading ? <Loader2 className="h-8 w-8 animate-spin text-slate-200" /> : summary.scheduled}
          </div>
          <p className="mt-1 text-[10px] font-black uppercase tracking-tighter text-slate-400">Próximos 14 dias no banco</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-emerald-50/50 p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3 text-emerald-600">
            <Database className="h-5 w-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Status da Cache</span>
          </div>
          <div className="text-sm font-black text-emerald-700 uppercase">Operacional</div>
          <p className="mt-1 text-[10px] font-black uppercase tracking-tighter text-emerald-600/60">Sincronização automática ativa</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white">
          <AlertCircle className="h-6 w-6 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 uppercase">Painel de Monitoramento</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm font-medium text-slate-500">
          Utilize o botão de sincronização acima para atualizar a base de dados com as últimas partidas das ligas BSA, PL, CL e BL1.
        </p>
      </div>
    </div>
  );
}
