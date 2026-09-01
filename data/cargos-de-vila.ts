/**
 * Os cargos de cada vila, na ordem de importância — o mais alto primeiro.
 *
 * Existe porque derivar a lista do banco dava dois problemas na aba de uma vila:
 *
 *  1. Vinha cargo de OUTRA vila. O Hiroshi Hanzo tem `2º General` (Kumogakure) e o Rock Gunma
 *     `2º Tsuchikage` (Iwagakure), e os dois estão marcados também como Konohagakure — então
 *     "General" e "Tsuchikage" apareciam no filtro de Konoha.
 *  2. Vinha patente de ORGANIZAÇÃO. "Líder", "Vice Líder", "Membro" e "NoGuns" saíam de
 *     `Líder dos 75%`, `Vice Líder da OCA`, `Membro dos 99%` — que são da OCA e da NoGuns, não
 *     de Konoha.
 *
 * E a ordem alfabética não dizia nada: "Chunin" vinha antes de "Hokage".
 *
 * `macros` são os valores que `macroDe` devolve e que aquele rótulo cobre. É indireto de propósito:
 * os cinco cargos de liderança de esquadrão de Konoha — Ambu, Equipe de Elite, Força Médica,
 * Rastreio e Inovações — todos reduzem para "Líder", e o rótulo que o Pedro quer ver é
 * "Líder de Esquadrão".
 *
 * O casamento é só contra `cargo`, nunca contra `patente`: cargo é posto de vila, patente é posto
 * de organização, e são eixos diferentes.
 *
 * Vila sem catálogo aqui cai na lista derivada de antes. Konoha foi a primeira; as outras entram
 * conforme o Pedro ditar a ordem de cada uma.
 */
export const CARGOS_DE_VILA: Record<string, { label: string; macros: string[] }[]> = {
  Konohagakure: [
    { label: 'Hokage', macros: ['Hokage'] },
    { label: 'Hokage das Sombras', macros: ['Hokage das Sombras'] },
    { label: 'Braço Direito', macros: ['Braço Direito'] },
    { label: 'Braço Esquerdo', macros: ['Braço Esquerdo'] },
    { label: 'Dama', macros: ['Dama'] },
    { label: 'Líder de Esquadrão', macros: ['Líder'] },
    { label: 'Sannin', macros: ['Sannin'] },
    { label: 'Jonin', macros: ['Jonin'] },
    { label: 'Chunin', macros: ['Chunin'] },
    { label: 'Genin', macros: ['Genin'] },
  ],
};
