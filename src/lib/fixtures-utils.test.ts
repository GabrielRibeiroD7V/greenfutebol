import { describe, expect, it, vi } from "vitest";
import {
  addCalendarDays,
  formatFixtureDateTime,
  getFixturesErrorMessage,
  getDateInTimezone,
  isValidIsoDate,
  withTimeout,
} from "./fixtures-utils";

describe("fixtures-utils", () => {
  it("formats a Campo Grande calendar date", () => {
    expect(getDateInTimezone(new Date("2026-08-08T02:00:00Z"))).toBe("2026-08-07");
  });

  it("adds days without local timezone drift", () => {
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("validates real ISO dates", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("invalid")).toBe(false);
  });

  it("shows weekday, date and Campo Grande time", () => {
    expect(formatFixtureDateTime("2026-08-08T20:00:00Z", false, new Date("2026-01-01T16:00:00Z"))).toBe(
      "Sáb, 08/08 • 16:00",
    );
  });

  it("includes the year when it differs", () => {
    expect(formatFixtureDateTime("2027-08-08T20:00:00Z", true, new Date("2026-01-01"))).toBe(
      "08/08/2027 • 16:00",
    );
  });

  it("rejects a request that exceeds its timeout", async () => {
    vi.useFakeTimers();
    const assertion = expect(
      withTimeout(new Promise<string>(() => undefined), 1000),
    ).rejects.toThrow("FIXTURES_TIMEOUT");
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    vi.useRealTimers();
  });

  it("maps provider and connectivity errors to specific messages", () => {
    expect(getFixturesErrorMessage(new Error("FIXTURES_TIMEOUT"))).toBe(
      "Não foi possível atualizar os jogos.",
    );
    expect(getFixturesErrorMessage({ status: 429 })).toContain("Muitas consultas");
    expect(getFixturesErrorMessage({ context: { status: 403 } })).toContain(
      "Algumas competições",
    );
    expect(getFixturesErrorMessage(new Error("Failed to fetch"))).toBe(
      "Verifique sua conexão.",
    );
  });
});
