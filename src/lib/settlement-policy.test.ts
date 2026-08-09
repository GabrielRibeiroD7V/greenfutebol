import { describe, expect, it } from "vitest";
import { calculateTicketSettlement } from "./settlement-policy";

describe("all-or-nothing ticket settlement", () => {
  it("settles 1 WON + 1 LOST as LOST with zero return", () => {
    expect(calculateTicketSettlement(["WON", "LOST"], 10, [1.8, 3.4])).toEqual({
      status: "LOST",
      settledReturn: 0,
    });
  });

  it("settles 9 WON + 1 LOST as LOST with zero return", () => {
    expect(
      calculateTicketSettlement(
        [...Array(9).fill("WON"), "LOST"],
        10,
        Array(10).fill(1.2),
      ),
    ).toEqual({ status: "LOST", settledReturn: 0 });
  });

  it("keeps 19 WON + 1 PENDING unpaid", () => {
    expect(
      calculateTicketSettlement(
        [...Array(19).fill("WON"), "PENDING"],
        10,
        Array(20).fill(1.1),
      ),
    ).toEqual({ status: "CONFIRMED", settledReturn: null });
  });

  it("pays 20 WON selections", () => {
    expect(
      calculateTicketSettlement(Array(20).fill("WON"), 10, Array(20).fill(1.1)),
    ).toEqual({ status: "WON", settledReturn: 67.27 });
  });

  it("uses effective odd 1.00 for VOID selections", () => {
    expect(
      calculateTicketSettlement(
        [...Array(18).fill("WON"), "VOID", "VOID"],
        10,
        [...Array(18).fill(1.1), 5, 8],
      ),
    ).toEqual({ status: "WON", settledReturn: 55.6 });
  });

  it("returns the stake when all selections are VOID", () => {
    expect(calculateTicketSettlement(["VOID", "VOID"], 25, [2, 3])).toEqual({
      status: "VOID",
      settledReturn: 25,
    });
  });

  it("is idempotent for the same settlement inputs", () => {
    const first = calculateTicketSettlement(["WON", "LOST"], 10, [1.8, 3.4]);
    const second = calculateTicketSettlement(["WON", "LOST"], 10, [1.8, 3.4]);
    expect(second).toEqual(first);
  });
});
