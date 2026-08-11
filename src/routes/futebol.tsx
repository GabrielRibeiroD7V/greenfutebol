import { createFileRoute } from "@tanstack/react-router";
import { PublicSidebar } from "@/components/PublicSidebar";
import { BetSlip } from "@/components/BetSlip";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/futebol" as any)({
  component: Futebol,
});

function Futebol() {
  return (
    <div className="flex min-h-screen bg-[#F6F7F7]">
      <PublicSidebar />
      <main className="flex-1 pl-[88px] md:pl-64 lg:pr-[350px]">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
          <header className="mb-8 flex items-center gap-3">
            <div className="rounded-xl bg-emerald-600 p-2.5 text-white shadow-lg shadow-emerald-200">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Futebol</h1>
              <p className="text-sm font-medium text-slate-500">Explore todas as competições e partidas</p>
            </div>
          </header>

          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-24 text-center">
            <div className="mb-4 rounded-full bg-slate-50 p-4">
              <Trophy className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Em Breve</h3>
            <p className="max-w-xs text-sm font-medium text-slate-500">
              Estamos preparando a listagem completa de competições para você.
            </p>
          </div>
        </div>
      </main>
      <div className="fixed right-0 top-0 hidden h-screen w-[350px] border-l border-slate-200 bg-white lg:block">
        <BetSlip />
      </div>
    </div>
  );
}
