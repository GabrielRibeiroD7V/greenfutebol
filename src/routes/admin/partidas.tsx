import { createFileRoute } from "@tanstack/react-router";
import { Calendar, RefreshCw, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/partidas" as any)({
  component: AdminPartidas,
});

function AdminPartidas() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Gestão de Partidas</h1>
          <p className="text-sm font-medium text-slate-500">Controle a sincronização e os status das fixtures</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <RefreshCw className="mr-2 h-4 w-4" />
            Sincronizar Agora
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3 text-emerald-600">
            <PlayCircle className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-wider">Partidas Ativas</span>
          </div>
          <div className="text-3xl font-black text-slate-900">0</div>
          <p className="mt-1 text-xs font-medium text-slate-500">Partidas em andamento no momento</p>
        </div>
        
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3 text-blue-600">
            <Calendar className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-wider">Agendadas</span>
          </div>
          <div className="text-3xl font-black text-slate-900">0</div>
          <p className="mt-1 text-xs font-medium text-slate-500">Partidas futuras no banco de dados</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">Monitor de Fixtures</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm font-medium text-slate-500">
          A interface de monitoramento detalhado de fixtures será carregada aqui.
        </p>
      </div>
    </div>
  );
}
