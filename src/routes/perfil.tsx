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
    <div className="min-h-screen bg-[#050505] text-slate-200 font-sans">
      <header className="bg-black border-b border-emerald-500/10 text-white shadow-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-14 sm:h-16 gap-4">
          <a
            href="/"
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-emerald-500"
          >
            <ArrowLeft size={24} />
          </a>
          <h1 className="text-sm sm:text-lg font-black uppercase tracking-tight leading-tight">
            Meu Perfil
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-8 space-y-8">
        <div className="bg-white/5 rounded-3xl border border-white/5 p-8 text-center space-y-4 backdrop-blur-xl">
          <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
            <User size={48} className="text-emerald-500" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              {profile?.name || "Usuário"}
            </h2>
            <p className="text-emerald-500/70 font-bold text-xs uppercase tracking-widest">
              {profile?.role === "admin" ? "Administrador" : "Apostador Premium"}
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="bg-white/5 rounded-2xl border border-white/5 p-6 flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
              <Mail size={20} />
            </div>
            <div className="flex-1">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">
                E-mail
              </span>
              <span className="text-sm font-bold text-white">
                {user?.email || profile?.phone || "Não informado"}
              </span>
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl border border-white/5 p-6 flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
              <Calendar size={20} />
            </div>
            <div className="flex-1">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">
                Membro desde
              </span>
              <span className="text-sm font-bold text-white">
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
            className="w-full py-6 rounded-2xl font-black uppercase tracking-widest border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-[0_0_20px_rgba(239,68,68,0.1)]"
          >
            <LogOut size={20} className="mr-2" />
            Encerrar Sessão
          </Button>
        </div>
      </main>
    </div>
  );
}
