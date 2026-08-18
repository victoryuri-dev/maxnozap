// Tabelas de tradução usadas pra montar o texto do diagnóstico final (Etapa 4),
// conforme a "Tabela pro dev" da copy v2. Chaves = value das opções em quiz-questions.ts.

// P3 → horas perdidas por semana
export const HORAS_POR_P3: Record<string, string> = {
  menos10: '~2 horas por semana',
  de10a30: '~4 horas por semana',
  de30a60: '~7 horas por semana',
  mais1h: '10+ horas por semana',
};

// P4 → frase que completa "Você me disse que {...}."
// obs: a copy original não definia frase pra "Nunca (aí é sorte, viu)" — preenchido no mesmo tom.
export const FRASE_P4: Record<string, string> = {
  direto: 'perde cliente direto por demora',
  algumas: 'já perdeu cliente por demora',
  quasenunca: 'quase nunca perde — mas cada um que vai dói',
  nunca: 'nunca perdeu (ainda) — mas é sorte, viu',
};

// P5 → frase que completa "Por isso o cliente {...}."
// obs: a copy original não definia frase pra "Aceita de boa" — preenchido no mesmo tom.
export const FRASE_P5: Record<string, string> = {
  sempre: 'pede desconto sempre',
  vezenquando: 'vive tentando negociar',
  aceita: 'aceita de boa — mas é exceção, não regra',
  some: 'some sem responder depois do preço',
};
