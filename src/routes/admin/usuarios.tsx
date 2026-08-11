import { createFileRoute } from "@tanstack/react-router";
import { Users, Search, Filter } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/usuarios" as any)({
  component: AdminUsuarios,
});

function AdminUsuarios() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Gestão de Usuários</h1>
          <p className="text-sm font-medium text-slate-500">Visualize e gerencie os clientes da plataforma</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Buscar por nome ou e-mail..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
          <Users className="h-6 w-6 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Listagem de Usuários</h3>
        <p className="mx-auto max-w-sm text-sm font-medium text-slate-500">
          Esta funcionalidade está sendo reestruturada para integrar diretamente com o Supabase Auth e Profiles.
        </p>
      </div>
    </div>
  );
}
