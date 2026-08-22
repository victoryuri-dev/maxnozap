import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { HORAS_POR_P3, FRASE_P4, FRASE_P5 } from '../data/diagnostico';

// envolve o conteúdo de cada .opt/.btn num .face — o "rosto" que se
// desloca no hover, mantendo a sombra (::after do container) parada
document.querySelectorAll('.opt, .btn').forEach((el) => {
  const face = document.createElement('span');
  face.className = 'face';
  while (el.firstChild) face.appendChild(el.firstChild);
  el.appendChild(face);
});

const phone = document.querySelector<HTMLDivElement>('.phone')!;
const bar = document.getElementById('bar')!;
const TOTAL = Number(phone.dataset.total);
const CAPTURE_STEP = Number(phone.dataset.captureStep);
const LOADING_STEP = Number(phone.dataset.loadingStep);
const DIAG_STEP = Number(phone.dataset.diagStep);
const SOLUTION_STEP = Number(phone.dataset.solutionStep);

const EASE = 'cubic-bezier(.32,0,.24,1)';
const AUTO_ADVANCE_MS = 1800;
let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

interface Answer {
  pergunta: string;
  resposta: string;
  valor: string;
}

// respostas guardadas por id de pergunta (p1..p7) — genérico, funciona pra qualquer pergunta nova
const answers: Record<string, Answer> = {};

// origem do tráfego (utm_* da URL), capturada uma vez no load pra ir junto com o lead
const utm: Record<string, string> = {};
new URLSearchParams(window.location.search).forEach((value, key) => {
  if (key.startsWith('utm_')) utm[key] = value;
});

// ---------- rastreio de funil (completou? onde parou? quanto tempo no total?) ----------
// um id por visita, e uma linha só em funnel_sessions (ver supabase/schema.sql) que vai
// sendo atualizada via RPC a cada passo real — nunca insere linha nova por passo
const sessionId = crypto.randomUUID();
const sessionStartedAt = Date.now();
let currentTrackedStep = 0;
// true durante um pulo do nav de dev — esses pulos não são navegação real do usuário,
// então não devem virar dado de analytics
let devNavigating = false;

function labelForStep(step: number): string {
  return document.querySelector<HTMLElement>(`.screen[data-step="${step}"]`)?.dataset.trackLabel ?? String(step);
}

interface PendingAnswer {
  questionId: string;
  value: string;
  label: string;
}

// resposta que acabou de ser escolhida, esperando a próxima troca de tela pra ir junto
// na mesma chamada — assim a resposta já fica salva no clique, sem precisar esperar o
// formulário final ser preenchido
let pendingAnswer: PendingAnswer | null = null;

// só passa a gravar no Supabase depois que a pessoa responde a 2ª pergunta — quem
// responde só a 1ª e some não deve gerar linha nenhuma
let syncing = false;

// chamado toda vez que uma navegação REAL (não dev) troca de tela — atualiza a linha
// da sessão com a etapa mais recente, o tempo total até aqui, e a resposta pendente
async function trackStepChange(next: number) {
  if (next === currentTrackedStep) return;
  currentTrackedStep = next;
  const answer = pendingAnswer;
  pendingAnswer = null;

  if (!syncing) {
    if (Object.keys(answers).length < 2) return;
    syncing = true;
    // a linha ainda não existe — manda a resposta da p1 primeiro (que ficou esperando),
    // pra ela já nascer com as duas respostas
    const p1 = answers.p1;
    if (p1) await registrarProgresso(next, { questionId: 'p1', value: p1.valor, label: p1.resposta });
  }

  void registrarProgresso(next, answer);
}

async function registrarProgresso(step: number, answer: PendingAnswer | null, opts?: { nome?: string; whatsapp?: string; concluido?: boolean }) {
  if (!supabase) return;
  const label = labelForStep(step);
  const { error } = await supabase.rpc('registrar_progresso', {
    p_sessao_id: sessionId,
    p_duracao_ms: Date.now() - sessionStartedAt,
    p_concluido: opts?.concluido ?? label === 'solucao_final',
    p_origem: utm['utm_source'] ?? null,
    p_campanha: utm['utm_campaign'] ?? null,
    p_meio: utm['utm_medium'] ?? null,
    p_conteudo: utm['utm_content'] ?? null,
    p_pergunta_id: answer?.questionId ?? null,
    p_resposta_label: answer?.label ?? null,
    p_nome: opts?.nome ?? null,
    p_whatsapp: opts?.whatsapp ?? null,
  });
  if (error) console.error('Erro ao registrar progresso:', error.message);
}

// se a pessoa fechar/sair da página no meio do funil, registra o tempo total até ali
// mesmo sem uma troca de tela seguinte — sem isso, quem fica parado numa tela e
// desiste não teria o tempo daquela última tela contabilizado.
// usa fetch com keepalive (em vez do client do supabase) porque é a forma confiável
// de garantir que a requisição saia mesmo com a página sendo fechada
let abandonFlushed = false;
function flushAbandonEvent() {
  if (abandonFlushed || !syncing || !supabaseUrl || !supabaseAnonKey) return;
  abandonFlushed = true;
  const label = labelForStep(currentTrackedStep);
  const body = JSON.stringify({
    p_sessao_id: sessionId,
    p_duracao_ms: Date.now() - sessionStartedAt,
    p_concluido: label === 'solucao_final',
    p_origem: utm['utm_source'] ?? null,
    p_campanha: utm['utm_campaign'] ?? null,
    p_meio: utm['utm_medium'] ?? null,
    p_conteudo: utm['utm_content'] ?? null,
    p_pergunta_id: pendingAnswer?.questionId ?? null,
    p_resposta_label: pendingAnswer?.label ?? null,
  });
  fetch(`${supabaseUrl}/rest/v1/rpc/registrar_progresso`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    body,
  }).catch(() => {});
}
window.addEventListener('pagehide', flushAbandonEvent);

const devStepEl = document.getElementById('devStep') as HTMLInputElement | null;

function showStep(n: number) {
  document.querySelectorAll<HTMLElement>('.screen').forEach((s) => s.classList.toggle('active', +s.dataset.step! === n));
  bar.style.width = (n / TOTAL) * 100 + '%';
  phone.classList.toggle('no-footer', n === 0);
  phone.scrollTop = 0;
  if (devStepEl) devStepEl.value = String(n);
  if (!devNavigating) trackStepChange(n);
}
function go(n: number) {
  showStep(n);
}

// deixa um grupo de elementos pronto no estado "escondido" (direita, invisível), sem transição
function primeHidden(items: HTMLElement[]) {
  items.forEach((it) => {
    it.style.transition = 'none';
    it.style.opacity = '0';
    it.style.transform = 'translateX(28px)';
  });
}

// anima um grupo de elementos já escondidos entrando da direita, um após o outro
function revealStagger(items: HTMLElement[], stepMs: number, durMs: number) {
  void document.body.offsetWidth;
  items.forEach((it, i) => {
    const delay = i * stepMs;
    it.style.transition = `transform ${durMs}ms ease ${delay}ms, opacity ${durMs}ms ease ${delay}ms`;
    requestAnimationFrame(() => {
      it.style.opacity = '1';
      it.style.transform = 'translateX(0)';
    });
  });
  const totalMs = items.length * stepMs + durMs + 20;
  setTimeout(() => {
    items.forEach((it) => {
      it.style.transition = '';
      it.style.opacity = '';
      it.style.transform = '';
    });
  }, totalMs);
}

// tela "fromStep" sobe e sai, tela "toStep" entra subindo de baixo — a mesma
// transição usada na abertura (tela 0 → pergunta 1), reaproveitada em qualquer par de telas
function pushUpTransition(fromStep: number, toStep: number, onSettled?: () => void) {
  const oldS = document.querySelector<HTMLElement>(`.screen[data-step="${fromStep}"]`);
  const newS = document.querySelector<HTMLElement>(`.screen[data-step="${toStep}"]`);
  if (!oldS || !newS) return;

  bar.style.width = (toStep / TOTAL) * 100 + '%';
  phone.classList.remove('no-footer');
  if (devStepEl) devStepEl.value = String(toStep);
  if (!devNavigating) trackStepChange(toStep);

  newS.style.transition = 'none';
  newS.style.transform = 'translateY(100%)';
  newS.classList.add('active');
  void newS.offsetWidth; // força o reflow antes de animar

  oldS.style.transition = `transform .6s ${EASE}`;
  newS.style.transition = `transform .6s ${EASE}`;
  requestAnimationFrame(() => {
    oldS.style.transform = 'translateY(-100%)';
    newS.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    oldS.classList.remove('active');
    oldS.style.transition = '';
    oldS.style.transform = '';
    newS.style.transition = '';
    newS.style.transform = '';
    phone.scrollTop = 0;
    onSettled?.();
  }, 620);
}

// clique em "bora!": tela 0 sobe e sai, pergunta 1 entra subindo de baixo
function pushUp() {
  const newOpts = Array.from(document.querySelectorAll<HTMLElement>('.screen[data-step="1"] .opt'));
  // as opções da pergunta 1 já entram escondidas — só o título aparece junto com o push
  primeHidden(newOpts);
  pushUpTransition(0, 1, () => revealStagger(newOpts, 90, 300));
}

// elementos do .content-col da tela entram deslizando da direita, um após o outro
function staggerIn(screen: HTMLElement) {
  const col = screen.querySelector<HTMLElement>('.content-col') || screen;
  const items = Array.from(col.children) as HTMLElement[];
  primeHidden(items);
  void screen.offsetWidth;
  revealStagger(items, 90, 320);
}

// elementos de um .content-col saem deslizando pra esquerda, um após o outro
function staggerOut(col: HTMLElement, cb: () => void) {
  const items = Array.from(col.children) as HTMLElement[];
  items.forEach((it, i) => {
    const delay = i * 70;
    it.style.transition = `transform .22s ease ${delay}ms, opacity .22s ease ${delay}ms`;
    it.style.opacity = '0';
    it.style.transform = 'translateX(-28px)';
  });
  setTimeout(cb, items.length * 70 + 220);
}

// depois de navegar pra uma tela: dá a entrada em stagger se ela não usa o fade padrão,
// e agenda o avanço automático se for uma tela de transição
function afterNavigate(next: number) {
  const nextScreen = document.querySelector<HTMLElement>(`.screen[data-step="${next}"]`);
  if (!nextScreen) return;
  if (!nextScreen.classList.contains('fade-screen')) staggerIn(nextScreen);
  if (nextScreen.classList.contains('transition-screen')) scheduleAutoAdvance(nextScreen);
}

function scheduleAutoAdvance(screen: HTMLElement) {
  if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
  autoAdvanceTimer = setTimeout(() => {
    const tap = screen.querySelector<HTMLElement>('[data-action="advance"]');
    if (tap) advanceTransition(tap);
  }, AUTO_ADVANCE_MS);
}

// avança a partir de uma tela de transição (tocada pelo usuário ou pelo timer)
function advanceTransition(el: HTMLElement) {
  if (autoAdvanceTimer) {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
  const screen = el.closest<HTMLElement>('.screen')!;
  const curCol = screen.querySelector<HTMLElement>('.content-col')!;
  const next = Number(el.dataset.next);

  staggerOut(curCol, () => {
    Array.from(curCol.children).forEach((it) => {
      const item = it as HTMLElement;
      item.style.transition = '';
      item.style.opacity = '';
      item.style.transform = '';
    });
    go(next);
    afterNavigate(next);
  });
}

function pick(el: HTMLElement) {
  el.classList.add('picked');
  const curCol = el.parentElement as HTMLElement;
  const screen = el.closest<HTMLElement>('.screen')!;
  const next = Number(el.dataset.next);
  const value = el.dataset.value ?? '';
  const label = el.dataset.label ?? '';
  const questionId = screen.dataset.questionId;

  if (questionId) {
    const pergunta = screen.querySelector('h2')?.textContent ?? '';
    answers[questionId] = { pergunta, resposta: label, valor: value };
    pendingAnswer = { questionId, value, label };
  }

  staggerOut(curCol, () => {
    Array.from(curCol.children).forEach((it) => {
      const item = it as HTMLElement;
      item.style.transition = '';
      item.style.opacity = '';
      item.style.transform = '';
    });
    go(next);
    afterNavigate(next);
  });
}

// grava o lead (nome + whatsapp) no Supabase; nunca bloqueia o funil — se falhar, só loga o erro
// usa a mesma função RPC que registra o progresso do funil, só que com nome/whatsapp
async function saveLead(nome: string, whatsapp: string) {
  void registrarProgresso(currentTrackedStep, null, { nome, whatsapp });
}

function capturar() {
  const nomeInput = document.getElementById('nome') as HTMLInputElement;
  const zapInput = document.getElementById('zap') as HTMLInputElement;
  const errEl = document.getElementById('err')!;

  const nome = nomeInput.value.trim() || 'CHEFE';
  const zap = zapInput.value.replace(/\D/g, '');
  if (zap.length < 10) {
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  const p3 = answers.p3;
  const p4 = answers.p4;
  const p5 = answers.p5;
  const p7 = answers.p7;

  document.getElementById('diagNome')!.textContent = nome.toUpperCase();
  document.getElementById('diagPrejuizo')!.textContent = p7?.resposta ?? '';
  document.getElementById('diagHoras')!.textContent = HORAS_POR_P3[p3?.valor ?? ''] ?? '';
  document.getElementById('diagP4')!.textContent = FRASE_P4[p4?.valor ?? ''] ?? p4?.resposta ?? '';
  document.getElementById('diagP5')!.textContent = FRASE_P5[p5?.valor ?? ''] ?? p5?.resposta ?? '';

  pushUpTransition(CAPTURE_STEP, LOADING_STEP);
  const msgs = ['Analisando tuas respostas...', 'Cruzando com o que vejo em outras oficinas...', 'Pronto! 🔧'];
  msgs.forEach((m, i) => setTimeout(() => (document.getElementById('loadTxt')!.textContent = m), i * 900));

  void saveLead(nome, zap);

  // a entrada dos cards (surgir, de baixo pra cima) é só CSS — ver .diag-content no Layout.astro
  setTimeout(() => pushUpTransition(LOADING_STEP, DIAG_STEP), 2900);
}

// pares de tela que usam o push-up de tela cheia no fluxo real — o nav de dev
// reaproveita a mesma lista pra saber quando aplicar esse efeito em vez do stagger
const PUSH_PAIRS: [number, number][] = [
  [0, 1],
  [CAPTURE_STEP, LOADING_STEP],
  [LOADING_STEP, DIAG_STEP],
  [DIAG_STEP, SOLUTION_STEP],
];

function isPushPair(a: number, b: number) {
  return PUSH_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

let devBusy = false;

// toca a mesma animação que a tela usa no fluxo real (push, stagger ou fade) pra ir
// de "current" até "target" — usado tanto pelo ‹ › quanto pelo campo numérico
function devAnimateTo(current: number, target: number) {
  if (devBusy || target === current) return;
  devNavigating = true;
  setTimeout(() => {
    devNavigating = false;
  }, 700);

  if (autoAdvanceTimer) {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }

  if (isPushPair(current, target)) {
    devBusy = true;
    pushUpTransition(current, target, () => {
      devBusy = false;
    });
    return;
  }

  const newScreen = document.querySelector<HTMLElement>(`.screen[data-step="${target}"]`);
  if (newScreen?.classList.contains('fade-screen')) {
    go(target);
    return;
  }

  const oldCol = document.querySelector<HTMLElement>(`.screen[data-step="${current}"] .content-col`);
  if (!oldCol) {
    go(target);
    afterNavigate(target);
    return;
  }

  devBusy = true;
  staggerOut(oldCol, () => {
    Array.from(oldCol.children).forEach((it) => {
      const item = it as HTMLElement;
      item.style.transition = '';
      item.style.opacity = '';
      item.style.transform = '';
    });
    go(target);
    afterNavigate(target);
    devBusy = false;
  });
}

// nav de dev (‹ ›): anda uma etapa por vez — só existe em ambiente de desenvolvimento
function devJump(delta: number) {
  const current = Number(document.querySelector<HTMLElement>('.screen.active')?.dataset.step ?? 0);
  const target = Math.min(TOTAL, Math.max(0, current + delta));
  devAnimateTo(current, target);
}

// campo numérico do nav de dev: digitou um número e confirmou, pula direto pra essa etapa
function devGoTo(value: number) {
  const current = Number(document.querySelector<HTMLElement>('.screen.active')?.dataset.step ?? 0);
  const target = Math.min(TOTAL, Math.max(0, Math.round(value)));
  if (devStepEl) devStepEl.value = String(target);
  devAnimateTo(current, target);
}

document.addEventListener('click', (e) => {
  const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href*="wa.me"]');
  if (link) {
    void registrarProgresso(currentTrackedStep, null, { concluido: true });
  }

  const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!target) return;

  switch (target.dataset.action) {
    case 'push-up':
      pushUp();
      break;
    case 'pick':
      pick(target);
      break;
    case 'advance':
      advanceTransition(target);
      break;
    case 'capturar':
      capturar();
      break;
    case 'go':
      go(Number(target.dataset.goto));
      break;
    case 'push': {
      const screen = target.closest<HTMLElement>('.screen')!;
      pushUpTransition(Number(screen.dataset.step), Number(target.dataset.next));
      break;
    }
    case 'dev-prev':
      devJump(-1);
      break;
    case 'dev-next':
      devJump(1);
      break;
  }
});

// campo do nav de dev: Enter confirma (dispara blur, que é quem realmente pula de tela)
if (devStepEl) {
  devStepEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') devStepEl.blur();
  });
  devStepEl.addEventListener('blur', () => {
    devGoTo(Number(devStepEl.value));
  });
}
