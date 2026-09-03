/**
 * As Habilidades Lendárias — o macro que junta dojutsu, jinchuuriki, kekkei genkai e estados
 * especiais numa coisa só, pesquisável.
 *
 * COMO A BUSCA SE COMPORTA, e por quê
 *
 * Cada família é uma ESCADA de degraus, do mais fraco pro mais forte. Pesquisar um degrau traz ele
 * e todos os acima, nunca os abaixo:
 *
 *   "sharingan"          → todos, porque Sharingan é o primeiro degrau
 *   "mangekyou sharingan" → só do segundo degrau pra cima; quem tem apenas Sharingan fica fora
 *   "byakugan"           → traz os Fujogan também, porque Fujogan é evolução do Byakugan
 *   "fujogan"            → só os Fujogan; quem tem apenas Byakugan fica fora
 *
 * E o motivo que o card exibe é sempre o degrau MAIS ALTO daquela ficha na família pesquisada. Isso
 * responde a duas coisas de uma vez: procurar "sharingan" e ver "Mangekyou Sharingan" no card do
 * Oddy, e a Ayumi deixar de exibir o título "Princesa do Sharingan" no lugar da habilidade.
 *
 * `paralelo: true` desliga a escada. Serve pra família onde as marcas são ALTERNATIVAS, não níveis:
 * as nove bijuu, e o par Natural/Artificial. Ali "kurama" tem que trazer só os jinchuuriki do
 * Kurama, e não os nove — enquanto "jinchuuriki", que é o nome da família, traz todos.
 *
 * `apelidos` existe porque o nome da família às vezes não aparece em marca nenhuma: os degraus do
 * Hachimon Tonkou são "1º Portão".."9º Portão", e sem apelido a busca por "hachimon" não acharia
 * ninguém. Mesma coisa com Senjutsu, cujos degraus se chamam "Modo Sábio ...".
 *
 * As marcas moram no campo `aptitudes` da ficha. Os poderes de mesmo nome (Koton, Jinton, Ranton,
 * Hachimon Tonkou, Senjutsu, Magen) continuam existindo em paralelo com nível — são a estatística,
 * não a identidade.
 */

export type DegrauLendario = {
  /** O nome do degrau, e o que a busca casa. O primeiro é o que o card mostra. */
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
    // A escada que o Pedro descreveu: Mangekyou é evolução do Sharingan, e Eterno do Mangekyou.
    // "Implantado" não é degrau, é variante — vive no mesmo nível do original.
    familia: 'Sharingan',
    degraus: [
      { marcas: ['Sharingan', 'Sharingan Implantado'] },
      { marcas: ['Mangekyou Sharingan', 'Mangekyou Sharingan Implantado'] },
      { marcas: ['Mangekyou Sharingan Eterno', 'Mangekyou Sharingan Eterno Implantado'] },
    ],
  },
  {
    // Fujogan é evolução do Byakugan, então os dois são uma família só. Sem apelido de propósito:
    // "Fujogan" como apelido da FAMÍLIA fazia a busca por ele liberar o degrau 0 e trazer o Ryuta,
    // que só tem Byakugan. Como marca de degrau ele já casa sozinho, e aí só traz do degrau 1 pra
    // cima — que é a regra que o Pedro pediu.
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
    // Incompleto → Completo é escada; Artificial é variante do Completo, não um quarto nível.
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
    // dela — ou seja, procurar Kagura Shingan tem que trazer os Shingan também. "Shingan" é
    // substring de "Kagura Shingan", então os dois termos amplos trazem a família inteira e só os
    // "Perfeito" estreitam.
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
];

/** Como o macro se chama na busca. */
export const MACRO_LENDARIO = ['Habilidade Lendária', 'Habilidades Lendárias', 'Lendária', 'Lendaria'];

const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Toda marca lendária que existe, para o teste rápido de "esta aptidão é lendária?". */
const TODAS = new Set<string>();
for (const f of FAMILIAS_LENDARIAS) for (const d of f.degraus) for (const m of d.marcas) TODAS.add(m);

export const eMarcaLendaria = (aptidao: string): boolean => TODAS.has(aptidao);

/** As marcas lendárias de uma ficha, na ordem em que estão na aptidão. */
export const marcasLendarias = (aptitudes?: string[]): string[] =>
  (aptitudes ?? []).filter(eMarcaLendaria);

/**
 * O degrau mais alto que a ficha tem naquela família, ou null.
 *
 * Em família paralela "mais alto" não quer dizer nada, então devolve a primeira marca encontrada —
 * e quem tem duas bijuu (a Reika) aparece com a primeira, que é o que cabe numa linha do card.
 */
function maiorDegrau(f: FamiliaLendaria, aptitudes: string[]): { marca: string; nivel: number } | null {
  let achado: { marca: string; nivel: number } | null = null;
  f.degraus.forEach((d, nivel) => {
    for (const m of d.marcas) {
      if (!aptitudes.includes(m)) continue;
      if (!achado || nivel >= achado.nivel) achado = { marca: m, nivel };
    }
  });
  return achado;
}

/**
 * Casa um termo de busca contra as habilidades lendárias de uma ficha.
 *
 * Devolve o texto que o card deve exibir, ou null quando não casou. Ver o comentário do topo para a
 * regra de escada, que é o coração disto.
 */
export function casaLendaria(aptitudes: string[] | undefined, termo: string): string | null {
  const t = semAcento(termo);
  if (!t) return null;
  const apts = aptitudes ?? [];

  // O macro: traz qualquer ficha com qualquer marca.
  if (MACRO_LENDARIO.some(m => semAcento(m).includes(t))) {
    const todas = marcasLendarias(apts);
    return todas.length ? todas.join(' · ') : null;
  }

  for (const f of FAMILIAS_LENDARIAS) {
    const nomes = [f.familia, ...(f.apelidos ?? [])];
    const casouFamilia = nomes.some(n => semAcento(n).includes(t));

    // Degraus cujo nome contém o termo. O MENOR deles é o piso da busca.
    let piso = Infinity;
    let casouMarca = false;
    const marcasCasadas: string[] = [];
    f.degraus.forEach((d, nivel) => {
      for (const m of d.marcas) {
        if (!semAcento(m).includes(t)) continue;
        casouMarca = true;
        marcasCasadas.push(m);
        if (nivel < piso) piso = nivel;
      }
    });

    if (!casouFamilia && !casouMarca) continue;

    const meu = maiorDegrau(f, apts);
    if (!meu) continue;

    // Família paralela: as marcas são alternativas, então o termo específico só traz quem tem
    // exatamente aquela marca. O nome da família continua trazendo todo mundo.
    if (f.paralelo && !casouFamilia) {
      const minha = marcasCasadas.find(m => apts.includes(m));
      return minha ?? null;
    }

    // Escada: entra quem está no piso ou acima.
    const exigido = casouFamilia ? 0 : piso;
    return meu.nivel >= exigido ? meu.marca : null;
  }
  return null;
}
