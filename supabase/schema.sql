-- Rode isso no SQL Editor do seu projeto Supabase (Database > SQL Editor).
-- Pode rodar o arquivo inteiro de novo sem medo, mesmo se a tabela já existir —
-- os comandos abaixo são todos "só cria se não existir".
--
-- Nome da tabela tem espaço e "|", por isso fica entre aspas duplas em todo lugar
-- (inclusive no código: supabase.from('MAX | QUIZ LEADS')).

create table if not exists public."MAX | QUIZ LEADS" (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nome text not null,
  whatsapp text not null,
  -- respostas do quiz por pergunta: { p1: { pergunta, resposta, valor }, p2: {...}, ... }
  respostas jsonb not null default '{}'::jsonb,
  -- utm_source, utm_medium, utm_campaign, utm_content, utm_term etc. capturados da URL de chegada
  utm jsonb not null default '{}'::jsonb
);

-- colunas geradas a partir do utm acima, só pra filtrar/ordenar fácil direto na tabela do Supabase
-- (sem precisar escrever query em jsonb) — são automáticas, o app não grava nelas diretamente.
-- Em "ADD COLUMN IF NOT EXISTS": se você já tinha a tabela de antes, isso adiciona só o que falta.
alter table public."MAX | QUIZ LEADS" add column if not exists utm_source text generated always as (utm ->> 'utm_source') stored;
alter table public."MAX | QUIZ LEADS" add column if not exists utm_medium text generated always as (utm ->> 'utm_medium') stored;
alter table public."MAX | QUIZ LEADS" add column if not exists utm_campaign text generated always as (utm ->> 'utm_campaign') stored;
alter table public."MAX | QUIZ LEADS" add column if not exists utm_content text generated always as (utm ->> 'utm_content') stored;

alter table public."MAX | QUIZ LEADS" enable row level security;

-- Só permite INSERT vindo do client público (anon key).
-- Sem policy de SELECT/UPDATE/DELETE = ninguém lê, edita ou apaga pelo client;
-- só quem acessa o painel do Supabase (ou a service key, nunca exposta no front).
drop policy if exists "public can insert leads" on public."MAX | QUIZ LEADS";
create policy "public can insert leads"
  on public."MAX | QUIZ LEADS"
  for insert
  to anon
  with check (true);

-- Acelera filtros por origem (ex: "quantos leads vieram da campanha X") no painel do Supabase.
create index if not exists leads_utm_source_idx on public."MAX | QUIZ LEADS" (utm_source);
create index if not exists leads_utm_campaign_idx on public."MAX | QUIZ LEADS" (utm_campaign);
