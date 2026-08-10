export const MARKET_CATEGORIES = [
  { key: "ALL", label: "Todos" },
  { key: "MAIN", label: "Principais" },
  { key: "GOALS", label: "Gols" },
  { key: "FIRST_HALF", label: "1º Tempo" },
  { key: "HANDICAPS", label: "Handicaps" },
  { key: "CORNERS", label: "Escanteios" },
  { key: "CARDS", label: "Cartões" },
  { key: "PLAYERS", label: "Jogadores" },
  { key: "SCORE", label: "Placar" },
  { key: "TEAMS", label: "Equipes" },
  { key: "COMBINATIONS", label: "Combinações" },
] as const;

export type MarketCategory = (typeof MARKET_CATEGORIES)[number]["key"];

export interface CatalogMarket {
  id: string;
  category: string;
  sortOrder: number;
}

export function filterMarketsByCategory<T extends CatalogMarket>(
  markets: T[],
  category: MarketCategory,
): T[] {
  if (category === "ALL") return markets;
  return markets.filter((market) => market.category === category);
}

export function sortCatalogMarkets<T extends CatalogMarket>(markets: T[]): T[] {
  return [...markets].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
  );
}

export function countMarketsByCategory(markets: CatalogMarket[]): Record<string, number> {
  return markets.reduce<Record<string, number>>(
    (counts, market) => {
      counts["ALL"] = (counts["ALL"] || 0) + 1;
      counts[market.category] = (counts[market.category] || 0) + 1;
      return counts;
    },
    { ALL: 0 },
  );
}
