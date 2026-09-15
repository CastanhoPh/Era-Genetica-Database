// O aviso do Hiroshi Hanzo, que só o Takeshi vê.
//
// Pedido do Pedro em 16/09/2026: quando o Takeshi entra no banco, a tela inteira se enche de
// "URGENTE" piscando em vermelho por 10 segundos, e só depois aparece a mensagem.
//
// Duas decisões de implementação que valem a leitura:
//
//  - As posições, rotações e tamanhos dos avisos vão em `style` inline, não em classe do Tailwind.
//    O Tailwind lê o código como TEXTO e só gera a classe que estiver escrita por extenso: uma
//    classe montada (`top-[${n}%]`) sairia do CSS final e os avisos apareceriam todos empilhados
//    no canto.
//  - A lista de posições é fixa e escrita à mão, não sorteada a cada render. Sorteio dentro do
//    render muda de lugar a cada repintura e os avisos ficariam tremendo pela tela.
//
// `prefers-reduced-motion` desliga o pisca e mostra o alarme estático: quem tem sensibilidade a
// luz piscando recebe os mesmos 10 segundos sem o estrobo.
import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/** 10 segundos de alarme antes da mensagem, como o Pedro pediu. */
const SEGUNDOS_DE_ALARME = 10;

/** posição em %, rotação em graus, tamanho em px, atraso do pisca em ms */
const AVISOS: [number, number, number, number, number][] = [
  [6, 4, -8, 34, 0], [4, 62, 6, 28, 180], [14, 30, -3, 44, 90],
  [22, 74, 10, 26, 260], [30, 8, 4, 38, 60], [36, 46, -6, 30, 340],
  [44, 80, -12, 32, 140], [52, 18, 7, 40, 220], [58, 58, -4, 26, 30],
  [66, 4, 9, 36, 300], [72, 38, -9, 28, 110], [78, 70, 5, 34, 190],
  [86, 22, -5, 30, 250], [90, 54, 8, 26, 70], [12, 88, -11, 24, 320],
  [48, 92, 3, 22, 160], [82, 90, -7, 24, 200], [26, 52, 12, 24, 280],
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

  // trava a rolagem do site atrás do aviso
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  // ================================================================ o alarme
  if (restam > 0) {
    return (
      <div className="fixed inset-0 z-[200] bg-black overflow-hidden select-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.28),transparent_70%)] animate-pulse pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent_2px,rgba(0,0,0,0.6)_3px)] bg-[size:100%_4px] pointer-events-none opacity-40" />

        {AVISOS.map(([top, left, giro, tamanho, atraso], k) => (
          <div
            key={k}
            className="absolute font-black uppercase text-red-600 motion-safe:animate-[piscar_0.6s_steps(1)_infinite] whitespace-nowrap drop-shadow-[0_0_18px_rgba(220,38,38,0.9)]"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              transform: `rotate(${giro}deg)`,
              fontSize: `${tamanho}px`,
              animationDelay: `${atraso}ms`,
            }}
          >
            URGENTE URGENTE URGENTE
          </div>
        ))}

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
          <AlertTriangle size={96} className="text-red-500 motion-safe:animate-[piscar_0.6s_steps(1)_infinite] drop-shadow-[0_0_30px_rgba(220,38,38,0.9)]" />
          <div className="text-red-500 text-[11px] uppercase tracking-[0.35em] bg-black/70 px-4 py-1.5 border border-red-700">
            transmissão recebida · {restam}s
          </div>
        </div>

        <div className="absolute inset-0 border-[6px] border-red-600 motion-safe:animate-[piscar_0.6s_steps(1)_infinite] pointer-events-none" />
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
