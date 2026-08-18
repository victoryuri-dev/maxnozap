export interface QuizOption {
  emoji?: string;
  label: string;
  /** Slug estável — usado pra gravar a resposta e alimentar as tabelas de diagnóstico em diagnostico.ts */
  value: string;
}

export interface QuizQuestion {
  /** p1..p7 — chave da resposta no objeto de respostas e no leads.respostas do Supabase */
  id: string;
  tag: string;
  question: string;
  options: QuizOption[];
  /** Texto de uma tela de transição própria, exibida antes desta pergunta (opcional) */
  transitionBefore?: string;
}

// Ordem = ordem de exibição. Pra adicionar/remover/reordenar perguntas, mexe só aqui —
// o front (telas, barra de progresso, animações) se ajusta sozinho.
export const quizQuestions: QuizQuestion[] = [
  {
    id: 'p1',
    tag: 'Pergunta 1 de 7',
    question: 'Primeiro me conta: qual é a tua área?',
    options: [
      { emoji: '🔨', label: 'Funilaria e pintura', value: 'funilaria' },
      { emoji: '✨', label: 'Estética automotiva / detalhamento', value: 'estetica' },
      { emoji: '🔧', label: 'Mecânica / Elétrica', value: 'mecanica' },
      { emoji: '😅', label: 'Faço de tudo um pouco', value: 'geral' },
    ],
  },
  {
    id: 'p2',
    tag: 'Pergunta 2 de 7',
    question: 'E hoje, como você monta teus orçamentos?',
    options: [
      { emoji: '📄', label: 'Papel e caneta (o clássico)', value: 'papel' },
      { emoji: '📱', label: 'No WhatsApp, na mão mesmo', value: 'whatsapp' },
      { emoji: '💻', label: 'Uso um sistema/app', value: 'sistema' },
      { emoji: '🤷', label: 'Depende do dia', value: 'depende' },
    ],
  },
  {
    id: 'p3',
    tag: 'Pergunta 3 de 7',
    question: 'Quanto tempo você gasta pra montar UM orçamento?',
    transitionBefore: 'Saquei... agora me responde com sinceridade, chefe 👇',
    options: [
      { label: 'Menos de 10 min', value: 'menos10' },
      { label: '10 a 30 min', value: 'de10a30' },
      { label: '30 min a 1 hora', value: 'de30a60' },
      { label: 'Mais de 1 hora 😩', value: 'mais1h' },
    ],
  },
  {
    id: 'p4',
    tag: 'Pergunta 4 de 7',
    question: 'Já perdeu cliente porque demorou pra mandar o orçamento?',
    options: [
      { label: 'Direto 😡', value: 'direto' },
      { label: 'Já aconteceu umas vezes', value: 'algumas' },
      { label: 'Quase nunca', value: 'quasenunca' },
      { label: 'Nunca (aí é sorte, viu)', value: 'nunca' },
    ],
  },
  {
    id: 'p5',
    tag: 'Pergunta 5 de 7',
    question: 'E quando o cliente vê teu preço, ele...',
    options: [
      { label: 'Pede desconto sempre', value: 'sempre' },
      { label: 'Negocia de vez em quando', value: 'vezenquando' },
      { label: 'Aceita de boa', value: 'aceita' },
      { label: 'Some e não responde 👻', value: 'some' },
    ],
  },
  {
    id: 'p6',
    tag: 'Pergunta 6 de 7',
    question: 'Se todo orçamento saísse em 30 segundos, o que você faria com o tempo que sobra?',
    transitionBefore: 'Entendi. Agora deixa eu te perguntar o contrário...',
    options: [
      { emoji: '🚗', label: 'Atenderia mais carro e faturaria mais', value: 'mais_carro' },
      { emoji: '🍽️', label: 'Jantaria em paz com a família', value: 'familia' },
      { emoji: '😴', label: 'Teria o domingo de volta', value: 'domingo' },
      { emoji: '💪', label: 'Cobraria melhor sem dor de cabeça', value: 'cobrar' },
    ],
  },
  {
    id: 'p7',
    tag: 'Pergunta 7 de 7',
    question:
      'E se o cliente parasse de pedir desconto porque teu orçamento parece profissional... quanto a mais você fecharia por mês?',
    options: [
      { label: 'R$ 500 a R$ 1.000', value: 'faixa1' },
      { label: 'R$ 1.000 a R$ 3.000', value: 'faixa2' },
      { label: 'R$ 3.000 a R$ 5.000', value: 'faixa3' },
      { label: 'Mais de R$ 5.000 🚀', value: 'faixa4' },
    ],
  },
];
