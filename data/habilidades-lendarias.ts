/**
 * As Habilidades Lendárias — dojutsu, jinchuuriki, kekkei genkai e estados especiais num conceito
 * só, pesquisável.
 *
 * O NÍVEL LENDÁRIO É UM CAMPO PRÓPRIO
 *
 * Ele vive em `habilidadesLendarias` na ficha, e não em `aptitudes` nem em `powers`. As três coisas
 * coexistem porque dizem coisas diferentes, e o Iryou é o exemplo mais claro:
 *
 *   poder    `Iryou Ninjutsu 14`         a estatística, limitada pelo teto do NC
 *   aptidão  "Ninjutsu Médico"           o que a ficha lista como capacidade
 *   nível    "Iryou Ninjutsu Perfeito"   o que o card mostra quando a busca casa
 *
 * Misturar os três num campo só foi o erro da primeira versão disto: o vocabulário de cada um é
 * diferente, e mexer num arrastava os outros.
 *
 * COMO A BUSCA SE COMPORTA
 *
 * Cada família é uma ESCADA de degraus, do mais fraco pro mais forte. Pesquisar um degrau traz ele
 * e todos os acima, nunca os abaixo:
 *
 *   "sharingan"           → todos, porque Sharingan é o primeiro degrau
 *   "mangekyou sharingan" → só do segundo degrau pra cima
 *   "byakugan"            → traz os Fujogan também, porque Fujogan é evolução do Byakugan
 *   "fujogan"             → só os Fujogan; quem tem apenas Byakugan fica fora
 *
 * E o motivo que o card exibe é sempre o degrau MAIS ALTO daquela ficha na família pesquisada.
 *
 * "Implantado" não é degrau, é variante: mora no mesmo nível do original, porque o implante muda a
 * origem e não a potência.
 *
 * `paralelo: true` desliga a escada, para família onde as marcas são ALTERNATIVAS e não níveis: as
 * nove bijuu, e os pares Natural/Artificial. Ali "kurama" traz só os jinchuuriki do Kurama,
 * enquanto "jinchuuriki", que é o nome da família, traz todos.
 *
 * `apelidos` cobre o nome que a família não carrega em marca nenhuma: os degraus do Hachimon são
 * "1º Portão".."9º Portão", e sem apelido a busca por "hachimon" não acharia ninguém. Serve também
 * para sinônimo de mesa — "marionete" pelo Kugutsu, "jutsu médico" pelo Iryou.
 */

export type DegrauLendario = {
  /** Os nomes daquele degrau. O primeiro que a ficha tiver é o que o card mostra. */
  marcas: string[];
};

export type FamiliaLendaria = {
  familia: string;
  apelidos?: string[];
  /** Marcas são alternativas, não níveis: pesquisar uma traz só quem tem aquela. */
  paralelo?: boolean;
  /** Do mais fraco pro mais forte. */
  degraus: DegrauLendario[];
};

export const FAMILIAS_LENDARIAS: FamiliaLendaria[] = [
  {
    familia: 'Jinchuuriki',
    paralelo: true,
    degraus: [{
      marcas: [
        'Jinchuuriki do Shukaku', 'Jinchuuriki do Matatabi', 'Jinchuuriki do Isobu',
        'Jinchuuriki do Son Goku', 'Jinchuuriki do Kokuo', 'Jinchuuriki do Saiken',
        'Jinchuuriki do Chomei', 'Jinchuuriki do Gyuki', 'Jinchuuriki do Kurama',
      ],
    }],
  },
  {
    familia: 'Jinchuuriki Profano',
    paralelo: true,
    degraus: [{
      marcas: ['Jinchuuriki Profano', 'Jinchuuriki Profano do Aokiba', 'Jinchuuriki Profano do Geidetsu'],
    }],
  },
  {
    familia: 'Senjutsu',
    apelidos: ['Modo Sábio'],
    degraus: [
      { marcas: ['Modo Sábio Instável'] },
      { marcas: ['Modo Sábio Incompleto'] },
      { marcas: ['Modo Sábio Completo'] },
      { marcas: ['Modo Sábio Semi Perfeito'] },
      { marcas: ['Modo Sábio Perfeito'] },
    ],
  },
  {
    familia: 'Ranton',
    paralelo: true,
    degraus: [{ marcas: ['Ranton Natural', 'Ranton Artificial'] }],
  },
  {
    familia: 'Kaminari',
    paralelo: true,
    degraus: [{ marcas: ['Kaminari Natural', 'Kaminari Artificial'] }],
  },
  {
    familia: 'Shiroki Kaminari',
    paralelo: true,
    degraus: [{ marcas: ['Shiroki Kaminari Natural', 'Shiroki Kaminari Artificial'] }],
  },
  {
    familia: 'Sharingan',
    degraus: [
      { marcas: ['Sharingan', 'Sharingan Implantado'] },
      { marcas: ['Mangekyou Sharingan', 'Mangekyou Sharingan Implantado'] },
      { marcas: ['Mangekyou Sharingan Eterno', 'Mangekyou Sharingan Eterno Implantado'] },
    ],
  },
  {
    // Fujogan é evolução do Byakugan, então os dois são uma família só. Sem apelido "Fujogan" de
    // propósito: como apelido da FAMÍLIA ele liberaria o degrau 0 e traria quem tem só Byakugan.
    // Como marca de degrau, ele casa sozinho e a escada funciona.
    familia: 'Byakugan',
    degraus: [
      { marcas: ['Byakugan', 'Byakugan Implantado'] },
      { marcas: ['Fujogan', 'Fujogan Implantado'] },
      { marcas: ['Fujogan Eterno', 'Fujogan Eterno Implantado'] },
    ],
  },
  {
    familia: 'Ketsuryugan',
    degraus: [
      { marcas: ['Ketsuryugan'] },
      { marcas: ['Ketsuryugan Perfeito', 'Ketsuryugan Perfeito Implantado'] },
    ],
  },
  {
    // Incompleto -> Completo é escada; Artificial é variante do Completo, não um quarto nível.
    familia: 'Koton',
    degraus: [
      { marcas: ['Koton Incompleto'] },
      { marcas: ['Koton Completo', 'Koton Artificial'] },
    ],
  },
  {
    familia: 'Jinton',
    paralelo: true,
    degraus: [{ marcas: ['Jinton Natural', 'Jinton Artificial'] }],
  },
  {
    // Kagura Shingan na base porque o Pedro anotou "Shingan deve aparecer nessa pesquisa" ao lado
    // dela: procurar Kagura Shingan tem que trazer os Shingan também.
    familia: 'Kagura Shingan',
    degraus: [
      { marcas: ['Kagura Shingan'] },
      { marcas: ['Kagura Shingan Perfeito'] },
      { marcas: ['Shingan'] },
      { marcas: ['Shingan Perfeito'] },
    ],
  },
  {
    familia: 'Hachimon Tonkou',
    apelidos: ['Portão', 'Portao', 'Oito Portões'],
    degraus: [
      { marcas: ['1º Portão'] }, { marcas: ['2º Portão'] }, { marcas: ['3º Portão'] },
      { marcas: ['4º Portão'] }, { marcas: ['5º Portão'] }, { marcas: ['6º Portão'] },
      { marcas: ['7º Portão'] }, { marcas: ['8º Portão'] }, { marcas: ['9º Portão'] },
    ],
  },
  {
    familia: 'Hiraishin',
    apelidos: ['Deus do Trovão'],
    degraus: [
      { marcas: ['Hiraishin'] },
      { marcas: ['Hiraishin Deus do Trovão'] },
      { marcas: ['Hiraishin Perfeito'] },
    ],
  },
  {
    familia: 'Clone Perfeito',
    degraus: [{ marcas: ['Clone Perfeito'] }],
  },
  {
    familia: 'Genjutsu',
    apelidos: ['Magen'],
    degraus: [
      { marcas: ['Genjutsu Instável'] },
      { marcas: ['Genjutsu Incompleto'] },
      { marcas: ['Genjutsu Completo'] },
      { marcas: ['Genjutsu Perfeito'] },
    ],
  },
  {
    familia: 'Kuchiyose',
    apelidos: ['Invocação'],
    degraus: [
      { marcas: ['Kuchiyose Incompleta'] },
      { marcas: ['Kuchiyose Completa'] },
      { marcas: ['Kuchiyose Contrato Selado'] },
    ],
  },
  {
    familia: 'Byakugou',
    degraus: [
      { marcas: ['Byakugou Incompleto'] },
      { marcas: ['Byakugou Completo'] },
    ],
  },
  {
    // A ordem é a que o Pedro ditou: Humano vem depois de Completo, e Perfeito fecha.
    familia: 'Kugutsu',
    apelidos: ['Marionete'],
    degraus: [
      { marcas: ['Kugutsu Instável'] },
      { marcas: ['Kugutsu Completo'] },
      { marcas: ['Kugutsu Humano'] },
      { marcas: ['Kugutsu Perfeito'] },
    ],
  },
  {
    familia: 'Mokuton',
    paralelo: true,
    degraus: [{ marcas: ['Mokuton Natural', 'Mokuton Artificial'] }],
  },
  {
    familia: 'Fuinjutsu',
    apelidos: ['Fūinjutsu', 'Selos'],
    degraus: [
      { marcas: ['Fuinjutsu Instável'] },
      { marcas: ['Fuinjutsu Incompleto'] },
      { marcas: ['Fuinjutsu Completo'] },
      { marcas: ['Fuinjutsu Semi Perfeito'] },
      { marcas: ['Fuinjutsu Perfeito'] },
      { marcas: ['Fuinjutsu Proibido'] },
    ],
  },
  {
    // O nível usa "Iryou", igual ao nome do poder. A APTIDÃO dessas fichas se chama "Ninjutsu
    // Médico" — vocabulário diferente de propósito, e os apelidos abaixo cobrem os dois jeitos de
    // procurar.
    familia: 'Iryou Ninjutsu',
    apelidos: ['Iryō Ninjutsu', 'Jutsu Médico', 'Ninjutsu Médico', 'Medicina'],
    degraus: [
      { marcas: ['Iryou Ninjutsu Instável'] },
      { marcas: ['Iryou Ninjutsu Incompleto'] },
      { marcas: ['Iryou Ninjutsu Completo'] },
      { marcas: ['Iryou Ninjutsu Semi Perfeito'] },
      { marcas: ['Iryou Ninjutsu Perfeito'] },
      { marcas: ['Iryou Ninjutsu Proibido'] },
    ],
  },
  {
    familia: 'Edo Tensei',
    apelidos: ['Ressurreição'],
    degraus: [{ marcas: ['Edo Tensei'] }],
  },
];

/** Como o macro se chama na busca. */
export const MACRO_LENDARIO = ['Habilidade Lendária', 'Habilidades Lendárias', 'Lendária', 'Lendaria'];

const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Todo nível lendário que existe, para o teste rápido de pertinência. */
const TODOS = new Set<string>();
for (const f of FAMILIAS_LENDARIAS) for (const d of f.degraus) for (const m of d.marcas) TODOS.add(m);

export const eNivelLendario = (nome: string): boolean => TODOS.has(nome);

export type FichaBuscavel = { habilidadesLendarias?: string[] };

/** Os níveis lendários de uma ficha, na ordem em que estão gravados. */
export const niveisLendarios = (ficha?: FichaBuscavel): string[] =>
  (ficha?.habilidadesLendarias ?? []).filter(eNivelLendario);

/**
 * O degrau mais alto que a ficha tem naquela família, ou null.
 *
 * Em família paralela "mais alto" não quer dizer nada, então devolve a primeira marca encontrada —
 * e quem tem duas bijuu (a Reika) aparece com a primeira, que é o que cabe numa linha do card.
 */
function maiorDegrau(f: FamiliaLendaria, niveis: string[]): { marca: string; nivel: number } | null {
  let achado: { marca: string; nivel: number } | null = null;
  f.degraus.forEach((d, nivel) => {
    for (const m of d.marcas) {
      if (!niveis.includes(m)) continue;
      if (!achado || nivel >= achado.nivel) achado = { marca: m, nivel };
    }
  });
  return achado;
}

/**
 * Casa um termo de busca contra os níveis lendários de uma ficha.
 *
 * Devolve o texto que o card deve exibir, ou null quando não casou.
 */
export function casaLendaria(ficha: FichaBuscavel | undefined, termo: string): string | null {
  const t = semAcento(termo);
  if (!t) return null;
  const niveis = niveisLendarios(ficha);
  if (!niveis.length) return null;

  // O macro: traz qualquer ficha com qualquer nível.
  if (MACRO_LENDARIO.some(m => semAcento(m).includes(t))) return niveis.join(' · ');

  for (const f of FAMILIAS_LENDARIAS) {
    const casouFamilia = [f.familia, ...(f.apelidos ?? [])].some(n => semAcento(n).includes(t));

    // Degraus cujo nome contém o termo. O MENOR deles é o piso da busca.
    let piso = Infinity;
    const marcasCasadas: string[] = [];
    f.degraus.forEach((d, nivel) => {
      for (const m of d.marcas) {
        if (!semAcento(m).includes(t)) continue;
        marcasCasadas.push(m);
        if (nivel < piso) piso = nivel;
      }
    });
    if (!casouFamilia && !marcasCasadas.length) continue;

    const meu = maiorDegrau(f, niveis);
    if (!meu) continue;

    // Família paralela: as marcas são alternativas, então o termo específico só traz quem tem
    // exatamente aquela marca. O nome da família continua trazendo todo mundo.
    if (f.paralelo && !casouFamilia) {
      const minha = marcasCasadas.find(m => niveis.includes(m));
      if (minha) return minha;
      continue;
    }

    // Escada: entra quem está no piso ou acima. `continue` em vez de `return null` porque um termo
    // genérico casa em várias famílias — "perfeito" está em oito delas — e abortar na primeira que
    // não qualifica fazia a ficha desaparecer mesmo tendo a habilidade numa família seguinte.
    const exigido = casouFamilia ? 0 : piso;
    if (meu.nivel >= exigido) return meu.marca;
  }
  return null;
}
