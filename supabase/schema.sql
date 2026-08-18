-- Rode isso no SQL Editor do seu projeto Supabase (Database > SQL Editor).

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nome text not null,
  whatsapp text not null,
  tempo_orcamento text,
  faixa_perdida text,
  respostas jsonb not null default '[]'::jsonb
);

alter table public.leads enable row level security;

-- Só permite INSERT vindo do client público (anon key).
-- Sem policy de SELECT/UPDATE/DELETE = ninguém lê, edita ou apaga pelo client;
-- só quem acessa o painel do Supabase (ou a service key, nunca exposta no front).
create policy "public can insert leads"
  on public.leads
  for insert
  to anon
  with check (true);
