import { z } from "zod";

// Product limits live in configuration, not code (docs/01 §6). Defaults match the docs.
const bool = z
  .enum(["true", "false"])
  .transform((v) => v === "true");

const schema = z.object({
  TRIAL_LIMIT_ENABLED: bool.default(true),
  TRIAL_LIMIT_MINUTES: z.coerce.number().positive().default(5),
  SESSION_TARGET_MINUTES: z.coerce.number().positive().default(5),
  SESSION_GRACE_SECONDS: z.coerce.number().positive().default(120),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().positive().default(50),
  SILENCE_HINT_PULSE_SECONDS: z.coerce.number().positive().default(10),
  SILENCE_NUDGE_SECONDS: z.coerce.number().positive().default(25),
  UNCLEAR_MAX_RETRIES: z.coerce.number().int().min(0).default(1),
  MAX_RECORDING_SECONDS: z.coerce.number().positive().default(30),
  MIN_SPEECH_MS: z.coerce.number().positive().default(250),
  IDLE_PAUSE_SECONDS: z.coerce.number().positive().default(90),
  RECONNECT_WINDOW_SECONDS: z.coerce.number().positive().default(120),
  TRIAL_ACCOUNTS_PER_IP_PER_DAY: z.coerce.number().int().positive().default(3),
  MAX_LEARNER_TURNS: z.coerce.number().int().positive().default(40),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  // Treat empty strings as unset so `.env` placeholders fall back to defaults.
  const cleaned = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v !== ""),
  );
  return schema.parse(cleaned);
}
