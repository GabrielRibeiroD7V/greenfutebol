import { cn } from "@/lib/utils";
import { Info, Lock } from "lucide-react";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { toast } from "sonner";

interface Selection {
  id: string;
  selection_name: string;
  selection_key: string;
  odd: number;
  status: string;
  sort_order: number;
  metadata?: any;
}

interface Market {
  id: string;
  market_name: string;
  market_type: string;
  market_group: string;
  status: string;
  line?: number;
  fixture_market_selections: Selection[];
}

interface FixtureMetadata {
  fixture_id: number;
  home_team_name: string;
  away_team_name: string;
  kickoff_at: string;
  league_name: string;
}

export function SelectionButton({
  selection,
  market,
  fixture,
  className
}: {
  selection: Selection;
  market: Market;
  fixture: FixtureMetadata;
  className?: string;
}) {
  const { toggleSelection, hasSelection } = useBetSlip();
  
  const isMarketOpen = market.status === 'OPEN';
  const isSelectionActive = selection.status === 'OPEN';
  const isValidOdd = selection.odd > 1.0;
  const isPastKickoff = false; // DESABILITADO PARA HOMOLOGAÇÃO
  
  const isDisabled = !isMarketOpen || !isSelectionActive || !isValidOdd;
  const isSuspended = market.status === 'SUSPENDED';
  const selected = hasSelection(selection.id);

  const handleClick = () => {
    if (isDisabled) {
      if (isPastKickoff) toast.error("Partida já iniciada.");
      else if (isSuspended) toast.error("Mercado suspenso no momento.");
      return;
    }

    toggleSelection({
      fixtureId: fixture.fixture_id,
      fixtureName: `${fixture.home_team_name} x ${fixture.away_team_name}`,
      kickoffAt: fixture.kickoff_at,
      competitionName: fixture.league_name,
      marketId: market.id,
      marketName: market.market_name,
      marketType: market.market_group,
      selectionId: selection.id,
      selectionName: selection.selection_name,
      displayedOdd: selection.odd,
      homeTeam: fixture.home_team_name,
      awayTeam: fixture.away_team_name
    });
  };

  return (
    <button
      disabled={isDisabled}
      onClick={handleClick}
      className={cn(
        "relative flex flex-col items-center justify-center p-3 transition-all duration-200 min-h-[64px]",
        selected 
          ? "bg-emerald-600 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] z-10" 
          : "bg-zinc-900/50 border border-white/5 hover:bg-white/5 hover:border-white/10",
        isDisabled && "opacity-40 cursor-not-allowed grayscale",
        isSuspended && "border-amber-500/20",
        className
      )}
    >
      <span className={cn(
        "text-[10px] font-bold uppercase tracking-tight mb-1",
        selected ? "text-emerald-500 bg-black/40 px-1.5 py-0.5 rounded" : "text-zinc-500"
      )}>
        {selection.selection_name}
      </span>
      <div className="flex items-center gap-1.5">
        {isSuspended ? (
          <Lock size={12} className="text-amber-500" />
        ) : (
          <span className={cn(
            "text-lg font-black tracking-tighter",
            selected ? "text-white" : "text-emerald-500"
          )}>
            {selection.odd.toFixed(2)}
          </span>
        )}
      </div>
      {isPastKickoff && !selected && (
        <span className="absolute bottom-1 text-[7px] font-black text-red-500 uppercase">Encerrado</span>
      )}
    </button>
  );
}

export function MarketGroup({ title, children, status }: { title: string, children: React.ReactNode, status?: string }) {
  return (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-2">
      <div className="px-4 py-3 bg-zinc-800/40 border-b border-white/5 flex justify-between items-center">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex items-center gap-2">
          <div className="w-1 h-3 bg-emerald-500 rounded-full" />
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {status === 'SUSPENDED' && (
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
              Suspenso
            </span>
          )}
          <Info size={14} className="text-zinc-600 hover:text-zinc-400 cursor-help transition-colors" />
        </div>
      </div>
      {children}
    </div>
  );
}
