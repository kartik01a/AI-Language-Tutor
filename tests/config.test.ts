import { describe, expect, it } from "vitest";
import { loadConfig } from "@/lib/config";

describe("config", () => {
  it("uses the documented defaults", () => {
    const c = loadConfig({});
    expect(c.TRIAL_LIMIT_ENABLED).toBe(true);
    expect(c.TRIAL_LIMIT_MINUTES).toBe(5);
    expect(c.SESSION_TARGET_MINUTES).toBe(5);
    expect(c.UNCLEAR_MAX_RETRIES).toBe(1);
    expect(c.AI_MONTHLY_BUDGET_USD).toBe(50);
  });

  it("honours overrides, e.g. trial off or 10 minutes", () => {
    const c = loadConfig({ TRIAL_LIMIT_ENABLED: "false", TRIAL_LIMIT_MINUTES: "10" });
    expect(c.TRIAL_LIMIT_ENABLED).toBe(false);
    expect(c.TRIAL_LIMIT_MINUTES).toBe(10);
  });

  it("treats empty strings as unset", () => {
    expect(loadConfig({ TRIAL_LIMIT_MINUTES: "" }).TRIAL_LIMIT_MINUTES).toBe(5);
  });

  it("rejects nonsense values", () => {
    expect(() => loadConfig({ TRIAL_LIMIT_ENABLED: "maybe" })).toThrow();
    expect(() => loadConfig({ SESSION_TARGET_MINUTES: "-1" })).toThrow();
  });
});
