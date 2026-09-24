import { postoDe } from '../utils/formatters';

/**
 * Os postos de cada aba da lista de personagens — vila ou organização — na ordem de importância que
 * o Pedro ditou, do mais alto pro mais baixo.
 *
 * Existe porque derivar a lista do banco dava três problemas:
 *
 *  1. Vinha posto de OUTRA aba. O `cargo` da ficha é uma lista de textos, sem vínculo com a vila, e
 *     quem tem duas vilas leva os cargos das duas pra ambas: o Hiroshi Hanzo tem `2º General`
 *     (Kumogakure) e o Rock Gunma `2º Tsuchikage` (Iwagakure), e os dois são também Konohagakure.
 *  2. Vinha patente de organização junto com cargo de vila, sem distinção.
 *  3. A ordem alfabética não dizia nada: "Chunin" vinha antes de "Hokage".
 *
 * Casa contra `cargo` E `patente`, já sem ordinal. Precisa dos dois porque a Marinha é uma
 * organização de Kirigakure: o Mizukage é cargo de vila, mas Almirante e Capitão são patente. E o
 * casamento é pelo posto INTEIRO, nunca pelo macro — "Líder dos Monges" e "Líder de Inovações"
 * reduzem os dois para "Líder", e o Rock Gunma apareceria como Líder dos Monges de Iwagakure.
 *
 *  - `postos`   — o texto exato do cargo/patente, sem ordinal.
 *  - `prefixos` — para família de postos que cresce: as quatro frotas da Marinha e os seis Pilares
 *                 de Suna entram por prefixo, então frota ou Pilar novo aparece sozinho.
 *
 * O rótulo pode diferir do posto gravado de propósito: "General de Guerra" casa com o `General` que
 * está nas fichas, e "Membro da NoGuns" casa com o `NoGuns` puro. São nomes que o Pedro vai
 * corrigir no dado depois; até lá o filtro já mostra o nome certo.
 *
 * Aba sem catálogo aqui (Todos, Personagem, NPC, OCA) cai na lista derivada em ordem alfabética.
 * Posto listado sem nenhum dono some do filtro sozinho, então dá pra cadastrar antes de a ficha do
 * titular existir.
 */
export type PostoDeAba = { label: string; postos?: string[]; prefixos?: string[] };

export const POSTOS_POR_ABA: Record<string, PostoDeAba[]> = {
  Konohagakure: [
    { label: 'Hokage', postos: ['Hokage'] },
    { label: 'Hokage das Sombras', postos: ['Hokage das Sombras'] },
    { label: 'Braço Direito', postos: ['Braço Direito'] },
    { label: 'Braço Esquerdo', postos: ['Braço Esquerdo'] },
    { label: 'Dama', postos: ['Dama'] },
    // Os sete esquadrões de Konoha sob um rótulo só. A Barreira entrou em 24/09/2026.
    { label: 'Líder de Esquadrão', postos: [
      'Líder da Equipe de Elite', 'Líder da Ambu', 'Líder de Rastreio',
      'Líder de Inovações', 'Líder da Força Médica', 'Líder da Academia Ninja', 'Líder de Barreira',
    ] },
    // Abaixo dos seis líderes. O Capitão entra com as duas grafias porque as fichas gravam
    // "Capitã" no feminino, como a Marinha. Havia também um "Membro de Esquadrão" aqui, criado e
    // desfeito no mesmo dia: o Pedro tirou os dois postos de Membro em 16/09/2026.
    { label: 'Capitão de Equipe', postos: ['Capitão de Equipe da Ambu', 'Capitã de Equipe da Ambu'] },
    { label: 'Sannin', postos: ['Sannin'] },
    { label: 'Jonin', postos: ['Jonin'] },
    { label: 'Chunin', postos: ['Chunin'] },
    { label: 'Genin', postos: ['Genin'] },
  ],

  // A Marinha é organização de Kirigakure: o Mizukage é cargo, o resto é patente. Por prefixo
  // porque cada posto existe uma vez por frota — hoje Leviatã, Kraken, Megalodon e Jormungandr.
  // O feminino entra separado: as fichas gravam "Capitã da Frota Kraken", não "Capitão".
  Kirigakure: [
    { label: 'Mizukage', postos: ['Mizukage'] },
    { label: 'Almirante', prefixos: ['Almirante da Frota'] },
    { label: 'Vice-Almirante', prefixos: ['Vice-Almirante da Frota'] },
    { label: 'Capitão', prefixos: ['Capitão da Frota', 'Capitã da Frota'] },
    { label: 'Capitão-Tenente', prefixos: ['Capitão-Tenente da Frota', 'Capitã-Tenente da Frota'] },
  ],

  Kumogakure: [
    { label: 'Raikage', postos: ['Raikage'] },
    { label: 'General de Guerra', postos: ['General'] },
    { label: 'Líder da Elite', postos: ['Líder da Elite'] },
    { label: 'Vice Líder da Elite', postos: ['Vice Líder da Elite'] },
    { label: 'Membro da Elite', postos: ['Membro da Elite'] },
  ],

  Sunagakure: [
    { label: 'Kazekage', postos: ['Kazekage'] },
    { label: 'Kazekage das Sombras', postos: ['Kazekage das Sombras'] },
    { label: 'Pilar', prefixos: ['Pilar d'] },
  ],

  // Os três últimos são o MESMO cargo em duas ordens: o primeiro nome que o Pedro dita é o líder
  // dos samurais, o segundo é o dos monges. O rótulo junta os dois; o cargo na ficha diz qual.
  //
  // A Dama da Terra entrou em 24/09/2026 com a Sekka Gunma, esposa do 1º Tsuchikage. Fica logo
  // abaixo da liderança da vila, como a Dama de Konoha fica abaixo do Hokage e dos Braços. A Dama
  // dos Samurais entrou no mesmo dia, logo abaixo do Rei dos Samurais — Onna e Zanshin Ishi, as duas
  // primeiras, ainda sem ficha.
  Iwagakure: [
    { label: 'Tsuchikage', postos: ['Tsuchikage'] },
    { label: 'Governador da Pedra', postos: ['Governador da Pedra'] },
    { label: 'Dama da Terra', postos: ['Dama da Terra'] },
    { label: 'Líder dos Monges', postos: ['Líder dos Monges'] },
    { label: 'Rei dos Samurais', postos: ['Rei dos Samurais'] },
    { label: 'Dama dos Samurais', postos: ['Dama dos Samurais'] },
    { label: 'Líder Espiritual', postos: ['Líder Espiritual dos Samurais', 'Líder Espiritual dos Monges'] },
    { label: 'Líder Mental', postos: ['Líder Mental dos Samurais', 'Líder Mental dos Monges'] },
    { label: 'Líder Corporal', postos: ['Líder Corporal dos Samurais', 'Líder Corporal dos Monges'] },
  ],

  NoGuns: [
    { label: 'Líder da NoGuns', postos: ['Líder da NoGuns'] },
    { label: 'Vice Líder da NoGuns', postos: ['Vice Líder da NoGuns'] },
    { label: 'Membro da NoGuns', postos: ['NoGuns'] },
  ],

  Kiba: [
    { label: 'Líder da Kiba', postos: ['Líder da Kiba'] },
    { label: 'Vice Líder da Kiba', postos: ['Vice Líder da Kiba'] },
    { label: 'Membro da Kiba', postos: ['Membro da Kiba'] },
  ],
};

/** O posto (cargo ou patente, sem ordinal) casa com esta entrada do catálogo? */
export const casaPosto = (e: PostoDeAba, posto: string): boolean =>
  (e.postos?.includes(posto) ?? false) || (e.prefixos?.some(p => posto.startsWith(p)) ?? false);

/**
 * Onde um posto vive: a aba (vila ou organização) e a posição dele na hierarquia dela.
 *
 * É o que dá ao selo do card duas coisas de uma vez: qual posto mostrar quando a ficha tem vários
 * (o de menor `ordem` é o mais alto) e de qual cor pintar (a cor da `aba`). Posto que não está em
 * catálogo nenhum — as patentes da OCA, por exemplo — devolve null e vai pro fim da fila.
 */
export const localDoPosto = (posto: string): { aba: string; ordem: number } | null => {
  for (const [aba, cat] of Object.entries(POSTOS_POR_ABA)) {
    const i = cat.findIndex(e => casaPosto(e, posto));
    if (i >= 0) return { aba, ordem: i };
  }
  return null;
};

/**
 * O posto mais alto que a ficha tem, comparando a posição dentro do catálogo de cada aba. É o que o
 * card mostra em "Todos" e o que a ficha usa na linha CARGO — antes era `patente[0] || cargo[0]`,
 * ordem de array, e por isso o Tobirama aparecia como "1º Vice Líder da OCA" em vez de "2º Hokage".
 *
 * Posto que não está em catálogo nenhum (as patentes da OCA, hoje) vai pro fim. Quando o Pedro
 * ditar a ordem da OCA, ela entra no catálogo e passa a competir.
 */
export const maiorPosto = (c: { cargo?: string[]; patente?: string[] }): { texto: string; aba: string | null } | null => {
  const brutos = [...(c.cargo ?? []), ...(c.patente ?? [])];
  let melhor: string | null = null;
  let melhorI = Infinity;
  let melhorAba: string | null = null;
  for (const v of brutos) {
    const l = localDoPosto(postoDe(v));
    const i = l ? l.ordem : 99;
    if (i < melhorI) { melhorI = i; melhor = v; melhorAba = l?.aba ?? null; }
  }
  return melhor ? { texto: melhor, aba: melhorAba } : null;
};