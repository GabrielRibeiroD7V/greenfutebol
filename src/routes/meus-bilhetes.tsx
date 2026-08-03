import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireAuthenticatedUser } from "@/lib/auth-guard";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket } from "lucide-react";

export const Route = createFileRoute("/meus-bilhetes")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const user = await requireAuthenticatedUser();
    if (!user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: MeusBilhetesComponent,
});

function MeusBilhetesComponent() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Ticket size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Meus Bilhetes</h1>
            <p className="text-muted-foreground">
              Histórico de apostas para {user?.email}
            </p>
          </div>
        </header>

        <div className="grid gap-6">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Nenhum bilhete encontrado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Você ainda não realizou nenhuma aposta. Os bilhetes aparecerão aqui após serem confirmados.
              </p>
              <p className="mt-4 text-xs text-muted-foreground/60 italic">
                Nota: A proteção desta rota é apenas visual. Os dados futuros serão protegidos por RLS.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
