-- Simulation GM3 - schema Supabase per la tabella "cues"
-- Incollare in Supabase Dashboard -> SQL Editor -> New query -> Run

create table if not exists public.cues (
  id bigint generated always as identity primary key,
  name text not null,
  fade_time numeric not null default 3,
  effect text not null default 'none' check (effect in ('none', 'chaser', 'rainbow', 'strobe')),
  faders jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Abilita Row Level Security (richiesto da Supabase per l'accesso via anon key)
alter table public.cues enable row level security;

-- Demo/training: accesso pubblico in lettura/scrittura con la anon key.
-- Non usare questa policy per dati reali/produzione multi-utente.
create policy "public read" on public.cues for select using (true);
create policy "public insert" on public.cues for insert with check (true);
create policy "public delete" on public.cues for delete using (true);

-- Abilita Realtime sulla tabella (Database -> Replication in dashboard,
-- oppure via SQL se il progetto lo supporta):
alter publication supabase_realtime add table public.cues;
