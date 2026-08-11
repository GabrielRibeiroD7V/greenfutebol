import { createFileRoute } from "@tanstack/react-router";
import { Users, Search, Filter, Loader2, Phone, Mail, Calendar, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getAdminUsers } from "@/lib/admin.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/usuarios" as any)({
  component: AdminUsuarios,
});

function AdminUsuarios() {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { users: data } = await getAdminUsers({ data: { search: searchTerm } });
      setUsers(data || []);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadUsers, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div className="space-y-6 p-4 md:p-8 bg-white min-h-screen">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Gestão de Usuários</h1>
          <p className="text-sm font-medium text-slate-500">Visualize e gerencie os clientes da plataforma</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Nome ou telefone..." 
              className="pl-9 bg-slate-50 border-slate-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" className="border-slate-200">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-20 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white">
            <Users className="h-6 w-6 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Nenhum usuário encontrado</h3>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <div key={u.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-emerald-200 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                    {(u.name || "U").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 leading-none mb-1">{u.name}</h3>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                      <Shield size={10} className="text-emerald-500" />
                      {u.user_roles?.[0]?.role || 'user'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Phone size={14} className="text-slate-400" />
                  {u.phone || 'Sem telefone'}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Calendar size={14} className="text-slate-400" />
                  Membro desde {new Date(u.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex gap-2">
                <Button variant="outline" size="sm" className="w-full text-[10px] font-black uppercase tracking-widest border-slate-200">
                  Ver Bilhetes
                </Button>
                <Button variant="outline" size="sm" className="w-full text-[10px] font-black uppercase tracking-widest border-slate-200 hover:text-emerald-600">
                  Detalhes
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
