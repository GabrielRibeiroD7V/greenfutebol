import { Link } from "@tanstack/react-router";
import { Clock, Home, Radio, Ticket, Trophy } from "lucide-react";

export function PublicSidebar() {
  const items = [
    { label: "Início", to: "/", search: {}, icon: Home },
    { label: "Futebol", to: "/futebol", search: {}, icon: Trophy },
    { label: "Ao vivo", to: "/ao-vivo", search: {}, icon: Radio },
    { label: "Bilhetes", to: "/meus-bilhetes", search: {}, icon: Ticket },
  ] as const;

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-[88px] flex-col overflow-hidden border-r border-slate-200 bg-white px-1.5 py-3 md:w-64 md:px-4 md:py-4">
      <Link to="/" search={{}} aria-label="Ir para o início" className="flex h-20 flex-col items-center justify-center gap-1 border-b border-slate-100 px-1 md:h-24 md:flex-row md:gap-2 md:px-3">
        <img
          src="/favicon.png"
          alt="GreenSport"
          className="h-10 w-10 object-contain md:h-14 md:w-14"
        />
        <span className="text-[11px] font-black tracking-tight text-slate-950 md:text-base">GreenSport</span>
      </Link>

      <nav className="mt-5 space-y-1.5">
        {items.map((item) => (
          <Link
            key={`${item.label}-${item.to}`}
            to={item.to as any}
            search={item.search as any}
            className="flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-center text-[10px] font-bold text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 md:flex-row md:justify-start md:gap-2 md:px-3 md:text-left md:text-sm"
            activeProps={{ className: "bg-emerald-50 text-emerald-700" }}
          >
            <item.icon className="h-4 w-4 shrink-0 text-emerald-600 md:h-[18px] md:w-[18px]" />
            <span className="max-w-full leading-tight">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto border-t border-slate-100 pt-4 text-center text-[9px] font-bold uppercase tracking-wider text-slate-400 md:text-[10px]">
        <Clock className="mx-auto mb-1 h-4 w-4 text-emerald-600" />
        GreenSport
      </div>
    </aside>
  );
}
