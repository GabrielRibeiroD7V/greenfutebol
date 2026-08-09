export type MarketOperationalStatus =
  | "SEM MERCADOS"
  | "DRAFT"
  | "PARCIALMENTE PUBLICADO"
  | "PUBLICADO";

export function parseOddInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") return null;
  if (!/^\d+(?:\.\d{1,4})?$/.test(normalized)) {
    throw new Error("Odd inválida. Use um número como 1,85.");
  }
  const odd = Number(normalized);
  if (!Number.isFinite(odd) || odd <= 1) {
    throw new Error("A odd precisa ser maior que 1,00.");
  }
  return odd;
}

export function getMarketOperationalStatus(statuses: string[]): MarketOperationalStatus {
  if (statuses.length === 0) return "SEM MERCADOS";
  const openCount = statuses.filter((status) => status === "OPEN").length;
  if (openCount === statuses.length) return "PUBLICADO";
  if (openCount > 0) return "PARCIALMENTE PUBLICADO";
  return "DRAFT";
}
