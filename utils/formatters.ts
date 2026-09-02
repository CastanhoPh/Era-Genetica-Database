export const formatImageUrl = (url: string): string => {
  if (!url) return '';
  
  // Normalize backslashes to slashes (fix for Windows paths like public\images\file.png)
  let formattedUrl = url.replace(/\\/g, '/');

  // Robustly handle 'public/' or '/public/' prefix errors
  // This allows users to paste "public/images/file.png" and we convert it to "/images/file.png"
  formattedUrl = formattedUrl.replace(/^\/?public\//, '');

  // Handle Google Drive Viewer links
  // Convert https://drive.google.com/file/d/ID/view?usp=drivesdk to https://drive.google.com/uc?export=view&id=ID
  if (formattedUrl.includes('drive.google.com') && (formattedUrl.includes('/view') || formattedUrl.includes('/file/d/'))) {
    const idMatch = formattedUrl.match(/\/d\/([^/?]+)/);
    if (idMatch && idMatch[1]) {
      return `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
    }
  }

  // If it's an external URL (http/https) or data URI, return as is
  if (formattedUrl.match(/^(https?:\/\/|data:)/)) {
      return formattedUrl;
  }

  // Handle local images: ensure it starts with /
  if (!formattedUrl.startsWith('/')) {
    formattedUrl = `/${formattedUrl}`;
  }
  
  return formattedUrl;
};

/**
 * O selo de hierarquia da ficha, numa função só para o card, a ficha aberta e o filtro nunca
 * discordarem. A precedência é a regra que o Pedro definiu em 27/08/2026:
 *
 *   1. patente da organização — quem tem organização mostra a patente dela
 *   2. primeiro cargo da vila — na lista dele o primeiro é sempre o posto mais alto
 *   3. position — o campo antigo, para o que ainda não foi migrado
 *
 * String vazia significa sem selo, e quem consome tem que não mostrar nada no lugar: nem
 * rótulo, nem traço, nem espaço reservado. Hoje 20 das 86 fichas caem nesse caso.
 */
export const seloDe = (c: { patente?: string[]; cargo?: string[]; position?: string }): string =>
  c.patente?.[0] || c.cargo?.[0] || c.position || '';

/**
 * A cor de cada vila, definida pelo Pedro em 27/08/2026. As classes estão escritas por extenso
 * de propósito: o Tailwind varre este arquivo em busca de literais, então `text-red-400` montado
 * em tempo de execução não geraria CSS nenhum e a cor sumiria no build.
 *
 * `texto`/`borda`/`fundo` compõem o selo de patente no card e a tag da vila na ficha.
 */
/**
 * A cor de cada vila e organização.
 *
 * `texto`/`borda`/`fundo` vestem um elemento discreto — o selo do card, a linha da ficha. `solido` e
 * `brilho` são o par que preenche: servem à aba ATIVA da lista, que no tema padrão é verde chapado
 * com halo. `hover` é o estado de passagem da aba inativa. Ficam aqui, e não no App, porque cor de
 * vila é vocabulário do projeto inteiro; espalhar um segundo mapa faria o selo e a aba divergirem na
 * primeira vez que uma vila mudasse de cor.
 *
 * Toda classe é escrita por extenso, `hover:` incluído, e é por isso que o campo existe em vez de o
 * App montar `hover:` + `fundo`: o Tailwind varre o código-fonte à procura de nomes de classe, e um
 * nome montado em runtime — por template ou por concatenação — não está no fonte, então a regra
 * simplesmente não entra no CSS final e o hover não pinta nada.
 */
export type CorDeFaccao = {
  texto: string; borda: string; fundo: string;
  solido: string; brilho: string; hover: string;
};

export const CORES_DE_VILA: Record<string, CorDeFaccao> = {
  Konohagakure: { texto: 'text-red-400',    borda: 'border-red-500/40',    fundo: 'bg-red-500/10',    solido: 'bg-red-500 border-red-500',       brilho: 'shadow-[0_0_15px_rgba(239,68,68,0.45)]',   hover: 'hover:bg-red-500/20 hover:border-red-500' },
  Sunagakure:   { texto: 'text-green-400',  borda: 'border-green-500/40',  fundo: 'bg-green-500/10',  solido: 'bg-green-500 border-green-500',   brilho: 'shadow-[0_0_15px_rgba(34,197,94,0.45)]',   hover: 'hover:bg-green-500/20 hover:border-green-500' },
  Kirigakure:   { texto: 'text-blue-400',   borda: 'border-blue-500/40',   fundo: 'bg-blue-500/10',   solido: 'bg-blue-400 border-blue-400',     brilho: 'shadow-[0_0_15px_rgba(96,165,250,0.45)]',  hover: 'hover:bg-blue-500/20 hover:border-blue-400' },
  Kumogakure:   { texto: 'text-yellow-300', borda: 'border-yellow-400/40', fundo: 'bg-yellow-400/10', solido: 'bg-yellow-400 border-yellow-400', brilho: 'shadow-[0_0_15px_rgba(250,204,21,0.45)]',  hover: 'hover:bg-yellow-400/20 hover:border-yellow-400' },
  Iwagakure:    { texto: 'text-orange-400', borda: 'border-orange-500/40', fundo: 'bg-orange-500/10', solido: 'bg-orange-400 border-orange-400', brilho: 'shadow-[0_0_15px_rgba(251,146,60,0.45)]',  hover: 'hover:bg-orange-500/20 hover:border-orange-400' },
};

/** As vilas da ficha, em ordem, olhando o campo `vila` e caindo em `categories` se ele faltar. */
export const vilasDe = (c: { vila?: string[]; categories?: string[] }): string[] => {
  const de = c.vila?.length ? c.vila : (c.categories ?? []);
  return de.filter(v => v in CORES_DE_VILA);
};

/** A cor de cada organização, definida pelo Pedro em 27/08/2026. Mesma regra dos literais. */
export const CORES_DE_ORG: Record<string, CorDeFaccao> = {
  OCA:    { texto: 'text-white',      borda: 'border-white/45',      fundo: 'bg-white/10',      solido: 'bg-white border-white',           brilho: 'shadow-[0_0_15px_rgba(255,255,255,0.4)]',  hover: 'hover:bg-white/20 hover:border-white' },
  NoGuns: { texto: 'text-slate-400',  borda: 'border-slate-400/45',  fundo: 'bg-slate-400/10',  solido: 'bg-slate-300 border-slate-300',   brilho: 'shadow-[0_0_15px_rgba(203,213,225,0.4)]',  hover: 'hover:bg-slate-400/20 hover:border-slate-300' },
  Kiba:   { texto: 'text-pink-400',   borda: 'border-pink-500/45',   fundo: 'bg-pink-500/10',   solido: 'bg-pink-400 border-pink-400',     brilho: 'shadow-[0_0_15px_rgba(244,114,182,0.45)]', hover: 'hover:bg-pink-500/20 hover:border-pink-400' },
};

/**
 * A cor de uma aba da lista, ou null quando ela não é um lugar.
 *
 * "Todos", "Personagem" e "NPC" não têm cor de propósito: elas não são vila nem organização, são
 * recortes do acervo. Deixá-las no verde do tema é o que faz o modo colorido dizer alguma coisa —
 * colorido é lugar, verde é tipo. Pintar as três só porque são abas apagaria essa leitura.
 */
export const corDaAba = (aba: string): CorDeFaccao | null =>
  CORES_DE_VILA[aba] ?? CORES_DE_ORG[aba] ?? null;
export const CORES_NEUTRAS = { texto: 'text-slate-300', borda: 'border-slate-500/40', fundo: 'bg-slate-500/10' };

/**
 * A cor do selo acompanha a ORIGEM do que ele mostra, não o personagem: se o selo é a patente de
 * uma organização, a cor é da organização; se é um cargo de vila, a cor é da vila. Assim a cor
 * responde "de onde vem esse posto" em vez de repetir uma informação que a tag já dá.
 *
 * Quem tem duas organizações usa a que a própria patente nomeia — o Shikatsu, o Shikure e o Yuuto
 * têm NoGuns e OCA, e a patente dos três é NoGuns.
 */
export const corDoSelo = (c: { vila?: string[]; categories?: string[]; organizacao?: string[]; patente?: string[] }) => {
  const primeira = c.patente?.[0];
  if (primeira) {
    const orgs = c.organizacao ?? [];
    const citada = orgs.find(o => primeira.toLowerCase().includes(o.toLowerCase())) ?? orgs[0];
    if (citada && CORES_DE_ORG[citada]) return CORES_DE_ORG[citada];
  }
  return CORES_DE_VILA[vilasDe(c)[0]] ?? CORES_NEUTRAS;
};

/**
 * O nome do posto sem o ordinal: "3º Hokage" e "2º Hokage" viram "Hokage", "3º Líder da Ambu"
 * vira "Líder da Ambu". É o que o filtro oferece — um Hokage é um Hokage, e listar os três
 * separadamente só multiplicava as opções sem agrupar ninguém.
 */
export const postoDe = (v: string): string => v.replace(/^\d+[ºª]\s*/, '').trim();

/** Todos os postos da ficha, cargo e patente, já sem ordinal. */
export const postosDe = (c: { cargo?: string[]; patente?: string[]; position?: string }): string[] => {
  const tem = (c.cargo?.length ?? 0) + (c.patente?.length ?? 0) > 0;
  const brutos = [...(c.cargo ?? []), ...(c.patente ?? []), tem ? undefined : c.position];
  return [...new Set(brutos.filter((x): x is string => !!x).map(postoDe))];
};

/**
 * O posto MACRO: só o cargo em si, sem ordinal e sem a organização ou frota a que ele pertence.
 *
 *   3º Hokage                          -> Hokage
 *   Almirante da Frota Jormungandr     -> Almirante
 *   Capitã-Tenente da Frota Megalodon  -> Capitão-Tenente
 *   Líder dos 99%                      -> Líder
 *   Pilar da Renúncia                  -> Pilar
 *
 * É o que o filtro da lista oferece. Sem isso ele tinha 69 opções, com quatro linhas só de
 * "Almirante da Frota X" e catorze de "Líder de alguma coisa" — cada uma com um ou dois
 * personagens, o que não filtra nada.
 *
 * Duas normalizações a mais: o feminino vira masculino (senão "Capitã" e "Capitão" são duas
 * opções para o mesmo posto), e o que não tem preposição fica inteiro — "Braço Direito" e
 * "Linhagem Espiritual" são o nome do posto, não posto + qualificador.
 */
const FEMININO: Record<string, string> = { 'Capitã': 'Capitão', 'Capitã-Tenente': 'Capitão-Tenente', 'Dama': 'Dama' };

/**
 * "das Sombras" NÃO é qualificador de organização: é outro cargo. O Hokage das Sombras não é o
 * Hokage — são duas linhas de sucessão paralelas, com ordinal próprio cada uma. Cortar juntava o
 * Kaizuka (3º Hokage das Sombras) no filtro "Hokage", ao lado do Nishinoya e do Tobirama, e o
 * Chigiri e o Shiita (Kazekage das Sombras) no filtro "Kazekage".
 */
const QUALIFICADOR_QUE_FICA = /\s+das\s+Sombras$/i;

export const macroDe = (v: string): string => {
  const semOrdinal = postoDe(v);
  if (QUALIFICADOR_QUE_FICA.test(semOrdinal)) return semOrdinal;
  const cortado = semOrdinal.replace(/\s+(?:da|de|do|das|dos)\s+.+$/i, '').trim();
  return FEMININO[cortado] ?? cortado;
};

/** Os postos macro da ficha, deduplicados. É por aqui que o filtro da lista casa. */
export const macrosDe = (c: { cargo?: string[]; patente?: string[]; position?: string }): string[] =>
  [...new Set(postosDe(c).map(macroDe))];
