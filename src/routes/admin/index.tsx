import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  component: () => {
    return (
      <div className="p-8 text-white">
        <h1 className="text-2xl font-bold mb-4">Painel Administrativo</h1>
        <p>Selecione uma opção no menu lateral ou utilize as rotas específicas.</p>
      </div>
    );
  },
});
