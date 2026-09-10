// As famílias de invocação — os povos sábios de que uma criatura vem.
//
// Ditadas pelo Pedro em 10/09/2026, e elas NÃO são uma lista nova: levam o nome das Vias do Modo
// Sábio, que o `modos_sabios_manual.md` na raiz do projeto já define. Mas a família é da CRIATURA,
// não do invocador — ver a seção abaixo, que é onde eu errei na primeira vez.
//
// FAMÍLIA NÃO SE DERIVA DA VIA DO INVOCADOR — a Via é indício, não prova
//
// Foi assim que eu preenchi o campo na primeira vez, e estava errado num caso: o Kurotsume ganhou
// "Escorpiões Sábios" porque a Kurohime segue a Via dos Escorpiões, e o Pedro corrigiu em
// 10/09/2026 — ele é invocação PESSOAL dela, não uma criatura daquele povo. Seguir uma Via não faz
// a invocação de alguém pertencer ao povo da Via.
//
// A pergunta certa é se a criatura VEM de uma comunidade sábia. Os 30 sapos e os 25 lobos vêm, e
// as descrições deles falam de comunidade, hierarquia e território próprios. Invocação pessoal
// não tem família, e o campo vazio é a informação correta.
//
// Duas ainda estão preenchidas por derivação e valem uma conferência do Pedro: o Enma, do Apollo
// (Macacos), e o Mizuchi, do Akira (Cobras) — as duas únicas da família delas.
//
// As invocações de natureza diferente de `Senjutsu` nunca têm família: são golens de Mokuton,
// tigres de Fujogan, Hyoton, Kage Mane, Ketton, as bijuu e um Doton.
//
// O CASO DOS TIGRES
//
// Os sete `-tora` (Kintora, Yomatora, Ketsutora, Shotora, Hokotora, Seitora, Zotora) parecem uma
// família de animais e não são: os sete têm natureza Fujogan, e o único invocador deles que segue
// uma Via sábia — o Kaizuka, que é Cobras — tem o tigre pelo Fujogan, não pelo Senjutsu. Se o
// Pedro decidir que existem Tigres Sábios, é acrescentar a linha aqui e gravar nos sete.

/**
 * Ordem de exibição. Lobos e Sapos primeiro porque são as duas com volume; Escorpiões e Lesmas
 * seguem no catálogo com ZERO invocações, e é correto: a Via existe, o povo existe, ninguém tem
 * uma criatura dele cadastrada ainda.
 */
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
