-- Run history metadata (no input/output files are stored in v1).
create table if not exists public.runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tool_id       text not null,
  tool_version  text not null,
  created_at    timestamptz not null default now(),
  input_names   text[] not null default '{}',
  row_counts    jsonb  not null default '{}'::jsonb,
  warnings      text[] not null default '{}'
);

create index if not exists runs_user_created_idx on public.runs (user_id, created_at desc);

-- Row-Level Security: a user can only see and create their own runs.
alter table public.runs enable row level security;

drop policy if exists "runs_select_own" on public.runs;
create policy "runs_select_own" on public.runs
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "runs_insert_own" on public.runs;
create policy "runs_insert_own" on public.runs
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "runs_delete_own" on public.runs;
create policy "runs_delete_own" on public.runs
  for delete to authenticated using (user_id = auth.uid());
