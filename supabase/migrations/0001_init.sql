-- Lactice initial schema (docs/10). Supabase provides auth.users and auth.uid().
-- All writes happen server-side with the service role; clients only read their own rows via RLS.

-- ---------- enums ----------
create type target_lang as enum ('ja', 'de', 'en');
create type cefr_level as enum ('A1', 'A2', 'B1', 'B2');
create type strictness as enum ('relaxed', 'balanced', 'strict');
create type skill as enum ('grammar', 'vocabulary', 'fluency', 'comprehension');
create type session_status as enum ('active', 'suspended', 'ended');
create type end_reason as enum ('time', 'trial', 'budget', 'user', 'turn_cap', 'grace', 'disconnect', 'error', 'unsafe');
create type turn_role as enum ('tutor', 'learner', 'system');
create type turn_category as enum (
  'NO_SPEECH','UNCLEAR_AUDIO','AMBIGUOUS','UNDERSTOOD','UNDERSTOOD_OFF_TOPIC',
  'L1_HELP_REQUEST','L1_ANSWER','DONT_KNOW','META_REQUEST','UNSAFE','PROVIDER_ERROR');
create type card_type as enum ('fix', 'alternative', 'praise');
create type correction_status as enum ('shown', 'dropped');
create type correction_report as enum ('was_correct', 'misheard', 'other');
create type usage_kind as enum ('stt', 'llm', 'tts', 'moderation');

-- ---------- profiles & learner ----------
create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text not null,
  email               text not null,
  adult_confirmed_at  timestamptz,
  privacy_notice_ver  text,
  privacy_accepted_at timestamptz,
  audio_opt_in        boolean not null default false,
  audio_opt_in_at     timestamptz,
  trial_seconds_used  integer not null default 0 check (trial_seconds_used >= 0),
  active_language_id  uuid,
  prefs               jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create table learner_languages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  target          target_lang not null,
  native_lang     text not null,
  self_level      cefr_level not null,
  motivations     text[] not null default '{}',
  strictness      strictness not null default 'balanced',
  display         jsonb not null default '{}',
  onboarding_done boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (user_id, target),
  constraint en_min_a2 check (target <> 'en' or self_level <> 'A1')
);

create table skill_estimates (
  learner_language_id uuid not null references learner_languages(id) on delete cascade,
  skill        skill not null,
  score        real not null,
  uncertainty  real not null,
  level        cefr_level not null,
  sessions_n   integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (learner_language_id, skill)
);

-- ---------- sessions & turns ----------
create table sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles(id) on delete cascade,
  learner_language_id uuid not null references learner_languages(id) on delete cascade,
  tutor_id            text not null,
  config_versions     jsonb not null,
  level_at_start      cefr_level not null,
  topic               jsonb,
  goals               jsonb not null default '[]',
  state               jsonb not null,
  status              session_status not null default 'active',
  end_reason          end_reason,
  started_at          timestamptz not null default now(),
  last_activity_at    timestamptz not null default now(),
  ended_at            timestamptz,
  active_seconds      integer not null default 0,
  learner_speech_ms   integer not null default 0,
  learner_turns       integer not null default 0,
  hints_used          integer not null default 0,
  cost_usd            numeric(10,5) not null default 0,
  summary             jsonb,
  flagged             boolean not null default false,
  flag_reasons        text[] not null default '{}'
);
create index on sessions (user_id, started_at desc);
create index on sessions (flagged) where flagged;
create index on sessions (status) where status <> 'ended';

create table level_estimate_history (
  id                  bigint generated always as identity primary key,
  learner_language_id uuid not null references learner_languages(id) on delete cascade,
  session_id          uuid references sessions(id) on delete set null,
  skill               skill not null,
  score_before        real not null,
  score_after         real not null,
  evidence            jsonb not null,
  created_at          timestamptz not null default now()
);

create table turns (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references sessions(id) on delete cascade,
  seq               integer not null,
  role              turn_role not null,
  category          turn_category,
  transcript        text,
  asr               jsonb,
  analysis          jsonb,
  action            text,
  text              text,
  segments          jsonb,
  template_id       text,
  latency           jsonb,
  audio_path        text,
  audio_expires_at  timestamptz,
  idempotency_key   text,
  created_at        timestamptz not null default now(),
  unique (session_id, seq),
  unique (session_id, idempotency_key)
);

create table corrections (
  id                  uuid primary key default gen_random_uuid(),
  turn_id             uuid not null references turns(id) on delete cascade,
  session_id          uuid not null references sessions(id) on delete cascade,
  learner_language_id uuid not null references learner_languages(id) on delete cascade,
  error_code          text not null,
  severity            smallint not null check (severity between 1 and 3),
  card                card_type not null,
  original            text not null,
  corrected           text not null,
  explanation         text not null,
  spoken_recast       boolean not null default false,
  status              correction_status not null,
  drop_reason         text,
  try_again_attempts  smallint not null default 0,
  fixed_on_retry      boolean,
  verified            boolean,
  user_report         correction_report,
  user_report_note    text,
  created_at          timestamptz not null default now(),
  -- A dropped correction must say why; a shown one must not carry a drop reason.
  constraint drop_reason_consistent check ((status = 'dropped') = (drop_reason is not null))
);
create index on corrections (learner_language_id, error_code);

create table mistake_patterns (
  learner_language_id uuid not null references learner_languages(id) on delete cascade,
  error_code     text not null,
  occurrences    integer not null,
  sessions_n     integer not null,
  correct_uses_n integer not null default 0,
  first_seen     timestamptz not null,
  last_seen      timestamptz not null,
  examples       jsonb not null,
  status         text not null default 'active' check (status in ('active','improving','resolved')),
  primary key (learner_language_id, error_code)
);

create table vocabulary_items (
  id                  uuid primary key default gen_random_uuid(),
  learner_language_id uuid not null references learner_languages(id) on delete cascade,
  lemma               text not null,
  surface             text,
  reading             text,
  meaning             text not null,
  example             text,
  source_session_id   uuid references sessions(id) on delete set null,
  saved               boolean not null default false,
  times_seen          integer not null default 1,
  times_used          integer not null default 0,
  created_at          timestamptz not null default now(),
  unique (learner_language_id, lemma)
);

-- ---------- cost, limits, abuse ----------
create table usage_ledger (
  id          bigint generated always as identity primary key,
  user_id     uuid references profiles(id) on delete set null,
  session_id  uuid references sessions(id) on delete set null,
  turn_id     uuid,
  kind        usage_kind not null,
  provider    text not null,
  model       text not null,
  units       numeric not null,
  unit_type   text not null,
  cost_usd    numeric(10,6) not null check (cost_usd >= 0),
  price_ver   text not null,
  created_at  timestamptz not null default now()
);
create index on usage_ledger (created_at);

create table monthly_spend (
  month      date primary key,
  cost_usd   numeric(12,6) not null default 0,
  updated_at timestamptz not null default now()
);

create table trial_ip_registrations (
  ip_hash text not null,
  day     date not null,
  count   integer not null default 0,
  primary key (ip_hash, day)
);

create table rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key, window_start)
);

-- ---------- consent, waitlist, compliance ----------
create table consent_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null check (kind in ('adult_confirmation','privacy_notice','audio_retention','analytics')),
  version    text not null,
  granted    boolean not null,
  created_at timestamptz not null default now()
);

create table waitlist (
  user_id      uuid primary key references profiles(id) on delete cascade,
  email        text not null,
  price_answer text check (price_answer in ('199','399','799','other')),
  price_other  text,
  created_at   timestamptz not null default now()
);

-- Content-free processing logs kept 1 year even after account deletion (docs/14 §4; pending legal advice).
create table compliance_logs (
  id            bigint generated always as identity primary key,
  subject_hash  text not null,
  event         text not null,
  detail        jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  purge_after   timestamptz not null
);

-- ---------- atomic helpers (service role) ----------
-- Records one provider call and updates the month-to-date total in a single transaction.
create function record_usage(
  p_user uuid, p_session uuid, p_turn uuid, p_kind usage_kind, p_provider text, p_model text,
  p_units numeric, p_unit_type text, p_cost numeric, p_price_ver text
) returns numeric language plpgsql as $$
declare
  m date := date_trunc('month', now() at time zone 'utc')::date;
  total numeric;
begin
  insert into usage_ledger (user_id, session_id, turn_id, kind, provider, model, units, unit_type, cost_usd, price_ver)
  values (p_user, p_session, p_turn, p_kind, p_provider, p_model, p_units, p_unit_type, p_cost, p_price_ver);

  insert into monthly_spend (month, cost_usd) values (m, p_cost)
  on conflict (month) do update set cost_usd = monthly_spend.cost_usd + excluded.cost_usd, updated_at = now()
  returning cost_usd into total;

  if p_session is not null then
    update sessions set cost_usd = cost_usd + p_cost where id = p_session;
  end if;
  return total;
end $$;

-- Adds active seconds to the one-time trial allowance, never exceeding the cap.
create function add_trial_seconds(p_user uuid, p_seconds integer, p_cap integer) returns integer
language sql as $$
  update profiles set trial_seconds_used = least(p_cap, trial_seconds_used + greatest(0, p_seconds))
  where id = p_user returning trial_seconds_used;
$$;

-- Counts a new trial account for an IP hash today; returns false once the daily limit is hit.
create function register_trial_ip(p_ip_hash text, p_limit integer) returns boolean
language plpgsql as $$
declare c integer;
begin
  insert into trial_ip_registrations (ip_hash, day, count) values (p_ip_hash, current_date, 1)
  on conflict (ip_hash, day) do update set count = trial_ip_registrations.count + 1
  returning count into c;
  if c > p_limit then
    update trial_ip_registrations set count = count - 1 where ip_hash = p_ip_hash and day = current_date;
    return false;
  end if;
  return true;
end $$;

-- Optimistic-concurrency state write: returns false if the state version moved (duplicate/concurrent turn).
create function write_session_state(p_session uuid, p_state jsonb, p_expected_version integer, p_active_seconds integer)
returns boolean language plpgsql as $$
declare n integer;
begin
  update sessions
     set state = p_state, last_activity_at = now(), active_seconds = p_active_seconds
   where id = p_session and (state->>'stateVersion')::int = p_expected_version;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- ---------- row-level security ----------
alter table profiles enable row level security;
alter table learner_languages enable row level security;
alter table skill_estimates enable row level security;
alter table sessions enable row level security;
alter table level_estimate_history enable row level security;
alter table turns enable row level security;
alter table corrections enable row level security;
alter table mistake_patterns enable row level security;
alter table vocabulary_items enable row level security;
alter table usage_ledger enable row level security;
alter table monthly_spend enable row level security;
alter table trial_ip_registrations enable row level security;
alter table rate_limits enable row level security;
alter table consent_events enable row level security;
alter table waitlist enable row level security;
alter table compliance_logs enable row level security;

-- Owner read-only policies. No client write policies exist: writes use the service role.
create policy own_read on profiles for select using (id = auth.uid());
create policy own_read on learner_languages for select using (user_id = auth.uid());
create policy own_read on sessions for select using (user_id = auth.uid());
create policy own_read on waitlist for select using (user_id = auth.uid());

create policy own_read on skill_estimates for select
  using (exists (select 1 from learner_languages l where l.id = learner_language_id and l.user_id = auth.uid()));
create policy own_read on level_estimate_history for select
  using (exists (select 1 from learner_languages l where l.id = learner_language_id and l.user_id = auth.uid()));
create policy own_read on mistake_patterns for select
  using (exists (select 1 from learner_languages l where l.id = learner_language_id and l.user_id = auth.uid()));
create policy own_read on vocabulary_items for select
  using (exists (select 1 from learner_languages l where l.id = learner_language_id and l.user_id = auth.uid()));
create policy own_read on turns for select
  using (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy own_read on corrections for select
  using (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()));
-- usage_ledger, monthly_spend, trial_ip_registrations, rate_limits, consent_events, compliance_logs:
-- RLS enabled with no client policy => invisible to clients (service role only).

-- ---------- defence in depth ----------
-- Supabase grants table privileges to anon/authenticated by default and relies on RLS alone.
-- Clients never write directly (service role only), so remove write privileges as a second barrier.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke insert, update, delete, truncate on all tables in schema public from %I', r);
    end if;
  end loop;
end $$;

-- Functions are executable by PUBLIC by default: lock them to the service role only,
-- including any function added by later migrations.
revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on all functions in schema public to service_role;
  end if;
end $$;
