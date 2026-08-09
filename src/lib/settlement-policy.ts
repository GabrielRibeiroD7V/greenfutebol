export type SelectionSettlementStatus = "WON" | "LOST" | "VOID" | "PENDING";

export interface TicketSettlementOutcome {
  status: "WON" | "LOST" | "VOID" | "CONFIRMED";
  settledReturn: number | null;
}

export function calculateTicketSettlement(
  statuses: SelectionSettlementStatus[],
  stake: number,
  odds: number[],
): TicketSettlementOutcome {
  if (statuses.length === 0 || statuses.length !== odds.length) {
    throw new Error("Settlement requires one odd for every selection");
  }

  if (statuses.includes("LOST")) {
    return { status: "LOST", settledReturn: 0 };
  }

  if (statuses.includes("PENDING")) {
    return { status: "CONFIRMED", settledReturn: null };
  }

  const effectiveOdd = odds.reduce(
    (total, odd, index) => total * (statuses[index] === "VOID" ? 1 : odd),
    1,
  );

  if (statuses.every((status) => status === "VOID")) {
    return { status: "VOID", settledReturn: stake };
  }

  return {
    status: "WON",
    settledReturn: Math.round(stake * effectiveOdd * 100) / 100,
  };
}
