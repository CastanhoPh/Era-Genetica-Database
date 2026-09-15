// O aviso do Hiroshi Hanzo, que só o Takeshi vê.
//
// Quando ele entra no banco, o site é INVADIDO por 10 segundos: 26 janelas de terminal nascem
// quebradas por toda a tela, uma varredura vermelha desce sem parar e uma moldura anuncia a
// intrusão. O banco continua à vista e navegável por baixo. Passados os 10 segundos, tudo some e a
// mensagem abre.
//
// Vermelho é a cor do invasor. O sistema é verde — o contraste é o que conta a história.
//
// Três decisões de implementação que valem a leitura:
//
//  - Posição e largura vão em `style` inline, não em classe do Tailwind. O Tailwind lê o código
//    como TEXTO e só gera a classe escrita por extenso: uma classe montada (`top-[${n}%]`) sairia
//    do CSS final e as janelas apareceriam todas empilhadas num canto.
//  - Cada janela é um componente com o próprio temporizador, e o sorteio da posição mora DENTRO
//    dele — nunca no render. Sortear no render mudaria o lugar a cada repintura e a janela ficaria
//    tremendo em vez de trocar de lugar ao reabrir.
//  - O `ciclo` entra no `key` da janela para a animação de entrada rodar de novo a cada abertura:
//    animação de entrada só dispara quando o elemento entra no DOM.
//
// `prefers-reduced-motion` desliga o ciclo e a varredura: as janelas abrem uma vez e ficam paradas.
import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/** 10 segundos de alarme antes da mensagem, como o Pedro pediu. */
const SEGUNDOS_DE_ALARME = 10;

/** Quantas janelas ao mesmo tempo. */
const QUANTAS = 32;

const entre = (min: number, max: number) => min + Math.random() * (max - min);

/** lixo hexadecimal para a linha de baixo da janela */
const hex = (n: number) => Array.from({ length: n }, () =>
  Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0')).join(' ');

/**
 * Um lugar novo na tela, e o disfarce da janela. Sem rotação: o Pedro pediu retas, e reto também
 * é o que combina com janela de sistema.
 */
const sorteiaLugar = () => ({
  top: entre(1, 86),
  left: entre(1, 74),
  largura: entre(300, 470),
  porta: Math.floor(entre(1000, 65000)),
  lixo: hex(8),
  grito: GRITOS[Math.floor(Math.random() * GRITOS.length)],
  progresso: Math.floor(entre(8, 97)),
});

/** As frases da sub-linha das janelas. Curtas de propósito: é grito, não explicação. */
const GRITOS = [
  'AUTENTICAÇÃO IGNORADA', 'ROOT OBTIDO', 'CHAVE QUEBRADA', 'FIREWALL MORTO',
  'SESSÃO SEQUESTRADA', 'BACKUP APAGADO', 'LOG LIMPO', 'PERMISSÃO ELEVADA',
];

/**
 * As linhas do log de ataque.
 *
 * Citam as coleções e os números REAIS do banco — characters, imageChecklist, 118 fichas, 101
 * invocações. Comando genérico de filme não assusta; o próprio banco sendo lido em voz alta, sim.
 */
const COMANDOS = [
  () => `$ ssh -i ~/.ssh/id_rsa root@era-genetica.db`,
  () => `> handshake TLS … IGNORADO`,
  () => `> bypass firebase.rules … OK`,
  () => `> auth.currentUser := root [FORJADO]`,
  () => `$ firestore dump --collection=characters`,
  () => `  118 documentos · ${Math.floor(entre(180, 420))} KB … EXTRAÍDO`,
  () => `$ firestore dump --collection=arsenal`,
  () => `  87 documentos … EXTRAÍDO`,
  () => `$ firestore dump --collection=imageChecklist`,
  () => `  1399 documentos … EXTRAÍDO`,
  () => `$ gsutil -m cp -r gs://era-genetica/Galeria .`,
  () => `  ${Math.floor(entre(200, 1190))}/1198 objetos … ${Math.floor(entre(10, 99))} MB/s`,
  () => `> 101 invocações indexadas`,
  () => `> hash ${hex(4).replace(/ /g, '')} … COLIDIDO`,
  () => `> chave de serviço … CAPTURADA`,
  () => `! integridade comprometida em ${Math.floor(entre(2, 40))} coleções`,
  () => `! tentativa de rollback … NEGADA`,
  () => `> apagando rastro em audit.log`,
  () => `> canal reverso aberto :${Math.floor(entre(1000, 65000))}`,
  () => `${hex(6)}`,
  () => `> aguarde. não desligue o terminal.`,
];

const GLIFOS = 'ABCDEF0123456789$#%&@/\\|<>[]{}!?*+=~^';
const glifo = () => GLIFOS[Math.floor(Math.random() * GLIFOS.length)];

/**
 * A chuva de código, atrás de tudo.
 *
 * 26 colunas de caracteres despencando. É o sinal visual mais reconhecível de invasão que existe,
 * e resolve um problema concreto: antes, o espaço entre as janelas era o site parado, e site
 * parado não parece invadido.
 *
 * As colunas são montadas UMA vez (`useState` com função) porque sortear a cada render trocaria
 * todos os caracteres a cada quadro e viraria ruído ilegível em vez de código caindo.
 */
const ChuvaDeCodigo: React.FC = () => {
  const [colunas] = useState(() => Array.from({ length: 26 }, () => ({
    left: Math.random() * 100,
    duracao: entre(1.6, 4.2),
    atraso: entre(0, 2.5),
    letras: Array.from({ length: 22 }, glifo).join(''),
  })));
  return (
    <div className="absolute inset-0 overflow-hidden">
      {colunas.map((c, k) => (
        <div
          key={k}
          className="absolute top-0 text-[15px] leading-[1.15] text-red-600/45 font-bold motion-safe:animate-[cair_linear_infinite] whitespace-pre"
          style={{ left: `${c.left}%`, animationDuration: `${c.duracao}s`, animationDelay: `${c.atraso}s` }}
        >
          {c.letras.split('').join('\n')}
        </div>
      ))}
    </div>
  );
};

/**
 * Os rasgos: faixas horizontais que pulam de altura o tempo todo e invertem o que está por baixo.
 *
 * Lê como sinal de vídeo quebrando. `mix-blend-difference` inverte em vez de cobrir, então o rasgo
 * mostra o site por baixo corrompido, e não uma tarja opaca.
 */
const Rasgos: React.FC = () => {
  const [faixas, setFaixas] = useState(() => Array.from({ length: 6 }, () => ({ top: Math.random() * 100, alt: entre(2, 16) })));
  useEffect(() => {
    const t = setInterval(() => setFaixas(f => f.map(() => ({ top: Math.random() * 100, alt: entre(2, 16) }))), 90);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden mix-blend-difference">
      {faixas.map((f, k) => (
        <div key={k} className="absolute inset-x-0 bg-red-500" style={{ top: `${f.top}%`, height: `${f.alt}px` }} />
      ))}
    </div>
  );
};

/** O grito do meio da tela: o único texto do alarme grande o bastante para ser lido de longe. */
const FRASES = ['SISTEMA COMPROMETIDO', 'ACESSO NEGADO', 'DADOS ROUBADOS', 'VOCÊ FOI OBSERVADO'];
const Grito: React.FC = () => {
  const [k, setK] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setK(x => x + 1), 700);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-red-600 border-y-4 border-black py-3 motion-safe:animate-[flicker_0.1s_steps(2)_infinite]">
      <div className="text-center text-black font-black uppercase tracking-tighter text-[clamp(28px,7vw,86px)] leading-none truncate px-3">
        {FRASES[k % FRASES.length]}
      </div>
    </div>
  );
};

/**
 * O log de ataque de uma das bordas.
 *
 * Guarda no máximo 14 linhas: sem o corte a lista cresceria durante os 10 segundos inteiros e a
 * página ficaria mais pesada a cada quadro.
 */
const LogDeAtaque: React.FC = () => {
  const [linhas, setLinhas] = useState<string[]>([]);
  useEffect(() => {
    const t = setInterval(() => {
      setLinhas(l => [...l.slice(-15), COMANDOS[Math.floor(Math.random() * COMANDOS.length)]()]);
    }, 80);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="absolute left-0 top-10 bottom-12 w-[52%] max-w-[640px] overflow-hidden flex flex-col justify-end gap-1 px-4">
      {linhas.map((l, k) => (
        <div
          key={`${k}-${l}`}
          className="text-[19px] leading-tight font-bold text-red-500 truncate drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]"
          style={{ opacity: 0.3 + (k / linhas.length) * 0.7 }}
        >
          {l}
        </div>
      ))}
    </div>
  );
};

/**
 * Uma janela da invasão, com o próprio relógio.
 *
 * Abre, espera, fecha, espera, sorteia outro lugar e reabre. Nenhuma sabe da outra: é isso que
 * impede que elas voltem a abrir juntas, que era o que acontecia quando o ciclo era uma animação
 * CSS de duração fixa — durações próximas entram em fase depois de alguns ciclos.
 *
 * O `ciclo` no `key` existe para a animação de entrada RODAR DE NOVO a cada abertura: animação de
 * entrada só dispara quando o elemento entra no DOM, e sem trocar a chave o nó seria reaproveitado
 * e a janela apareceria sem o glitch da segunda vez em diante.
 */
const Janela: React.FC<{ indice: number }> = ({ indice }) => {
  const [lugar, setLugar] = useState(sorteiaLugar);
  const [aberta, setAberta] = useState(false);
  const [ciclo, setCiclo] = useState(0);
  const paradinho = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (paradinho) { setAberta(true); return; }
    let relogio: ReturnType<typeof setTimeout>;
    const passo = (abrindo: boolean) => {
      if (abrindo) { setLugar(sorteiaLugar()); setCiclo(c => c + 1); }
      setAberta(abrindo);
      relogio = setTimeout(() => passo(!abrindo), abrindo ? entre(420, 1100) : entre(90, 420));
    };
    relogio = setTimeout(() => passo(true), entre(0, 1200) + indice * 35);
    return () => clearTimeout(relogio);
  }, [indice, paradinho]);

  if (!aberta) return null;

  // uma em cada quatro é vermelha sólida: o contraste entre os dois tipos é o que dá o ar de
  // invasão, em vez de 26 janelas iguais
  const solida = indice % 4 === 0;

  return (
    <div
      key={ciclo}
      className="absolute motion-safe:animate-[glitchar_0.22s_steps(2,end)_1]"
      style={{ top: `${lugar.top}%`, left: `${lugar.left}%`, width: `${lugar.largura}px` }}
    >
      <div className={`border-2 shadow-[0_0_50px_-8px_rgba(220,38,38,0.95)] ${solida ? 'bg-red-600 border-red-200' : 'bg-black border-red-500'}`}>
        <div className={`flex items-center gap-2 px-2 py-1 border-b-2 ${solida ? 'bg-black border-red-200' : 'bg-red-600 border-red-500'}`}>
          <span className={`text-[10px] font-bold tracking-tight truncate ${solida ? 'text-red-500' : 'text-black'}`}>
            root@era-genetica:~/{lugar.porta}$
          </span>
          <span className={`ml-auto text-[11px] font-black tracking-tighter shrink-0 ${solida ? 'text-red-500' : 'text-black'}`}>
            _ ▢ ✕
          </span>
        </div>
        <div className="px-3 pt-3 pb-2.5">
          <div className={`text-[46px] leading-none font-black tracking-tight ${solida ? 'text-black' : 'text-red-500'}`}>
            &gt; URGENTE<span className="motion-safe:animate-pulse">█</span>
          </div>
          <div className={`mt-1.5 text-[11px] font-black uppercase tracking-[0.14em] truncate ${solida ? 'text-black' : 'text-red-400'}`}>
            ! {lugar.grito}
          </div>
          {/* a barra de exfiltração: o dado saindo é mais ameaçador que um aviso parado */}
          <div className={`mt-2 h-1.5 ${solida ? 'bg-black/30' : 'bg-red-900/50'}`}>
            <div className={solida ? 'h-full bg-black' : 'h-full bg-red-500'} style={{ width: `${lugar.progresso}%` }} />
          </div>
          <div className={`mt-1.5 text-[10px] tracking-widest truncate ${solida ? 'text-black/70' : 'text-red-500/50'}`}>
            {lugar.lixo}
          </div>
        </div>
      </div>
    </div>
  );
};

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
        {/* ruído de tubo: linhas horizontais por cima do site inteiro */}
        <div className="absolute inset-0 bg-[linear-gradient(transparent_2px,rgba(220,38,38,0.10)_3px)] bg-[size:100%_4px]" />
        {/* a varredura desce sem parar, como scanner de quem está vasculhando a máquina */}
        <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-red-600/25 to-transparent motion-safe:animate-[varredura_1.6s_linear_infinite]" />

        <ChuvaDeCodigo />

        {/* o log fica so na esquerda, a pedido do Pedro: dos dois lados ele disputava com as
            janelas e nao dava para ler nenhum dos dois */}
        <LogDeAtaque />

        {Array.from({ length: QUANTAS }, (_, k) => <Janela key={k} indice={k} />)}

        <Grito />
        <Rasgos />

        {/* o estouro: a tela inteira pisca em vermelho fora de ritmo */}
        <div className="absolute inset-0 bg-red-600/15 motion-safe:animate-[flicker_0.12s_steps(2)_infinite]" />

        {/* cabeçalho e rodapé fixos: a moldura que diz que o sistema não é mais de quem está lendo */}
        <div className="absolute top-0 inset-x-0 bg-red-600 text-black text-[11px] font-black uppercase tracking-[0.3em] px-4 py-1.5 flex justify-between gap-4">
          <span className="truncate">◤ acesso forçado · sessão interceptada</span>
          {/* 1198 é o número real de objetos no Storage: o contador sobe até ele */}
          <span className="shrink-0">{Math.min(1198, Math.round((SEGUNDOS_DE_ALARME - restam) / SEGUNDOS_DE_ALARME * 1198))}/1198 arquivos</span>
        </div>
        <div className="absolute bottom-0 inset-x-0">
          {/* a barra conta os 10 segundos como se fosse a cópia do banco terminando */}
          <div className="h-1.5 bg-black">
            <div className="h-full bg-red-500 transition-[width] duration-1000 ease-linear"
              style={{ width: `${((SEGUNDOS_DE_ALARME - restam) / SEGUNDOS_DE_ALARME) * 100}%` }} />
          </div>
          <div className="bg-red-600 text-black text-[11px] font-black uppercase tracking-[0.3em] px-4 py-1.5 flex justify-between gap-4">
            <span className="truncate">exfiltrando banco · não desligue o terminal</span>
            <span className="shrink-0">{restam}s</span>
          </div>
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
