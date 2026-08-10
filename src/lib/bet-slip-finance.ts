export const MIN_STAKE = 10;

export function parseStakeInput(value: string): number | null {
  const cleaned = value.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const stake = Number(normalized);
  return Number.isFinite(stake) ? stake : null;
}

export function calculateBetPreview(odds: number[], stake: number | null) {
  const totalOdd = odds.reduce((total, odd) => total * odd, 1);
  const validStake = stake !== null && Number.isFinite(stake) && stake > 0 ? stake : 0;
  const potentialReturn = validStake * totalOdd;
  return {
    totalOdd,
    potentialReturn,
    potentialProfit: potentialReturn - validStake,
  };
}

export const formatBRL = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(value);
