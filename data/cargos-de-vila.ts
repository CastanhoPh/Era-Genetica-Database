/**
 * Os cargos de cada vila, na ordem de importância — o mais alto primeiro.
 *
 * Existe porque derivar a lista do banco dava três problemas na aba de uma vila:
 *
 *  1. Vinha cargo de OUTRA vila. O `cargo` da ficha é uma lista de textos, sem vínculo com a vila,
 *     e quem tem duas vilas leva os cargos das duas pra ambas: o Hiroshi Hanzo tem `2º General`
 *     (Kumogakure) e o Rock Gunma `2º Tsuchikage` (Iwagakure), e os dois são também Konohagakure.
 *  2. Vinha patente de ORGANIZAÇÃO — Líder dos 75%, Vice Líder da OCA, Membro dos 99%.
 *  3. A ordem alfabética não dizia nada: "Chunin" vinha antes de "Hokage".
 *
 * `postos` são os valores EXATOS do cargo, já sem ordinal, que o rótulo cobre. Casar por posto
 * inteiro e não pelo macro é o que evita colisão: "Líder dos Monges" e "Líder de Inovações"
 * reduzem os dois para "Líder", e o Rock Gunma apareceria como Líder dos Monges de Iwagakure.
 *
 * O casamento é só contra `cargo`, nunca contra `patente`: cargo é posto de vila, patente é posto
 * de organização, e são eixos diferentes.
 *
 * Vila sem catálogo aqui cai na lista derivada de antes. Cargo listado sem nenhum dono some do
 * filtro sozinho, então dá pra cadastrar o posto antes de a ficha do titular existir.
 */
export const CARGOS_DE_VILA: Record<string, { label: string; postos: string[] }[]> = {
  Konohagakure: [
    { label: 'Hokage', postos: ['Hokage'] },
    { label: 'Hokage das Sombras', postos: ['Hokage das Sombras'] },
    { label: 'Braço Direito', postos: ['Braço Direito'] },
    { label: 'Braço Esquerdo', postos: ['Braço Esquerdo'] },
    { label: 'Dama', postos: ['Dama'] },
    // Os seis esquadrões de Konoha sob um rótulo só, como o Pedro pediu.
    { label: 'Líder de Esquadrão', postos: [
      'Líder da Equipe de Elite', 'Líder da Ambu', 'Líder de Rastreio',
      'Líder de Inovações', 'Líder da Força Médica', 'Líder da Academia Ninja',
    ] },
    { label: 'Sannin', postos: ['Sannin'] },
    { label: 'Jonin', postos: ['Jonin'] },
    { label: 'Chunin', postos: ['Chunin'] },
    { label: 'Genin', postos: ['Genin'] },
  ],

  // Os três últimos são o MESMO cargo em duas ordens: o primeiro nome que o Pedro dita é o líder
  // dos samurais, o segundo é o dos monges. O rótulo junta os dois; o cargo na ficha diz qual.
  Iwagakure: [
    { label: 'Tsuchikage', postos: ['Tsuchikage'] },
    { label: 'Governador da Pedra', postos: ['Governador da Pedra'] },
    { label: 'Líder dos Monges', postos: ['Líder dos Monges'] },
    { label: 'Rei dos Samurais', postos: ['Rei dos Samurais'] },
    { label: 'Líder Espiritual', postos: ['Líder Espiritual dos Samurais', 'Líder Espiritual dos Monges'] },
    { label: 'Líder Mental', postos: ['Líder Mental dos Samurais', 'Líder Mental dos Monges'] },
    { label: 'Líder Corporal', postos: ['Líder Corporal dos Samurais', 'Líder Corporal dos Monges'] },
  ],
};
