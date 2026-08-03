import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Search, Ticket, Trash2, Calendar, Clock, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Plataforma de Futebol" },
      { name: "description", content: "Plataforma de palpites esportivos simulados." },
    ],
  }),
  component: Index,
});

interface Match {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  time: string;
  status: 'scheduled' | 'live' | 'finished';
  odds: {
    home: number;
    draw: number;
    away: number;
  };
  tab: 'today' | 'tomorrow' | 'live';
}

interface BetSelection {
  matchId: string;
  matchName: string;
  selection: 'home' | 'draw' | 'away';
  selectionLabel: string;
  odd: number;
}

const MOCK_MATCHES: Match[] = [
  { id: '1', league: 'Brasileirão Série A', homeTeam: 'Flamengo', awayTeam: 'Palmeiras', time: '16:00', status: 'scheduled', tab: 'today', odds: { home: 2.10, draw: 3.20, away: 3.50 } },
  { id: '2', league: 'Brasileirão Série A', homeTeam: 'São Paulo', awayTeam: 'Corinthians', time: '18:30', status: 'scheduled', tab: 'today', odds: { home: 1.95, draw: 3.10, away: 4.20 } },
  { id: '3', league: 'Premier League', homeTeam: 'Man City', awayTeam: 'Liverpool', time: '75\'', status: 'live', tab: 'live', odds: { home: 1.50, draw: 4.50, away: 6.00 } },
  { id: '4', league: 'Champions League', homeTeam: 'Real Madrid', awayTeam: 'Bayern', time: '20:45', status: 'scheduled', tab: 'tomorrow', odds: { home: 2.25, draw: 3.40, away: 3.10 } },
  { id: '5', league: 'La Liga', homeTeam: 'Barcelona', awayTeam: 'Getafe', time: '30\'', status: 'live', tab: 'live', odds: { home: 1.25, draw: 5.50, away: 12.00 } },
  { id: '6', league: 'Serie A', homeTeam: 'Inter', awayTeam: 'Milan', time: '15:45', status: 'scheduled', tab: 'today', odds: { home: 2.05, draw: 3.30, away: 3.60 } },
];

function Index() {
  const [activeTab, setActiveTab] = useState<'today' | 'tomorrow' | 'live'>('today');
  const [betSelections, setBetSelections] = useState<BetSelection[]>([]);
  const [betValue, setBetValue] = useState<number>(10);

  const filteredMatches = MOCK_MATCHES.filter(m => m.tab === activeTab);

  const totalOdd = useMemo(() => {
    if (betSelections.length === 0) return 0;
    return betSelections.reduce((acc, bet) => acc * bet.odd, 1);
  }, [betSelections]);

  const potentialReturn = useMemo(() => {
    return totalOdd * betValue;
  }, [totalOdd, betValue]);

  const toggleSelection = (match: Match, type: 'home' | 'draw' | 'away', odd: number) => {
    const selectionId = `${match.id}-${type}`;
    const exists = betSelections.find(b => b.matchId === match.id && b.selection === type);

    if (exists) {
      setBetSelections(prev => prev.filter(b => !(b.matchId === match.id && b.selection === type)));
    } else {
      // Allow multiple selections but usually one per match in basic bet slips
      // For this demo, let's just add it
      const selectionLabel = type === 'home' ? match.homeTeam : type === 'draw' ? 'Empate' : match.awayTeam;
      setBetSelections(prev => [...prev.filter(b => b.matchId !== match.id), {
        matchId: match.id,
        matchName: `${match.homeTeam} x ${match.awayTeam}`,
        selection: type,
        selectionLabel,
        odd
      }]);
    }
  };

  const removeSelection = (matchId: string) => {
    setBetSelections(prev => prev.filter(b => b.matchId !== matchId));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-tight">Plataforma de Futebol</h1>
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar jogos..." 
              className="bg-slate-800 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Tabs */}
          <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
            {(['today', 'tomorrow', 'live'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-3 px-4 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2",
                  activeTab === tab 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {tab === 'today' && <Calendar className="w-4 h-4" />}
                {tab === 'tomorrow' && <Clock className="w-4 h-4" />}
                {tab === 'live' && <PlayCircle className="w-4 h-4" />}
                {tab === 'today' && "Hoje"}
                {tab === 'tomorrow' && "Amanhã"}
                {tab === 'live' && "Ao vivo"}
              </button>
            ))}
          </div>

          {/* Match Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMatches.map((match) => (
              <div key={match.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-blue-300 transition-colors">
                <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{match.league}</span>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                    match.status === 'live' ? "bg-red-100 text-red-600 animate-pulse" : "bg-slate-200 text-slate-600"
                  )}>
                    {match.status === 'live' ? `Ao Vivo ${match.time}` : match.time}
                  </span>
                </div>
                
                <div className="p-4 space-y-4">
                  <div className="flex justify-between items-center text-sm font-bold text-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-[10px] text-slate-400">🛡️</div>
                      <span>{match.homeTeam}</span>
                    </div>
                    <span className="text-slate-300 text-xs">vs</span>
                    <div className="flex items-center gap-3 text-right">
                      <span>{match.awayTeam}</span>
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-[10px] text-slate-400">🛡️</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: 'home', label: '1', val: match.odds.home },
                      { type: 'draw', label: 'X', val: match.odds.draw },
                      { type: 'away', label: '2', val: match.odds.away }
                    ].map((odd) => {
                      const isSelected = betSelections.some(b => b.matchId === match.id && b.selection === odd.type);
                      return (
                        <button
                          key={odd.type}
                          onClick={() => toggleSelection(match, odd.type as any, odd.val)}
                          className={cn(
                            "flex flex-col items-center justify-center p-2 rounded-lg border transition-all",
                            isSelected 
                              ? "bg-blue-600 border-blue-600 text-white" 
                              : "bg-white border-slate-200 text-slate-800 hover:bg-blue-50 hover:border-blue-200"
                          )}
                        >
                          <span className={cn("text-[10px] font-bold mb-1", isSelected ? "text-blue-100" : "text-slate-400")}>{odd.label}</span>
                          <span className="text-sm font-bold">{odd.val.toFixed(2)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
            {filteredMatches.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 italic">
                Nenhum jogo disponível nesta categoria no momento.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar / Bet Slip */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-lg sticky top-24 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              <h2 className="font-bold">Bilhete de Apostas</h2>
              {betSelections.length > 0 && (
                <span className="ml-auto bg-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {betSelections.length}
                </span>
              )}
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {betSelections.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-sm mb-2">Seu bilhete está vazio</p>
                  <p className="text-xs">Selecione uma odd para começar</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {betSelections.map((bet) => (
                    <div key={bet.matchId} className="bg-slate-50 p-3 rounded-lg border border-slate-100 relative group">
                      <button 
                        onClick={() => removeSelection(bet.matchId)}
                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">{bet.matchName}</p>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs text-slate-500 mb-0.5">Resultado Final</p>
                          <p className="text-sm font-bold text-slate-800">{bet.selectionLabel}</p>
                        </div>
                        <p className="text-sm font-bold text-slate-900">@{bet.odd.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {betSelections.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Odd Total:</span>
                  <span className="font-bold text-slate-900">{totalOdd.toFixed(2)}</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Valor do Palpite (R$)</label>
                  <input 
                    type="number" 
                    value={betValue}
                    onChange={(e) => setBetValue(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-slate-600 font-medium">Retorno Potencial:</span>
                    <span className="text-lg font-black text-green-600">R$ {potentialReturn.toFixed(2)}</span>
                  </div>
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-[0.98]">
                    Confirmar Palpite
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bet Button (Floating) */}
      <div className="lg:hidden fixed bottom-6 right-6">
        <button className="bg-blue-600 text-white p-4 rounded-full shadow-2xl flex items-center gap-2 font-bold relative">
          <Ticket className="w-6 h-6" />
          {betSelections.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-[10px] w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">
              {betSelections.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
