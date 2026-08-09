export const APP_TIMEZONE = "America/Campo_Grande";
export const FUTURE_SEARCH_LIMIT = 14;
export const FIXTURES_REQUEST_TIMEOUT_MS = 12_000;

export function getDateInTimezone(date: Date, timeZone = APP_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

export function isValidIsoDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const year = Number(date.slice(0, 4));
  if (year < 2000 || year > 2100) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function formatFixtureDateTime(iso: string, showFullDate = false, now = new Date()): string {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  if (!showFullDate) {
    const weekday = new Intl.DateTimeFormat("pt-BR", {
      timeZone: APP_TIMEZONE,
      weekday: "short",
    })
      .format(date)
      .replace(".", "");
    const datePart = new Intl.DateTimeFormat("pt-BR", {
      timeZone: APP_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
    }).format(date);
    const label = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return `${label}, ${datePart} • ${time}`;
  }

  const datePart = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  const year = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
  }).format(date);
  const currentYear = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
  }).format(now);

  return year === currentYear
    ? `${datePart} • ${time}`
    : `${datePart}/${year} • ${time}`;
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("FIXTURES_TIMEOUT")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function getFixturesErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "FIXTURES_TIMEOUT") {
    return "Não foi possível atualizar os jogos.";
  }

  const candidate = error as {
    message?: string;
    status?: number;
    context?: { status?: number };
  } | null;
  const status = candidate?.status ?? candidate?.context?.status;
  const message = candidate?.message?.toLowerCase() ?? "";

  if (status === 429 || message.includes("429")) {
    return "Muitas consultas foram realizadas. Aguarde alguns instantes.";
  }
  if (status === 403 || message.includes("403")) {
    return "Algumas competições não puderam ser consultadas.";
  }
  if (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("failed to fetch")
  ) {
    return "Verifique sua conexão.";
  }
  return "Não foi possível atualizar os jogos.";
}
