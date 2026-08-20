-- Rode isso no SQL Editor do seu projeto Supabase

create table if not exists public."MAX | QUIZ LEADS" (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Lead: pessoa de verdade que preencheu o formulário
  nome text,
  whatsapp text,

  -- Origem do tráfego (parâmetros da URL)
  origem_parametros jsonb not null default '{}'::jsonb,

  -- Rastreio do funil (cada visitante gera uma linha, mesmo sem preencher form)
  sessao_id uuid not null unique,
  etapa_maxima int not null default 0,
  nome_etapa text not null default 'inicio',
  concluido boolean not null default false,
  duracao_ms int not null default 0,

  -- Respostas do quiz (p1..p7)
  resposta_p1 text,
  resposta_p2 text,
  resposta_p3 text,
  resposta_p4 text,
  resposta_p5 text,
  resposta_p6 text,
  resposta_p7 text
);

-- Colunas geradas pra filtrar fácil no painel (sem JSON)
alter table public."MAX | QUIZ LEADS" add column if not exists origem text generated always as (origem_parametros ->> 'utm_source') stored;
alter table public."MAX | QUIZ LEADS" add column if not exists campanha text generated always as (origem_parametros ->> 'utm_campaign') stored;
alter table public."MAX | QUIZ LEADS" add column if not exists meio text generated always as (origem_parametros ->> 'utm_medium') stored;
alter table public."MAX | QUIZ LEADS" add column if not exists conteudo text generated always as (origem_parametros ->> 'utm_content') stored;

alter table public."MAX | QUIZ LEADS" enable row level security;

drop policy if exists "public can insert leads" on public."MAX | QUIZ LEADS";
create policy "public can insert leads"
  on public."MAX | QUIZ LEADS"
  for insert
  to anon
  with check (true);

-- Índices pra consultas rápidas
create index if not exists leads_origem_idx on public."MAX | QUIZ LEADS" (origem);
create index if not exists leads_campanha_idx on public."MAX | QUIZ LEADS" (campanha);
create index if not exists leads_sessao_idx on public."MAX | QUIZ LEADS" (sessao_id);
create index if not exists leads_concluido_idx on public."MAX | QUIZ LEADS" (concluido);

-- ============================================================================
-- UPSERT — função segura que o client público chama pra registrar progresso
-- ============================================================================

create or replace function public.registrar_progresso(
  p_sessao_id uuid,
  p_etapa int,
  p_nome_etapa text,
  p_duracao_ms int,
  p_concluido boolean,
  p_origem_parametros jsonb,
  p_pergunta_id text default null,
  p_resposta_label text default null,
  p_nome text default null,
  p_whatsapp text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public."MAX | QUIZ LEADS" (
    sessao_id, etapa_maxima, nome_etapa, duracao_ms, concluido, origem_parametros,
    resposta_p1, resposta_p2, resposta_p3, resposta_p4, resposta_p5, resposta_p6, resposta_p7,
    nome, whatsapp
  )
  values (
    p_sessao_id, p_etapa, p_nome_etapa, p_duracao_ms, p_concluido, p_origem_parametros,
    case when p_pergunta_id = 'p1' then p_resposta_label end,
    case when p_pergunta_id = 'p2' then p_resposta_label end,
    case when p_pergunta_id = 'p3' then p_resposta_label end,
    case when p_pergunta_id = 'p4' then p_resposta_label end,
    case when p_pergunta_id = 'p5' then p_resposta_label end,
    case when p_pergunta_id = 'p6' then p_resposta_label end,
    case when p_pergunta_id = 'p7' then p_resposta_label end,
    p_nome,
    p_whatsapp
  )
  on conflict (sessao_id) do update set
    etapa_maxima = greatest("MAX | QUIZ LEADS".etapa_maxima, excluded.etapa_maxima),
    nome_etapa = case
      when excluded.etapa_maxima >= "MAX | QUIZ LEADS".etapa_maxima then excluded.nome_etapa
      else "MAX | QUIZ LEADS".nome_etapa
    end,
    duracao_ms = excluded.duracao_ms,
    concluido = "MAX | QUIZ LEADS".concluido or excluded.concluido,
    origem_parametros = excluded.origem_parametros,
    atualizado_em = now(),
    resposta_p1 = coalesce(excluded.resposta_p1, "MAX | QUIZ LEADS".resposta_p1),
    resposta_p2 = coalesce(excluded.resposta_p2, "MAX | QUIZ LEADS".resposta_p2),
    resposta_p3 = coalesce(excluded.resposta_p3, "MAX | QUIZ LEADS".resposta_p3),
    resposta_p4 = coalesce(excluded.resposta_p4, "MAX | QUIZ LEADS".resposta_p4),
    resposta_p5 = coalesce(excluded.resposta_p5, "MAX | QUIZ LEADS".resposta_p5),
    resposta_p6 = coalesce(excluded.resposta_p6, "MAX | QUIZ LEADS".resposta_p6),
    resposta_p7 = coalesce(excluded.resposta_p7, "MAX | QUIZ LEADS".resposta_p7),
    nome = coalesce(excluded.nome, "MAX | QUIZ LEADS".nome),
    whatsapp = coalesce(excluded.whatsapp, "MAX | QUIZ LEADS".whatsapp);
end;
$$;

grant execute on function public.registrar_progresso(uuid, int, text, int, boolean, jsonb, text, text, text, text) to anon;
