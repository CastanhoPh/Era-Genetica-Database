// O botão que copia o link da tela atual, com os filtros ativos.
//
// Existe porque os filtros das três listas passaram a viver na query string: a URL na barra de
// endereço já é o link certo, e o botão só evita a viagem até lá. Copia `window.location.href`
// inteiro — caminho, filtros e o item aberto, se houver.
//
// Nasceu inline na aba Invocações e virou componente quando Personagens e Arsenal ganharam o
// mesmo recurso: eram três cópias de doze linhas com o mesmo comportamento de "vira um check por
// dois segundos".
import React, { useEffect, useRef, useState } from 'react';
import { Link2, Check } from 'lucide-react';

const BotaoDeLink: React.FC<{ oQue?: string }> = ({ oQue = 'desta tela' }) => {
  const [copiado, setCopiado] = useState(false);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpa o timer ao desmontar: trocar de aba nos dois segundos seguintes chamaria setState num
  // componente que já saiu.
  useEffect(() => () => { if (relogio.current) clearTimeout(relogio.current); }, []);

  const copia = () => {
    // `clipboard` não existe em contexto sem HTTPS nem em navegador antigo, e a escrita pode ser
    // recusada por permissão — sem o catch, o clique viraria um erro no console e nada na tela.
    navigator.clipboard?.writeText(window.location.href).then(
      () => {
        setCopiado(true);
        if (relogio.current) clearTimeout(relogio.current);
        relogio.current = setTimeout(() => setCopiado(false), 2000);
      },
      () => { /* sem área de transferência: a URL da barra de endereço continua servindo */ },
    );
  };

  return (
    <button
      type="button"
      onClick={copia}
      title={`Copiar o link ${oQue}, com os filtros ativos`}
      aria-label={`Copiar o link ${oQue}`}
      className={`h-10 w-10 shrink-0 border flex items-center justify-center transition-all clip-corner-sm ${copiado
        ? 'border-tech-primary text-black bg-tech-primary'
        : 'border-tech-border text-tech-dim hover:text-tech-primary hover:border-tech-primary'}`}
    >
      {copiado ? <Check size={15} /> : <Link2 size={15} />}
    </button>
  );
};

export default BotaoDeLink;
