import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Loader2, ShieldCheck, Ticket, BarChart3, Settings, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminLayout,
});

function AdminLayout() {
  const { profile, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Audit point: Clear state separation
  const isAuthLoading = isLoading;
  const isAuthorized = !isLoading && isAuthenticated && profile?.role === 'admin';
  const isUnauthorized = !isLoading && (
    !isAuthenticated || (profile && profile.role !== 'admin')
  );

  useEffect(() => {
    // Only redirect if we are SURE the user is unauthorized
    if (isUnauthorized) {
      console.log("Admin Guard: User is unauthorized, redirecting to home.");
      navigate({ to: "/" });
    }
  }, [isUnauthorized, navigate]);

  if (isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="animate-spin text-emerald-600 w-10 h-10 mb-4" />
        <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Verificando credenciais...</p>
      </div>
    );
  }

  if (!isAuthorized && !isUnauthorized) {
    // This state is transient while waiting for effects to settle
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="animate-spin text-emerald-600 w-8 h-8" />
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 bg-white z-20 sticky top-0 md:h-screen shadow-sm flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <ShieldCheck className="text-emerald-600" />
          <h2 className="font-black text-slate-900 uppercase tracking-tighter italic">Painel Admin</h2>
        </div>
        
        <nav className="p-4 space-y-2 flex-1">
          {[
            { label: 'Bilhetes', icon: Ticket, to: '/admin/bilhetes' },
            { label: 'Resultados', icon: BarChart3, to: '/admin/resultados' },
            { label: 'Mercados', icon: Settings, to: '/admin/mercados' },
            { label: 'Voltar', icon: ArrowRightLeft, to: '/' },
          ].map((item) => {
            const isActive = window.location.pathname.startsWith(item.to);
            return (
              <button
                key={item.to}
                onClick={() => navigate({ to: item.to as any })}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm",
                  isActive 
                    ? "bg-emerald-600 text-white shadow-md" 
                    : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
