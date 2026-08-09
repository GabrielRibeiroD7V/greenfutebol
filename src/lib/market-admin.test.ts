import { describe, expect, it } from "vitest";
import { getMarketOperationalStatus, parseOddInput } from "./market-admin";

describe("market admin rules", () => {
  it("normalizes decimal commas and preserves NULL", () => {
    expect(parseOddInput("1,85")).toBe(1.85);
    expect(parseOddInput("1.85")).toBe(1.85);
    expect(parseOddInput("  ")).toBeNull();
  });

  it("rejects placeholders and invalid odds", () => {
    expect(() => parseOddInput("0")).toThrow();
    expect(() => parseOddInput("1.00")).toThrow();
    expect(() => parseOddInput("abc")).toThrow();
  });

  it("classifies fixture publication state", () => {
    expect(getMarketOperationalStatus([])).toBe("SEM MERCADOS");
    expect(getMarketOperationalStatus(["DRAFT", "DRAFT"])).toBe("DRAFT");
    expect(getMarketOperationalStatus(["OPEN", "DRAFT"])).toBe("PARCIALMENTE PUBLICADO");
    expect(getMarketOperationalStatus(["OPEN", "OPEN"])).toBe("PUBLICADO");
  });
});
