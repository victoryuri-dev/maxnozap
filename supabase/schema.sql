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
-- liga esse lead à sessão de navegação dele em funnel_events (ver mais abaixo) —
-- é como você cruza "quem converteu" com "o caminho que ele percorreu até converter".
alter table public."MAX | QUIZ LEADS" add column if not exists session_id uuid;

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

-- ============================================================================
-- FUNIL — rastreio de progresso (completou? onde parou? quanto tempo no total?)
-- ============================================================================
-- Uma linha por visita (não por evento) — session_id é a chave primária. Cada passo
-- real que a pessoa dá ATUALIZA essa mesma linha em vez de criar uma nova.
--
-- O client público só pode INSERT (nunca UPDATE, por segurança — ver policies da
-- "MAX | QUIZ LEADS" acima). Pra ainda assim conseguir "ir atualizando" essa linha
-- conforme a pessoa avança, usamos uma função (RPC) com SECURITY DEFINER: o client
-- chama a função, a função é quem tem permissão de fazer o upsert — o client nunca
-- ganha UPDATE direto na tabela.
create table if not exists public.funnel_sessions (
  session_id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  furthest_step int not null default 0,
  furthest_label text not null default 'hero',
  completed boolean not null default false,
  duration_ms int not null default 0,
  utm jsonb not null default '{}'::jsonb,
  -- respostas do quiz, uma coluna por pergunta (p1 fica de fora, por pedido) — vão sendo
  -- preenchidas conforme a pessoa responde, mesmo que ela nunca termine o formulário
  p2 text,
  p3 text,
  p4 text,
  p5 text,
  p6 text,
  p7 text
);

alter table public.funnel_sessions add column if not exists utm_source text generated always as (utm ->> 'utm_source') stored;
alter table public.funnel_sessions add column if not exists utm_campaign text generated always as (utm ->> 'utm_campaign') stored;
alter table public.funnel_sessions add column if not exists utm_content text generated always as (utm ->> 'utm_content') stored;

alter table public.funnel_sessions enable row level security;
-- Nenhuma policy pro client público aqui — nem INSERT direto. Toda escrita passa
-- pela função abaixo, e leitura só pelo painel/SQL Editor do Supabase.
revoke all on public.funnel_sessions from anon, authenticated;

create index if not exists funnel_sessions_completed_idx on public.funnel_sessions (completed);
create index if not exists funnel_sessions_utm_campaign_idx on public.funnel_sessions (utm_campaign);

-- Upsert seguro: cria a linha da sessão se não existir, ou atualiza se já existir.
-- `furthest_step`/`furthest_label` só andam pra frente (greatest), `completed` nunca
-- volta a false, e cada resposta (p2..p7) só é sobrescrita quando vem um valor novo
-- pra ela — chamadas de passos diferentes não apagam a resposta de um passo anterior.
create or replace function public.upsert_funnel_progress(
  p_session_id uuid,
  p_step int,
  p_label text,
  p_duration_ms int,
  p_completed boolean,
  p_utm jsonb,
  p_question_id text default null,
  p_answer_label text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.funnel_sessions (
    session_id, furthest_step, furthest_label, duration_ms, completed, utm, p2, p3, p4, p5, p6, p7
  )
  values (
    p_session_id, p_step, p_label, p_duration_ms, p_completed, p_utm,
    case when p_question_id = 'p2' then p_answer_label end,
    case when p_question_id = 'p3' then p_answer_label end,
    case when p_question_id = 'p4' then p_answer_label end,
    case when p_question_id = 'p5' then p_answer_label end,
    case when p_question_id = 'p6' then p_answer_label end,
    case when p_question_id = 'p7' then p_answer_label end
  )
  on conflict (session_id) do update set
    furthest_step = greatest(funnel_sessions.furthest_step, excluded.furthest_step),
    furthest_label = case
      when excluded.furthest_step >= funnel_sessions.furthest_step then excluded.furthest_label
      else funnel_sessions.furthest_label
    end,
    duration_ms = excluded.duration_ms,
    completed = funnel_sessions.completed or excluded.completed,
    utm = excluded.utm,
    updated_at = now(),
    p2 = coalesce(excluded.p2, funnel_sessions.p2),
    p3 = coalesce(excluded.p3, funnel_sessions.p3),
    p4 = coalesce(excluded.p4, funnel_sessions.p4),
    p5 = coalesce(excluded.p5, funnel_sessions.p5),
    p6 = coalesce(excluded.p6, funnel_sessions.p6),
    p7 = coalesce(excluded.p7, funnel_sessions.p7);
end;
$$;

-- É essa concessão que permite o client público chamar a função acima — mas só ELA,
-- não a tabela. Sem isso, nada consegue escrever nem lendo nem gravando.
grant execute on function public.upsert_funnel_progress(uuid, int, text, int, boolean, jsonb, text, text) to anon;

-- ============================================================================
-- A VISÃO GERAL — uma linha por visitante, tudo em coluna, pronta pra exportar
-- (Table Editor ou SQL Editor > botão "Download CSV" > abre direto no Excel/Sheets)
-- ============================================================================
--   select * from public.funnel_overview order by created_at desc;
create or replace view public.funnel_overview as
select
  fs.session_id,
  fs.created_at,
  fs.updated_at,
  fs.utm_source,
  fs.utm_campaign,
  fs.utm_content,
  fs.furthest_label as etapa_onde_parou,
  fs.completed as completou_funil,
  round(fs.duration_ms / 1000.0, 1) as duracao_segundos,
  fs.p2,
  fs.p3,
  fs.p4,
  fs.p5,
  fs.p6,
  fs.p7,
  leads.nome,
  leads.whatsapp
from public.funnel_sessions fs
left join public."MAX | QUIZ LEADS" leads using (session_id)
order by fs.created_at desc;

-- Views não têm RLS própria e por padrão rodam com o privilégio de quem criou —
-- essas duas linhas fecham isso, senão a view podia vazar tudo pra anon key.
alter view public.funnel_overview set (security_invoker = true);
revoke all on public.funnel_overview from anon, authenticated;

-- ============================================================================
-- ANÁLISE — comparações prontas de desempenho do funil
-- ============================================================================

-- 1) Quantas sessões chegaram (ou passaram) por cada etapa (funil clássico —
--    deve cair conforme desce)
--   select furthest_step, furthest_label, count(*) as sessoes
--   from public.funnel_sessions group by furthest_step, furthest_label order by furthest_step;

-- 2) Taxa de conclusão geral
--   select
--     count(*) filter (where completed) as completaram,
--     count(*) as total_sessoes,
--     round(100.0 * count(*) filter (where completed) / count(*), 1) as taxa_pct
--   from public.funnel_sessions;

-- 3) Onde mais gente empaca, entre quem não completou
--   select furthest_label, count(*) as sessoes
--   from public.funnel_sessions where completed = false
--   group by furthest_label order by sessoes desc;

-- 4) Desempenho por campanha (compara utm_campaign entre si)
--   select
--     utm_campaign,
--     count(*) as sessoes,
--     count(*) filter (where completed) as completaram,
--     round(100.0 * count(*) filter (where completed) / count(*), 1) as taxa_pct
--   from public.funnel_sessions
--   group by utm_campaign order by sessoes desc;

-- 5) Respostas mais escolhidas em cada pergunta (ex: p3)
--   select p3, count(*) as vezes from public.funnel_sessions
--   where p3 is not null group by p3 order by vezes desc;

-- 6) Quem responde X (em p3) converte mais que quem responde Y?
--   select p3, count(*) as escolheram,
--     count(*) filter (where completed) as converteram,
--     round(100.0 * count(*) filter (where completed) / count(*), 1) as taxa_conversao_pct
--   from public.funnel_sessions where p3 is not null
--   group by p3 order by taxa_conversao_pct desc;

-- ============================================================================
-- LIMPEZA (OPCIONAL) — remove a estrutura antiga (funnel_events + views que
-- dependiam dela), agora substituída pela funnel_sessions acima.
-- NÃO roda automático — é destrutivo, apaga os dados de teste que já tiver
-- nessas tabelas. Só descomente e rode se quiser mesmo limpar.
-- ============================================================================
-- drop view if exists public.respostas_por_sessao;
-- drop view if exists public.funnel_session_summary;
-- drop view if exists public.funnel_answers;
-- drop table if exists public.funnel_events;
