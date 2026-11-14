-- Stores each run's output workbook so it can be re-downloaded from run history.
-- Run this once in the Supabase SQL Editor (after 0001_runs.sql).

alter table public.runs
  add column if not exists output_path text,
  add column if not exists output_name text;

-- Allow a user to update their own runs (used to clear the output path when a file expires).
drop policy if exists "runs_update_own" on public.runs;
create policy "runs_update_own" on public.runs
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Private bucket for outputs. Files live at <user_id>/<run_id>.xlsx.
insert into storage.buckets (id, name, public)
values ('run-outputs', 'run-outputs', false)
on conflict (id) do nothing;

drop policy if exists "run_outputs_select_own" on storage.objects;
create policy "run_outputs_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'run-outputs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "run_outputs_insert_own" on storage.objects;
create policy "run_outputs_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'run-outputs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "run_outputs_delete_own" on storage.objects;
create policy "run_outputs_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'run-outputs' and (storage.foldername(name))[1] = auth.uid()::text);
