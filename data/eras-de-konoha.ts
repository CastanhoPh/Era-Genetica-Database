// As eras de Konohagakure, na ordem cronológica.
//
// É filtro de VILA, não do banco inteiro: só ficha de Konohagakure tem era, e o filtro facetado se
// encarrega do resto — nas outras abas nenhum personagem no escopo tem o campo, então o seletor não
// oferece nenhuma opção e fica só com "TODOS".
//
// O CRITÉRIO é o auge, ditado pelo Pedro em 08/09/2026: a era é aquela em que o personagem viveu o
// auge dele e pela qual ficou marcado. Não é "quando esteve vivo" nem "quando teve cargo", e ficha
// sem era nenhuma é normal, não pendência — hoje 10 das 44 de Konoha estão assim de propósito.
//
// O ordinal do cargo NÃO é a era, e vale registrar porque a coincidência é grande o bastante para
// enganar: dos 18 com cargo numerado de Konoha, 16 caem na era do próprio ordinal. O Oogway é a
// prova de que é coincidência — ele é 2º Hokage das Sombras e é da Era Hashirama. Quem manda é o
// auge, e por isso este arquivo não deriva nada: a era vem gravada na ficha, uma por uma.

/** Ordem cronológica, e é nela que o seletor lista — nunca em ordem alfabética. */
export const ERAS_DE_KONOHA = [
  'Era Hashirama', 'Era Tobirama', 'Era Nishinoya', 'Era Katsumi',
] as const;

export type EraDeKonoha = typeof ERAS_DE_KONOHA[number];

export const eEraDeKonoha = (v: string): v is EraDeKonoha =>
  (ERAS_DE_KONOHA as readonly string[]).includes(v);

/** As eras de uma ficha, sempre em ordem cronológica e sem valor desconhecido. */
export const erasDe = (ficha?: { erasDeKonoha?: string[] }): EraDeKonoha[] =>
  ERAS_DE_KONOHA.filter(e => (ficha?.erasDeKonoha ?? []).includes(e));
