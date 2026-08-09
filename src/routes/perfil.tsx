import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireAuthenticatedUser } from "@/lib/auth-guard";
import { useAuth } from "@/hooks/use-auth";
import { User, Mail, Calendar, LogOut, Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/perfil")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const user = await requireAuthenticatedUser();
    if (!user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: ProfileComponent,
});

function ProfileComponent() {
  const { user, profile, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Sessão encerrada com sucesso.");
    } catch (error) {
      toast.error("Erro ao sair.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 text-slate-900 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-14 sm:h-16 gap-4">
          <a
            href="/"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-emerald-600"
          >
            <ArrowLeft size={24} />
          </a>
          <h1 className="text-sm sm:text-lg font-black uppercase tracking-tight leading-tight italic uppercase">
            Meu Perfil
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-8 space-y-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-100 shadow-sm">
            <User size={48} className="text-emerald-600" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">
              {profile?.name || "Usuário"}
            </h2>
            <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest">
              {profile?.role === "admin" ? "Administrador" : "Apostador Premium"}
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <Mail size={20} />
            </div>
            <div className="flex-1">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">
                E-mail
              </span>
              <span className="text-sm font-bold text-slate-900">
                {user?.email || profile?.phone || "Não informado"}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <Calendar size={20} />
            </div>
            <div className="flex-1">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">
                Membro desde
              </span>
              <span className="text-sm font-bold text-slate-900">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString("pt-BR")
                  : "-"}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-8">
          <Button
            onClick={handleLogout}
            variant="destructive"
            className="w-full py-6 rounded-2xl font-black uppercase tracking-widest border border-red-200 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm"
          >
            <LogOut size={20} className="mr-2" />
            Encerrar Sessão
          </Button>
        </div>
      </main>
    </div>
  );
}