// As liberações — os caminhos de chakra do universo, dos cinco elementos base até a Kekkei Mora.
//
// Ditadas pelo Pedro em 09/09/2026. São conteúdo NOVO: não existia nada disto no projeto, diferente
// das Habilidades Lendárias, que já viviam em data/habilidades-lendarias.ts.
//
// POR QUE ISTO NÃO É UMA ESCADA
//
// A Habilidade Lendária é uma escada de degraus: Modo Sábio Instável → Incompleto → Completo. A
// liberação não sobe, ela COMBINA. O que cada uma tem é uma origem — nenhuma (as cinco bases), uma
// (evolução), duas, três, quatro ou cinco (as Kekkei) — e é por isso que o campo é `de: string[]` e
// o grupo sai do tamanho dele, em vez de ser digitado.
//
// A ÚNICA EXCEÇÃO são as exclusivas de clã: elas não vêm de combinação nenhuma, vêm de sangue. Por
// isso `de` é vazio e `fonte` diz de quem — clã, bijuu ou criatura.
//
// GRAFIA
//
// A lista do Pedro escreveu o vento de três formas (`Futon`, `Fuuton`, `Fūton`) em pontos
// diferentes. Normalizei para `Futon`, que é como ele nomeou na lista das cinco bases e é a forma
// dominante no campo `nature` do banco. As outras grafias ficaram como ele escreveu — inclusive
// `Hyouton` e `Shouton`, que hoje aparecem como `Hyoton` e `Shōton` em `nature`. Fechar essa
// divergência é decisão dele, e está anotada como pendência.

export type GrupoLiberacao =
  | 'Elementos da Natureza'
  | 'Evoluções da Natureza'
  | 'Kekkei Genkai Exclusiva'
  | 'Kekkei Genkai'
  | 'Kekkei Tota'
  | 'Kekkei Chota'
  | 'Kekkei Mora';

export type Liberacao = {
  /** O nome do jutsu de liberação: `Youton`, `Seimeiton`. */
  nome: string;
  /** O que o nome quer dizer, sem a palavra "Liberação": `Lava`, `Vida`. */
  traducao: string;
  /**
   * De onde ela sai. Vazio nas cinco bases e nas exclusivas de clã; um nome nas evoluções; dois a
   * cinco nas Kekkei. O tamanho desta lista é o que determina o grupo.
   */
  de: string[];
  /** Só nas exclusivas: clã, bijuu ou criatura de quem ela é. */
  fonte?: string[];
  grupo: GrupoLiberacao;
};

export const LIBERACOES: Liberacao[] = [
  // ---------------------------------------------------------------- as cinco bases
  { nome: 'Katon', traducao: 'Fogo', de: [], grupo: 'Elementos da Natureza' },
  { nome: 'Doton', traducao: 'Terra', de: [], grupo: 'Elementos da Natureza' },
  { nome: 'Raiton', traducao: 'Raio', de: [], grupo: 'Elementos da Natureza' },
  { nome: 'Suiton', traducao: 'Água', de: [], grupo: 'Elementos da Natureza' },
  { nome: 'Futon', traducao: 'Vento', de: [], grupo: 'Elementos da Natureza' },

  // ---------------------------------------------------------------- uma evolução por base
  { nome: 'Neshoton', traducao: 'Combustão', de: ['Katon'], grupo: 'Evoluções da Natureza' },
  { nome: 'Koton', traducao: 'Ferro', de: ['Doton'], grupo: 'Evoluções da Natureza' },
  { nome: 'Suiseiton', traducao: 'Vida Aquática', de: ['Suiton'], grupo: 'Evoluções da Natureza' },
  { nome: 'Shiroki Kaminari', traducao: 'Luz', de: ['Raiton'], grupo: 'Evoluções da Natureza' },
  { nome: 'Atsuton', traducao: 'Vácuo', de: ['Futon'], grupo: 'Evoluções da Natureza' },

  // ---------------------------------------------------------------- sangue, não combinação
  { nome: 'Ketton', traducao: 'Sangue', de: [], fonte: ['Clã Chinoike', 'Megalodon'], grupo: 'Kekkei Genkai Exclusiva' },
  { nome: 'Kageton', traducao: 'Sombra', de: [], fonte: ['Clã Nara'], grupo: 'Kekkei Genkai Exclusiva' },
  { nome: 'Shinton', traducao: 'Mente', de: [], fonte: ['Clã Yamanaka'], grupo: 'Kekkei Genkai Exclusiva' },
  { nome: 'Mushiton', traducao: 'Insetos', de: [], fonte: ['Clã Aburame'], grupo: 'Kekkei Genkai Exclusiva' },
  { nome: 'Baikaton', traducao: 'Expansão', de: [], fonte: ['Clã Akimichi'], grupo: 'Kekkei Genkai Exclusiva' },
  { nome: 'Kotsuton', traducao: 'Ossos', de: [], fonte: ['Clã Kaguya'], grupo: 'Kekkei Genkai Exclusiva' },
  { nome: 'Enton', traducao: 'Inferno', de: [], fonte: ['Clã Uchiha'], grupo: 'Kekkei Genkai Exclusiva' },
  { nome: 'Senninkaton', traducao: 'Transformação Sábia', de: [], fonte: ['Clã de Jugo'], grupo: 'Kekkei Genkai Exclusiva' },
  { nome: 'Aoi Katon', traducao: 'Fogo Azul', de: [], fonte: ['Matatabi'], grupo: 'Kekkei Genkai Exclusiva' },
  { nome: 'Sangoton', traducao: 'Coral', de: [], fonte: ['Isobu'], grupo: 'Kekkei Genkai Exclusiva' },
  { nome: 'Santon', traducao: 'Ácido', de: [], fonte: ['Saiken', 'Jormungandr'], grupo: 'Kekkei Genkai Exclusiva' },
  { nome: 'Rinpunton', traducao: 'Pó Luminoso', de: [], fonte: ['Chomei'], grupo: 'Kekkei Genkai Exclusiva' },
  { nome: 'Sumiton', traducao: 'Tinta', de: [], fonte: ['Gyuki', 'Kraken'], grupo: 'Kekkei Genkai Exclusiva' },
  { nome: 'Shinkaiton', traducao: 'Abissal', de: [], fonte: ['Leviatã'], grupo: 'Kekkei Genkai Exclusiva' },

  // ---------------------------------------------------------------- dois a dois: a tabela fecha
  // São as DEZ combinações possíveis de dois entre cinco elementos, e as dez estão aqui.
  { nome: 'Youton', traducao: 'Lava', de: ['Katon', 'Doton'], grupo: 'Kekkei Genkai' },
  { nome: 'Futton', traducao: 'Vapor', de: ['Katon', 'Suiton'], grupo: 'Kekkei Genkai' },
  { nome: 'Shouton', traducao: 'Cristal', de: ['Katon', 'Raiton'], grupo: 'Kekkei Genkai' },
  { nome: 'Shakuton', traducao: 'Calor', de: ['Katon', 'Futon'], grupo: 'Kekkei Genkai' },
  { nome: 'Mokuton', traducao: 'Madeira', de: ['Doton', 'Suiton'], grupo: 'Kekkei Genkai' },
  { nome: 'Bakuton', traducao: 'Explosão', de: ['Doton', 'Raiton'], grupo: 'Kekkei Genkai' },
  { nome: 'Saton', traducao: 'Areia', de: ['Doton', 'Futon'], grupo: 'Kekkei Genkai' },
  { nome: 'Ranton', traducao: 'Tempestade', de: ['Suiton', 'Raiton'], grupo: 'Kekkei Genkai' },
  { nome: 'Hyouton', traducao: 'Gelo', de: ['Suiton', 'Futon'], grupo: 'Kekkei Genkai' },
  { nome: 'Jiton', traducao: 'Magnetismo', de: ['Raiton', 'Futon'], grupo: 'Kekkei Genkai' },

  // ---------------------------------------------------------------- três, quatro, cinco
  { nome: 'Puraton', traducao: 'Plasma', de: ['Katon', 'Raiton', 'Suiton'], grupo: 'Kekkei Tota' },
  { nome: 'Jinton', traducao: 'Poeira', de: ['Katon', 'Futon', 'Doton'], grupo: 'Kekkei Tota' },
  { nome: 'Juryokuton', traducao: 'Gravidade', de: ['Doton', 'Raiton', 'Futon'], grupo: 'Kekkei Tota' },

  { nome: 'Seishinton', traducao: 'Estelar', de: ['Katon', 'Futon', 'Raiton', 'Doton'], grupo: 'Kekkei Chota' },
  { nome: 'Tensaigiton', traducao: 'Cataclismo', de: ['Katon', 'Suiton', 'Futon', 'Raiton'], grupo: 'Kekkei Chota' },

  { nome: 'Seimeiton', traducao: 'Vida', de: ['Katon', 'Doton', 'Suiton', 'Raiton', 'Futon'], grupo: 'Kekkei Mora' },
];

/** A ordem dos grupos na tela — do mais simples ao mais raro, nunca alfabética. */
export const GRUPOS_DE_LIBERACAO: GrupoLiberacao[] = [
  'Elementos da Natureza',
  'Evoluções da Natureza',
  'Kekkei Genkai Exclusiva',
  'Kekkei Genkai',
  'Kekkei Tota',
  'Kekkei Chota',
  'Kekkei Mora',
];

export const liberacoesDoGrupo = (g: GrupoLiberacao): Liberacao[] =>
  LIBERACOES.filter(l => l.grupo === g);

/**
 * Quantas combinações de `k` elementos entre os cinco existem, para a tela poder dizer "10 de 10"
 * ou "3 de 10". As Kekkei Genkai estão completas; as Tota e as Chota não, e mostrar isso é honesto
 * — pode ser de propósito, pode ser que ainda não tenham nome.
 */
export const combinacoesPossiveis = (k: number): number => {
  if (k < 1 || k > 5) return 0;
  let n = 1;
  for (let i = 0; i < k; i++) n = (n * (5 - i)) / (i + 1);
  return Math.round(n);
};
