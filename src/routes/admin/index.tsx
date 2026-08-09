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
    // Redireciona para validação por padrão para garantir a homologação final
    navigate({ to: "/admin/validacao", replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="animate-spin text-emerald-600 w-8 h-8" />
    </div>
  );
}
