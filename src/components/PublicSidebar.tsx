import { Link } from "@tanstack/react-router";
import { Clock, Home, Radio, Ticket, Trophy } from "lucide-react";

export function PublicSidebar() {
  const items = [
    { label: "Início", to: "/", icon: Home },
    { label: "Futebol", to: "/", icon: Trophy },
    { label: "Ao vivo", to: "/", icon: Radio },
    { label: "Bilhetes", to: "/meus-bilhetes", icon: Ticket },
  ] as const;

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-[120px] flex-col border-r border-slate-200 bg-white px-2 py-4 md:w-64 md:px-4">
      <Link to="/" className="flex h-20 flex-col items-center justify-center gap-1 border-b border-slate-100 px-1 md:h-24 md:flex-row md:gap-2 md:px-3">
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
            to={item.to}
            className="flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 md:px-3 md:text-sm"
          >
            <item.icon className="h-4 w-4 shrink-0 text-emerald-600 md:h-[18px] md:w-[18px]" />
            <span className="leading-tight">{item.label}</span>
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
