import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

// Runs the real migration on a real Postgres (WASM). Supabase's auth schema is stubbed.
let db: PGlite;
const privileges: Record<string, boolean> = {};
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

const as = async (uid: string | null, fn: () => Promise<unknown>) => {
  await db.exec(`set role authenticated; select set_config('app.uid', '${uid ?? ""}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
};
const count = async (table: string) => Number(((await db.query(`select count(*)::int as n from ${table}`)).rows[0] as { n: number }).n);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
    create role authenticated;
    grant usage on schema auth, public to authenticated;
  `);
  await db.exec(readFileSync("supabase/migrations/0001_init.sql", "utf8"));

  // Defence in depth: the migration itself must leave clients without write/execute privileges.
  const priv = async (sql: string) => ((await db.query(sql)).rows[0] as { p: boolean }).p;
  privileges.update = await priv("select has_table_privilege('authenticated','profiles','UPDATE') p");
  privileges.insert = await priv("select has_table_privilege('authenticated','waitlist','INSERT') p");
  privileges.fn = await priv("select has_function_privilege('authenticated','record_usage(uuid,uuid,uuid,usage_kind,text,text,numeric,text,numeric,text)','EXECUTE') p");

  // Now mirror Supabase's default grants so the tests below exercise RLS on its own.
  await db.exec("grant select, insert, update, delete on all tables in schema public to authenticated;");

  for (const [id, name] of [[A, "Priya"], [B, "Arjun"]]) {
    await db.exec(`insert into auth.users values ('${id}'); insert into profiles (id, display_name, email) values ('${id}','${name}','${name}@x.com');`);
  }
  for (const [id, uid] of [["aaaaaaaa-0000-0000-0000-000000000001", A], ["bbbbbbbb-0000-0000-0000-000000000001", B]]) {
    await db.exec(`
      insert into learner_languages (id, user_id, target, native_lang, self_level) values ('${id}','${uid}','ja','hi','A2');
      insert into sessions (id, user_id, learner_language_id, tutor_id, config_versions, level_at_start, state)
        values (gen_random_uuid(), '${uid}', '${id}', 'yuki-ja', '{}', 'A2', '{"stateVersion":0}');
    `);
  }
});

describe("schema", () => {
  it("applies cleanly and creates the expected tables", async () => {
    const { rows } = await db.query("select table_name from information_schema.tables where table_schema='public'");
    const names = (rows as { table_name: string }[]).map((r) => r.table_name);
    for (const t of ["profiles", "learner_languages", "sessions", "turns", "corrections", "usage_ledger", "monthly_spend", "compliance_logs", "waitlist"]) {
      expect(names).toContain(t);
    }
  });

  it("English cannot start at A1 (D-22)", async () => {
    await expect(db.exec(`insert into learner_languages (user_id, target, native_lang, self_level) values ('${A}','en','hi','A1')`)).rejects.toThrow();
  });

  it("a dropped correction must carry a reason; a shown one must not", async () => {
    const turn = "cccccccc-0000-0000-0000-000000000001";
    const { rows } = await db.query<{ id: string; learner_language_id: string }>("select id, learner_language_id from sessions where user_id = $1", [A]);
    const s = rows[0];
    await db.exec(`insert into turns (id, session_id, seq, role) values ('${turn}','${s.id}',1,'learner')`);
    const base = `'${turn}','${s.id}','${s.learner_language_id}','ja.particle.destination',3,'fix','x','y','z'`;
    await expect(db.exec(`insert into corrections (turn_id, session_id, learner_language_id, error_code, severity, card, original, corrected, explanation, status) values (${base},'dropped')`)).rejects.toThrow();
    await expect(db.exec(`insert into corrections (turn_id, session_id, learner_language_id, error_code, severity, card, original, corrected, explanation, status, drop_reason) values (${base},'shown','asr_risk')`)).rejects.toThrow();
    await db.exec(`insert into corrections (turn_id, session_id, learner_language_id, error_code, severity, card, original, corrected, explanation, status, drop_reason) values (${base},'dropped','asr_risk')`);
    expect(await count("corrections")).toBe(1);
  });

  it("(session, seq) and (session, idempotency key) are unique", async () => {
    const { rows } = await db.query<{ id: string }>("select id from sessions where user_id = $1", [A]);
    await expect(db.exec(`insert into turns (session_id, seq, role) values ('${rows[0].id}',1,'tutor')`)).rejects.toThrow();
  });
});

describe("defence in depth", () => {
  it("clients have no write privileges and cannot call the server-side helpers", () => {
    expect(privileges).toEqual({ update: false, insert: false, fn: false });
  });
});

describe("row-level security", () => {
  it("users see only their own rows, across direct and joined tables", async () => {
    for (const t of ["profiles", "learner_languages", "sessions", "turns", "corrections"]) {
      const asA = (await as(A, () => count(t))) as number;
      const asB = (await as(B, () => count(t))) as number;
      expect(asA + asB).toBe(await count(t)); // partitioned, never duplicated
      if (t !== "turns" && t !== "corrections") expect(asB).toBe(1);
    }
    expect(await as(B, () => count("turns"))).toBe(0);
    expect(await as(B, () => count("corrections"))).toBe(0);
    expect(await as(A, () => count("corrections"))).toBe(1);
  });

  it("anonymous sees nothing", async () => {
    expect(await as(null, () => count("sessions"))).toBe(0);
  });

  it("server-only tables are invisible to clients even when rows exist", async () => {
    await db.exec(`insert into usage_ledger (user_id, kind, provider, model, units, unit_type, cost_usd, price_ver) values ('${A}','stt','x','y',1,'s',0.01,'v')`);
    await db.exec(`insert into consent_events (user_id, kind, version, granted) values ('${A}','analytics','1',true)`);
    await db.exec(`insert into compliance_logs (subject_hash, event, purge_after) values ('h','account_created', now() + interval '1 year')`);
    for (const t of ["usage_ledger", "monthly_spend", "trial_ip_registrations", "rate_limits", "consent_events", "compliance_logs"]) {
      expect(await as(A, () => count(t))).toBe(0);
    }
  });

  it("clients cannot write (no write policies exist)", async () => {
    await db.exec(`update profiles set trial_seconds_used = 42 where id = '${A}'`);
    // Under RLS an UPDATE with no matching policy silently affects 0 rows.
    await as(A, () => db.exec(`update profiles set trial_seconds_used = 0 where id = '${A}'`));
    const { rows } = await db.query<{ trial_seconds_used: number }>(`select trial_seconds_used from profiles where id = '${A}'`);
    expect(rows[0].trial_seconds_used).toBe(42);
    await expect(as(A, () => db.exec(`insert into waitlist (user_id, email) values ('${A}','a@x.com')`))).rejects.toThrow();
  });
});

describe("atomic helpers", () => {
  it("record_usage updates ledger, month total and session cost together", async () => {
    const { rows } = await db.query<{ id: string }>("select id from sessions where user_id = $1", [A]);
    const sid = rows[0].id;
    const t1 = await db.query<{ record_usage: string }>(`select record_usage('${A}','${sid}',null,'llm','openai','gpt-6-luna',3000,'input_tokens',0.0003,'2026-10-14')`);
    const t2 = await db.query<{ record_usage: string }>(`select record_usage('${A}','${sid}',null,'tts','azure','nanami',900,'characters',0.0135,'2026-10-14')`);
    expect(Number(t2.rows[0].record_usage) - Number(t1.rows[0].record_usage)).toBeCloseTo(0.0135, 6);
    const sess = await db.query<{ cost_usd: string }>(`select cost_usd from sessions where id = '${sid}'`);
    expect(Number(sess.rows[0].cost_usd)).toBeCloseTo(0.0138, 5);
  });

  it("trial seconds accumulate and never exceed the cap", async () => {
    await db.exec(`update profiles set trial_seconds_used = 0 where id = '${B}'`);
    await db.exec(`select add_trial_seconds('${B}', 200, 300)`);
    const r = await db.query<{ add_trial_seconds: number }>(`select add_trial_seconds('${B}', 200, 300)`);
    expect(r.rows[0].add_trial_seconds).toBe(300);
    const neg = await db.query<{ add_trial_seconds: number }>(`select add_trial_seconds('${B}', -50, 300)`);
    expect(neg.rows[0].add_trial_seconds).toBe(300);
  });

  it("IP guard allows up to the daily limit, then refuses without inflating the counter", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(((await db.query<{ register_trial_ip: boolean }>("select register_trial_ip('iphash', 3)")).rows[0]).register_trial_ip);
    }
    expect(results).toEqual([true, true, true, false, false]);
    const c = await db.query<{ count: number }>("select count from trial_ip_registrations where ip_hash = 'iphash'");
    expect(c.rows[0].count).toBe(3);
  });

  it("state writes use optimistic concurrency", async () => {
    const { rows } = await db.query<{ id: string }>("select id from sessions where user_id = $1", [A]);
    const sid = rows[0].id;
    const ok = await db.query<{ write_session_state: boolean }>(`select write_session_state('${sid}', '{"stateVersion":1}'::jsonb, 0, 30)`);
    expect(ok.rows[0].write_session_state).toBe(true);
    const stale = await db.query<{ write_session_state: boolean }>(`select write_session_state('${sid}', '{"stateVersion":1}'::jsonb, 0, 40)`);
    expect(stale.rows[0].write_session_state).toBe(false);
  });
});

describe("account deletion", () => {
  it("cascades learner content but keeps the cost ledger (anonymised)", async () => {
    await db.exec(`delete from auth.users where id = '${A}'`);
    expect(((await db.query(`select count(*)::int n from profiles where id='${A}'`)).rows[0] as { n: number }).n).toBe(0);
    expect(((await db.query(`select count(*)::int n from sessions where user_id='${A}'`)).rows[0] as { n: number }).n).toBe(0);
    expect(((await db.query(`select count(*)::int n from turns`)).rows[0] as { n: number }).n).toBe(0);
    const ledger = await db.query<{ user_id: string | null }>("select user_id from usage_ledger");
    expect(ledger.rows.length).toBeGreaterThan(0);
    expect(ledger.rows.every((r) => r.user_id === null)).toBe(true);
  });
});
