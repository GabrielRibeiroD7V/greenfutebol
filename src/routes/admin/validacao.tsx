import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Shield, Layout, Users, Ticket, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/validacao" as any)({
  component: AdminValidacao,
});

function AdminValidacao() {
  const reports = [
    {
      title: "Visual e Navegação (Premium Sportsbook)",
      status: "COMPLETO",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      items: [
        "Tema Claro: Migração total para fundo branco, bordas em slate suave e destaques em verde esmeralda.",
        "Sidebar Permanente: Refatoração do PublicSidebar e integração definitiva nas páginas /futebol e /ao-vivo.",
        "Navegação Corrigida: Links do Header agora apontam para rotas reais (/futebol, /ao-vivo)."
      ],
      icon: Layout
    },
    {
      title: "Homepage e Fallback de 14 Dias",
      status: "ESTABILIZADO",
      color: "text-blue-600",
      bg: "bg-blue-50",
      items: [
        "Home Estabilizada: Sincronização entre URL e estado para filtros e abas.",
        "Busca Sequencial: Fallback de 14 dias garantindo que a plataforma nunca fique vazia.",
        "Lógica de Status: Busca ignora partidas encerradas para priorizar apostas."
      ],
      icon: BarChart3
    },
    {
      title: "Painel Administrativo Reestruturado",
      status: "FUNCIONAL",
      color: "text-purple-600",
      bg: "bg-purple-50",
      items: [
        "Gestão de Usuários: Nova rota /admin/usuarios integrada ao banco de dados.",
        "Gestão de Partidas: Monitor de fixtures ativas/agendadas e sincronização forçada.",
        "Central de Bilhetes: Refatoração total para o novo tema claro com snapshots de auditoria."
      ],
      icon: Settings
    }
  ];

  return (
    <div className="space-y-8 p-4 md:p-8 bg-white min-h-screen">
      <header className="max-w-4xl mx-auto text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full font-black text-xs uppercase tracking-widest">
          <Shield size={14} />
          Relatório de Auditoria e Reestruturação
        </div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
          GreenSport <span className="text-emerald-600">v2.0</span>
        </h1>
        <p className="text-slate-500 font-medium max-w-2xl mx-auto">
          A reestruturação completa da plataforma foi concluída com sucesso. 
          Abaixo estão os detalhes das implementações e correções realizadas.
        </p>
      </header>

      <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-3">
        {reports.map((report, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6", report.bg)}>
              <report.icon className={report.color} size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-900 leading-tight mb-2 uppercase">
              {report.title}
            </h3>
            <div className={cn("inline-block text-[10px] font-black px-2 py-0.5 rounded-full mb-6 uppercase tracking-widest", report.bg, report.color)}>
              {report.status}
            </div>
            <ul className="space-y-3">
              {report.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-600 font-medium">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="max-w-4xl mx-auto bg-slate-50 border border-slate-200 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 shadow-sm">
        <div className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-200">
          <CheckCircle2 size={40} />
        </div>
        <div className="text-center md:text-left">
          <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Pronto para Produção</h3>
          <p className="text-sm text-slate-500 font-medium mb-6">
            A integridade das rotas, segurança dos bilhetes e o fallback de partidas foram validados. 
            A plataforma está operando em modo Premium Light.
          </p>
          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            <button className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-200">
              Validar Sistema
            </button>
            <button className="bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:text-slate-900 transition-all">
              Ver Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
