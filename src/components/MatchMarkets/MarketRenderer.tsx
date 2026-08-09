import { MarketGroup, SelectionButton } from "./MarketTemplates";
import { cn } from "@/lib/utils";

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

export function MarketRenderer({ 
  market, 
  fixture 
}: { 
  market: Market; 
  fixture: FixtureMetadata;
}) {
  const selections = [...(market.fixture_market_selections || [])]
    .filter(s => s.status === 'OPEN' || s.status === 'SUSPENDED')
    .sort((a, b) => a.sort_order - b.sort_order);

  if (selections.length === 0 && market.status !== 'SUSPENDED') return null;

  // Renderers baseados em market_type
  
  // 0. Mercados de Jogadores
  if (market.market_group === 'PLAYER') {
    return (
      <MarketGroup title={market.market_name} status={market.status}>
        <div className="grid grid-cols-1 divide-y divide-white/5 max-h-[400px] overflow-y-auto custom-scrollbar">
          {selections.map(s => (
            <div key={s.id} className="flex items-center justify-between p-3 group hover:bg-white/5 transition-colors">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-zinc-400 group-hover:text-emerald-500 transition-colors">
                  {s.selection_name}
                </span>
                {s.metadata?.team_side && (
                  <span className="text-[8px] text-zinc-600 font-bold uppercase">
                    {s.metadata.team_side === 'HOME' ? fixture.home_team_name : fixture.away_team_name}
                  </span>
                )}
              </div>
              <div className="w-24 h-10">
                <SelectionButton selection={s} market={market} fixture={fixture} showLabel={false} className="h-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </MarketGroup>
    );
  }

  // 1. Over/Under (OU, CORNERS, CARDS etc se forem de linha)
  if (market.market_type === 'OU' || (market.line !== null && market.line !== undefined)) {
    return (
      <MarketGroup title={`${market.market_name} ${market.line || ''}`} status={market.status}>
        <div className="grid grid-cols-2 divide-x divide-white/5">
          {selections.map(s => (
            <SelectionButton key={s.id} selection={s} market={market} fixture={fixture} />
          ))}
        </div>
      </MarketGroup>
    );
  }

  // 2. Placar Exato (CS)
  if (market.market_type === 'CS') {
    return (
      <MarketGroup title={market.market_name} status={market.status}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 divide-x divide-y divide-white/5">
          {selections.map(s => (
            <SelectionButton key={s.id} selection={s} market={market} fixture={fixture} />
          ))}
        </div>
      </MarketGroup>
    );
  }

  // 3. Renderer Genérico (1X2, DC, DNB, BTTS, etc)
  // Define grid cols based on selection count
  const gridCols = selections.length <= 2 ? 'grid-cols-2' : selections.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3';

  return (
    <MarketGroup title={market.market_name} status={market.status}>
      <div className={cn("grid divide-x divide-y divide-white/5", gridCols)}>
        {selections.map(s => (
          <SelectionButton key={s.id} selection={s} market={market} fixture={fixture} />
        ))}
      </div>
    </MarketGroup>
  );
}
