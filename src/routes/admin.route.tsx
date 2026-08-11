import { createFileRoute, redirect, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Loader2, ShieldCheck, Ticket, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminLayout,
});

function AdminLayout() {
  const { profile, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || profile?.role !== 'admin')) {
      navigate({ to: "/" });
    }
  }, [isLoading, isAuthenticated, profile, navigate]);

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-emerald-500" /></div>;

  if (profile?.role !== 'admin') return null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-800 md:flex-row">
      {/* Sidebar */}
      <aside className="sticky top-0 z-20 w-full border-b border-slate-200 bg-white md:h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 border-b border-slate-200 p-6">
          <ShieldCheck className="text-emerald-500" />
          <h2 className="font-black uppercase tracking-tighter text-slate-950">Painel Admin</h2>
        </div>
        
        <nav className="p-4 space-y-2">
          {[
            { label: 'Resultados', icon: BarChart3, to: '/admin/resultados' },
            { label: 'Bilhetes', icon: Ticket, to: '/admin/bilhetes' },
            { label: 'Mercados', icon: BarChart3, to: '/admin/mercados' },
            { label: 'Partidas', icon: BarChart3, to: '/admin/partidas' },
            { label: 'Usuários', icon: ShieldCheck, to: '/admin/usuarios' },
            { label: 'Voltar', icon: Settings, to: '/' },
          ].map((item) => (
            <button
              key={item.to}
              onClick={() => navigate({ to: item.to as any })}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm",
                window.location.pathname.startsWith(item.to) 
                  ? "bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]" 
                  : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
