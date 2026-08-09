import { MarketGroup, SelectionButton } from "./MarketTemplates";
import { cn } from "@/lib/utils";
export function MarketRenderer({ market, fixture }) {
    const selections = [...(market.fixture_market_selections || [])]
        .filter(s => s.status === 'OPEN' || s.status === 'SUSPENDED')
        .sort((a, b) => a.sort_order - b.sort_order);
    if (selections.length === 0 && market.status !== 'SUSPENDED')
        return null;
    // Renderers baseados em market_type
    // 1. Over/Under (OU, CORNERS, CARDS etc se forem de linha)
    if (market.market_type === 'OU' || (market.line !== null && market.line !== undefined)) {
        return (<MarketGroup title={`${market.market_name} ${market.line || ''}`} status={market.status}>
        <div className="grid grid-cols-2 divide-x divide-white/5">
          {selections.map(s => (<SelectionButton key={s.id} selection={s} market={market} fixture={fixture}/>))}
        </div>
      </MarketGroup>);
    }
    // 2. Placar Exato (CS)
    if (market.market_type === 'CS') {
        return (<MarketGroup title={market.market_name} status={market.status}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 divide-x divide-y divide-white/5">
          {selections.map(s => (<SelectionButton key={s.id} selection={s} market={market} fixture={fixture}/>))}
        </div>
      </MarketGroup>);
    }
    // 3. Renderer Genérico (1X2, DC, DNB, BTTS, etc)
    // Define grid cols based on selection count
    const gridCols = selections.length <= 2 ? 'grid-cols-2' : selections.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3';
    return (<MarketGroup title={market.market_name} status={market.status}>
      <div className={cn("grid divide-x divide-y divide-white/5", gridCols)}>
        {selections.map(s => (<SelectionButton key={s.id} selection={s} market={market} fixture={fixture}/>))}
      </div>
    </MarketGroup>);
}
