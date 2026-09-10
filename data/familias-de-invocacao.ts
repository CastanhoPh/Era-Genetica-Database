// As famílias de invocação — os povos sábios de que uma criatura vem.
//
// Ditadas pelo Pedro em 10/09/2026, e elas NÃO são uma lista nova: são as Vias do Modo Sábio, que
// o `modos_sabios_manual.md` na raiz do projeto já define e que todo personagem com Senjutsu já
// tem atribuída. A família de uma invocação é a Via do invocador dela.
//
// POR QUE SÓ 41 DAS 83 TÊM FAMÍLIA
//
// Família é coisa de caminho sábio. As 41 invocações de natureza `Senjutsu` vêm de um povo, e se
// distribuem exatamente nas cinco famílias abaixo. As outras 42 vêm de outro lugar — 21 são golens
// de Mokuton, 7 são tigres de Fujogan, 5 de Hyoton, 4 de Kage Mane, 2 de Ketton, mais as duas
// bijuu e um Doton — e não pertencem a povo nenhum. Deixar o campo vazio nelas é a informação
// correta, não falta de dado.
//
// O CASO DOS TIGRES
//
// Os sete `-tora` (Kintora, Yomatora, Ketsutora, Shotora, Hokotora, Seitora, Zotora) parecem uma
// família de animais e não são: os sete têm natureza Fujogan, e o único invocador deles que segue
// uma Via sábia — o Kaizuka, que é Cobras — tem o tigre pelo Fujogan, não pelo Senjutsu. Se o
// Pedro decidir que existem Tigres Sábios, é acrescentar a linha aqui e gravar nos sete.

/** Ordem de exibição: as que têm invocação primeiro, pelo tamanho, e as vazias no fim. */
export const FAMILIAS_DE_INVOCACAO = [
  'Lobos Sábios',
  'Sapos Sábios',
  'Macacos Sábios',
  'Cobras Sábias',
  'Escorpiões Sábios',
  'Lesmas Sábias',
] as const;

export type FamiliaDeInvocacao = typeof FAMILIAS_DE_INVOCACAO[number];

/**
 * A Via do manual → o nome da família na tela.
 *
 * Duas Vias não estão aqui de propósito. `Própria` não é um povo: é o caminho de quem desenvolveu
 * o Modo Sábio sozinho, e as invocações desses personagens são construções próprias — os dez
 * golens do Kaito, os cinco da Airi, os seis do Hisoka. `Monges` e `Salamandras` são Vias de povo
 * de verdade, mas nenhum dos personagens delas tem invocação cadastrada ainda.
 */
export const FAMILIA_DA_VIA: Record<string, FamiliaDeInvocacao> = {
  'Cães': 'Lobos Sábios',
  'Sapos': 'Sapos Sábios',
  'Macacos': 'Macacos Sábios',
  'Cobras': 'Cobras Sábias',
  'Escorpiões': 'Escorpiões Sábios',
  'Lesmas': 'Lesmas Sábias',
};
