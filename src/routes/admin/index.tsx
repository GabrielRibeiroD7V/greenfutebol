import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  component: AdminIndexPage,
});

function AdminIndexPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redireciona para mercados por padrão, que é a tela principal de gestão
    navigate({ to: "/admin/mercados", replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="animate-spin text-emerald-600 w-8 h-8" />
    </div>
  );
}
