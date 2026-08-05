import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/mercados")({
  component: () => (
    <div className="p-8">
      <h1 className="text-2xl font-black text-white mb-6 uppercase tracking-tight">Gestão de Mercados</h1>
      <p className="text-slate-400">Funcionalidade administrativa de mercados e odds em construção.</p>
    </div>
  )
});
