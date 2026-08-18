import { supabase } from '../lib/supabase';

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
const DIAG_STEP = Number(phone.dataset.diagStep);
const QUESTION_COUNT = TOTAL - 4;

const EASE = 'cubic-bezier(.32,0,.24,1)';

let tempo = '~30 min';
let faixa = 'R$ 1.000 a R$ 3.000';
const respostas: { pergunta: string; resposta: string }[] = [];

function showStep(n: number) {
  document.querySelectorAll<HTMLElement>('.screen').forEach((s) => s.classList.toggle('active', +s.dataset.step! === n));
  bar.style.width = (n / TOTAL) * 100 + '%';
  phone.classList.toggle('no-footer', n === 0);
  phone.scrollTop = 0;
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

// clique em "bora!": tela 0 sobe e sai, pergunta 1 entra subindo de baixo
function pushUp() {
  const oldS = document.querySelector<HTMLElement>('.screen[data-step="0"]')!;
  const newS = document.querySelector<HTMLElement>('.screen[data-step="1"]')!;
  const newOpts = Array.from(newS.querySelectorAll<HTMLElement>('.opt'));

  bar.style.width = (1 / TOTAL) * 100 + '%';
  phone.classList.remove('no-footer');

  // as opções da pergunta 1 já entram escondidas — só o título aparece junto com o push
  primeHidden(newOpts);

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
    revealStagger(newOpts, 90, 300);
  }, 620);
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

function pick(el: HTMLElement) {
  el.classList.add('picked');
  const curCol = el.parentElement as HTMLElement;
  const screen = el.closest<HTMLElement>('.screen')!;
  const next = Number(el.dataset.next);
  const value = el.dataset.value ?? '';
  const track = el.dataset.track;

  if (track === 'tempo') tempo = '~' + value;
  if (track === 'faixa') faixa = value;

  const pergunta = screen.querySelector('h2')?.textContent ?? '';
  respostas.push({ pergunta, resposta: value });

  staggerOut(curCol, () => {
    Array.from(curCol.children).forEach((it) => {
      const item = it as HTMLElement;
      item.style.transition = '';
      item.style.opacity = '';
      item.style.transform = '';
    });
    go(next);
    if (next >= 1 && next <= QUESTION_COUNT) staggerIn(document.querySelector<HTMLElement>(`.screen[data-step="${next}"]`)!);
  });
}

// grava o lead no Supabase; nunca bloqueia o funil — se falhar, só loga o erro
async function saveLead(nome: string, whatsapp: string) {
  if (!supabase) {
    console.warn('Supabase não configurado: defina PUBLIC_SUPABASE_URL e PUBLIC_SUPABASE_ANON_KEY em .env');
    return;
  }
  const { error } = await supabase.from('leads').insert({
    nome,
    whatsapp,
    tempo_orcamento: tempo,
    faixa_perdida: faixa,
    respostas,
  });
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

  document.getElementById('diagNome')!.textContent = nome.toUpperCase();
  document.getElementById('diagTempo')!.textContent = tempo;
  document.getElementById('diagFaixa')!.textContent = faixa;

  showStep(QUESTION_COUNT + 2); // tela de loading
  const msgs = ['Analisando tuas respostas...', 'Calculando quanto tá ficando na mesa...', 'Pronto! 🔧'];
  msgs.forEach((m, i) => setTimeout(() => (document.getElementById('loadTxt')!.textContent = m), i * 900));

  void saveLead(nome, zap);

  setTimeout(() => showStep(DIAG_STEP), 2900);
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
    case 'capturar':
      capturar();
      break;
    case 'go':
      go(Number(target.dataset.goto));
      break;
  }
});
