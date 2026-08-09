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

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-emerald-600" /></div>;

  if (profile?.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 bg-white z-20 sticky top-0 md:h-screen shadow-sm">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <ShieldCheck className="text-emerald-600" />
          <h2 className="font-black text-slate-900 uppercase tracking-tighter italic">Painel Admin</h2>
        </div>
        
        <nav className="p-4 space-y-2">
          {[
            { label: 'Bilhetes', icon: Ticket, to: '/admin/bilhetes' },
            { label: 'Resultados', icon: BarChart3, to: '/admin/resultados' },
            { label: 'Mercados', icon: Settings, to: '/admin/mercados' },
            { label: 'Voltar', icon: ArrowRightLeft, to: '/' },
          ].map((item) => (
            <button
              key={item.to}
              onClick={() => navigate({ to: item.to as any })}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm",
                window.location.pathname.startsWith(item.to) 
                  ? "bg-emerald-600 text-white shadow-md" 
                  : "text-slate-500 hover:bg-slate-50"
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