-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists funds (
  scheme_code     integer primary key,
  name            text not null,
  category        text,
  benchmark_code  integer,
  benchmark_name  text,
  peer_codes      jsonb not null default '[]'::jsonb,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists nav_history (
  scheme_code integer not null,
  date        date not null,
  nav         numeric(18, 6) not null,
  unique (scheme_code, date)
);
create index if not exists nav_history_code_date on nav_history (scheme_code, date desc);

create table if not exists market_news (
  id           bigserial primary key,
  link         text not null unique,
  title        text not null,
  description  text,
  source       text,
  published_at timestamptz
);
create index if not exists market_news_published on market_news (published_at desc);

create table if not exists weekly_snapshots (
  week_ending date not null,
  scheme_code integer not null,
  wow numeric, mom numeric, ytd numeric,
  bench_wow numeric, bench_mom numeric, bench_ytd numeric,
  cat_wow numeric, cat_mom numeric, cat_ytd numeric,
  unique (week_ending, scheme_code)
);

create table if not exists reports (
  id             bigserial primary key,
  week_ending    date not null unique,
  market_context jsonb,
  report         jsonb,
  verdict        text,
  email_sent     boolean not null default false,
  created_at     timestamptz not null default now()
);

-- The app only talks to Supabase from the server with the service-role key,
-- so lock the tables against the public anon key.
alter table funds            enable row level security;
alter table nav_history      enable row level security;
alter table market_news      enable row level security;
alter table weekly_snapshots enable row level security;
alter table reports          enable row level security;

-- When each scheduled job last ran, for the dashboard's "Last updated" panel.
create table if not exists job_runs (
  job     text primary key,          -- 'daily' | 'weekly'
  ran_at  timestamptz not null default now(),
  ok      boolean not null default true,
  detail  jsonb
);
alter table job_runs enable row level security;
