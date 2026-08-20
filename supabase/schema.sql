-- Rode isso no SQL Editor do seu projeto Supabase

create table if not exists public."MAX | QUIZ LEADS" (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Lead: pessoa de verdade que preencheu o formulário
  nome text,
  whatsapp text,

  -- Origem do tráfego
  origem text,
  campanha text,
  meio text,
  conteudo text,

  -- Rastreio do funil (cada visitante gera uma linha, mesmo sem preencher form)
  sessao_id uuid not null unique,
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
  p_duracao_ms int,
  p_concluido boolean,
  p_origem text default null,
  p_campanha text default null,
  p_meio text default null,
  p_conteudo text default null,
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
    sessao_id, duracao_ms, concluido,
    origem, campanha, meio, conteudo,
    resposta_p1, resposta_p2, resposta_p3, resposta_p4, resposta_p5, resposta_p6, resposta_p7,
    nome, whatsapp
  )
  values (
    p_sessao_id, p_duracao_ms, p_concluido,
    p_origem, p_campanha, p_meio, p_conteudo,
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
    duracao_ms = excluded.duracao_ms,
    concluido = "MAX | QUIZ LEADS".concluido or excluded.concluido,
    origem = coalesce(excluded.origem, "MAX | QUIZ LEADS".origem),
    campanha = coalesce(excluded.campanha, "MAX | QUIZ LEADS".campanha),
    meio = coalesce(excluded.meio, "MAX | QUIZ LEADS".meio),
    conteudo = coalesce(excluded.conteudo, "MAX | QUIZ LEADS".conteudo),
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

grant execute on function public.registrar_progresso(uuid, int, boolean, text, text, text, text, text, text, text, text) to anon;
