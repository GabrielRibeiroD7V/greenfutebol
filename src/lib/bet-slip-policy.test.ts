import { describe, expect, it } from "vitest";
import { toggleSelection } from "./bet-slip-policy";

describe("bet slip selection policy", () => {
  it("keeps different selections even when they belong to the same market", () => {
    const first = { selection_id: "home", market_id: "match-result" };
    const draw = { selection_id: "draw", market_id: "match-result" };

    expect(toggleSelection([first], draw)).toEqual([first, draw]);
  });

  it("toggles only an exact duplicate selection", () => {
    const selection = { selection_id: "home", market_id: "match-result" };

    expect(toggleSelection([selection], selection)).toEqual([]);
  });

  it("does not exceed twenty selections", () => {
    const selections = Array.from({ length: 20 }, (_, index) => ({
      selection_id: String(index),
    }));

    expect(toggleSelection(selections, { selection_id: "twenty-one" })).toBe(selections);
  });
});
