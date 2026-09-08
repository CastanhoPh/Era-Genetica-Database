// O botão de paleta, a preferência que ele guarda e o filtro que a arte recebe por causa dele.
//
// Os três moravam dentro do App.tsx, servindo só ao grid de personagens. Agora as listas de
// Arsenal e de Invocações têm o mesmo botão, e uma preferência SÓ: quem liga a cor no arsenal
// acha o grid de personagens colorido também. É a mesma chave de localStorage nos três, e é de
// propósito — o botão diz "quero ver a arte como ela é", e isso não muda de opinião ao trocar de
// aba.
//
// A preferência é por navegador de quem olha, nunca sai daqui e nunca chega ao Firestore.
import React, { useState, useEffect } from 'react';
import { Palette } from 'lucide-react';

/** Onde a preferência de capa colorida fica no navegador de quem olha. */
export const CHAVE_CORES = 'era-genetica:capas-coloridas';

/**
 * O filtro da arte no card, pelo modo escolhido.
 *
 * A arte do site nasce colorida, mas as listas sempre a mostraram em `grayscale`, com a cor
 * voltando só no hover — é o que dá o ar de terminal aos grids. O botão de paleta desliga esse
 * dessaturado para quem quiser ver a arte como ela é.
 *
 * Morto continua legível como morto mesmo colorido: o card tem a faixa "MORTO" e o NC em
 * vermelho, e aqui o brilho segue reduzido. O `grayscale` era estética, não o sinal de morte.
 *
 * Arma e invocação não morrem, então as duas listas chamam com `morto` falso — o que sobra é
 * exatamente o par de classes que os cards já tinham escrito à mão.
 */
export const filtroDaCapa = (morto: boolean, colorido: boolean): string => {
  if (!colorido) {
    return morto
      ? 'grayscale brightness-50 contrast-125'
      : 'grayscale brightness-90 group-hover:grayscale-0 group-hover:brightness-110';
  }
  return morto
    ? 'brightness-75 contrast-125'
    : 'brightness-100 group-hover:brightness-110';
};

/**
 * Lê e grava a preferência. O try/catch existe porque `localStorage` não é só "pode vir vazio":
 * em janela privada e com dados de site bloqueados o próprio acesso lança, e aí a página tem que
 * continuar montando — sem lembrar da escolha, que é o pior aceitável.
 */
export function useCapasColoridas(): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [colorido, setColorido] = useState(() => {
    try { return localStorage.getItem(CHAVE_CORES) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(CHAVE_CORES, colorido ? '1' : '0'); } catch { /* sem persistir, só não lembra */ }
  }, [colorido]);
  return [colorido, setColorido];
}

/** O botão. Entra ao lado da busca nas três listas, com a mesma altura dos campos dela. */
const BotaoDeCores: React.FC<{ colorido: boolean; onToggle: () => void; oQue?: string }> = ({
  colorido, onToggle, oQue = 'as capas',
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={colorido}
    title={colorido ? `Voltar ${oQue} ao preto e branco` : `Mostrar ${oQue} em cores`}
    className={`h-10 w-10 shrink-0 border flex items-center justify-center transition-all clip-corner-sm ${colorido
      ? 'border-tech-primary text-tech-primary bg-tech-primary/10 shadow-[0_0_10px_rgba(0,255,65,0.25)]'
      : 'border-tech-border text-tech-dim hover:text-tech-primary hover:border-tech-primary'}`}
  >
    <Palette size={15} />
  </button>
);

export default BotaoDeCores;
