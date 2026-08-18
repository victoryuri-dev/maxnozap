import { supabase } from '../lib/supabase';
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
const SOLUTION_INTRO_STEP = Number(phone.dataset.solutionIntroStep);
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

const devStepEl = document.getElementById('devStep') as HTMLInputElement | null;

function showStep(n: number) {
  document.querySelectorAll<HTMLElement>('.screen').forEach((s) => s.classList.toggle('active', +s.dataset.step! === n));
  bar.style.width = (n / TOTAL) * 100 + '%';
  phone.classList.toggle('no-footer', n === 0);
  phone.scrollTop = 0;
  if (devStepEl) devStepEl.value = String(n);
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

// passos mostrados um de cada vez no "step-pill" da abertura da solução
const solutionSteps = [
  { icon: '🎙️', text: 'Você manda o áudio do serviço' },
  { icon: '⚡', text: 'Eu entendo e monto na hora' },
  { icon: '📄', text: 'Sai um orçamento PDF profissional com a logo da tua oficina em 30 segundos' },
];
let solutionStepIndex = 0;
let cyclingStep = false;

// toque na tela: troca o conteúdo do step-pill pro próximo passo (sai pela esquerda,
// entra pela direita — mesma animação do stagger das perguntas). No último passo, avança de tela.
function cycleStep(el: HTMLElement) {
  if (cyclingStep) return;

  if (solutionStepIndex >= solutionSteps.length - 1) {
    const next = Number(el.dataset.next);
    const current = el.closest<HTMLElement>('.screen')!;
    pushUpTransition(Number(current.dataset.step), next);
    return;
  }

  const pill = document.getElementById('stepPill')!;

  cyclingStep = true;
  // o botão inteiro sai pela esquerda (não só o conteúdo dele)
  pill.style.transition = 'transform .22s ease, opacity .22s ease';
  pill.style.opacity = '0';
  pill.style.transform = 'translateX(-28px)';

  setTimeout(() => {
    solutionStepIndex++;
    const step = solutionSteps[solutionStepIndex];
    pill.querySelector('.step-pill-icon')!.textContent = step.icon;
    pill.querySelector('.step-pill-text')!.textContent = step.text;

    // e o botão novo (já com o conteúdo trocado) entra inteiro pela direita
    primeHidden([pill]);
    void pill.offsetWidth;
    revealStagger([pill], 0, 260);

    setTimeout(() => {
      cyclingStep = false;
    }, 280);
  }, 220);
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

// grava o lead no Supabase; nunca bloqueia o funil — se falhar, só loga o erro
async function saveLead(nome: string, whatsapp: string) {
  if (!supabase) {
    console.warn('Supabase não configurado: defina PUBLIC_SUPABASE_URL e PUBLIC_SUPABASE_ANON_KEY em .env');
    return;
  }
  const { error } = await supabase.from('MAX | QUIZ LEADS').insert({ nome, whatsapp, respostas: answers, utm });
  if (error) console.error('Erro ao salvar lead no Supabase:', error.message);
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
  [SOLUTION_INTRO_STEP, SOLUTION_STEP],
];

function isPushPair(a: number, b: number) {
  return PUSH_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

let devBusy = false;

// toca a mesma animação que a tela usa no fluxo real (push, stagger ou fade) pra ir
// de "current" até "target" — usado tanto pelo ‹ › quanto pelo campo numérico
function devAnimateTo(current: number, target: number) {
  if (devBusy || target === current) return;

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
    case 'cycle-step':
      cycleStep(target);
      break;
    case 'capturar':
      capturar();
      break;
    case 'go':
      go(Number(target.dataset.goto));
      break;
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
