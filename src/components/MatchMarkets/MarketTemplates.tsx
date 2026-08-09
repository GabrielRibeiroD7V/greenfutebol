import { cn } from "@/lib/utils";
import { Info, Lock } from "lucide-react";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { toast } from "sonner";

interface Selection {
  id: string;
  selection_name: string;
  selection_key: string;
  odd: number | null;
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
  className,
  showLabel = true
}: {
  selection: Selection;
  market: Market;
  fixture: FixtureMetadata;
  className?: string;
  showLabel?: boolean;
}) {
  const { toggleSelection, hasSelection } = useBetSlip();
  
  const isMarketOpen = market.status === 'OPEN';
  const isSelectionActive = selection.status === 'OPEN';
  const isValidOdd = selection.odd !== null && selection.odd > 1.0;
  const isPastKickoff = new Date(fixture.kickoff_at) <= new Date();
  
  const isDisabled = !isMarketOpen || !isSelectionActive || !isValidOdd || isPastKickoff;
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
      displayedOdd: selection.odd || 0,
      homeTeam: fixture.home_team_name,
      awayTeam: fixture.away_team_name,
      metadata: selection.metadata
    });
  };

  return (
    <button
      disabled={false}
      onClick={handleClick}
      className={cn(
        "relative flex flex-col items-center justify-center p-2 sm:p-3 transition-all duration-200 min-h-[56px] sm:min-h-[64px]",
        selected 
          ? "bg-emerald-600 border-emerald-500 z-10" 
          : "bg-[#F6F7F7] border border-[#E5E7EB] hover:bg-emerald-50 hover:border-emerald-100",
        isDisabled && "opacity-40 cursor-not-allowed grayscale",
        isSuspended && "border-amber-500/20",
        "rounded-[6px]",
        className
      )}
    >
      {showLabel && (
        <span className={cn(
          "text-[10px] font-medium uppercase tracking-tight mb-0.5",
          selected ? "text-white" : "text-slate-600"
        )}>
          {selection.selection_name}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        {isSuspended || !isValidOdd ? (
          <Lock size={12} className={cn(isSuspended ? "text-amber-500" : "text-slate-300")} />
        ) : (
            <span className={cn(
              "text-[13px] font-bold tracking-tight",
              selected ? "text-white" : "text-slate-900"
            )}>
            {selection.odd?.toFixed(2)}
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
    <div className="border-b border-[#E5E7EB] last:border-b-0 animate-in fade-in">
      <div className="px-0 py-3 flex justify-between items-center">
        <h3 className="text-[13px] font-semibold text-slate-900 flex items-center gap-2">
          {title}
        </h3>
        {status === 'SUSPENDED' && (
          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100">
            Suspenso
          </span>
        )}
      </div>
      <div className="pb-4">
        {children}
      </div>
    </div>
  );
}
