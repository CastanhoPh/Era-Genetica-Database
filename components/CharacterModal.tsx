import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  X, Shield, Zap, Star, Backpack, Scroll, Heart, Activity,
  BicepsFlexed, Hand, Move, Brain, Ghost, Eye, Terminal, Lock, Skull, Flame,
  AlertTriangle, Fingerprint, Binary, Image as ImageIcon,
  ChevronRight, ChevronLeft, ChevronDown, Globe, Share2, Pencil, Trash2, Palette, ScanLine, Sparkles,
  Hexagon, History
} from 'lucide-react';
import { Character, EVENT_SEASONS, CLASSIFICATION_PRIORITY } from '../types';
import { Equipment } from '../types/Equipment';
import { slugify } from '../data/firestore';
import AttributeBox from './AttributeBox';
import ResourceBar from './ResourceBar';
import { formatImageUrl, seloDe, corDoSelo, vilasDe, CORES_DE_VILA, CORES_DE_ORG } from '../utils/formatters';
import { maiorPosto } from '../data/postos-por-aba';
import { rankDeNC } from '../data/atributos';

// Carregado sob demanda: chart.js + react-chartjs-2 só entram no bundle quando
// alguém realmente clica em "Radar" (a ficha abre com a visão de barras por padrão).
const AttributeRadar = lazy(() => import('./AttributeRadar'));

interface CharacterModalProps {
  char: Character | null;
  onClose: () => void;
  isAdmin?: boolean;
  onEdit?: (char: Character) => void;
  onDelete?: (char: Character) => Promise<void> | void;
  onFilterClan?: (clan: string) => void;
  onFilterTag?: (tag: string) => void;
  arsenalOptions?: Equipment[];
  /**
   * Todas as fichas públicas. Serve a UMA coisa: achar a invocação que esta pessoa já invocou, que
   * vive desnormalizada na ficha de quem a invoca hoje. O arsenal faz o equivalente com
   * `arsenalOptions`.
   */
  characters?: Character[];
}

const CharacterModal: React.FC<CharacterModalProps> = ({ char, onClose, isAdmin, onEdit, onDelete, onFilterClan, onFilterTag, arsenalOptions = [], characters = [] }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [forceColor, setForceColor] = useState(false);
  const [hideMask, setHideMask] = useState(false);
  const eraStripRef = useRef<HTMLDivElement>(null);
  const modoStripRef = useRef<HTMLDivElement>(null);
  const scrollStrip = (ref: React.RefObject<HTMLDivElement | null>, direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  const scrollEraStrip = (direction: 1 | -1) => scrollStrip(eraStripRef, direction);

  // A faixa de abas do topo sempre rolou, mas com scrollbar-none nada dizia isso: numa ficha com as
  // seis abas as duas ultimas ficam atras dos icones de acao e so um gesto de trackpad as alcancava.
  const tabStripRef = useRef<HTMLDivElement>(null);
  const [tabSobra, setTabSobra] = useState({ esq: false, dir: false });
  // Os campos de consulta do jutsu (escala, protocolo, histórico) entram recolhidos: a leitura que
  // importa é a description, e os quatro juntos davam 1.405 caracteres de uma vez.
  const [detalheTech, setDetalheTech] = useState(false);
  const mediaTabs = () => {
    const el = tabStripRef.current;
    if (!el) return;
    // 4px de tolerancia: navegador arredonda scrollLeft e a seta piscaria no fim da rolagem.
    const folga = el.scrollWidth - el.clientWidth - el.scrollLeft;
    const esq = el.scrollLeft > 4;
    const dir = folga > 4;
    setTabSobra(a => (a.esq === esq && a.dir === dir ? a : { esq, dir }));
  };
  const scrollTabs = (direction: 1 | -1) => scrollStrip(tabStripRef, direction);

  const copyLink = () => {
    if (!char?.docId) return;
    const url = `${window.location.origin}${location.pathname}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  useEffect(() => {
    setImgError(false);
  }, [char]);

  // Prevent scroll on body when modal is open
  useEffect(() => {
    if (char) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [char]);

  // Fecha com Esc, igual à lightbox da Galeria.
  useEffect(() => {
    if (!char) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [char, onClose]);

  const [eventosViewMode, setEventosViewMode] = useState<'completa' | 'temporada'>('completa');
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());
  const toggleSeason = (season: string) => {
    setExpandedSeasons(prev => {
      const next = new Set(prev);
      if (next.has(season)) next.delete(season); else next.add(season);
      return next;
    });
  };
  const [statsView, setStatsView] = useState<'bars' | 'radar'>('bars');
  const [radarAnimationData, setRadarAnimationData] = useState<number[]>([]);

  useEffect(() => {
    if (statsView === 'radar' && char) {
      const targetData = [
        char.stats.strength,
        char.stats.dexterity,
        char.stats.agility,
        char.stats.perception,
        char.stats.intelligence,
        char.stats.vigor,
        char.stats.spirit
      ].map(v => typeof v === 'number' ? v : 0);
      
      setRadarAnimationData(new Array(targetData.length).fill(0));
      const timer = setTimeout(() => {
        setRadarAnimationData(targetData);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setRadarAnimationData([]);
    }
  }, [statsView, char]);

  if (!char) return null;

  const allTechniques = char.techniques || [];

  /**
   * O anel de chakra marca rank Z, e só rank Z — em toda técnica e em toda arma do arsenal
   * pessoal, quantas houverem. Se a mais forte da ficha não for Z, ela não recebe nada.
   * A página /arsenal fica de fora de propósito: lá o anel não teria de quem herdar a cor.
   *
   * Devolve o estilo com as duas cores dos fachos, ou undefined quando não há anel — o que
   * também cobre quem ainda não tem cor de chakra. `cores` permite a técnica usar mais de um
   * chakra: um facho de cada cor (a Reikō Kuchiyose do Katsumi conduz o Yomatora roxo e o
   * Kintora dourado ao mesmo tempo). O segundo facho só é escrito quando difere do primeiro.
   */
  const anelDe = (classification?: string, cores?: string[]): React.CSSProperties | undefined => {
    if (classification !== 'Z') return undefined;
    const a = cores?.[0] || char.chakraColor;
    if (!a) return undefined;
    const b = cores?.[1];
    return {
      ['--chakra' as string]: a,
      ...(b && b !== a ? { ['--chakra-2' as string]: b } : {}),
    } as React.CSSProperties;
  };

  // Se a arma tem uma variação manifestada por ESTE personagem (ex: Kaito com a Guren no
  // Kage, dentro da Sōen no Kage), mostra o nome/imagem/descrição da variação dele —
  // não os da arma-base, que seriam de outro portador.
  const comVariacaoDele = (item: typeof arsenalOptions[number]) => {
    const variant = item.variants?.find(v => v.owner.trim().toLowerCase() === char.name.trim().toLowerCase());
    if (!variant) return item;
    return { ...item, name: variant.name, image: variant.image ?? item.image, description: variant.description ?? item.description };
  };

  const characterArsenal = (char.arsenal || [])
    .map(id => arsenalOptions.find(item => item.id === id))
    .filter(Boolean)
    .map(item => comVariacaoDele(item!));

  // Armas marcadas (campo `diedHolding`) como estando com ESTE personagem quando ele morreu,
  // mas que não estão no `arsenal` pessoal dele (senão já apareceriam ali) — junta com
  // characterArsenal pra formar a seção de cima, sem duplicar. Passa pelo mesmo
  // comVariacaoDele: quem morreu com a própria variação tem que ver o nome dela, não o da
  // arma-base.
  const characterDiedHoldingArsenal = arsenalOptions
    .filter(item =>
      !characterArsenal.some(w => w.id === item.id) &&
      (item.diedHolding || []).some(name => name.trim().toLowerCase() === char.name.trim().toLowerCase())
    )
    .map(comVariacaoDele);

  // Seção de cima: pra quem já morreu, é tudo que ele tinha (arsenal pessoal + o que foi
  // marcado como "morreu em posse" na arma) — não faz sentido separar os dois, é a mesma
  // coisa (o que ele tinha na hora da morte). Pra quem tá vivo, é só o arsenal pessoal mesmo.
  const characterCurrentSectionArsenal = [...characterArsenal, ...characterDiedHoldingArsenal];

  // Armas que ESTE personagem já teve — é o `originalOwner`, aparece em `pastOwners`, ou é
  // dono de uma variação da arma (ex: Naomi com a Shiden no Kage) — mas não estão na seção
  // de cima (pra não duplicar). Se for dono de variação, mostra o nome/imagem da variação dele.
  const characterPastArsenal = arsenalOptions
    .filter(item => {
      if (characterCurrentSectionArsenal.some(w => w.id === item.id)) return false;
      const nameLower = char.name.trim().toLowerCase();
      const wasOriginal = (item.originalOwner || '').trim().toLowerCase() === nameLower;
      const wasPast = (item.pastOwners || []).some(o => o.trim().toLowerCase() === nameLower);
      const wasVariantOwner = (item.variants || []).some(v => v.owner.trim().toLowerCase() === nameLower);
      return wasOriginal || wasPast || wasVariantOwner;
    })
    .map(comVariacaoDele);

  // Lista combinada (seção de cima + já utilizou), só pra rotear/abrir o detalhe de
  // qualquer uma das seções a partir de um índice único.
  const characterArsenalAll = [...characterCurrentSectionArsenal, ...characterPastArsenal];

  const characterGallery = char.gallery || [];
  const galleryWithIndex = characterGallery.map((img, idx) => ({ img, idx }));
  const eraGallery = galleryWithIndex.filter(({ img }) => img.category === 'era');
  const transformacaoGallery = galleryWithIndex.filter(({ img }) => img.category === 'transformacao');
  const eventoGallery = galleryWithIndex.filter(({ img }) => img.category === 'evento');

  // As invocações vêm desnormalizadas na ficha (`invocacoes`), não do checklist: a ficha é pública
  // e não pode ler as 741 linhas do imageChecklist para achar as suas. A ordem gravada é a das
  // páginas do Canva, então nada de reordenar aqui.
  /**
   * Do rank mais alto para o mais baixo, com a mesma tabela do arsenal e da aba Invocações.
   * `sort` é estável, então dentro do mesmo rank fica valendo a ordem das páginas do Canva.
   */
  const porRank = (lista: NonNullable<Character['invocacoes']>) => [...lista].sort(
    (a, b) => (CLASSIFICATION_PRIORITY[b.rank ?? ''] ?? -1) - (CLASSIFICATION_PRIORITY[a.rank ?? ''] ?? -1),
  );

  const characterInvocacoes = porRank(char.invocacoes || []);

  // Invocações que ESTA pessoa já invocou: aparece como invocador original ou antigo numa invocação
  // que hoje é de outro. Mesma regra do arsenal, e o mesmo cuidado de não duplicar quem já está na
  // seção de cima.
  const invocacoesPassadas = (() => {
    const meu = char.name.trim().toLowerCase();
    const jaTem = new Set(characterInvocacoes.map(i => i.nome));
    const vistas = new Set<string>();
    const achadas = characters
      .flatMap(c => c.invocacoes ?? [])
      .filter(inv => {
        if (jaTem.has(inv.nome) || vistas.has(inv.nome)) return false;
        const foiOriginal = (inv.originalOwner ?? '').trim().toLowerCase() === meu;
        const foiAntigo = (inv.pastOwners ?? []).some(o => o.trim().toLowerCase() === meu);
        if (!foiOriginal && !foiAntigo) return false;
        vistas.add(inv.nome);
        return true;
      });
    return porRank(achadas);
  })();

  /** As duas seções numa lista só, para a rota abrir qualquer uma por um índice único. */
  const invocacoesTodas = [...characterInvocacoes, ...invocacoesPassadas];

  // Aba ativa e item selecionado (jutsu/arma/imagem) vêm direto da URL — segmentos depois
  // do slug do personagem: /<slug>/jutsus[/<tecnica>], /<slug>/arsenal[/<arma>], /<slug>/galeria[/<imagem>].
  // Sem estado próprio pra duplicar (mesmo princípio já usado pra aba principal em App.tsx).
  const restSegments = location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).slice(1);
  const subTabRaw = restSegments[0];
  const itemSlugRaw = restSegments[1] ? decodeURIComponent(restSegments[1]) : undefined;
  // "galeria" continua valendo como rota da Linha do Tempo: é o que os links já compartilhados
  // usam, e a aba foi só renomeada e dividida em duas.
  const activeTab: 'data' | 'techniques' | 'arsenal' | 'invocacoes' | 'gallery' | 'eventos' =
    subTabRaw === 'jutsus' ? 'techniques' :
    subTabRaw === 'arsenal' ? 'arsenal' :
    subTabRaw === 'invocacoes' ? 'invocacoes' :
    subTabRaw === 'eventos' ? 'eventos' :
    subTabRaw === 'linha-do-tempo' || subTabRaw === 'galeria' ? 'gallery' : 'data';

  const gallerySlugFor = (img: { caption?: string }, idx: number) => img.caption ? slugify(img.caption) : `img-${idx + 1}`;

  const selectedTechIndex = activeTab === 'techniques' && itemSlugRaw
    ? (() => { const i = allTechniques.findIndex(t => slugify(t.name) === itemSlugRaw); return i >= 0 ? i : null; })()
    : null;
  const selectedWeaponIndex = activeTab === 'arsenal' && itemSlugRaw
    ? (() => { const i = characterArsenalAll.findIndex(w => w && slugify(w.name) === itemSlugRaw); return i >= 0 ? i : null; })()
    : null;
  const selectedInvocacaoIndex = activeTab === 'invocacoes' && itemSlugRaw
    ? (() => { const i = invocacoesTodas.findIndex(x => slugify(x.nome) === itemSlugRaw); return i >= 0 ? i : null; })()
    : null;
  const selectedGalleryIndex = (activeTab === 'gallery' || activeTab === 'eventos') && itemSlugRaw
    ? (() => { const i = characterGallery.findIndex((g, gi) => gallerySlugFor(g, gi) === itemSlugRaw); return i >= 0 ? i : null; })()
    : null;

  const charBasePath = `/${encodeURIComponent(char.docId!)}`;
  const goTo = (path: string) => navigate(path, { state: location.state });
  const goToTab = (tab: 'data' | 'techniques' | 'arsenal' | 'invocacoes' | 'gallery' | 'eventos') => goTo(
    tab === 'data' ? charBasePath
      : tab === 'techniques' ? `${charBasePath}/jutsus`
      : tab === 'arsenal' ? `${charBasePath}/arsenal`
      : tab === 'invocacoes' ? `${charBasePath}/invocacoes`
      : tab === 'eventos' ? `${charBasePath}/eventos`
      : `${charBasePath}/linha-do-tempo`
  );
  // O numero de abas muda com a ficha, e a largura disponivel muda com a janela.
  useEffect(() => {
    mediaTabs();
    window.addEventListener('resize', mediaTabs);
    return () => window.removeEventListener('resize', mediaTabs);
  }, [char, characterInvocacoes.length]);

  // Trocar de jutsu fecha os detalhes do anterior — abrir um jutsu novo já expandido devolveria
  // o problema que o recolhimento resolve.
  useEffect(() => { setDetalheTech(false); }, [selectedTechIndex]);

  // Abrir a ficha por link direto numa aba escondida tem de mostrar a aba, nao so o conteudo.
  useEffect(() => {
    const btn = tabStripRef.current?.querySelector<HTMLButtonElement>('[data-aba-ativa="1"]');
    btn?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    mediaTabs();
  }, [activeTab, char]);

  const goToInvocacao = (idx: number) => {
    const inv = invocacoesTodas[idx];
    if (inv) goTo(`${charBasePath}/invocacoes/${encodeURIComponent(slugify(inv.nome))}`);
  };
  const goToTechnique = (idx: number) => goTo(`${charBasePath}/jutsus/${encodeURIComponent(slugify(allTechniques[idx].name))}`);
  const goToWeapon = (idx: number) => {
    const w = characterArsenalAll[idx];
    if (w) goTo(`${charBasePath}/arsenal/${encodeURIComponent(slugify(w.name))}`);
  };
  // A imagem abre na aba a que ela pertence — evento cai em /eventos, fase e modo em
  // /linha-do-tempo — para o "voltar" levar ao lugar de onde ela veio.
  const abaDaImagem = (img?: { category?: string }) => (img?.category === 'evento' ? 'eventos' : 'linha-do-tempo');
  const goToGalleryImage = (idx: number) =>
    goTo(`${charBasePath}/${abaDaImagem(characterGallery[idx])}/${encodeURIComponent(gallerySlugFor(characterGallery[idx], idx))}`);

  const SEM_TEMPORADA = 'Sem Temporada';
  // O `season` do evento vem do checklist, e lá ele não é só "1ª a 5ª Temporada": tem Prólogo,
  // Clássico e as duas 2ª Temporada (de Konoha e da OCA). Ordena pelo que a lista conhece e
  // deixa o resto em ordem cronológica declarada, senão tudo isso cairia em "Sem Temporada".
  const ORDEM_TEMPORADA = ['Prólogo', 'Clássico', '1ª Temporada', '2ª Temporada',
    '2ª Temporada de Konoha', '2ª Temporada da OCA', '3ª Temporada', '4ª Temporada', '5ª Temporada'];
  const rankTemporada = (s: string) => {
    const i = ORDEM_TEMPORADA.indexOf(s);
    if (i >= 0) return i;
    const j = (EVENT_SEASONS as readonly string[]).indexOf(s);
    return j >= 0 ? j : 99;
  };
  const eventosBySeason = [...new Set(eventoGallery.map(({ img }) => img.season || SEM_TEMPORADA))]
    .sort((a, b) => rankTemporada(a) - rankTemporada(b) || a.localeCompare(b))
    .map(season => ({
      season,
      items: eventoGallery.filter(({ img }) => (img.season || SEM_TEMPORADA) === season),
    }))
    .filter(g => g.items.length > 0);

  const attributesList = [
    { label: "FORÇA", value: char.stats.strength, icon: BicepsFlexed },
    { label: "DESTREZA", value: char.stats.dexterity, icon: Hand },
    { label: "AGILIDADE", value: char.stats.agility, icon: Move },
    { label: "PERCEPÇÃO", value: char.stats.perception, icon: Eye },
    { label: "INTELIGÊNCIA", value: char.stats.intelligence, icon: Brain },
    { label: "VIGOR", value: char.stats.vigor, icon: Activity },
    { label: "ESPÍRITO", value: char.stats.spirit, icon: Ghost },
  ];

  const radarValues = radarAnimationData.length > 0 ? radarAnimationData : new Array(attributesList.length).fill(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-black/95 backdrop-blur-sm">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,65,0.05),transparent)] pointer-events-none"></div>
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="relative w-full max-w-7xl h-full md:h-[90vh] bg-tech-bg border-2 border-tech-primary/50 shadow-[0_0_30px_rgba(0,255,65,0.1)] flex flex-col md:flex-row overflow-hidden clip-corner animate-in fade-in zoom-in-95 duration-300">
        <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-tech-primary z-50 pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-tech-primary z-50 pointer-events-none"></div>


        <div className="w-full md:w-[400px] border-r border-tech-border flex flex-col bg-tech-panel/30 relative overflow-y-auto scrollbar-custom">
           <div className={`p-2 border-b text-[10px] flex justify-between sticky top-0 bg-black/90 z-10 backdrop-blur-sm ${char.isDead ? 'border-red-900/50 text-red-500/50' : 'border-tech-border text-tech-primary/50'}`}>
              <span>IMG_DATA_BLOCK_01</span>
              <span>SECURE_CONNECTION</span>
           </div>

           <div className="p-4 flex flex-col">
              <div className={`relative border-2 h-[350px] shrink-0 w-full bg-black overflow-hidden relative group ${hideMask ? 'z-[9999] ' : ''}${char.isDead ? 'border-red-600/50 shadow-[0_0_15px_rgba(255,0,0,0.2)]' : 'border-tech-dim'}`}>
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.1)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none z-20"></div>
                  {!char.isDead && (
                      <div className="absolute top-2 right-2 text-[10px] bg-red-600 text-black px-1 font-bold z-20 blink">LIVE</div>
                  )}
                  {char.isDead && (
                    <div className="absolute top-6 -right-12 bg-red-600 text-black font-black text-xs py-1 w-40 text-center rotate-45 z-30 border border-black shadow-[0_0_15px_rgba(255,0,0,0.6)] tracking-widest">
                        MORTO
                    </div>
                  )}

                  {char.image && !imgError ? (
                     <img 
                      src={formatImageUrl(char.image)} 
                      alt={char.name} 
                      onError={() => setImgError(true)}
                      className={`w-full h-full object-cover transition-all duration-500 ${char.isDead ? 'contrast-110 brightness-90' : ''}`} 
                     />
                  ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center text-tech-dim">
                        <Lock size={48} className="mb-2 animate-pulse" />
                        <span className="text-xs">NO_SIGNAL</span>
                     </div>
                  )}
                  {!char.isDead && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-tech-primary/50 shadow-[0_0_10px_#00ff41] animate-[scanline_3s_linear_infinite] pointer-events-none z-30 opacity-50"></div>
                  )}
              </div>

              <div className="mt-4 border border-tech-border bg-black p-4 relative shrink-0">
                <div className="absolute -top-3 left-4 bg-tech-bg px-2 text-tech-primary text-xs">IDENTIFICAÇÃO</div>
                <h1 className={`text-2xl uppercase font-bold tracking-tighter mb-1 text-glow ${char.isDead ? 'text-red-700 decoration-line-through' : 'text-white'}`}>{char.name}</h1>
                {/* Empilhado, não em linha: o título e a patente lado a lado quebravam a três colunas
                    nesta coluna estreita — o Katsuo, com "3º Líder da Ambu" mais um segundo cargo,
                    virava uma escada de duas palavras por linha. */}
                {/* Três linhas rotuladas, e as três dizem coisas diferentes:
                      Título — como o personagem é conhecido (titles[0]).
                      Cargo  — o posto que ele ocupa numa vila ou organização, que é conquistado.
                      Rank   — a escada de ninja, que sai do NC pela `rankDeNC` e não é gravada.
                    Sem o rótulo, "3º Hokage" e "Lenda Shinobi" pareciam a mesma coisa. */}
                <div className="border-b border-tech-border pb-2 mb-2 space-y-1.5">
                    {/* Mesma regra do CARGO e do RANK: sem valor, a linha inteira não existe. Título é
                        honorífico — mostrar "DESCONHECIDO" dava a entender que faltava preencher. */}
                    {char.titles?.[0] && (
                        <p className="text-sm font-bold">
                            <span className="text-tech-primary/50">TÍTULO: </span>
                            <span className="text-tech-secondary">{char.titles[0].toUpperCase()}</span>
                        </p>
                    )}
                    {/* Ficha sem cargo nem patente não mostra nada no lugar — nem o rótulo, nem a
                        linha inteira. */}
                    {/* O CARGO aqui é o posto MAIS ALTO da ficha, pela hierarquia de cada vila e
                        organização — o mesmo critério do card na aba "Todos". Era `patente[0] ||
                        cargo[0]`, ordem de array, e por isso o Tobirama aparecia como "1º Vice Líder
                        da OCA" em vez de "2º Hokage". */}
                    {(maiorPosto(char)?.texto ?? seloDe(char)) && (
                        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-bold">
                            <span className={corDoSelo(char).texto}>
                                <span className="opacity-50">CARGO: </span>{(maiorPosto(char)?.texto ?? seloDe(char)).toUpperCase()}
                            </span>
                            {/* O card mostra só o primeiro cargo; aqui cabe o resto. */}
                            {(char.cargo?.length ?? 0) > 1 && (
                                <span className={`text-xs opacity-60 ${corDoSelo(char).texto}`}>+ {char.cargo!.slice(1).join(" · ").toUpperCase()}</span>
                            )}
                        </p>
                    )}
                    {/* Mesma regra do cargo: NC fora da escada (o Beta e o Hades, em 0) não rende
                        rank nenhum, e aí a linha não existe. */}
                    {rankDeNC(char.nc) && (
                        <p className="text-sm font-bold text-tech-accent">
                            <span className="opacity-50">RANK: </span>{rankDeNC(char.nc).toUpperCase()}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {char.titles.slice(1).map((t, i) => (
                        <span key={i} className="text-[10px] bg-tech-accent/10 text-tech-accent border border-tech-accent/30 px-2 py-0.5">
                            {t.toUpperCase()}
                        </span>
                    ))}
                </div>
                {/* Clã e tags clicáveis (filtram a lista) */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-tech-dim">
                    {char.clan && (
                        <button
                            onClick={() => onFilterClan?.(char.clan)}
                            title={`Filtrar pelo clã ${char.clan}`}
                            className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border border-tech-primary/40 text-tech-primary bg-tech-primary/5 hover:bg-tech-primary hover:text-black transition-colors"
                        >
                            🧬 {char.clan}
                        </button>
                    )}
                    {char.categories.map((cat, i) => (
                        <button
                            key={i}
                            onClick={() => onFilterTag?.(cat)}
                            title={`Filtrar pela tag ${cat}`}
                            // A vila e a organização pintam a própria tag; o resto (#NPC, #Personagem) segue no ciano.
                            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border transition-colors ${(CORES_DE_VILA[cat] ?? CORES_DE_ORG[cat])
                                    ? `${(CORES_DE_VILA[cat] ?? CORES_DE_ORG[cat]).borda} ${(CORES_DE_VILA[cat] ?? CORES_DE_ORG[cat]).texto} ${(CORES_DE_VILA[cat] ?? CORES_DE_ORG[cat]).fundo} hover:brightness-150`
                                    : 'border-tech-secondary/40 text-tech-secondary bg-tech-secondary/5 hover:bg-tech-secondary hover:text-black'
                                }`}
                        >
                            #{cat}
                        </button>
                    ))}
                </div>
              </div>
              
              <div className="mt-4 pt-4 space-y-2 shrink-0">
                 <ResourceBar label="Integridade Física (HP)" value={char.hp} icon={Heart} isDead={char.isDead} />
                 <ResourceBar label="Energia Espiritual (CP)" value={char.chakra} icon={Zap} isDead={char.isDead} />
              </div>

              {char.isDead && (
                <div className="mt-6 border border-red-900/50 bg-red-950/20 p-3 shrink-0 relative animate-pulse">
                    <div className="absolute -top-2 left-2 bg-black px-2 text-[10px] text-red-500 border border-red-900/50 font-bold uppercase tracking-wider">
                        CAUSA MORTIS
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-900/20 border border-red-500/30">
                            <Skull className="text-red-500" size={24} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-red-400/60 uppercase font-bold mb-0.5">MORTO POR:</span>
                            <span className="text-sm text-red-500 font-mono font-bold uppercase tracking-wide text-glow">
                                {char.killedBy || 'DESCONHECIDO'}
                            </span>
                        </div>
                    </div>
                </div>
              )}
           </div>
        </div>

        <div className="flex-1 flex flex-col bg-tech-bg relative overflow-hidden">
            <div className="h-12 bg-tech-panel border-b border-tech-border flex items-center px-4 justify-between">
                {/* min-w-0 + overflow-x-auto: com cinco abas a faixa rola em tela estreita em vez
                    de comprimir os botões ou empurrar os ícones de ação para fora. */}
                <div className="flex items-center gap-4 min-w-0">
                    <Terminal size={14} className="text-tech-primary shrink-0" />
                    {/* min-w-0 + flex-1: a faixa fica com a largura que sobra e rola dentro dela,
                        em vez de empurrar os icones de acao para fora da tela. */}
                    <div className="relative min-w-0 flex-1">
                        {tabSobra.esq && (
                            <>
                                <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-tech-panel to-transparent z-10" />
                                <button
                                    onClick={() => scrollTabs(-1)}
                                    title="Abas anteriores"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center h-6 w-6 bg-tech-panel border border-tech-border text-tech-primary hover:bg-tech-primary hover:text-black transition-colors clip-corner-sm"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                            </>
                        )}
                        <div ref={tabStripRef} onScroll={mediaTabs} className="flex gap-2 overflow-x-auto scrollbar-none">
                            <button
                                onClick={() => goToTab('data')}
                                data-aba-ativa={activeTab === 'data' ? '1' : undefined}
                                className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${activeTab === 'data' ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]' : 'text-tech-primary/50 border-tech-border hover:border-tech-primary/50'}`}
                            >
                                DADOS_GERAIS
                            </button>
                            <button
                                onClick={() => goToTab('techniques')}
                                data-aba-ativa={activeTab === 'techniques' ? '1' : undefined}
                                className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${activeTab === 'techniques' ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]' : 'text-tech-primary/50 border-tech-border hover:border-tech-primary/50'}`}
                            >
                                Jutsus [{allTechniques.length}]
                            </button>
                            {invocacoesTodas.length > 0 && (
                                <button
                                    onClick={() => goToTab('invocacoes')}
                                    data-aba-ativa={activeTab === 'invocacoes' ? '1' : undefined}
                                    className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${activeTab === 'invocacoes' ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]' : 'text-tech-primary/50 border-tech-border hover:border-tech-primary/50'}`}
                                >
                                    Invocações [{invocacoesTodas.length}]
                                </button>
                            )}
                            <button
                                onClick={() => goToTab('arsenal')}
                                data-aba-ativa={activeTab === 'arsenal' ? '1' : undefined}
                                className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${activeTab === 'arsenal' ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]' : 'text-tech-primary/50 border-tech-border hover:border-tech-primary/50'}`}
                            >
                                Arsenal [{characterCurrentSectionArsenal.length}]
                            </button>
                            <button
                                onClick={() => goToTab('gallery')}
                                data-aba-ativa={activeTab === 'gallery' ? '1' : undefined}
                                className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${activeTab === 'gallery' ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]' : 'text-tech-primary/50 border-tech-border hover:border-tech-primary/50'}`}
                            >
                                Linha do Tempo [{eraGallery.length + transformacaoGallery.length}]
                            </button>
                            <button
                                onClick={() => goToTab('eventos')}
                                data-aba-ativa={activeTab === 'eventos' ? '1' : undefined}
                                className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${activeTab === 'eventos' ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]' : 'text-tech-primary/50 border-tech-border hover:border-tech-primary/50'}`}
                            >
                                Eventos [{eventoGallery.length}]
                            </button>
                        </div>
                        {tabSobra.dir && (
                            <>
                                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-tech-panel to-transparent z-10" />
                                <button
                                    onClick={() => scrollTabs(1)}
                                    title="Proximas abas"
                                    className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center h-6 w-6 bg-tech-panel border border-tech-border text-tech-primary hover:bg-tech-primary hover:text-black transition-colors clip-corner-sm"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-tech-primary/30 hidden lg:inline mr-2">SYSTEM_ID: {char.id}</span>
                    <button
                        onClick={() => setForceColor(v => !v)}
                        title="Colorir todas as imagens"
                        className={`border p-1.5 transition-colors uppercase text-xs font-bold tracking-widest flex items-center clip-corner-sm ${forceColor ? 'bg-tech-primary text-black border-tech-primary' : 'bg-tech-primary/10 hover:bg-tech-primary text-tech-primary hover:text-black border-tech-primary'}`}
                    >
                        <Palette size={14} />
                    </button>
                    <button
                        onClick={() => setHideMask(v => !v)}
                        title="Remover máscara das imagens"
                        className={`border p-1.5 transition-colors uppercase text-xs font-bold tracking-widest flex items-center clip-corner-sm ${hideMask ? 'bg-tech-primary text-black border-tech-primary' : 'bg-tech-primary/10 hover:bg-tech-primary text-tech-primary hover:text-black border-tech-primary'}`}
                    >
                        <ScanLine size={14} />
                    </button>
                    <button
                        onClick={copyLink}
                        title="Copiar link da ficha"
                        className="bg-tech-primary/10 hover:bg-tech-primary text-tech-primary hover:text-black border border-tech-primary p-1.5 transition-colors uppercase text-xs font-bold tracking-widest flex items-center clip-corner-sm"
                    >
                        {linkCopied ? <span className="text-[10px]">Copiado!</span> : <Share2 size={14} />}
                    </button>
                    {isAdmin && onEdit && (
                        <button
                            onClick={() => onEdit(char)}
                            title="Editar personagem"
                            className="bg-tech-primary/10 hover:bg-tech-primary text-tech-primary hover:text-black border border-tech-primary p-1.5 transition-colors uppercase text-xs font-bold tracking-widest flex items-center clip-corner-sm"
                        >
                            <Pencil size={14} />
                        </button>
                    )}
                    {isAdmin && onDelete && (
                        <button
                            onClick={async () => {
                                if (confirm(`Excluir "${char.name}" do banco? Esta ação não pode ser desfeita.`)) {
                                    await onDelete(char);
                                }
                            }}
                            title="Excluir personagem"
                            className="bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-black border border-red-600 p-1.5 transition-colors uppercase text-xs font-bold tracking-widest flex items-center clip-corner-sm"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        title="Fechar"
                        className="bg-red-900/20 hover:bg-red-500 text-red-500 hover:text-black border border-red-500 p-1.5 transition-colors uppercase text-xs font-bold tracking-widest flex items-center clip-corner-sm"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 scrollbar-custom">
                {activeTab === 'data' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Altura das três é ditada pela caixa do NC, a única com quatro linhas — as
                            outras duas só esticam pra acompanhar. Encolher o número e o padding daqui
                            encolhe a fileira toda. */}
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            <div className="border border-tech-border px-3 py-2.5 bg-tech-panel/20 text-center">
                                <div className="text-[10px] text-tech-primary/80 font-bold uppercase mb-0.5">Nível de Combate</div>
                                <div className="text-3xl leading-none text-tech-primary font-bold text-glow">{char.nc}</div>
                                {/* Nível de poder: sai do NC pela escada em data/atributos.ts, não é campo gravado.
                                    Precisa de rótulo porque os nomes dos degraus — Chunin, Jonin, Sannin — são os
                                    mesmos dos cargos de mérito de Konoha, e as duas coisas divergem de propósito: o
                                    Kaito é Jonin de Elite de poder e reconhecido como Chunin na Folha. Abaixo de NC 4
                                    não há degrau — hoje só Beta e Hades, com NC 0. */}
                                {rankDeNC(char.nc) && (
                                    <>
                                        <div className="text-[9px] text-tech-primary/50 font-bold uppercase tracking-widest mt-2">Nível de Poder</div>
                                        <div className="text-xs text-tech-accent font-bold uppercase tracking-wide">{rankDeNC(char.nc)}</div>
                                    </>
                                )}
                            </div>
                            <div className="border border-tech-border px-3 py-2.5 bg-tech-panel/20 text-center flex flex-col justify-center">
                                <div className="text-[10px] text-tech-primary/80 font-bold uppercase mb-0.5">Especialização</div>
                                <div className="text-base text-white font-bold">{char.role.toUpperCase()}</div>
                            </div>
                            <div className="border border-tech-border px-3 py-2.5 bg-tech-panel/20 text-center flex flex-col justify-center">
                                <div className="text-[10px] text-tech-primary/80 font-bold uppercase mb-0.5">Afiliação</div>
                                {/* Lia categories[1] por posição no array, o que quebra em quem tem duas vilas
                                    ou nenhuma. Agora lê o campo vila, que existe desde 27/08/2026. */}
                                <div className="text-base text-tech-secondary font-bold">{vilasDe(char).join(' · ') || 'DESCONHECIDO'}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2 border-b border-tech-primary/30 pb-1">
                                    <div className="flex items-center gap-2">
                                        <Shield size={16} className="text-tech-primary" />
                                        <h3 className="text-sm font-bold text-tech-primary uppercase">Atributos</h3>
                                    </div>
                                    <button 
                                        onClick={() => setStatsView(statsView === 'bars' ? 'radar' : 'bars')}
                                        className="text-[10px] bg-tech-primary/10 text-tech-primary border border-tech-primary/30 px-2 py-0.5 hover:bg-tech-primary hover:text-black transition-all uppercase font-bold flex items-center gap-1"
                                    >
                                        <Share2 size={10} />
                                        {statsView === 'bars' ? 'Ver Teia' : 'Ver Barras'}
                                    </button>
                                </div>
                                
                                <div className="h-[280px] overflow-y-auto scrollbar-custom pr-2">
                                    {statsView === 'bars' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {attributesList.map((attr, idx) => (
                                                <AttributeBox key={idx} {...attr} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-tech-panel/20 border border-tech-primary/30 p-2 h-full flex items-center justify-center relative overflow-hidden">
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,65,0.05),transparent)] pointer-events-none"></div>
                                            <Suspense fallback={<div className="text-tech-primary/40 text-xs uppercase tracking-widest">Carregando radar...</div>}>
                                                <AttributeRadar
                                                    labels={attributesList.map(a => a.label)}
                                                    values={radarValues}
                                                />
                                            </Suspense>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2 border-b border-tech-accent/30 pb-1">
                                    <Zap size={16} className="text-tech-accent" />
                                    <h3 className="text-sm font-bold text-tech-accent uppercase">Poderes</h3>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {char.powers.map((power, idx) => {
                                        const isUnknown = power.level === '?' || power.level === '？';
                                        const level = isUnknown ? 0 : Math.min(Math.max(power.level as number, 0), 15);
                                        return (
                                        <div key={idx} className="flex items-center group">
                                            <div className={`w-1 h-6 mr-2 transition-colors ${isUnknown ? 'bg-tech-dim' : 'bg-tech-accent/50 group-hover:bg-tech-accent'}`}></div>
                                            <div className="flex-1 bg-tech-panel/40 p-2 flex items-center justify-between border-b border-tech-dim/30">
                                                <span className={`text-xs uppercase font-bold tracking-tight truncate mr-2 w-32 ${isUnknown ? 'text-tech-dim' : 'text-slate-300'}`}>{power.name}</span>
                                                <div className="flex-1 border-b border-dotted border-tech-dim/50 mx-2 h-1 relative top-[1px]"></div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex gap-[2px]">
                                                        {isUnknown ? (
                                                            <div className="w-20 h-3 bg-tech-dim/10 flex items-center justify-center">
                                                                <span className="text-[8px] text-tech-dim">UNKNOWN</span>
                                                            </div>
                                                        ) : (
                                                            [...Array(15)].map((_, i) => (
                                                                <div key={i} className={`w-1.5 h-3 skew-x-[-10deg] ${i < level ? 'bg-tech-accent shadow-[0_0_5px_rgba(255,176,0,0.5)]' : 'bg-tech-dim/30'}`}></div>
                                                            ))
                                                        )}
                                                    </div>
                                                    <span className={`text-sm font-mono font-bold w-5 text-right tabular-nums ${isUnknown ? 'text-tech-dim' : 'text-tech-accent'}`}>{isUnknown ? '??' : level}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <div className="flex items-center gap-2 mb-2 border-b border-tech-secondary/30 pb-1">
                                <Star size={16} className="text-tech-secondary" />
                                <h3 className="text-sm font-bold text-tech-secondary uppercase">Aptidões</h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {char.aptitudes.map((apt, idx) => (
                                    <div key={idx} className="bg-tech-secondary/10 border border-tech-secondary/30 px-3 py-1 text-xs text-tech-secondary clip-corner-sm">{apt}</div>
                                ))}
                            </div>
                        </div>

                        {/* Description Log */}
                        <div className="mt-8 border border-tech-border p-4 bg-tech-panel/20 font-mono text-xs leading-relaxed text-slate-400 relative">
                            <div className="absolute -top-2 left-4 bg-tech-bg px-2 text-tech-primary text-[10px] border border-tech-border">HISTÓRICO.LOG</div>
                            <Scroll size={14} className="text-tech-primary mb-2" />
                            <p className="whitespace-pre-wrap">{char.description || "ARQUIVO CORROMPIDO OU INEXISTENTE."}</p>
                        </div>
                    </div>
                ) : activeTab === 'techniques' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {selectedTechIndex === null ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                {allTechniques.length > 0 ? (
                                    allTechniques.map((tech, idx) => {
                                        const anel = anelDe(tech.classification, tech.chakraColors);
                                        return (
                                        <div
                                            key={idx}
                                            className="relative aspect-square"
                                            style={anel}
                                        >
                                        {anel && (
                                            <>
                                                <span className="anel-varredura anel-brilho" aria-hidden="true" />
                                                <span className="anel-varredura" aria-hidden="true" />
                                            </>
                                        )}
                                        <button
                                            onClick={() => goToTechnique(idx)}
                                            className={`group absolute border border-tech-border overflow-hidden hover:border-tech-accent transition-all duration-300 ${anel ? 'inset-[2px] cartao-solido' : 'inset-0 bg-tech-panel/40'} ${hideMask ? 'z-[9999]' : 'z-[1]'}`}
                                        >
                                            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.05)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none z-10"></div>
                                            
                                            {/* Threat Status Badge */}
                                            {tech.classification && (
                                                <div className="absolute top-2 left-2 z-30">
                                                    <div className="bg-tech-accent text-black text-[8px] font-black px-1.5 py-0.5 clip-corner-sm shadow-[0_0_10px_rgba(255,176,0,0.3)] border-r-2 border-black/20">
                                                        {tech.classification}
                                                    </div>
                                                </div>
                                            )}

                                            {tech.image ? (
                                                <img
                                                    loading="lazy"
                                                    decoding="async"
                                                    src={formatImageUrl(tech.image)}
                                                    alt={tech.name} 
                                                    className={`w-full h-full object-cover group-hover:scale-110 transition-all duration-500 ${forceColor ? 'opacity-100' : 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100'}`}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-tech-dim">
                                                    <Flame size={32} className="opacity-20" />
                                                </div>
                                            )}

                                            {!hideMask && (
                                                <>
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent pointer-events-none z-20" />
                                                    <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white leading-tight line-clamp-2 text-left pointer-events-none z-20">{tech.name}</span>
                                                </>
                                            )}

                                            <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="bg-tech-accent text-black p-1">
                                                    <ChevronRight size={12} />
                                                </div>
                                            </div>
                                        </button>
                                        </div>
                                        );
                                    })
                                ) : (
                                    <div className="col-span-full h-64 flex flex-col items-center justify-center border border-tech-border border-dashed bg-tech-panel/10">
                                        <AlertTriangle size={32} className="text-tech-dim mb-4" />
                                        <span className="text-xs text-tech-dim uppercase tracking-widest">Nenhuma técnica avançada registrada para este sujeito.</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {(() => {
                                    const tech = allTechniques[selectedTechIndex];
                                    return (
                                        <div className="flex items-center flex-wrap gap-4 mb-4">
                                            <button
                                                onClick={() => goToTab('techniques')}
                                                className="flex items-center gap-2 text-tech-accent hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest group shrink-0"
                                            >
                                                <div className="p-1 border border-tech-accent group-hover:bg-tech-accent group-hover:text-black transition-all">
                                                    <X size={12} className="rotate-90" />
                                                </div>
                                                VOLTAR_PARA_JUTSUS
                                            </button>
                                            {tech && (
                                                <>
                                                    <div className="hidden sm:block h-4 w-px bg-tech-border shrink-0"></div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <div className="p-1.5 bg-tech-accent/20 border border-tech-accent/40 rounded-full">
                                                            <Flame size={18} className="text-tech-accent animate-pulse" />
                                                        </div>
                                                        <h3 className="text-xs font-black text-tech-accent uppercase tracking-[0.4em] drop-shadow-[0_0_8px_rgba(255,176,0,0.5)]">
                                                            {`Registro Técnico // #${selectedTechIndex + 1}`}
                                                        </h3>
                                                    </div>
                                                </>
                                            )}
                                            <div className="h-px bg-gradient-to-r from-tech-accent/40 to-transparent flex-1"></div>
                                        </div>
                                    );
                                })()}

                                {(() => {
                                    const tech = allTechniques[selectedTechIndex];
                                    if (!tech) return null;
                                    return (
                                        <div className="group animate-in fade-in slide-in-from-right-4 duration-500">
                                            {/* Main Technical Frame */}
                                            <div className="relative border border-tech-accent/30 bg-tech-panel/40 p-1 group-hover:border-tech-accent/60 transition-all duration-500 overflow-hidden">
                                                {/* Decorative Brackets */}
                                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-tech-accent"></div>
                                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-tech-accent"></div>
                                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-tech-accent"></div>
                                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-tech-accent"></div>
                                                
                                                {/* Interior Content Grid */}
                                                <div className="bg-black/60 relative">
                                                    {/* Technique Image Banner */}
                                                    {tech.image && (
                                                        <div className={`w-full aspect-video border-b relative overflow-hidden ${hideMask ? 'z-[9999] ' : ''}${char.isDead ? 'border-red-900/50' : 'border-tech-accent/30'}`}>
                                                            <div className="absolute inset-0 bg-[linear-gradient(transparent_60%,rgba(0,0,0,0.8))] z-10 pointer-events-none"></div>
                                                            <img 
                                                                src={formatImageUrl(tech.image)} 
                                                                alt={tech.name} 
                                                                className={`w-full h-full object-cover transition-all duration-1000 scale-105 group-hover:scale-100 ${char.isDead ? 'opacity-90 group-hover:opacity-100' : forceColor ? 'opacity-100' : 'grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100'}`}
                                                            />
                                                            <div className="absolute top-4 left-4 z-20 flex gap-2">
                                                                <span className={`text-[8px] font-black px-2 py-0.5 border clip-corner-sm ${char.isDead ? 'bg-black/80 text-red-500 border-red-900/50' : 'bg-black/80 text-tech-accent border-tech-accent/30'}`}>TECH_VISUAL_{selectedTechIndex + 1}</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="p-5 md:p-8 space-y-6 relative">
                                                        {/* HUD Scanlines */}
                                                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,176,0,0.02)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none opacity-50"></div>

                                                        {/* Top Header: Name & Classification */}
                                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-tech-accent/20 pb-6 relative">
                                                            <div className="space-y-1.5 flex-1 pr-2">
                                                                <span className="text-[9px] font-black text-tech-accent/50 uppercase tracking-widest flex items-center gap-2">
                                                                    <Binary size={10} /> Identificador Único
                                                                </span>
                                                                <h4 className="text-xl md:text-3xl font-black text-white uppercase tracking-tighter leading-tight text-glow italic break-words">
                                                                    {tech.name}
                                                                </h4>
                                                            </div>
                                                            
                                                            {tech.classification && (
                                                                <div className="flex flex-col items-start md:items-end shrink-0 min-w-[120px]">
                                                                    <span className="text-[8px] text-tech-accent/40 font-bold uppercase mb-1.5 tracking-wider">Status de Ameaça</span>
                                                                    <div className="relative group/status">
                                                                        <div className="bg-tech-accent text-black px-5 py-2 text-base font-black uppercase shadow-[0_0_20px_rgba(255,176,0,0.3)] clip-corner-sm border-r-4 border-black/20 flex items-center justify-center min-w-[60px]">
                                                                            {tech.classification}
                                                                        </div>
                                                                        <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                                                                            <div className="w-1 h-3 bg-tech-accent/40"></div>
                                                                            <div className="w-1 h-3 bg-tech-accent/40"></div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Natureza: é rótulo, não texto — vale uma linha, não um cartão */}
                                                        {tech.nature && (
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <Zap size={12} className="text-tech-accent shrink-0" />
                                                                {tech.nature.split('+').map((n, i) => (
                                                                    <span key={i} className="text-[10px] font-mono uppercase tracking-wider text-tech-accent border border-tech-accent/30 bg-tech-accent/5 px-2 py-0.5">
                                                                        {n.trim()}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* A leitura principal: o que a técnica faz. Sem justificar — a 11px
                                                            justificado, os nomes longos em japonês abriam rios de espaço. */}
                                                        {tech.description && (
                                                            <p className="text-[13.5px] text-slate-200 leading-[1.8] max-w-[70ch] first-letter:text-2xl first-letter:font-black first-letter:text-tech-accent first-letter:mr-1.5 first-letter:float-left first-letter:leading-none first-letter:mt-1">
                                                                {tech.description}
                                                            </p>
                                                        )}

                                                        {/* Escala, protocolo e histórico são consulta, não leitura corrida */}
                                                        {(tech.destruction || tech.status || tech.history) && (
                                                            <div className="border-t border-tech-border pt-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setDetalheTech(v => !v)}
                                                                    aria-expanded={detalheTech}
                                                                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-tech-accent/70 hover:text-tech-accent transition-colors"
                                                                >
                                                                    <ChevronDown size={13} className={`transition-transform ${detalheTech ? 'rotate-180' : ''}`} />
                                                                    {detalheTech ? 'Ocultar' : 'Escala, protocolo e histórico'}
                                                                </button>

                                                                {detalheTech && (
                                                                    <div className="mt-3 space-y-3">
                                                                        {tech.destruction && (
                                                                            <div className="border-l-2 border-red-500/40 pl-3">
                                                                                <span className="text-[9px] text-red-500 font-black uppercase tracking-widest flex items-center gap-1.5 mb-1">
                                                                                    <AlertTriangle size={11} /> Escala de Destruição
                                                                                </span>
                                                                                <p className="text-[12px] text-slate-300 leading-relaxed max-w-[70ch]">{tech.destruction}</p>
                                                                            </div>
                                                                        )}
                                                                        {tech.status && (
                                                                            <div className="border-l-2 border-tech-accent/40 pl-3">
                                                                                <span className="text-[9px] text-tech-accent font-black uppercase tracking-widest flex items-center gap-1.5 mb-1">
                                                                                    <Lock size={11} /> Protocolo de Utilização
                                                                                </span>
                                                                                <p className="text-[12px] text-slate-300 leading-relaxed max-w-[70ch]">{tech.status}</p>
                                                                            </div>
                                                                        )}
                                                                        {tech.history && (
                                                                            <div className="border-l-2 border-tech-dim pl-3">
                                                                                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5 mb-1">
                                                                                    <Fingerprint size={11} /> Origem
                                                                                </span>
                                                                                <p className="text-[12px] text-slate-400 italic leading-relaxed max-w-[70ch]">{tech.history}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                ) : activeTab === 'invocacoes' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {selectedInvocacaoIndex === null ? (
                            (() => {
                                // 4:3 porque é o formato real das duas artes — recortar em quadrado
                                // como o arsenal faz jogaria fora um quarto do desenho.
                                const renderInvocacaoCard = (inv: typeof invocacoesTodas[number], idx: number, dimmed?: boolean) => (
                                    <div key={inv.nome} className={`transition-opacity duration-300 ${dimmed ? 'opacity-70 hover:opacity-100' : ''}`}>
                                        <button
                                            key={inv.nome}
                                            onClick={() => goToInvocacao(idx)}
                                            className="group relative aspect-[4/3] border border-tech-border bg-tech-panel/40 overflow-hidden hover:border-tech-accent transition-all duration-300 text-left"
                                        >
                                            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.05)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none z-10"></div>

                                            {inv.rank && (
                                                <div className="absolute top-2 left-2 z-30">
                                                    <div className="bg-tech-accent text-black text-[8px] font-black px-1.5 py-0.5 clip-corner-sm shadow-[0_0_10px_rgba(255,176,0,0.3)] border-r-2 border-black/20">
                                                        {inv.rank}
                                                    </div>
                                                </div>
                                            )}

                                            {inv.capaUrl && !inv.placeholder ? (
                                                <img
                                                    loading="lazy"
                                                    decoding="async"
                                                    src={formatImageUrl(inv.capaUrl)}
                                                    alt={inv.nome}
                                                    className={`w-full h-full object-cover group-hover:scale-110 transition-all duration-500 ${forceColor ? 'opacity-100' : 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100'}`}
                                                />
                                            ) : (
                                                /* placeholder é página em branco: mostrar a imagem seria
                                                   fingir que a arte existe */
                                                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-tech-dim">
                                                    <Sparkles size={26} className="opacity-20" />
                                                    <span className="text-[8px] uppercase tracking-widest text-tech-primary/25">arte pendente</span>
                                                </div>
                                            )}

                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent pointer-events-none z-20" />
                                            <span className="absolute bottom-1 left-1.5 right-1.5 text-[10px] text-white leading-tight line-clamp-2 pointer-events-none z-20">{inv.nome}</span>

                                            <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="bg-tech-accent text-black p-1">
                                                    <ChevronRight size={12} />
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                );
                                return (
                                    <div className="space-y-8">
                                        {(characterInvocacoes.length > 0 || !invocacoesPassadas.length) && (
                                        <div>
                                            <h3 className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 text-tech-accent">
                                                {char.isDead ? 'Invocava' : 'Invoca hoje'}
                                                <span className="h-px flex-1 bg-tech-border"></span>
                                                <span className="text-tech-primary/30">{characterInvocacoes.length}</span>
                                            </h3>
                                            {characterInvocacoes.length > 0 ? (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                                    {characterInvocacoes.map((inv, idx) => renderInvocacaoCard(inv, idx))}
                                                </div>
                                            ) : (
                                                <div className="h-40 flex flex-col items-center justify-center border border-tech-border border-dashed bg-tech-panel/10">
                                                    <Sparkles size={26} className="text-tech-primary/15 mb-3" />
                                                    <span className="text-[10px] text-tech-primary/30 uppercase tracking-widest">nenhuma invocação atual</span>
                                                </div>
                                            )}
                                        </div>
                                        )}

                                        {invocacoesPassadas.length > 0 && (
                                            <div>
                                                <h3 className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 text-yellow-500">
                                                    Já invocou
                                                    <span className="h-px flex-1 bg-tech-border"></span>
                                                    <span className="text-tech-primary/30">{invocacoesPassadas.length}</span>
                                                </h3>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                                    {invocacoesPassadas.map((inv, i) =>
                                                        renderInvocacaoCard(inv, characterInvocacoes.length + i, true))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()
                        ) : (
                            (() => {
                                const inv = invocacoesTodas[selectedInvocacaoIndex];
                                // a arte cheia é o que faz sentido na tela aberta; a capa é o recorte de card
                                const imagem = inv.arteUrl || inv.capaUrl;
                                return (
                                    <div className="animate-in fade-in duration-300">
                                        <button
                                            onClick={() => goToTab('invocacoes')}
                                            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-tech-primary/50 hover:text-tech-primary transition-colors mb-4"
                                        >
                                            <ChevronLeft size={12} /> voltar às invocações
                                        </button>
                                        <div className="flex items-baseline gap-3 flex-wrap mb-3">
                                            <h3 className="text-xl font-black text-white uppercase tracking-wide">{inv.nome}</h3>
                                            {inv.rank && (
                                                <span className="bg-tech-accent text-black text-[9px] font-black px-2 py-0.5 clip-corner-sm">{inv.rank}</span>
                                            )}
                                            {inv.placeholder && (
                                                <span className="text-[9px] font-black uppercase tracking-widest text-tech-primary/30 border border-tech-primary/30 px-2 py-0.5">arte pendente</span>
                                            )}
                                        </div>
                                        {(() => {
                                          // `originalOwner` ausente = quem invoca hoje e tambem o
                                          // original, e ai nao ha cadeia nenhuma para mostrar.
                                          if (!inv.originalOwner && !(inv.pastOwners ?? []).length && !inv.nomeAntigo) return null;
                                          const atual = char.name.trim().toLowerCase();
                                          // mesma regra do arsenal: o original tambem conta como
                                          // antigo, desde que nao seja quem invoca hoje
                                          const antigos = [
                                            ...(inv.originalOwner && inv.originalOwner.trim().toLowerCase() !== atual ? [inv.originalOwner] : []),
                                            ...(inv.pastOwners ?? []),
                                          ];
                                          const chip = (nome: string, k: React.Key, cor: string, borda: string, fundo: string) => (
                                            <span key={k} className={`px-2 py-0.5 text-[11px] font-mono ${cor} border ${borda} ${fundo}`}>{nome}</span>
                                          );
                                          return (
                                            <div className="flex flex-col gap-2 mb-3">
                                              {inv.nomeAntigo && (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <span className="text-[10px] font-black uppercase tracking-wider text-tech-primary/50 flex items-center gap-1.5">
                                                    <ScanLine size={12} /> Antes chamado de
                                                  </span>
                                                  {chip(inv.nomeAntigo, 'antigo', 'text-tech-primary/80', 'border-tech-border', 'bg-tech-panel/30')}
                                                </div>
                                              )}
                                              {antigos.length > 0 && (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <span className="text-[10px] font-black uppercase tracking-wider text-yellow-500 flex items-center gap-1.5">
                                                    <History size={12} /> Invocadores Passados
                                                  </span>
                                                  {antigos.map((n, k) => chip(n, k, 'text-yellow-400', 'border-yellow-500/40', 'bg-yellow-500/5'))}
                                                </div>
                                              )}
                                              {inv.originalOwner && (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                                                    <Hexagon size={12} /> Invocador Original
                                                  </span>
                                                  {chip(inv.originalOwner, 'orig', 'text-sky-400', 'border-sky-500/40', 'bg-sky-500/5')}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })()}
                                        {imagem && !inv.placeholder ? (
                                            <div className="border border-tech-border bg-black overflow-hidden">
                                                <img
                                                    src={formatImageUrl(imagem)}
                                                    alt={inv.nome}
                                                    className="w-full h-auto"
                                                />
                                            </div>
                                        ) : (
                                            <div className="border border-tech-border bg-tech-panel/20 aspect-[4/3] flex flex-col items-center justify-center gap-2">
                                                <Sparkles size={32} className="text-tech-primary/15" />
                                                <span className="text-[10px] uppercase tracking-widest text-tech-primary/30">a arte desta invocação ainda não foi feita</span>
                                            </div>
                                        )}

                                        {inv.hierarquia && (
                                          <p className="text-[11px] uppercase tracking-widest text-tech-accent/80 mt-1">{inv.hierarquia}</p>
                                        )}

                                        {(inv.familia || inv.nature || inv.village) && (
                                          <div className="flex gap-6 flex-wrap mt-4">
                                            {inv.familia && (
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] uppercase tracking-widest text-tech-primary/50">Família</span>
                                                <span className="text-sm text-slate-200">{inv.familia}</span>
                                              </div>
                                            )}
                                            {inv.nature && (
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] uppercase tracking-widest text-tech-primary/50">Natureza</span>
                                                <span className="text-sm text-slate-200">{inv.nature}</span>
                                              </div>
                                            )}
                                            {inv.village && (
                                              <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] uppercase tracking-widest text-tech-primary/50">Vila</span>
                                                <span className="text-sm text-slate-200">{inv.village}</span>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {inv.descricao && (
                                          <div className="mt-4 flex flex-col gap-1.5">
                                            <span className="text-[10px] uppercase tracking-widest text-tech-primary/50">Descrição</span>
                                            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{inv.descricao}</p>
                                          </div>
                                        )}

                                        {(inv.habilidades?.length || inv.habilidadeSuprema) && (
                                          <div className="mt-4 flex flex-col gap-2.5">
                                            {(inv.habilidades ?? []).map((h, k, todas) => (
                                              <div key={k} className="border-l-2 border-tech-primary/50 pl-3 flex flex-col gap-1">
                                                <span className="text-[10px] uppercase tracking-widest text-tech-primary/60">
                                                  Habilidade{todas.length > 1 ? ` ${k + 1}` : ''}
                                                </span>
                                                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{h}</p>
                                              </div>
                                            ))}
                                            {/* Uma só por invocação, e o âmbar é o que diz isso. */}
                                            {inv.habilidadeSuprema && (
                                              <div className="border-l-2 border-tech-accent pl-3 py-1 flex flex-col gap-1 bg-tech-accent/[0.04]">
                                                <span className="text-[10px] uppercase tracking-widest text-tech-accent">Habilidade Suprema</span>
                                                <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-line">{inv.habilidadeSuprema}</p>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                    </div>
                                );
                            })()
                        )}
                    </div>
                ) : activeTab === 'arsenal' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {selectedWeaponIndex === null ? (
                            (() => {
                                const renderWeaponCard = (weapon: typeof characterArsenal[number], idx: number, dimmed?: boolean) => {
                                    const anel = anelDe(weapon.classification);
                                    return (
                                    <div
                                        key={idx}
                                        // o esmaecido de "já utilizou" fica no invólucro, não no botão:
                                        // o anel é irmão do botão e ficaria a 100% enquanto a arte cai a 70%
                                        className={`relative aspect-square transition-opacity duration-300 ${dimmed ? 'opacity-70 hover:opacity-100' : ''}`}
                                        style={anel}
                                    >
                                    {anel && (
                                        <>
                                            <span className="anel-varredura anel-brilho" aria-hidden="true" />
                                            <span className="anel-varredura" aria-hidden="true" />
                                        </>
                                    )}
                                    <button
                                        onClick={() => goToWeapon(idx)}
                                        className={`group absolute border border-tech-border overflow-hidden hover:border-tech-accent transition-all duration-300 ${anel ? 'inset-[2px] cartao-solido' : 'inset-0 bg-tech-panel/40'} ${hideMask ? 'z-[9999]' : 'z-[1]'}`}
                                    >
                                        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.05)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none z-10"></div>

                                        {weapon.classification && (
                                            <div className="absolute top-2 left-2 z-30">
                                                <div className="bg-tech-accent text-black text-[8px] font-black px-1.5 py-0.5 clip-corner-sm shadow-[0_0_10px_rgba(255,176,0,0.3)] border-r-2 border-black/20">
                                                    {weapon.classification}
                                                </div>
                                            </div>
                                        )}

                                        {weapon.image ? (
                                            <img
                                                loading="lazy"
                                                decoding="async"
                                                src={formatImageUrl(weapon.image)}
                                                alt={weapon.name}
                                                className={`w-full h-full object-cover group-hover:scale-110 transition-all duration-500 ${forceColor ? 'opacity-100' : 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100'}`}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-tech-dim">
                                                <Backpack size={32} className="opacity-20" />
                                            </div>
                                        )}

                                        {!hideMask && (
                                            <>
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent pointer-events-none z-20" />
                                                <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white leading-tight line-clamp-2 text-left pointer-events-none z-20">{weapon.name}</span>
                                            </>
                                        )}

                                        <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="bg-tech-accent text-black p-1">
                                                <ChevronRight size={12} />
                                            </div>
                                        </div>
                                    </button>
                                    </div>
                                    );
                                };

                                return (
                                    <div className="space-y-8">
                                        <div>
                                            <h3 className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${char.isDead ? 'text-red-500' : 'text-tech-accent'}`}>
                                                {char.isDead ? 'Morreu em posse' : 'Em posse atual'}
                                                <span className="h-px flex-1 bg-tech-border"></span>
                                            </h3>
                                            {characterCurrentSectionArsenal.length > 0 ? (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                                    {characterCurrentSectionArsenal.map((weapon, idx) => renderWeaponCard(weapon, idx))}
                                                </div>
                                            ) : (
                                                <div className="h-64 flex flex-col items-center justify-center border border-tech-border border-dashed bg-tech-panel/10">
                                                    <AlertTriangle size={32} className="text-tech-dim mb-4" />
                                                    <span className="text-xs text-tech-dim uppercase tracking-widest">Nenhum armamento registrado para este sujeito.</span>
                                                </div>
                                            )}
                                        </div>

                                        {characterPastArsenal.length > 0 && (
                                            <div>
                                                <h3 className="text-[10px] font-black text-tech-primary/50 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    Já utilizou
                                                    <span className="h-px flex-1 bg-tech-border"></span>
                                                </h3>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                                    {characterPastArsenal.map((weapon, i) => renderWeaponCard(weapon, characterCurrentSectionArsenal.length + i, true))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="space-y-6">
                                {(() => {
                                    const weapon = characterArsenalAll[selectedWeaponIndex];
                                    return (
                                        <div className="flex items-center flex-wrap gap-4 mb-4">
                                            <button
                                                onClick={() => goToTab('arsenal')}
                                                className="flex items-center gap-2 text-tech-accent hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest group shrink-0"
                                            >
                                                <div className="p-1 border border-tech-accent group-hover:bg-tech-accent group-hover:text-black transition-all">
                                                    <X size={12} className="rotate-90" />
                                                </div>
                                                VOLTAR_PARA_ARSENAL
                                            </button>
                                            {weapon && (
                                                <>
                                                    <div className="hidden sm:block h-4 w-px bg-tech-border shrink-0"></div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <div className="p-1.5 bg-tech-accent/20 border border-tech-accent/40 rounded-full">
                                                            <Backpack size={18} className="text-tech-accent animate-pulse" />
                                                        </div>
                                                        <h3 className="text-xs font-black text-tech-accent uppercase tracking-[0.4em] drop-shadow-[0_0_8px_rgba(255,176,0,0.5)]">
                                                            Registro de Armamento // #{selectedWeaponIndex + 1}
                                                        </h3>
                                                    </div>
                                                </>
                                            )}
                                            <div className="h-px bg-gradient-to-r from-tech-accent/40 to-transparent flex-1"></div>
                                        </div>
                                    );
                                })()}

                                {(() => {
                                    const weapon = characterArsenalAll[selectedWeaponIndex];
                                    if (!weapon) return null;
                                    return (
                                        <div className="group animate-in fade-in slide-in-from-right-4 duration-500">

                                            <div className="relative border border-tech-accent/30 bg-tech-panel/40 p-1 group-hover:border-tech-accent/60 transition-all duration-500 overflow-hidden">
                                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-tech-accent"></div>
                                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-tech-accent"></div>
                                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-tech-accent"></div>
                                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-tech-accent"></div>
                                                
                                                <div className="bg-black/60 relative p-6 md:p-10">
                                                    {/* Header: Name & Classification */}
                                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-tech-accent/20 pb-8 mb-8 relative">
                                                        <div className="space-y-2 flex-1">
                                                            <span className="text-[10px] font-black text-tech-accent/50 uppercase tracking-[0.3em] flex items-center gap-2">
                                                                <Binary size={12} /> Registro de Arsenal // #{selectedWeaponIndex + 1}
                                                            </span>
                                                            <h4 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter leading-tight text-glow italic">
                                                                {weapon.name}
                                                            </h4>
                                                        </div>
                                                        
                                                        <div className="flex flex-col items-start md:items-end shrink-0">
                                                            <span className="text-[8px] text-tech-accent/40 font-bold uppercase mb-2 tracking-wider">Classificação de Poder</span>
                                                            <div className="bg-tech-accent text-black px-6 py-2 text-xl font-black uppercase shadow-[0_0_25px_rgba(255,176,0,0.4)] clip-corner-sm border-r-4 border-black/20">
                                                                {weapon.classification || 'N/A'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                                                        {/* Left Column: 1080x1080 Image Frame */}
                                                        {weapon.image && (
                                                            <div className="lg:col-span-5 space-y-4">
                                                                <div className={`relative aspect-square border bg-tech-panel/20 p-1 transition-all duration-500 overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] ${hideMask ? 'z-[9999] ' : ''}${char.isDead ? 'border-red-600/50 group-hover:border-red-500' : 'border-tech-accent/30 group-hover:border-tech-accent/60'}`}>
                                                                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,176,0,0.03)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none z-20"></div>
                                                                    <img 
                                                                        src={formatImageUrl(weapon.image)} 
                                                                        alt={weapon.name} 
                                                                        width={1080}
                                                                        height={1080}
                                                                        className={`w-full h-full object-contain transition-all duration-700 ${char.isDead ? 'opacity-90 group-hover:opacity-100' : forceColor ? 'opacity-100' : 'grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100'}`}
                                                                    />
                                                                    <div className="absolute bottom-4 left-4 z-30">
                                                                        <span className={`text-[8px] font-black px-2 py-1 border clip-corner-sm uppercase tracking-widest ${char.isDead ? 'bg-black/80 text-red-500 border-red-900/50' : 'bg-black/80 text-tech-accent border-tech-accent/30'}`}>Visual_Data_1080p</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Right Column: Technical Specs & Description */}
                                                        <div className={`${weapon.image ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-8`}>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                {weapon.origin && (
                                                                    <div className="space-y-2 p-4 bg-white/5 border-l-2 border-tech-primary/40">
                                                                        <span className="text-[10px] text-tech-primary font-black uppercase flex items-center gap-2 tracking-wider">
                                                                            <Globe size={14} /> Origem
                                                                        </span>
                                                                        <p className="text-xs text-slate-200 font-mono leading-relaxed">
                                                                            {weapon.origin}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {weapon.nature && (
                                                                    <div className="space-y-2 p-4 bg-white/5 border-l-2 border-tech-accent/40">
                                                                        <span className="text-[10px] text-tech-accent font-black uppercase flex items-center gap-2 tracking-wider">
                                                                            <Zap size={14} /> Propriedades
                                                                        </span>
                                                                        <p className="text-xs text-slate-200 font-mono leading-relaxed">
                                                                            {weapon.nature}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {weapon.description && (
                                                                <div className="relative group/desc">
                                                                    <div className="absolute -top-2 left-4 bg-black px-2 text-[9px] font-black text-tech-accent/60 border border-tech-accent/20 z-20">
                                                                        ESPECIFICAÇÕES_DO_JUTSU
                                                                    </div>
                                                                    <div className="bg-tech-panel/60 border border-tech-accent/10 p-5 pt-6 group-hover/desc:border-tech-accent/30 transition-colors">
                                                                        <p className="text-[12px] text-slate-300 font-mono leading-relaxed text-justify">
                                                                            {weapon.description}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}

                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {selectedGalleryIndex === null ? (
                            <div className="space-y-10">
                                {activeTab === 'gallery' && eraGallery.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-3 mb-4">
                                            <h3 className="text-xs font-bold text-black bg-tech-accent p-1 pl-2 uppercase clip-corner-sm">Linha do Tempo</h3>
                                            <span className="h-px flex-1 bg-tech-border"></span>
                                        </div>
                                        <div className="relative group/strip">
                                            <button
                                                type="button"
                                                onClick={() => scrollEraStrip(-1)}
                                                className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-40 items-center justify-center w-8 h-8 -ml-3 bg-black/90 border border-tech-accent text-tech-accent hover:bg-tech-accent hover:text-black transition-colors opacity-0 group-hover/strip:opacity-100"
                                                title="Voltar"
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            <div ref={eraStripRef} className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-custom scroll-smooth">
                                                {eraGallery.map(({ img, idx }, i) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => goToGalleryImage(idx)}
                                                        className={`group relative shrink-0 w-40 sm:w-48 aspect-[2/3] border border-tech-border bg-tech-panel/40 overflow-hidden hover:border-tech-accent transition-all duration-300 snap-start ${hideMask ? 'z-[9999]' : ''}`}
                                                    >
                                                        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.05)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none z-10"></div>
                                                        <div className="absolute top-2 left-2 z-30 bg-tech-accent text-black text-[8px] font-black w-5 h-5 flex items-center justify-center clip-corner-sm">
                                                            {i + 1}
                                                        </div>
                                                        <img
                                                            loading="lazy"
                                                            decoding="async"
                                                            src={formatImageUrl(img.url)}
                                                            alt={img.caption || char.name}
                                                            className={`w-full h-full object-cover transition-all duration-500 ${forceColor ? 'opacity-100' : 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100'}`}
                                                        />
                                                        {!hideMask && img.caption && (
                                                            <>
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent pointer-events-none z-20" />
                                                                <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white leading-tight line-clamp-2 text-left pointer-events-none z-20">{img.caption}</span>
                                                            </>
                                                        )}
                                                        {i < eraGallery.length - 1 && (
                                                            <div className="hidden sm:block absolute top-1/2 -right-3 -translate-y-1/2 w-3 h-px bg-tech-accent/40 z-30"></div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => scrollEraStrip(1)}
                                                className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-40 items-center justify-center w-8 h-8 -mr-3 bg-black/90 border border-tech-accent text-tech-accent hover:bg-tech-accent hover:text-black transition-colors opacity-0 group-hover/strip:opacity-100"
                                                title="Avançar"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Modos e Transformações: mesma tira da Linha do Tempo, logo abaixo dela.
                                    É uma lista aberta (o personagem ganha modo novo quando ganha), não um
                                    conjunto fechado de fases — por isso seção própria e não mais fases
                                    avulsas dentro da Linha do Tempo. */}
                                {activeTab === 'gallery' && transformacaoGallery.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-3 mb-4">
                                            <h3 className="text-xs font-bold text-black bg-tech-accent p-1 pl-2 uppercase clip-corner-sm">Modos e Transformações</h3>
                                            <span className="h-px flex-1 bg-tech-border"></span>
                                        </div>
                                        <div className="relative group/strip">
                                            <button
                                                type="button"
                                                onClick={() => scrollStrip(modoStripRef, -1)}
                                                className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-40 items-center justify-center w-8 h-8 -ml-3 bg-black/90 border border-tech-accent text-tech-accent hover:bg-tech-accent hover:text-black transition-colors opacity-0 group-hover/strip:opacity-100"
                                                title="Voltar"
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            <div ref={modoStripRef} className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-custom scroll-smooth">
                                                {transformacaoGallery.map(({ img, idx }, i) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => goToGalleryImage(idx)}
                                                        className={`group relative shrink-0 w-40 sm:w-48 aspect-[2/3] border border-tech-border bg-tech-panel/40 overflow-hidden hover:border-tech-accent transition-all duration-300 snap-start ${hideMask ? 'z-[9999]' : ''}`}
                                                    >
                                                        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.05)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none z-10"></div>
                                                        <div className="absolute top-2 left-2 z-30 bg-tech-accent text-black text-[8px] font-black w-5 h-5 flex items-center justify-center clip-corner-sm">
                                                            {i + 1}
                                                        </div>
                                                        <img
                                                            loading="lazy"
                                                            decoding="async"
                                                            src={formatImageUrl(img.url)}
                                                            alt={img.caption || char.name}
                                                            className={`w-full h-full object-cover transition-all duration-500 ${forceColor ? 'opacity-100' : 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100'}`}
                                                        />
                                                        {!hideMask && img.caption && (
                                                            <>
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent pointer-events-none z-20" />
                                                                <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white leading-tight line-clamp-2 text-left pointer-events-none z-20">{img.caption}</span>
                                                            </>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => scrollStrip(modoStripRef, 1)}
                                                className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-40 items-center justify-center w-8 h-8 -mr-3 bg-black/90 border border-tech-accent text-tech-accent hover:bg-tech-accent hover:text-black transition-colors opacity-0 group-hover/strip:opacity-100"
                                                title="Avançar"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'eventos' && eventoGallery.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-3 mb-4">
                                            <h3 className="text-xs font-bold text-black bg-tech-accent p-1 pl-2 uppercase clip-corner-sm">Eventos</h3>
                                            <span className="h-px flex-1 bg-tech-border"></span>
                                            <div className="flex gap-1.5 shrink-0">
                                                <button
                                                    onClick={() => setEventosViewMode('completa')}
                                                    className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border transition-all ${eventosViewMode === 'completa' ? 'bg-tech-accent text-black border-tech-accent' : 'text-tech-accent/50 border-tech-border hover:border-tech-accent/50'}`}
                                                >
                                                    Completa
                                                </button>
                                                <button
                                                    onClick={() => setEventosViewMode('temporada')}
                                                    className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border transition-all ${eventosViewMode === 'temporada' ? 'bg-tech-accent text-black border-tech-accent' : 'text-tech-accent/50 border-tech-border hover:border-tech-accent/50'}`}
                                                >
                                                    Temporada
                                                </button>
                                            </div>
                                        </div>

                                        {eventosViewMode === 'completa' ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                                {eventoGallery.map(({ img, idx }) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => goToGalleryImage(idx)}
                                                        className={`group relative aspect-video border border-tech-border bg-tech-panel/40 overflow-hidden hover:border-tech-accent transition-all duration-300 ${hideMask ? 'z-[9999]' : ''}`}
                                                    >
                                                        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.05)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none z-10"></div>
                                                        <img
                                                            loading="lazy"
                                                            decoding="async"
                                                            src={formatImageUrl(img.url)}
                                                            alt={img.caption || char.name}
                                                            className={`w-full h-full object-cover transition-all duration-500 ${forceColor ? 'opacity-100' : 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100'}`}
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {eventosBySeason.map(({ season, items }) => {
                                                    const isOpen = expandedSeasons.has(season);
                                                    return (
                                                        <div key={season} className="border border-tech-border bg-tech-panel/20">
                                                            <button
                                                                onClick={() => toggleSeason(season)}
                                                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-tech-accent/10 transition-colors"
                                                            >
                                                                <span className="text-[11px] font-black text-tech-accent uppercase tracking-widest">
                                                                    {season} <span className="text-tech-primary/40 font-normal">[{items.length}]</span>
                                                                </span>
                                                                <ChevronDown size={14} className={`text-tech-accent transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                                            </button>
                                                            {isOpen && (
                                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-4 pt-0">
                                                                    {items.map(({ img, idx }) => (
                                                                        <button
                                                                            key={idx}
                                                                            onClick={() => goToGalleryImage(idx)}
                                                                            className={`group relative aspect-video border border-tech-border bg-tech-panel/40 overflow-hidden hover:border-tech-accent transition-all duration-300 ${hideMask ? 'z-[9999]' : ''}`}
                                                                        >
                                                                            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.05)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none z-10"></div>
                                                                            <img
                                                                                loading="lazy"
                                                                                decoding="async"
                                                                                src={formatImageUrl(img.url)}
                                                                                alt={img.caption || char.name}
                                                                                className={`w-full h-full object-cover transition-all duration-500 ${forceColor ? 'opacity-100' : 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100'}`}
                                                                            />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'gallery' && eraGallery.length === 0 && transformacaoGallery.length === 0 && (
                                    <div className="h-64 flex flex-col items-center justify-center border border-tech-border border-dashed bg-tech-panel/10">
                                        <ImageIcon size={32} className="text-tech-dim mb-4" />
                                        <span className="text-xs text-tech-dim uppercase tracking-widest">Nenhuma imagem na linha do tempo.</span>
                                    </div>
                                )}

                                {activeTab === 'eventos' && eventoGallery.length === 0 && (
                                    <div className="h-64 flex flex-col items-center justify-center border border-tech-border border-dashed bg-tech-panel/10">
                                        <ImageIcon size={32} className="text-tech-dim mb-4" />
                                        <span className="text-xs text-tech-dim uppercase tracking-widest">Nenhum evento registrado.</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <button
                                    onClick={() => goToTab(activeTab === 'eventos' ? 'eventos' : 'gallery')}
                                    className="flex items-center gap-2 text-tech-accent hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest mb-4 group"
                                >
                                    <div className="p-1 border border-tech-accent group-hover:bg-tech-accent group-hover:text-black transition-all">
                                        <X size={12} className="rotate-90" />
                                    </div>
                                    {activeTab === 'eventos' ? 'VOLTAR_PARA_EVENTOS' : 'VOLTAR_PARA_LINHA_DO_TEMPO'}
                                </button>
                                {(() => {
                                    const img = characterGallery[selectedGalleryIndex];
                                    if (!img) return null;
                                    return (
                                        <div className="group animate-in fade-in slide-in-from-right-4 duration-500">
                                            <div className="relative border border-tech-accent/30 bg-tech-panel/40 p-1 overflow-hidden">
                                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-tech-accent"></div>
                                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-tech-accent"></div>
                                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-tech-accent"></div>
                                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-tech-accent"></div>
                                                <div className="bg-black/60 relative">
                                                    <div className={`relative overflow-hidden mx-auto ${hideMask ? 'z-[9999] ' : ''}${img.category === 'era' ? 'aspect-[2/3] max-h-[75vh] w-auto' : 'w-full aspect-video'}`}>
                                                        <img src={formatImageUrl(img.url)} alt={img.caption || char.name} className="w-full h-full object-contain" />
                                                        <div className="absolute top-4 left-4 z-20">
                                                            <span className="text-[8px] font-black px-2 py-0.5 border clip-corner-sm bg-black/80 text-tech-accent border-tech-accent/30 uppercase">
                                                                {img.category}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {img.caption && (
                                                        <div className="p-5 md:p-8">
                                                            <span className="text-[9px] font-black text-tech-accent/50 uppercase tracking-widest flex items-center gap-2 mb-2">
                                                                <Binary size={10} /> Legenda
                                                            </span>
                                                            <p className="text-sm text-slate-200 font-mono leading-relaxed">{img.caption}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="h-6 bg-tech-panel border-t border-tech-border flex justify-between items-center px-4 text-[10px] text-tech-dim uppercase">
                <span>MEM: 64KB OK</span>
                <span className={`animate-pulse ${char.isDead ? 'text-red-500' : ''}`}>
                    {char.isDead ? 'CONNECTION LOST - SUBJECT DECEASED' : 'CONNECTED TO KONOHA_NET'}
                </span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterModal;