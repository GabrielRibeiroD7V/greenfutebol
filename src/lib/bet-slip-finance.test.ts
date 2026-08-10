import { describe, expect, it } from "vitest";
import { calculateBetPreview, MIN_STAKE, parseStakeInput } from "./bet-slip-finance";

describe("bet slip financial preview", () => {
  it.each([["10", 10], ["10,50", 10.5], ["50.00", 50], ["1.234,56", 1234.56]])("parses %s", (input, expected) => {
    expect(parseStakeInput(input)).toBe(expected);
  });

  it.each(["", "-1", "abc", "10,999", "1.2.3"])('rejects invalid value "%s"', (input) => {
    expect(parseStakeInput(input)).toBeNull();
  });

  it("calculates the documented three-selection examples", () => {
    const first = calculateBetPreview([1.8, 3.4, 4.2], 10);
    expect(first.totalOdd).toBeCloseTo(25.704, 10);
    expect(first.potentialReturn).toBeCloseTo(257.04, 10);
    expect(first.potentialProfit).toBeCloseTo(247.04, 10);
    const second = calculateBetPreview([1.9, 1.82, 1.75], 50);
    expect(second.totalOdd).toBeCloseTo(6.0515, 10);
    expect(second.potentialReturn).toBeCloseTo(302.575, 10);
  });

  it("keeps full precision for the seven-selection preview", () => {
    const result = calculateBetPreview([292.4298], 10);
    expect(result.potentialReturn).toBeCloseTo(2924.298, 10);
  });

  it("uses the definitive minimum while preserving cents", () => {
    expect(MIN_STAKE).toBe(10);
    expect(parseStakeInput("9,99")).toBe(9.99);
    expect(parseStakeInput("10,01")).toBe(10.01);
    expect(parseStakeInput("12,45")).toBe(12.45);
    expect(calculateBetPreview([8.45], 12.45).potentialReturn).toBeCloseTo(105.2025, 10);
  });
});
