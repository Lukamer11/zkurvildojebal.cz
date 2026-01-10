create extension if not exists pgcrypto;

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

alter table if exists player_stats add column if not exists flags jsonb not null default '{}'::jsonb;
alter table if exists player_stats add column if not exists clicker jsonb not null default '{}'::jsonb;
alter table if exists player_stats add column if not exists missionData jsonb not null default '{}'::jsonb;
