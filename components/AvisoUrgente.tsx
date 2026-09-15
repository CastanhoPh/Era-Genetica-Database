// O aviso do Hiroshi Hanzo, que só o Takeshi vê.
//
// Quando ele entra no banco, 24 janelinhas "URGENTE" saltam POR CIMA do site, uma de cada vez ao
// longo de 10 segundos, piscando em vermelho. O banco continua à vista e navegável por baixo
// delas. Passados os 10 segundos, as janelas somem e a mensagem abre.
//
// Três decisões de implementação que valem a leitura:
//
//  - Posição, largura, giro e atraso vão em `style` inline, não em classe do Tailwind. O Tailwind
//    lê o código como TEXTO e só gera a classe escrita por extenso: uma classe montada
//    (`top-[${n}%]`) sairia do CSS final e as janelas apareceriam todas empilhadas num canto.
//  - A lista de posições é fixa e escrita à mão, não sorteada a cada render. Sorteio dentro do
//    render muda de lugar a cada repintura e as janelas ficariam tremendo pela tela.
//  - O mesmo atraso serve para a entrada e para o pisca — daí `animationDelay` com dois valores —,
//    então cada janela salta na sua vez e depois pisca fora de sincronia das vizinhas.
//
// `prefers-reduced-motion` mantém a entrada e desliga o pisca: quem tem sensibilidade a luz
// piscando recebe as mesmas janelas, paradas.
import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/** 10 segundos de alarme antes da mensagem, como o Pedro pediu. */
const SEGUNDOS_DE_ALARME = 10;

/**
 * Uma janelinha por linha: topo e esquerda em %, largura em px, giro em graus, e o atraso em ms —
 * que serve tanto para a entrada quanto para o pisca, então elas surgem uma de cada vez e piscam
 * fora de sincronia. Os atrasos se espalham pelos 10 segundos do alarme.
 *
 * A lista é fixa e escrita à mão, não sorteada: sorteio dentro do render muda de lugar a cada
 * repintura e as janelas ficariam tremendo pela tela.
 */
const AVISOS: [number, number, number, number, number][] = [
  [8, 6, 190, -6, 0], [4, 58, 150, 5, 400], [18, 34, 220, -2, 800],
  [26, 76, 160, 8, 1200], [34, 10, 200, 3, 1600], [12, 84, 140, -9, 2000],
  [44, 48, 240, -5, 2400], [52, 82, 150, 7, 2800], [58, 22, 180, -3, 3200],
  [30, 60, 160, 10, 3600], [66, 66, 200, -8, 4000], [72, 6, 170, 4, 4400],
  [40, 88, 140, -4, 4800], [78, 42, 210, 6, 5200], [84, 74, 150, -7, 5600],
  [62, 40, 160, 2, 6000], [88, 14, 180, 9, 6400], [20, 16, 150, -11, 6800],
  [50, 4, 140, 6, 7200], [70, 88, 160, -6, 7600], [92, 46, 170, 3, 8000],
  [6, 30, 150, 8, 8400], [36, 30, 150, -10, 8800], [80, 22, 160, 5, 9200],
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
        {AVISOS.map(([top, left, largura, giro, atraso], k) => (
          <div
            key={k}
            className="absolute bg-black border-2 border-red-600 shadow-[0_0_25px_-4px_rgba(220,38,38,0.9)] clip-corner-sm motion-safe:animate-[surgir_0.22s_ease-out_backwards,piscar_0.7s_steps(1)_infinite] motion-reduce:animate-[surgir_0.22s_ease-out_backwards]"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              width: `${largura}px`,
              transform: `rotate(${giro}deg)`,
              animationDelay: `${atraso}ms, ${atraso}ms`,
            }}
          >
            <div className="flex items-center gap-1.5 bg-red-600 px-2 py-1">
              <AlertTriangle size={11} className="text-black shrink-0" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-black">Alerta</span>
              <span className="ml-auto text-[10px] font-black text-black leading-none">×</span>
            </div>
            <div className="px-3 py-3 text-center">
              <span className="text-[26px] font-black uppercase tracking-wider text-red-500">URGENTE</span>
            </div>
          </div>
        ))}

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
