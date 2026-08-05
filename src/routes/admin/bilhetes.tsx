import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getAdminTickets } from "@/lib/admin.functions";
import { Loader2, Search, Ticket, User, Phone, Calendar, Clock, ChevronRight, Filter, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { maskPhone } from "@/lib/phone-utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/bilhetes")({
  ssr: false,
  component: AdminTicketsPage,
});


function AdminTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadTickets();
  }, [search]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const { tickets: data } = await getAdminTickets({ data: { search } });
      setTickets(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-black text-white mb-6 uppercase tracking-tight">Gestão de Bilhetes</h1>
      <div className="mb-6 flex gap-4">
        <Input 
          placeholder="Buscar por código..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm bg-white/5 border-white/10"
        />
        <Button onClick={loadTickets} className="bg-emerald-600">Buscar</Button>
      </div>

      {loading ? (
        <Loader2 className="animate-spin text-emerald-500" />
      ) : (
        <div className="grid gap-2">
          {tickets.map(t => (
            <div key={t.id} className="bg-white/5 border border-white/5 p-4 rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-emerald-400">{t.code}</div>
                <div className="text-xs text-slate-400">Usuário ID: {t.user_id}</div>
              </div>
              <div className="font-black text-white">R$ {t.stake.toFixed(2)}</div>
              <div className="px-3 py-1 bg-white/5 rounded-full text-xs font-bold">{t.status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
