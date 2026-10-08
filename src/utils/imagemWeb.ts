/**
 * A versão leve de uma imagem do Storage.
 *
 * O site entregava o arquivo original do Canva em todo lugar — PNG de 1 a 4 MB — inclusive num card
 * de 200 px. Abrir a lista de personagens baixava cerca de 130 MB. Medido em 08/10/2026: a mesma
 * capa em WebP cai de 988 KB para 66 KB no tamanho cheio e para 17 KB como miniatura.
 *
 * As versões leves são geradas por `scripts/gerar-imagens-web.mjs` e moram em `_web/` no mesmo
 * bucket, uma árvore espelhada da original:
 *
 *   original   Characters/Kaito Senju/Kaito Senju.png            ?alt=media&v=1788276400793721
 *   mini       _web/mini/Characters/Kaito Senju/Kaito Senju.png~1788276400793721.webp
 *   cheia      _web/cheia/Characters/Kaito Senju/Kaito Senju.png~1788276400793721.webp
 *
 * O `v` DA URL VAI NO NOME DO ARQUIVO, e não na query, de propósito. A versão leve é servida com
 * cache de um ano. Se o `v` fosse query, trocar a arte de uma ficha faria o navegador pedir
 * `...webp?v=novo`, receber a versão leve ANTIGA (a nova ainda não foi gerada) e guardá-la por um
 * ano com o endereço novo. Com o `v` no nome, versão que ainda não existe é 404 — e 404 cai no
 * original, que é o que o componente Imagem faz.
 *
 * O formato do nome é repetido em scripts/gerar-imagens-web.mjs. Mudou aqui, muda lá.
 *
 * Devolve a própria URL quando não há o que fazer: imagem de fora do Storage, URL sem `v`, ou
 * caminho ilegível.
 */
export type TamanhoWeb = 'mini' | 'cheia';

const BASE = 'https://firebasestorage.googleapis.com/v0/b/era-genetica-db.firebasestorage.app/o/';

export function imagemWeb(url: string, tamanho: TamanhoWeb): string {
  if (!url || !url.startsWith(BASE)) return url;
  const [codificado, query = ''] = url.slice(BASE.length).split('?');
  const v = new URLSearchParams(query).get('v');
  if (!v || !/^[\w-]+$/.test(v)) return url;
  let caminho: string;
  try { caminho = decodeURIComponent(codificado); } catch { return url; }
  if (caminho.startsWith('_web/')) return url;
  return `${BASE}${encodeURIComponent(`_web/${tamanho}/${caminho}~${v}.webp`)}?alt=media`;
}
