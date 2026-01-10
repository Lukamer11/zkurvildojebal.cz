create extension if not exists pgcrypto;

create table if not exists player_stats (
  user_id uuid primary key,
  level int not null default 1,
  xp numeric not null default 0,
  money numeric not null default 0,
  cigarettes numeric not null default 0,
  energy numeric not null default 100,
  max_energy numeric not null default 100,
  stats jsonb not null default '{}'::jsonb,
  upgrade_costs jsonb not null default '{}'::jsonb,
  inventory jsonb not null default '[]'::jsonb,
  equipped jsonb not null default '{}'::jsonb,
  flags jsonb not null default '{}'::jsonb,
  clicker jsonb not null default '{}'::jsonb,
  missionData jsonb not null default '{}'::jsonb
);

alter table if exists player_stats add column if not exists level int not null default 1;
alter table if exists player_stats add column if not exists xp numeric not null default 0;
alter table if exists player_stats add column if not exists money numeric not null default 0;
alter table if exists player_stats add column if not exists cigarettes numeric not null default 0;
alter table if exists player_stats add column if not exists energy numeric not null default 100;
alter table if exists player_stats add column if not exists max_energy numeric not null default 100;
alter table if exists player_stats add column if not exists stats jsonb not null default '{}'::jsonb;
alter table if exists player_stats add column if not exists upgrade_costs jsonb not null default '{}'::jsonb;
alter table if exists player_stats add column if not exists inventory jsonb not null default '[]'::jsonb;
alter table if exists player_stats add column if not exists equipped jsonb not null default '{}'::jsonb;
alter table if exists player_stats add column if not exists flags jsonb not null default '{}'::jsonb;
alter table if exists player_stats add column if not exists clicker jsonb not null default '{}'::jsonb;
alter table if exists player_stats add column if not exists missionData jsonb not null default '{}'::jsonb;

create table if not exists crypta_fights (
  user_id uuid primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function set_crypta_fights_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists crypta_fights_set_updated_at on crypta_fights;
create trigger crypta_fights_set_updated_at
before update on crypta_fights
for each row execute procedure set_crypta_fights_updated_at();
