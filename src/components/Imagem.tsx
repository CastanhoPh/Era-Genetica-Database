import React, { useState } from 'react';
import { formatImageUrl } from '../utils/formatters';
import { imagemWeb, TamanhoWeb } from '../utils/imagemWeb';

type ImagemProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  /** A URL original, como está gravada no banco. */
  src: string;
  /** `mini` para card e miniatura; `cheia` para a imagem aberta. */
  tamanho: TamanhoWeb;
};

/**
 * Um `<img>` que pede primeiro a versão leve (ver utils/imagemWeb.ts) e cai no original se ela não
 * existir — arte recém-enviada pelo Painel só ganha versão leve no próximo `npm run imagens`.
 *
 * O `onError` de quem usa só dispara quando o ORIGINAL falha. Sem isso, todo card com
 * `onError={() => setImgError(true)}` trocaria a imagem pelo quadro de "sem imagem" no primeiro
 * 404 da versão leve, antes de o original ter chance.
 *
 * O estado guarda QUAL versão leve falhou, e não um booleano: quando a ficha troca de arte o `src`
 * muda, a URL leve muda junto e a tentativa recomeça sozinha.
 */
const Imagem: React.FC<ImagemProps> = ({ src, tamanho, onError, ...resto }) => {
  const original = formatImageUrl(src);
  const leve = imagemWeb(original, tamanho);
  const [falhou, setFalhou] = useState<string | null>(null);
  const usaLeve = leve !== original && falhou !== leve;

  return (
    <img
      {...resto}
      src={usaLeve ? leve : original}
      onError={e => { if (usaLeve) setFalhou(leve); else onError?.(e); }}
    />
  );
};

export default Imagem;
