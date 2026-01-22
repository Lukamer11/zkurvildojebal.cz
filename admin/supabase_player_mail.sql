-- Supabase: ONLINE mail (player_mail)
-- Spusť v SQL editoru v Supabase.

create table if not exists public.player_mail (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  from_name text not null,
  to_name text not null,
  subject text,
  body text not null,
  created_at timestamptz not null default now(),
  unread boolean not null default true,
  important boolean not null default false,
  kind text not null default 'player'
);

create index if not exists player_mail_user_id_idx on public.player_mail (user_id);
create index if not exists player_mail_created_at_idx on public.player_mail (created_at desc);

-- RLS
alter table public.player_mail enable row level security;

-- Čtení jen vlastní pošty
create policy if not exists "player_mail_select_own"
on public.player_mail for select
using (auth.uid() = user_id);

-- Vkládání jen do vlastní pošty
create policy if not exists "player_mail_insert_own"
on public.player_mail for insert
with check (auth.uid() = user_id);

-- Update jen vlastní pošty
create policy if not exists "player_mail_update_own"
on public.player_mail for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Mazání jen vlastní pošty
create policy if not exists "player_mail_delete_own"
on public.player_mail for delete
using (auth.uid() = user_id);
