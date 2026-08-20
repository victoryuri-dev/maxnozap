-- Rode isso no SQL Editor do seu projeto Supabase (Database > SQL Editor).
-- Pode rodar o arquivo inteiro de novo sem medo, mesmo se a tabela já existir —
-- os comandos abaixo são todos "só cria se não existir".
--
-- Nome da tabela tem espaço e "|", por isso fica entre aspas duplas em todo lugar
-- (inclusive no código: supabase.from('MAX | QUIZ LEADS')).

create table if not exists public."MAX | QUIZ LEADS" (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lead pode estar vazio se a pessoa não preencheu o formulário
  nome text,
  whatsapp text,
  -- utm_source, utm_medium, utm_campaign, utm_content, utm_term etc. capturados da URL de chegada
  utm jsonb not null default '{}'::jsonb,
  -- Rastreio de funil — a pessoa sempre gera uma linha (mesmo antes de preencher o form)
  session_id uuid not null unique,
  furthest_step int not null default 0,
  furthest_label text not null default 'hero',
  completed boolean not null default false,
  duration_ms int not null default 0,
  -- uma coluna por pergunta (p1..p7) — preenchidas conforme a pessoa responde
  p1 text,
  p2 text,
  p3 text,
  p4 text,
  p5 text,
  p6 text,
  p7 text
);

-- colunas geradas a partir do utm acima, só pra filtrar/ordenar fácil direto na tabela do Supabase
-- (sem precisar escrever query em jsonb) — são automáticas, o app não grava nelas diretamente.
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
create index if not exists leads_session_idx on public."MAX | QUIZ LEADS" (session_id);
create index if not exists leads_completed_idx on public."MAX | QUIZ LEADS" (completed);

-- ============================================================================
-- UPSERT SEGURO — o client público não tem UPDATE direto na tabela.
-- Usa uma função (RPC) com SECURITY DEFINER para ir atualizando a sessão.
-- ============================================================================

create or replace function public.upsert_funnel_progress(
  p_session_id uuid,
  p_step int,
  p_label text,
  p_duration_ms int,
  p_completed boolean,
  p_utm jsonb,
  p_question_id text default null,
  p_answer_label text default null,
  p_nome text default null,
  p_whatsapp text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public."MAX | QUIZ LEADS" (
    session_id, furthest_step, furthest_label, duration_ms, completed, utm,
    p1, p2, p3, p4, p5, p6, p7, nome, whatsapp
  )
  values (
    p_session_id, p_step, p_label, p_duration_ms, p_completed, p_utm,
    case when p_question_id = 'p1' then p_answer_label end,
    case when p_question_id = 'p2' then p_answer_label end,
    case when p_question_id = 'p3' then p_answer_label end,
    case when p_question_id = 'p4' then p_answer_label end,
    case when p_question_id = 'p5' then p_answer_label end,
    case when p_question_id = 'p6' then p_answer_label end,
    case when p_question_id = 'p7' then p_answer_label end,
    p_nome,
    p_whatsapp
  )
  on conflict (session_id) do update set
    furthest_step = greatest("MAX | QUIZ LEADS".furthest_step, excluded.furthest_step),
    furthest_label = case
      when excluded.furthest_step >= "MAX | QUIZ LEADS".furthest_step then excluded.furthest_label
      else "MAX | QUIZ LEADS".furthest_label
    end,
    duration_ms = excluded.duration_ms,
    completed = "MAX | QUIZ LEADS".completed or excluded.completed,
    utm = excluded.utm,
    updated_at = now(),
    p1 = coalesce(excluded.p1, "MAX | QUIZ LEADS".p1),
    p2 = coalesce(excluded.p2, "MAX | QUIZ LEADS".p2),
    p3 = coalesce(excluded.p3, "MAX | QUIZ LEADS".p3),
    p4 = coalesce(excluded.p4, "MAX | QUIZ LEADS".p4),
    p5 = coalesce(excluded.p5, "MAX | QUIZ LEADS".p5),
    p6 = coalesce(excluded.p6, "MAX | QUIZ LEADS".p6),
    p7 = coalesce(excluded.p7, "MAX | QUIZ LEADS".p7),
    nome = coalesce(excluded.nome, "MAX | QUIZ LEADS".nome),
    whatsapp = coalesce(excluded.whatsapp, "MAX | QUIZ LEADS".whatsapp);
end;
$$;

grant execute on function public.upsert_funnel_progress(uuid, int, text, int, boolean, jsonb, text, text, text, text) to anon;

-- ============================================================================
-- LIMPEZA (OPCIONAL) — remove a estrutura antiga (funnel_sessions), agora
-- unificada em "MAX | QUIZ LEADS".
-- NÃO roda automático — é destrutivo. Só descomente e rode se quiser.
-- ============================================================================
-- drop table if exists public.funnel_sessions;
-- alter table public."MAX | QUIZ LEADS" drop column if exists respostas;
