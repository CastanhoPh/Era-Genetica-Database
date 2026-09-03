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
 * "Implantado" não existe como aptidão — o Pedro decidiu isso primeiro no Sharingan e depois no
 * Byakugan. O implante é fato da história, não capacidade, então a marca é a do estágio.
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
  /**
   * Nomes do PODER correspondente, quando a família também existe em `powers` com nível.
   *
   * Existe porque onze famílias não têm marca em `aptitudes` nenhuma — o Pedro decidiu que aquelas
   * aptidões não existem, e o que resta delas é o poder. Sem isto, procurar "fuinjutsu" não achava
   * nenhuma das 29 fichas que têm `Fuinjutsu` como poder, porque a busca só olhava aptidão.
   *
   * Mais de um nome por causa das grafias que convivem no banco: `Fuinjutsu` e `Fūinjutsu`,
   * `Iryou Ninjutsu` e `Iryō Ninjutsu`. E no Jinchuuriki o "poder" é o nome da própria bijuu.
   */
  poderes?: string[];
};

export const FAMILIAS_LENDARIAS: FamiliaLendaria[] = [
  {
    familia: 'Jinchuuriki',
    paralelo: true,
    poderes: ['Shukaku', 'Matatabi', 'Isobu', 'Son Goku', 'Kokuo', 'Saiken', 'Chomei', 'Gyuki', 'Kurama'],
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
    poderes: ['Senjutsu'],
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
    poderes: ['Ranton'],
    degraus: [{ marcas: ['Ranton Natural', 'Ranton Artificial'] }],
  },
  {
    familia: 'Kaminari',
    degraus: [{ marcas: ['Kaminari'] }],
  },
  {
    familia: 'Shiroki Kaminari',
    degraus: [{ marcas: ['Shiroki Kaminari'] }],
  },
  {
    // A escada que o Pedro descreveu: Mangekyou é evolução do Sharingan, e Eterno do Mangekyou.
    // "Implantado" não é degrau, é variante — vive no mesmo nível do original.
    familia: 'Sharingan',
    degraus: [
      { marcas: ['Sharingan'] },
      { marcas: ['Mangekyou Sharingan'] },
      { marcas: ['Mangekyou Sharingan Eterno'] },
    ],
  },
  {
    // Fujogan é evolução do Byakugan, então os dois são uma família só. Sem apelido de propósito:
    // "Fujogan" como apelido da FAMÍLIA fazia a busca por ele liberar o degrau 0 e trazer o Ryuta,
    // que só tem Byakugan. Como marca de degrau ele já casa sozinho, e aí só traz do degrau 1 pra
    // cima — que é a regra que o Pedro pediu.
    familia: 'Byakugan',
    degraus: [
      { marcas: ['Byakugan'] },
      { marcas: ['Fujogan'] },
      { marcas: ['Fujogan Eterno'] },
    ],
  },
  {
    familia: 'Ketsuryugan',
    degraus: [
      { marcas: ['Ketsuryugan'] },
      { marcas: ['Ketsuryugan Perfeito'] },
    ],
  },
  {
    // Incompleto → Completo é escada; Artificial é variante do Completo, não um quarto nível.
    familia: 'Koton',
    poderes: ['Koton'],
    degraus: [
      { marcas: ['Koton Incompleto'] },
      { marcas: ['Koton Completo', 'Koton Artificial'] },
    ],
  },
  {
    familia: 'Jinton',
    paralelo: true,
    poderes: ['Jinton'],
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
    poderes: ['Hachimon Tonkou'],
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
      { marcas: ['Hiraishin: Deus do Trovão'] },
    ],
  },
  {
    familia: 'Clone Perfeito',
    degraus: [{ marcas: ['Clone Perfeito'] }],
  },
  {
    familia: 'Genjutsu',
    apelidos: ['Magen'],
    poderes: ['Magen'],
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
    poderes: ['Kuchiyose'],
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
    poderes: ['Kugutsu'],
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
    poderes: ['Mokuton'],
    degraus: [{ marcas: ['Mokuton Natural', 'Mokuton Artificial'] }],
  },
  {
    familia: 'Fuinjutsu',
    apelidos: ['Fūinjutsu', 'Selos'],
    poderes: ['Fuinjutsu', 'Fūinjutsu'],
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
    // O Pedro escreveu "Iryo"; a marca usa "Iryou" para casar com o nome do PODER, que é
    // `Iryou Ninjutsu` em 14 fichas. "iryo" acha por substring, então as duas grafias funcionam.
    familia: 'Iryou Ninjutsu',
    apelidos: ['Iryō Ninjutsu', 'Jutsu Médico', 'Ninja Médico', 'Medicina'],
    poderes: ['Iryou Ninjutsu', 'Iryō Ninjutsu'],
    degraus: [{ marcas: ['Ninjutsu Médico'] }],
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
export type FichaBuscavel = {
  aptitudes?: string[];
  // `level` aceita string porque o tipo Power do projeto e assim — algumas fichas gravam o nivel
  // como texto.
  powers?: { name?: string; level?: string | number }[];
};

export function casaLendaria(ficha: FichaBuscavel | undefined, termo: string): string | null {
  const t = semAcento(termo);
  if (!t) return null;
  const apts = ficha?.aptitudes ?? [];
  const powers = ficha?.powers ?? [];
  /**
   * O poder daquela família que a ficha tem, formatado como o card exibe: "Fuinjutsu 15".
   *
   * `so` restringe a quais nomes valem. Serve ao caso do Jinchuuriki, onde o "poder" é o nome da
   * bijuu: procurar "kurama" tem que trazer só os três hospedeiros dela, não os doze da família.
   */
  const poderDe = (f: FamiliaLendaria, so?: string[]): string | null => {
    for (const nome of so ?? f.poderes ?? []) {
      const p = powers.find(x => (x.name ?? '').toLowerCase() === nome.toLowerCase());
      if (p) return `${p.name} ${p.level ?? 0}`;
    }
    return null;
  };

  // O macro: traz qualquer ficha com qualquer marca, ou com o poder de qualquer família.
  if (MACRO_LENDARIO.some(m => semAcento(m).includes(t))) {
    const todas = marcasLendarias(apts);
    if (todas.length) return todas.join(' · ');
    const pelosPoderes = FAMILIAS_LENDARIAS.map(f => poderDe(f)).filter(Boolean) as string[];
    return pelosPoderes.length ? pelosPoderes.join(' · ') : null;
  }

  for (const f of FAMILIAS_LENDARIAS) {
    const nomes = [f.familia, ...(f.apelidos ?? [])];
    const casouFamilia = nomes.some(n => semAcento(n).includes(t));
    // Nome de poder também é pesquisável: sem isto, "kurama" não achava ninguém depois que as
    // marcas `Jinchuuriki do Kurama` saíram das aptidões.
    const poderesCasados = (f.poderes ?? []).filter(n => semAcento(n).includes(t));

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

    if (poderesCasados.length && !casouFamilia) {
      const pd = poderDe(f, poderesCasados);
      if (pd) return pd;
      continue;
    }
    if (!casouFamilia && !casouMarca) continue;

    const meu = maiorDegrau(f, apts);
    if (!meu) {
      // Sem marca em aptidão, o poder responde. Só quando o termo casou o NOME da família (ou um
      // apelido), nunca um degrau específico: "fuinjutsu proibido" não pode trazer quem tem só o
      // poder, porque o poder não diz em que degrau a pessoa está.
      const pd = casouFamilia ? poderDe(f) : null;
      if (pd) return pd;
      continue;
    }

    // Família paralela: as marcas são alternativas, então o termo específico só traz quem tem
    // exatamente aquela marca. O nome da família continua trazendo todo mundo.
    if (f.paralelo && !casouFamilia) {
      const minha = marcasCasadas.find(m => apts.includes(m));
      if (minha) return minha;
      continue;
    }

    // Escada: entra quem está no piso ou acima. `continue` em vez de `return null` porque um termo
    // genérico casa em várias famílias — "perfeito" está em Ketsuryugan, Kugutsu, Fuinjutsu, Iryou,
    // Hiraishin, Modo Sábio, Shingan e Clone Perfeito. Abortar na primeira que não qualifica fazia
    // a ficha desaparecer mesmo tendo a habilidade numa família seguinte.
    const exigido = casouFamilia ? 0 : piso;
    if (meu.nivel >= exigido) return meu.marca;
  }
  return null;
}
