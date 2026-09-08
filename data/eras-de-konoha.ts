// As eras de Konohagakure — os três reinados de Hokage, na ordem cronológica.
//
// É filtro de VILA, não do banco inteiro: só ficha de Konohagakure tem era, e o filtro facetado se
// encarrega do resto — nas outras abas nenhum personagem no escopo tem o campo, então o seletor não
// oferece nenhuma opção e fica só com "TODOS".
//
// Uma ficha pode ser de VÁRIAS eras, e isso não é exceção: os cargos numerados provam. O Tobirama
// foi 1º Líder de Inovações sob o Hashirama antes de virar 2º Hokage, e o Katsuo foi 2º Líder de
// Rastreio antes de ser 3º Líder da Ambu. Por isso o campo é lista, não texto.
//
// O ordinal do cargo de Konoha é a própria era: 1º Hokage das Sombras é da Era Hashirama, 3ª Dama é
// da Era Nishinoya. Ordinal de cargo de OUTRA vila não vale — o `2º Tsuchikage` do Rock Gunma e o
// `2º General` do Hiroshi Hanzo são de Iwa e de Kumo, e patente de organização (`1º Vice Líder da
// OCA`) também não diz nada sobre era.

/** Ordem cronológica, e é nela que o seletor lista — nunca em ordem alfabética. */
export const ERAS_DE_KONOHA = ['Era Hashirama', 'Era Tobirama', 'Era Nishinoya'] as const;

export type EraDeKonoha = typeof ERAS_DE_KONOHA[number];

/** O ordinal do cargo (1, 2, 3) na era correspondente. */
export const ERA_DO_ORDINAL: Record<number, EraDeKonoha> = {
  1: 'Era Hashirama',
  2: 'Era Tobirama',
  3: 'Era Nishinoya',
};

export const eEraDeKonoha = (v: string): v is EraDeKonoha =>
  (ERAS_DE_KONOHA as readonly string[]).includes(v);

/** As eras de uma ficha, sempre em ordem cronológica e sem valor desconhecido. */
export const erasDe = (ficha?: { erasDeKonoha?: string[] }): EraDeKonoha[] =>
  ERAS_DE_KONOHA.filter(e => (ficha?.erasDeKonoha ?? []).includes(e));
