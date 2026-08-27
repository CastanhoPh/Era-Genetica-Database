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
 * `barra` é o filete no topo do card, `texto`/`borda`/`fundo` compõem o chip da ficha.
 */
export const CORES_DE_VILA: Record<string, { barra: string; texto: string; borda: string; fundo: string }> = {
  Konohagakure: { barra: 'bg-red-500',    texto: 'text-red-400',    borda: 'border-red-500/40',    fundo: 'bg-red-500/10' },
  Sunagakure:   { barra: 'bg-green-500',  texto: 'text-green-400',  borda: 'border-green-500/40',  fundo: 'bg-green-500/10' },
  Kirigakure:   { barra: 'bg-blue-500',   texto: 'text-blue-400',   borda: 'border-blue-500/40',   fundo: 'bg-blue-500/10' },
  Kumogakure:   { barra: 'bg-yellow-400', texto: 'text-yellow-300', borda: 'border-yellow-400/40', fundo: 'bg-yellow-400/10' },
  Iwagakure:    { barra: 'bg-orange-500', texto: 'text-orange-400', borda: 'border-orange-500/40', fundo: 'bg-orange-500/10' },
};

/** As vilas da ficha, em ordem, olhando o campo `vila` e caindo em `categories` se ele faltar. */
export const vilasDe = (c: { vila?: string[]; categories?: string[] }): string[] => {
  const de = c.vila?.length ? c.vila : (c.categories ?? []);
  return de.filter(v => v in CORES_DE_VILA);
};
