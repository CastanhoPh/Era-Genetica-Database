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
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { formatImageUrl } from '../utils/formatters';

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

/** Quanto tempo a tela de sincronização fica no ar, e quantas linhas ela tem. */
const SEGUNDOS_ENVIANDO = 30;

/**
 * O que o Hanzo está escrevendo no banco, palavra por palavra como o Pedro ditou.
 *
 * `vila` é cabeçalho de bloco, `item` é o detalhe por baixo dele, `passo` é operação de sistema.
 * A separação existe para a tela ter hierarquia: 16 linhas iguais viram parede de texto.
 */
type LinhaEnvio = { t: 'titulo' | 'autor' | 'vila' | 'item' | 'passo'; texto: string };
const ENVIO: LinhaEnvio[] = [
  { t: 'titulo', texto: 'Atualizando banco de dados.' },
  { t: 'autor', texto: 'Por: O Fantasma' },
  { t: 'vila', texto: 'Adicionando informações da Névoa.' },
  { t: 'item', texto: 'Adicionando Almirante da Frota, Almirantes, Vice-Almirantes, Capitães e Capitães-Tenentes.' },
  { t: 'vila', texto: 'Adicionando informações da Areia' },
  { t: 'item', texto: 'Adicionando Pilares, Shiita e Chiguiri' },
  { t: 'vila', texto: 'Adicionando informações da Núvem' },
  { t: 'item', texto: 'Adicionando Elite, Hiroshi e Katakana' },
  { t: 'vila', texto: 'Adicionando informações da Pedra' },
  { t: 'item', texto: 'Adicionando Oryo e Sekio' },
  { t: 'vila', texto: 'Adicionando informações da Folha' },
  { t: 'item', texto: 'Adicionando Hashirama, Madara, Kawarama, Mito, Sakura, Ashina, Minoru, Hiruzen, Hina, Amai entre outros' },
  { t: 'vila', texto: 'Adicionando OCA' },
  { t: 'item', texto: 'Adicionando 1, 2 e 3 pilar, 99%, 75% e 40% chamem como quiserem...' },
  { t: 'passo', texto: 'Compactando mensagem de Alerta' },
  { t: 'passo', texto: 'Enviando Mensagem de Alerta' },
];

/** Quanto texto um bloco tem. O contador da impressão anda por esta medida. */
const tamanhoDoBloco = (b: Bloco) => b.t === 'clas' ? b.itens.join('').length : b.texto.length;

/**
 * Os nomes que chegam TARJADOS e vão sendo revelados um a um enquanto o Takeshi lê.
 *
 * São os nomes que fazem a carta valer: quem está por trás, quem está acima deles, o que está
 * selado onde. Tarjar o resto seria enfeite; tarjar estes conta que alguém tentou esconder
 * exatamente isso.
 */
const TARJADOS = [
  'Hades', 'Theta', 'Madara', 'Matatabi', 'Fortaleza Yumei', 'Mangekyō Sharingan Eterno',
  'Oito-Caudas', 'Kaito Senju', 'Nishinoya', 'chakra profano', 'Dojutsu',
];
// o `|` mais longo primeiro, senão "Kaito Senju" nunca casaria — "Nishinoya" e os outros são
// independentes, mas a regra vale para qualquer par onde um nome contenha o outro
const REGEX_TARJA = new RegExp(`(${[...TARJADOS].sort((a, b) => b.length - a.length).join('|')})`, 'g');

/**
 * A carta do Hanzo, em blocos tipados.
 *
 * Bloco tipado em vez de um texto corrido com quebras: é o que deixa cada coisa ter o tratamento
 * que merece. "ODDY E AYUMI PRECISAM SER PROTEGIDOS A QUALQUER CUSTO" não pode ter o mesmo peso
 * visual de uma frase no meio de um parágrafo.
 *
 * O texto é o do Pedro, palavra por palavra.
 */
type Bloco =
  | { t: 'alerta'; texto: string }
  | { t: 'p'; texto: string }
  | { t: 'clas'; itens: string[] }
  | { t: 'titulo'; texto: string }
  | { t: 'grito'; texto: string };

const CARTA: Bloco[] = [
  { t: 'alerta', texto: 'IMPORTANTE: NÃO LEIAM ESTA MENSAGEM EM VOZ ALTA.' },
  { t: 'p', texto: 'Não leiam esta mensagem em voz alta nem comentem sobre ela enquanto estiverem juntos. Existe a possibilidade de alguém estar ouvindo vocês, então considerem que cada palavra pode estar sendo observada. Leiam tudo até o final antes de tomar qualquer decisão.' },
  { t: 'p', texto: 'Vocês estão caminhando para um lugar onde encontrarão quatro pessoas dos seguintes clãs:' },
  { t: 'clas', itens: ['Nara', 'Uchiha', 'Chinoike', 'Hoshigaki'] },
  { t: 'p', texto: 'Não sei se estarão esperando ou se o encontro acontecerá de outra forma, mas estejam preparados para lutar.' },
  { t: 'p', texto: 'Theta, o falso Kazekage, está acima de vocês e os está guiando até o local da batalha, assim como na última luta. Não façam nada, não olhem para cima e não demonstrem que perceberam. Enquanto ele acreditar que vocês seguem exatamente o plano dele, ainda terão uma pequena vantagem. Não desviem o caminho; encarem isso como uma oportunidade.' },
  { t: 'p', texto: 'A Uchiha precisa ficar ao lado de vocês, pois ela é extremamente importante. O Nara e o Chinoike não são pessoas ruins, apenas estão sendo manipulados. Tentem salvar o que restou do Hoshigaki.' },
  { t: 'p', texto: 'Também descubram quem se afastou do grupo, não estou falando do procurado, mas de outra pessoa, Hades chamou a pessoa de lobo que fugiu da matilha e estão indo atrás da pessoa para utilizar como experimento, caso essa pessoa seja usuária de Dojutsu a situação fica mais embaixo.' },
  { t: 'titulo', texto: 'Sobre a Uchiha' },
  { t: 'p', texto: 'Ela fez um acordo com Hades: ela pretende entregar o próprio olho em troca do outro olho de Madara, alcançando o Mangekyō Sharingan Eterno. Por isso prestem muita atenção' },
  { t: 'grito', texto: 'ODDY E AYUMI PRECISAM SER PROTEGIDOS A QUALQUER CUSTO.' },
  { t: 'p', texto: 'Furyuzan também é um dos principais alvos da OCA. Ele não pode chegar a 99% de forma alguma e, acima de tudo, não pode ser capturado. Se isso acontecer, não sei quais serão as consequências. Lembrem-se também de Hisoka, o verdadeiro está vivo, em coma, no último andar da Fortaleza Yumei. Qualquer Hisoka que encontrem fora de lá é falso e ainda está solto.' },
  { t: 'p', texto: 'Sobre Reika, vocês já sabem: o Oito-Caudas foi removido dela. Não tenho mais informações. Quando a luta começar, não esperem ajuda; ninguém virá salvá-los. Lutem com tudo o que tiverem e sigam em frente, mesmo sabendo que o inimigo os conduz exatamente para onde quer.' },
  { t: 'p', texto: 'Não se esqueçam de Matatabi, Estão com ele e o elo que ele havia com Nishinoya fez ele ainda manter 100% de seu chakra e poder mesmo selado em um humano, isso explica uma parte da força de Nishinoya, de alguma forma Matatabi resiste a sua fusão com chakra profano, caso ele seja controlado, será o inicio do nosso fim' },
  { t: 'p', texto: 'Quanto a Kaito Senju, encontrei o panfleto enquanto passava por kirigakure, é uma pena, mas se a informação for verdadeira o objetivo deve ser a morte de Kaito Senju a fim de matar também Hades. Não consegui descobrir nada. Não sei onde ele está, o que está fazendo ou de que lado aparecerá. Não contem com ele. Por enquanto, vocês só podem contar uns com os outros. Finjam que não sabem de nada, continuem andando e não deixem Theta perceber que descobriram.' },
  { t: 'p', texto: 'Fiz o que pude para conseguir essas informações, então confiem em mim. E guardem uma última coisa: protejam uns aos outros, não abandonem ninguém e façam o necessário para que todos voltem vivos.' },
  { t: 'p', texto: 'Continuem na linha de frente enquanto atuo nas sombras, vou mantendo vocês atualizados.' },
];

const TOTAL_CHARS = CARTA.reduce((n, b) => n + tamanhoDoBloco(b), 0);

const AvisoUrgente: React.FC<{ onClose: () => void; capaDoHanzo?: string }> = ({ onClose, capaDoHanzo }) => {
  const [restam, setRestam] = useState(SEGUNDOS_DE_ALARME);
  // 'erro' é a tela falsa que aparece quando o alarme acaba; a carta só abre quando o Takeshi
  // clica em RECARREGAR.
  const [fase, setFase] = useState<'erro' | 'enviando' | 'abrindo' | 'carta'>('erro');
  // 0 a 100 na tela de descompactação
  const [abertura, setAbertura] = useState(0);
  // quantos CARACTERES da carta já foram impressos; as tarjas só começam depois do último
  const [impressos, setImpressos] = useState(0);
  const rolagem = useRef<HTMLDivElement | null>(null);
  // quantas linhas do envio já saíram; as 16 se espalham pelos 20 segundos
  const [linha, setLinha] = useState(0);

  useEffect(() => {
    if (restam <= 0) return;
    const t = setTimeout(() => setRestam(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [restam]);

  // A rolagem só trava depois do alarme. Durante ele as janelas são visuais e o banco continua
  // navegável por baixo delas.
  useEffect(() => {
    if (restam > 0) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, [restam]);

  // Quantas tarjas já caíram. Sobe sozinho, uma a cada 260ms, e o cabeçalho acompanha.
  const [reveladas, setReveladas] = useState(0);
  // a barra de descompactação sobe em passos irregulares: barra que sobe liso parece falsa
  useEffect(() => {
    if (fase !== 'abrindo') return;
    if (abertura >= 100) { const t = setTimeout(() => setFase('carta'), 500); return () => clearTimeout(t); }
    const t = setTimeout(() => setAbertura(v => Math.min(100, v + Math.ceil(Math.random() * 7))), 130);
    return () => clearTimeout(t);
  }, [fase, abertura]);

  // a impressão da carta: 10 caracteres a cada 30ms, ~330 por segundo
  useEffect(() => {
    if (fase !== 'carta' || impressos >= TOTAL_CHARS) return;
    const t = setTimeout(() => {
      setImpressos(n => Math.min(TOTAL_CHARS, n + 10));
      // a rolagem acompanha o cursor; sem isso o texto cresce para fora da tela
      const el = rolagem.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
    return () => clearTimeout(t);
  }, [fase, impressos]);

  useEffect(() => {
    if (fase !== 'enviando' || linha >= ENVIO.length) return;
    const t = setTimeout(() => setLinha(n => n + 1), (SEGUNDOS_ENVIANDO * 1000) / ENVIO.length);
    return () => clearTimeout(t);
  }, [fase, linha]);

  useEffect(() => {
    if (restam > 0 || fase !== 'carta' || impressos < TOTAL_CHARS) return;
    const t = setInterval(() => setReveladas(n => n + 1), 260);
    return () => clearInterval(t);
  }, [restam, fase, impressos]);

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

  // ================================================================ a tela de erro
  //
  // Cópia EXATA do que o ChunkErrorBoundary desenha: mesma classe, mesmo texto, mesmo botão. Se
  // não fosse idêntica o truque morria. É a única razão de o markup estar duplicado em vez de
  // importado — o boundary é uma classe com estado de erro de verdade, e o que se quer aqui é a
  // aparência, não o comportamento.
  if (fase === 'erro') {
    return (
      <div className="fixed inset-0 z-[200] min-h-screen flex items-center justify-center bg-black text-tech-primary p-8">
        <div className="text-center space-y-3">
          <p className="text-sm uppercase tracking-widest">Algo deu errado.</p>
          <button
            type="button"
            onClick={() => setFase('enviando')}
            className="border border-tech-primary/40 px-4 py-2 text-xs uppercase tracking-widest hover:bg-tech-primary hover:text-black transition-all"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }

  // ================================================================ sincronizando
  //
  // VERDE de propósito: o vermelho é o invasor e o âmbar é o documento, mas aqui a máquina está
  // FUNCIONANDO — é o Hanzo escrevendo no banco, não alguém arrombando.
  if (fase === 'enviando') {
    const pronto = linha >= ENVIO.length;
    const pct = Math.round((Math.min(linha, ENVIO.length) / ENVIO.length) * 100);
    return (
      <div className="fixed inset-0 z-[200] bg-black text-tech-primary flex flex-col">
        <div className="absolute inset-0 bg-[linear-gradient(transparent_2px,rgba(0,255,65,0.05)_3px)] bg-[size:100%_4px] pointer-events-none z-10" />
        <div className="absolute top-0 left-0 w-full h-px bg-tech-primary/40 shadow-[0_0_12px_#00ff41] animate-[scanline_5s_linear_infinite] pointer-events-none z-10" />

        {/* linha de prompt: terminal não tem barra de título, tem a primeira linha */}
        <div className="shrink-0 border-b border-tech-border px-4 md:px-8 py-2.5 flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.2em] text-tech-primary/50">
          <span className="truncate">hanzo@era-genetica.db:~$ sync --push --canal=seguro</span>
          <span className="shrink-0">{pronto ? 'concluído' : 'em execução'}</span>
        </div>

        {/* o log ocupa a tela e cresce de cima para baixo a partir da margem esquerda */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-custom px-4 md:px-8 py-6 md:py-8 flex flex-col gap-2">
          {ENVIO.slice(0, linha).map((l, k) => {
            const atual = k === linha - 1 && !pronto;
            const ok = !atual;
            if (l.t === 'titulo') {
              return (
                <div key={k} className="text-[24px] md:text-[30px] font-black uppercase tracking-wide text-tech-primary mb-1">
                  {l.texto}
                </div>
              );
            }
            if (l.t === 'autor') {
              return (
                <div key={k} className="mb-4 inline-flex self-start border border-tech-primary/40 bg-tech-primary/[0.07] px-4 py-2 text-[15px] uppercase tracking-[0.18em] text-tech-primary">
                  {l.texto}
                </div>
              );
            }
            return (
              <div key={k} className={`flex items-start gap-3 ${l.t === 'item' ? 'pl-6 md:pl-10' : 'pt-2'}`}>
                <span className={`shrink-0 ${l.t === 'vila' ? 'text-tech-primary' : 'text-tech-primary/40'}`}>
                  {l.t === 'vila' ? '▸' : l.t === 'item' ? '└' : '$'}
                </span>
                <span className={`flex-1 leading-snug ${l.t === 'vila' ? 'text-[17px] md:text-[18px] text-tech-primary font-bold' : l.t === 'passo' ? 'text-[16px] text-tech-primary' : 'text-[14px] md:text-[15px] text-tech-primary/60'}`}>
                  {l.texto}
                  {atual && <span className="animate-pulse">█</span>}
                </span>
                {ok && <span className="shrink-0 text-[11px] uppercase tracking-widest text-tech-primary/45 pt-1">[ ok ]</span>}
              </div>
            );
          })}

        </div>

        {/* O aviso não é mais o fim do log: é uma JANELA que abre por cima do terminal quando a
            sincronização termina. O terminal continua atrás, escurecido — ele ainda é o que estava
            acontecendo, só parou de ser o assunto. */}
        {pronto && (
          <div className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-tech-bg border-2 border-red-600 shadow-[0_0_70px_-10px_rgba(220,38,38,0.7)] clip-corner animate-[abrirJanela_0.18s_ease-out]">
              <div className="border-b-2 border-red-600 bg-red-600 px-3 py-1.5 flex items-center gap-2">
                <AlertTriangle size={13} className="text-black shrink-0" />
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-black">aviso</span>
                <span className="ml-auto text-[13px] font-black text-black leading-none">✕</span>
              </div>
              <div className="px-6 py-8 flex flex-col items-center gap-7">
                <p className="text-center text-[26px] md:text-[34px] leading-tight font-black uppercase tracking-wide text-red-500">
                  Não leiam em voz alta
                </p>
                <button
                  type="button"
                  onClick={() => setFase('abrindo')}
                  className="border-2 border-tech-primary bg-tech-primary/10 text-tech-primary hover:bg-tech-primary hover:text-black px-8 py-4 text-[13px] font-black uppercase tracking-[0.25em] transition-colors clip-corner-sm"
                >
                  Abrir mensagem de alerta
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="shrink-0 border-t border-tech-border">
          <div className="h-2 bg-black">
            <div className="h-full bg-tech-primary transition-[width] duration-500 ease-linear" style={{ width: `${pct}%` }} />
          </div>
          <div className="px-4 md:px-8 py-2 flex justify-between gap-4 text-[11px] uppercase tracking-[0.2em] text-tech-primary/50">
            <span className="truncate">{pronto ? 'mensagem recebida' : 'não feche esta janela'}</span>
            <span className="shrink-0">{pct}%</span>
          </div>
        </div>
      </div>
    );
  }

  // ================================================================ descompactando
  //
  // A porcentagem estava numa linha de 10px no topo da carta, com o documento inteiro já visível
  // atrás dela — carregamento em letra miúda de algo que já tinha carregado. Virou tela.
  if (fase === 'abrindo') {
    // Barra em ASCII: barra desenhada é interface, barra feita de caracteres é terminal.
    const cheios = Math.round((abertura / 100) * 28);
    const barra = '█'.repeat(cheios) + '░'.repeat(28 - cheios);
    const saida: string[] = [
      '$ openssl enc -d -aes-256-cbc -in mensagem_alerta.enc',
      '> chave aceita · assinatura confere',
      '$ unpack --verbose mensagem_alerta',
    ];
    if (abertura > 12) saida.push('> cabeçalho lido · 1 documento · remetente protegido');
    if (abertura > 34) saida.push('> montando parágrafos');
    if (abertura > 58) saida.push('> aplicando censura do remetente');
    if (abertura > 80) saida.push('> verificando integridade … OK');
    if (abertura >= 100) saida.push('> pronto. abrindo.');

    return (
      <div className="fixed inset-0 z-[200] bg-black text-tech-primary flex flex-col">
        <div className="absolute inset-0 bg-[linear-gradient(transparent_2px,rgba(0,255,65,0.05)_3px)] bg-[size:100%_4px] pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-px bg-tech-primary/40 shadow-[0_0_12px_#00ff41] animate-[scanline_5s_linear_infinite] pointer-events-none" />

        <div className="relative flex-1 min-h-0 overflow-hidden px-4 md:px-8 py-6 md:py-8 flex flex-col gap-1.5 text-[14px] md:text-[15px] leading-relaxed">
          {saida.map(l => (
            <div key={l} className={l.startsWith('$') ? 'text-tech-primary font-bold' : 'text-tech-primary/60'}>{l}</div>
          ))}

          <div className="mt-4 text-[15px] md:text-[19px] text-tech-primary whitespace-pre">
            [{barra}] {String(abertura).padStart(3, ' ')}%
          </div>

          {/* o dump existe para a tela ter movimento: é o que separa "carregando" de "abrindo
              alguma coisa agora" */}
          <div className="mt-4 flex flex-col gap-0.5 text-[11px] md:text-[12px] text-tech-primary/30 whitespace-pre overflow-hidden">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i}>
                {`0x${((abertura * 64 + i * 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0')}   ${hex(12)}`}
              </div>
            ))}
          </div>

          <div className="mt-4 text-tech-primary">
            {abertura >= 100 ? '$ _' : <>descompactando<span className="animate-pulse">█</span></>}
          </div>
        </div>
      </div>
    );
  }

  // ================================================================ a mensagem
  // A numeração das tarjas precisa ser contínua entre os blocos, então o contador vive fora do
  // map e é consumido na ordem em que o texto aparece.
  let tarja = 0;
  // o contador da impressão: mesma ideia do `tarja`, uma variável que zera a cada render e é
  // consumida na ordem em que o texto aparece
  let percorrido = 0;
  const totalTarjas = CARTA.reduce((n, b) =>
    n + (('texto' in b) ? (b.texto.match(REGEX_TARJA) ?? []).length : 0), 0);

  /** Quebra o texto nos nomes tarjados e devolve os pedaços prontos para desenhar. */
  const comTarjas = (texto: string) => texto.split(REGEX_TARJA).map((pedaco, i) => {
    if (!TARJADOS.includes(pedaco)) return <span key={i}>{pedaco}</span>;
    const meu = tarja++;
    const aberta = meu < reveladas;
    return (
      <span
        key={i}
        // tarja é fundo preto com o texto invisível, não texto removido: assim a linha não muda de
        // tamanho quando ela cai e o parágrafo não pula na tela
        className={aberta
          ? 'text-tech-accent font-bold transition-colors duration-300'
          : 'bg-black text-transparent select-none'}
      >
        {pedaco}
      </span>
    );
  });

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-3 md:p-6">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-tech-bg border-2 border-tech-accent/50 shadow-[0_0_70px_-12px_rgba(255,176,0,0.35)] clip-corner flex flex-col overflow-hidden">
        <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-tech-accent z-30 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-tech-accent z-30 pointer-events-none" />

        {/* carimbo atrás de tudo: girado e enorme, como documento que passou por uma mesa */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="-rotate-[18deg] text-[clamp(60px,14vw,150px)] font-black uppercase tracking-tighter text-tech-accent/[0.06] whitespace-nowrap">
            confidencial
          </span>
        </div>

        <div className="relative shrink-0 border-b border-tech-accent/40 bg-tech-accent/[0.07] pl-6 pr-3 py-2 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-tech-accent min-w-0">
            <AlertTriangle size={11} className="shrink-0" />
            <span className="truncate">
              {reveladas < totalTarjas
                ? `descriptografando · ${Math.round((reveladas / Math.max(1, totalTarjas)) * 100)}%`
                : 'texto limpo · arquivo aberto'}
            </span>
          </span>
          <button
            onClick={onClose}
            title="Fechar"
            className="shrink-0 border border-tech-accent/60 bg-tech-accent/10 text-tech-accent hover:bg-tech-accent hover:text-black p-1.5 transition-colors clip-corner-sm"
          >
            <X size={14} />
          </button>
        </div>

        {/* ficha de origem: dá ao papel a aparência de coisa arquivada, não de mensagem de chat */}
        <div className="relative shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-px bg-tech-accent/20 border-b border-tech-accent/25">
          {[['remetente', 'campo — sombras'], ['canal', 'fechado · 1 salto'], ['classificação', 'olhos apenas'], ['arquivo', '0x7F-HANZO']].map(([r, v]) => (
            <div key={r} className="bg-tech-bg px-3 py-2 min-w-0">
              <div className="text-[8px] uppercase tracking-[0.2em] text-tech-primary/40">{r}</div>
              <div className="text-[12px] text-tech-accent/90 truncate">{v}</div>
            </div>
          ))}
        </div>

        <div ref={rolagem} className="relative flex-1 min-h-0 overflow-y-auto scrollbar-custom px-4 py-6 md:px-8 md:py-8">
          <div className="flex flex-col gap-5">
            {CARTA.map((b, k) => {
              const meuInicio = percorrido;
              percorrido += tamanhoDoBloco(b);
              if (impressos <= meuInicio) return null;          // ainda não chegou neste bloco
              const ate = impressos - meuInicio;                 // quanto dele já saiu
              const imprimindo = impressos < percorrido;         // é o bloco que está sendo escrito
              const cursor = imprimindo ? <span className="animate-pulse">█</span> : null;
              // a numeração de margem é o que dá o ar de documento oficial, e de graça ela vira
              // uma referência: "o parágrafo 09 fala do Furyuzan"
              const numero = <span className="select-none text-[10px] text-tech-primary/25 w-7 shrink-0 pt-1.5 text-right tabular-nums">{String(k + 1).padStart(2, '0')}</span>;

              if (b.t === 'alerta') {
                return (
                  <div key={k} className="flex gap-3">
                    {numero}
                    <div className="flex-1 border-2 border-red-600/70 bg-red-950/25 px-4 py-3.5">
                      <p className="text-[20px] leading-snug font-black uppercase tracking-[0.06em] text-red-500">{b.texto.slice(0, ate)}{cursor}</p>
                    </div>
                  </div>
                );
              }
              if (b.t === 'titulo') {
                return (
                  <div key={k} className="flex gap-3 pt-2">
                    {numero}
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-[12px] uppercase tracking-[0.3em] text-tech-accent whitespace-nowrap">{b.texto.slice(0, ate)}{cursor}</span>
                      <span className="h-px flex-1 bg-tech-accent/30" />
                    </div>
                  </div>
                );
              }
              if (b.t === 'clas') {
                return (
                  <div key={k} className="flex gap-3">
                    {numero}
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-px bg-tech-accent/25 border border-tech-accent/25">
                      {/* os clãs entram um por um, na mesma cadência do texto */}
                      {b.itens.map((c, i) => {
                        const antes = b.itens.slice(0, i).join('').length;
                        if (ate <= antes) return null;
                        return <div key={c} className="bg-tech-bg px-3 py-3 text-center text-[17px] font-black uppercase tracking-wide text-tech-accent">{c.slice(0, ate - antes)}</div>;
                      })}
                    </div>
                  </div>
                );
              }
              if (b.t === 'grito') {
                return (
                  <div key={k} className="flex gap-3">
                    {numero}
                    <div className="flex-1 border-l-4 border-red-600 bg-red-950/20 px-4 py-3.5">
                      <p className="text-[17px] leading-snug font-black uppercase tracking-[0.04em] text-red-400">{b.texto.slice(0, ate)}{cursor}</p>
                    </div>
                  </div>
                );
              }
              return (
                <div key={k} className="flex gap-3">
                  {numero}
                  <p className="flex-1 text-[17px] leading-[1.85] text-slate-300">{comTarjas(b.texto.slice(0, ate))}{cursor}</p>
                </div>
              );
            })}
          </div>

          {/* o selo só entra quando a impressão acaba: assinatura antes do texto não faz sentido */}
          {impressos >= TOTAL_CHARS && (
          <div className="mt-8 pt-6 border-t border-tech-accent/25 flex items-end justify-end gap-4">
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] uppercase tracking-[0.3em] text-tech-primary/40">assinado no campo</span>
              <span className="text-[24px] font-black uppercase tracking-wide text-tech-accent leading-none">Hiroshi Hanzo</span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-tech-primary/30">3º líder de rastreio · konohagakure</span>
            </div>
            {/* o selo é o retrato dele; sem capa na ficha, volta a ser as iniciais */}
            <div className="shrink-0 w-20 h-20 rounded-full border-2 border-tech-accent/70 overflow-hidden -rotate-6 relative bg-black">
              {capaDoHanzo ? (
                <>
                  <img
                    src={formatImageUrl(capaDoHanzo)}
                    alt="Hiroshi Hanzo"
                    className="absolute inset-0 w-full h-full object-cover sepia contrast-125"
                  />
                  {/* o âmbar por cima costura o retrato ao resto do documento */}
                  <div className="absolute inset-0 bg-tech-accent/25 mix-blend-color" />
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[19px] font-black text-tech-accent leading-none">HH</span>
                  <span className="text-[7px] uppercase tracking-[0.18em] text-tech-accent/70 mt-0.5">selo</span>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvisoUrgente;
