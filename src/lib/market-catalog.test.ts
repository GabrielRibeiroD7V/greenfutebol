import { describe, expect, it } from "vitest";
import { countMarketsByCategory, filterMarketsByCategory, sortCatalogMarkets } from "./market-catalog";

const markets = Array.from({ length: 25 }, (_, index) => ({
  id: String(index),
  category: index < 5 ? "MAIN" : index < 15 ? "GOALS" : "CORNERS",
  sortOrder: 25 - index,
}));

describe("market catalog", () => {
  it("TODOS preserves every open market without slicing", () => {
    expect(filterMarketsByCategory(markets, "ALL")).toHaveLength(25);
  });

  it("filters categories without affecting the complete catalog", () => {
    expect(filterMarketsByCategory(markets, "MAIN")).toHaveLength(5);
    expect(filterMarketsByCategory(markets, "GOALS")).toHaveLength(10);
    expect(filterMarketsByCategory(markets, "CORNERS")).toHaveLength(10);
  });

  it("counts and orders every market deterministically", () => {
    expect(countMarketsByCategory(markets)).toMatchObject({ ALL: 25, MAIN: 5, GOALS: 10, CORNERS: 10 });
    expect(sortCatalogMarkets(markets)[0]?.sortOrder).toBe(1);
  });
});
