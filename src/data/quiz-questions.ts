export interface QuizOption {
  emoji?: string;
  label: string;
  /** Valor usado no diagnóstico final quando a pergunta tem `track`. Se omitido, usa `label`. */
  value?: string;
}

export interface QuizQuestion {
  tag: string;
  question: string;
  options: QuizOption[];
  /** Quando definido, a opção escolhida alimenta o diagnóstico final sob essa chave. */
  track?: 'tempo' | 'faixa';
}

// Ordem = ordem de exibição. Pra adicionar/remover/reordenar perguntas, mexe só aqui —
// o front (telas, barra de progresso, animações) se ajusta sozinho.
export const quizQuestions: QuizQuestion[] = [
  {
    tag: 'Pergunta 1 de 7',
    question: 'Primeiro me conta: qual é a tua praia?',
    options: [
      { emoji: '🔨', label: 'Funilaria e pintura' },
      { emoji: '✨', label: 'Estética automotiva / detalhamento' },
      { emoji: '🔧', label: 'Mecânica / borracharia' },
      { emoji: '😅', label: 'Faço de tudo um pouco' },
    ],
  },
  {
    tag: 'Pergunta 2 de 7',
    question: 'E hoje, como você monta teus orçamentos?',
    options: [
      { emoji: '📄', label: 'Papel e caneta (o clássico)' },
      { emoji: '📱', label: 'No WhatsApp, na mão mesmo' },
      { emoji: '💻', label: 'Uso um sistema/app' },
      { emoji: '🤷', label: 'Depende do dia' },
    ],
  },
  {
    tag: 'Pergunta 3 de 7 · sinceridade, chefe 👇',
    question: 'Quanto tempo você gasta pra montar UM orçamento?',
    track: 'tempo',
    options: [
      { label: 'Menos de 10 min', value: 'menos de 10 min' },
      { label: '10 a 30 min', value: '10 a 30 min' },
      { label: '30 min a 1 hora', value: '30 min a 1 hora' },
      { label: 'Mais de 1 hora 😩', value: 'mais de 1 hora' },
    ],
  },
  {
    tag: 'Pergunta 4 de 7',
    question: 'Já perdeu cliente porque demorou pra mandar o orçamento?',
    options: [
      { emoji: '😡', label: 'Direto' },
      { label: 'Já aconteceu umas vezes' },
      { label: 'Quase nunca' },
      { label: 'Nunca (aí é sorte, viu)' },
    ],
  },
  {
    tag: 'Pergunta 5 de 7',
    question: 'E quando o cliente vê teu preço, ele...',
    options: [
      { label: 'Pechincha sempre' },
      { label: 'Negocia de vez em quando' },
      { label: 'Aceita de boa' },
      { label: 'Some e não responde 👻' },
    ],
  },
  {
    tag: 'Pergunta 6 de 7 · agora o contrário...',
    question: 'Se todo orçamento saísse em 30 segundos, o que você faria com o tempo que sobra?',
    options: [
      { emoji: '🚗', label: 'Atender mais carro e faturar mais' },
      { emoji: '🍽️', label: 'Jantar em paz com a família' },
      { emoji: '😴', label: 'Ter domingo de volta' },
      { emoji: '💪', label: 'Cobrar melhor sem dor de cabeça' },
    ],
  },
  {
    tag: 'Pergunta 7 de 7',
    question: 'E se o cliente parasse de pechinchar... quanto a mais você fecharia por mês?',
    track: 'faixa',
    options: [
      { label: 'R$ 500 a R$ 1.000', value: 'R$ 500 a R$ 1.000' },
      { label: 'R$ 1.000 a R$ 3.000', value: 'R$ 1.000 a R$ 3.000' },
      { label: 'R$ 3.000 a R$ 5.000', value: 'R$ 3.000 a R$ 5.000' },
      { label: 'Mais de R$ 5.000 🚀', value: 'mais de R$ 5.000' },
    ],
  },
];

// steps das perguntas (1..N) + captura + loading + diagnóstico + solução
export const TOTAL_STEPS = quizQuestions.length + 4;
