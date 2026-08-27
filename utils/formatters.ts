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
export const seloDe = (c: { patente?: string; cargo?: string[]; position?: string }): string =>
  c.patente || c.cargo?.[0] || c.position || '';

/**
 * A cor de cada vila, definida pelo Pedro em 27/08/2026. As classes estão escritas por extenso
 * de propósito: o Tailwind varre este arquivo em busca de literais, então `text-red-400` montado
 * em tempo de execução não geraria CSS nenhum e a cor sumiria no build.
 *
 * `texto`/`borda`/`fundo` compõem o selo de patente no card e a tag da vila na ficha.
 */
export const CORES_DE_VILA: Record<string, { texto: string; borda: string; fundo: string }> = {
  Konohagakure: { texto: 'text-red-400',    borda: 'border-red-500/40',    fundo: 'bg-red-500/10' },
  Sunagakure:   { texto: 'text-green-400',  borda: 'border-green-500/40',  fundo: 'bg-green-500/10' },
  Kirigakure:   { texto: 'text-blue-400',   borda: 'border-blue-500/40',   fundo: 'bg-blue-500/10' },
  Kumogakure:   { texto: 'text-yellow-300', borda: 'border-yellow-400/40', fundo: 'bg-yellow-400/10' },
  Iwagakure:    { texto: 'text-orange-400', borda: 'border-orange-500/40', fundo: 'bg-orange-500/10' },
};

/** As vilas da ficha, em ordem, olhando o campo `vila` e caindo em `categories` se ele faltar. */
export const vilasDe = (c: { vila?: string[]; categories?: string[] }): string[] => {
  const de = c.vila?.length ? c.vila : (c.categories ?? []);
  return de.filter(v => v in CORES_DE_VILA);
};

/** A cor de cada organização, definida pelo Pedro em 27/08/2026. Mesma regra dos literais. */
export const CORES_DE_ORG: Record<string, { texto: string; borda: string; fundo: string }> = {
  OCA:    { texto: 'text-white',      borda: 'border-white/45',      fundo: 'bg-white/10' },
  NoGuns: { texto: 'text-slate-400',  borda: 'border-slate-400/45',  fundo: 'bg-slate-400/10' },
  Kiba:   { texto: 'text-pink-400',   borda: 'border-pink-500/45',   fundo: 'bg-pink-500/10' },
};
export const CORES_NEUTRAS = { texto: 'text-slate-300', borda: 'border-slate-500/40', fundo: 'bg-slate-500/10' };

/**
 * A cor do selo acompanha a ORIGEM do que ele mostra, não o personagem: se o selo é a patente de
 * uma organização, a cor é da organização; se é um cargo de vila, a cor é da vila. Assim a cor
 * responde "de onde vem esse posto" em vez de repetir uma informação que a tag já dá.
 *
 * Quem tem duas organizações usa a que a própria patente nomeia — o Shikatsu, o Shikure e o Yuuto
 * têm NoGuns e OCA, e a patente dos três é NoGuns.
 */
export const corDoSelo = (c: { vila?: string[]; categories?: string[]; organizacao?: string[]; patente?: string }) => {
  if (c.patente) {
    const orgs = c.organizacao ?? [];
    const citada = orgs.find(o => c.patente!.toLowerCase().includes(o.toLowerCase())) ?? orgs[0];
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

/** Todos os postos da ficha, cargo e patente, já sem ordinal. É por aqui que o filtro casa. */
export const postosDe = (c: { cargo?: string[]; patente?: string; position?: string }): string[] => {
  const brutos = [...(c.cargo ?? []), c.patente, c.cargo?.length || c.patente ? undefined : c.position];
  return [...new Set(brutos.filter((x): x is string => !!x).map(postoDe))];
};
