// O aviso do Hiroshi Hanzo, que só o Takeshi vê.
//
// Quando ele entra no banco, 24 janelas "URGENTE" começam a ABRIR E FECHAR por cima do site, cada
// uma no seu ritmo, durante 10 segundos. O banco continua à vista e navegável por baixo delas.
// Passados os 10 segundos, as janelas somem e a mensagem abre.
//
// Três decisões de implementação que valem a leitura:
//
//  - Posição, largura, giro e atraso vão em `style` inline, não em classe do Tailwind. O Tailwind
//    lê o código como TEXTO e só gera a classe escrita por extenso: uma classe montada
//    (`top-[${n}%]`) sairia do CSS final e as janelas apareceriam todas empilhadas num canto.
//  - A lista de posições é fixa e escrita à mão, não sorteada a cada render. Sorteio dentro do
//    render muda de lugar a cada repintura e as janelas ficariam tremendo pela tela.
//  - A escala do `abrirFechar` é só em Y. Recolher a altura lê como janela fechando; encolher nos
//    dois eixos leria como bolha estourando.
//
// `prefers-reduced-motion` desliga a animação inteira e deixa as 24 janelas paradas e abertas:
// quem tem sensibilidade recebe a mesma tela, sem nada abrindo e fechando.
import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/** 10 segundos de alarme antes da mensagem, como o Pedro pediu. */
const SEGUNDOS_DE_ALARME = 10;

/**
 * Uma janela por linha: topo e esquerda em %, largura em px, giro em graus, atraso e duração do
 * ciclo de abrir/fechar em ms.
 *
 * Duração e atraso variam de janela para janela de propósito: com valores iguais as 24 abririam e
 * fechariam juntas, como um pisca só. Diferentes, viram um enxame.
 *
 * A lista é fixa e escrita à mão, não sorteada: sorteio dentro do render muda de lugar a cada
 * repintura e as janelas ficariam tremendo pela tela.
 */
const AVISOS: [number, number, number, number, number, number][] = [
  [4, 3, 380, -5, 0, 1500], [2, 52, 320, 4, 250, 1900], [16, 26, 440, -2, 600, 1300],
  [10, 70, 300, 7, 900, 2100], [28, 6, 400, 3, 1150, 1700], [24, 46, 340, -8, 400, 1400],
  [22, 74, 360, 5, 1400, 2000], [38, 30, 480, -3, 750, 1600], [40, 66, 310, 9, 1800, 1250],
  [34, 2, 300, -6, 2100, 1850], [52, 44, 420, 2, 500, 1550], [50, 12, 330, 8, 1650, 2200],
  [56, 72, 350, -7, 1000, 1350], [66, 28, 460, 4, 1900, 1750], [64, 62, 300, -4, 300, 1450],
  [70, 4, 340, 6, 2300, 1650], [78, 40, 400, -9, 800, 1500], [76, 70, 320, 3, 1500, 1950],
  [86, 14, 360, -3, 1250, 1400], [84, 54, 380, 7, 2000, 1800], [12, 4, 300, 10, 1700, 1600],
  [44, 86, 300, -6, 550, 2050], [8, 86, 310, 5, 2200, 1500], [90, 76, 320, -8, 1100, 1700],
];

const MENSAGEM = `IMPORTANTE: NÃO LEIAM ESTA MENSAGEM EM VOZ ALTA.

Não leiam esta mensagem em voz alta nem comentem sobre ela enquanto estiverem juntos. Existe a possibilidade de alguém estar ouvindo vocês, então considerem que cada palavra pode estar sendo observada. Leiam tudo até o final antes de tomar qualquer decisão.

Vocês estão caminhando para um lugar onde encontrarão quatro pessoas dos seguintes clãs:
- Nara
- Uchiha
- Chinoike
- Hoshigaki
Não sei se estarão esperando ou se o encontro acontecerá de outra forma, mas estejam preparados para lutar.

Theta, o falso Kazekage, está acima de vocês e os está guiando até o local da batalha, assim como na última luta. Não façam nada, não olhem para cima e não demonstrem que perceberam. Enquanto ele acreditar que vocês seguem exatamente o plano dele, ainda terão uma pequena vantagem. Não desviem o caminho; encarem isso como uma oportunidade.

A Uchiha precisa ficar ao lado de vocês, pois ela é extremamente importante. O Nara e o Chinoike não são pessoas ruins, apenas estão sendo manipulados. Tentem salvar o que restou do Hoshigaki.

Também descubram quem se afastou do grupo, não estou falando do procurado, mas de outra pessoa, Hades chamou a pessoa de lobo que fugiu da matilha e estão indo atrás da pessoa para utilizar como experimento, caso essa pessoa seja usuária de Dojutsu a situação fica mais embaixo.

Sobre a Uchiha
Ela fez um acordo com Hades: ela pretende entregar o próprio olho em troca do outro olho de Madara, alcançando o Mangekyō Sharingan Eterno. Por isso prestem muita atenção
ODDY E AYUMI PRECISAM SER PROTEGIDOS A QUALQUER CUSTO.

Furyuzan também é um dos principais alvos da OCA. Ele não pode chegar a 99% de forma alguma e, acima de tudo, não pode ser capturado. Se isso acontecer, não sei quais serão as consequências. Lembrem-se também de Hisoka, o verdadeiro está vivo, em coma, no último andar da Fortaleza Yumei. Qualquer Hisoka que encontrem fora de lá é falso e ainda está solto.

Sobre Reika, vocês já sabem: o Oito-Caudas foi removido dela. Não tenho mais informações. Quando a luta começar, não esperem ajuda; ninguém virá salvá-los. Lutem com tudo o que tiverem e sigam em frente, mesmo sabendo que o inimigo os conduz exatamente para onde quer.

Não se esqueçam de Matatabi, Estão com ele e o elo que ele havia com Nishinoya fez ele ainda manter 100% de seu chakra e poder mesmo selado em um humano, isso explica uma parte da força de Nishinoya, de alguma forma Matatabi resiste a sua fusão com chakra profano, caso ele seja controlado, será o inicio do nosso fim

Quanto a Kaito Senju, encontrei o panfleto enquanto passava por kirigakure, é uma pena, mas se a informação for verdadeira o objetivo deve ser a morte de Kaito Senju a fim de matar também Hades. Não consegui descobrir nada. Não sei onde ele está, o que está fazendo ou de que lado aparecerá. Não contem com ele. Por enquanto, vocês só podem contar uns com os outros. Finjam que não sabem de nada, continuem andando e não deixem Theta perceber que descobriram.

Fiz o que pude para conseguir essas informações, então confiem em mim. E guardem uma última coisa: protejam uns aos outros, não abandonem ninguém e façam o necessário para que todos voltem vivos.

Continuem na linha de frente enquanto atuo nas sombras, vou mantendo vocês atualizados.`;

const AvisoUrgente: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [restam, setRestam] = useState(SEGUNDOS_DE_ALARME);

  useEffect(() => {
    if (restam <= 0) return;
    const t = setTimeout(() => setRestam(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [restam]);

  // A rolagem só trava quando a MENSAGEM abre. Durante o alarme as janelinhas são visuais e o
  // banco continua navegável por baixo delas.
  useEffect(() => {
    if (restam > 0) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, [restam]);

  // ================================================================ o alarme
  if (restam > 0) {
    return (
      <div className="fixed inset-0 z-[200] overflow-hidden pointer-events-none select-none">
        {AVISOS.map(([top, left, largura, giro, atraso, duracao], k) => {
          // uma em cada três é vermelha sólida — o contraste entre os dois tipos é o que dá o ar
          // de invasão, em vez de 24 janelas iguais
          const solida = k % 3 === 0;
          return (
            // O giro fica no invólucro e a animação no filho: `animation` sobrescreve `transform`
            // enquanto roda, então rotate e scaleY no mesmo elemento fariam o giro sumir.
            <div
              key={k}
              className="absolute"
              style={{ top: `${top}%`, left: `${left}%`, width: `${largura}px`, transform: `rotate(${giro}deg)` }}
            >
            <div
              className={`origin-top border-4 shadow-[0_0_45px_-6px_rgba(220,38,38,0.95)] clip-corner-sm motion-safe:animate-[abrirFechar_linear_infinite] ${solida ? 'bg-red-600 border-red-300' : 'bg-black border-red-600'}`}
              style={{ animationDelay: `${atraso}ms`, animationDuration: `${duracao}ms` }}
            >
              <div className={`flex items-center gap-2 px-2.5 py-1.5 ${solida ? 'bg-black' : 'bg-red-600'}`}>
                <AlertTriangle size={14} className={`shrink-0 ${solida ? 'text-red-500' : 'text-black'}`} />
                <span className={`text-[11px] font-black uppercase tracking-[0.22em] ${solida ? 'text-red-500' : 'text-black'}`}>Alerta</span>
                <span className={`ml-auto text-[15px] font-black leading-none ${solida ? 'text-red-500' : 'text-black'}`}>×</span>
              </div>
              <div className="px-4 py-5 text-center">
                <span className={`text-[52px] leading-none font-black uppercase tracking-wider ${solida ? 'text-black' : 'text-red-500'}`}>URGENTE</span>
              </div>
            </div>
            </div>
          );
        })}

        {/* o contador fica no canto: no centro ele competiria com as janelas */}
        <div className="absolute bottom-5 right-5 bg-black border border-red-700 px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] text-red-500">
          transmissão recebida · {restam}s
        </div>
      </div>
    );
  }

  // ================================================================ a mensagem
  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-3 md:p-6">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-tech-bg border-2 border-red-700/70 shadow-[0_0_60px_-10px_rgba(220,38,38,0.5)] clip-corner flex flex-col">
        <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-red-600 z-30 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-red-600 z-30 pointer-events-none" />

        <div className="shrink-0 border-b border-red-800/60 bg-red-950/30 pl-6 pr-3 py-2 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-red-500">
            <AlertTriangle size={11} className="animate-pulse" />
            Mensagem urgente · canal fechado
          </span>
          <button
            onClick={onClose}
            title="Fechar"
            className="shrink-0 border border-red-600/60 bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-black p-1.5 transition-colors clip-corner-sm"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-custom p-5 md:p-7">
          <p className="text-[14px] text-slate-300 leading-[1.8] whitespace-pre-line">{MENSAGEM}</p>
          <p className="mt-8 text-right text-[15px] text-red-400 uppercase tracking-[0.14em]">— Hiroshi Hanzo</p>
        </div>
      </div>
    </div>
  );
};

export default AvisoUrgente;
