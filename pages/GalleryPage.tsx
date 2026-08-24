import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Images, ChevronDown, Search, Radio, X, LayoutGrid, Layers, Palette, EyeOff, ScanLine, ChevronLeft, ChevronRight, ListChecks, Clock } from 'lucide-react';
import { subscribeChecklist, slugify } from '../data/firestore';
import { groupItems } from '../data/checklistGrouping';
import { ChecklistItem } from '../types';

/**
 * Os dois tipos que pertencem a um personagem em vez de a uma temporada. Eles compartilham a forma
 * dos dados — `temporada` é o personagem e `arco` é a fase ou o modo — e por isso compartilham a
 * URL de dois níveis `/galeria/<personagem>/<fase-ou-modo>`, o agrupamento e a grade retrato.
 */
const TIPOS_DO_PERSONAGEM = ['timeline', 'transformacao'];
const ehDoPersonagem = (t?: string) => TIPOS_DO_PERSONAGEM.includes(t ?? 'evento');

const GalleryPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // /galeria/<personagem>/<fase> (Linha do Tempo, 2 níveis) ou
  // /galeria/<temporada>/<arco>/<subarco?>/<item> (Eventos, até 4 níveis) — link direto
  // pra uma pasta ou imagem específica. Os dois primeiros segmentos servem pros dois
  // esquemas; qual deles vale depende de qual realmente casa com os dados (ver efeitos abaixo).
  const gallerySegments = location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const personagemSlugFromUrl = gallerySegments[1] ? decodeURIComponent(gallerySegments[1]) : '';
  const faseSlugFromUrl = gallerySegments[2] ? decodeURIComponent(gallerySegments[2]) : '';
  const eventoSeg3FromUrl = gallerySegments[3] ? decodeURIComponent(gallerySegments[3]) : '';
  const eventoSeg4FromUrl = gallerySegments[4] ? decodeURIComponent(gallerySegments[4]) : '';

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTemporadas, setExpandedTemporadas] = useState<Set<string>>(new Set());
  const [expandedArcos, setExpandedArcos] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<ChecklistItem | null>(null);
  const [viewMode, setViewMode] = useState<'temporada' | 'geral'>('temporada');
  // Abre em "Geral" (Eventos + Linha do Tempo juntos); as abas específicas são um filtro
  // que o visitante escolhe, não o ponto de partida. Links diretos ainda mandam na aba:
  // /galeria/<personagem>/<fase> força 'timeline' e link de evento mantém 'geral'.
  const [activeType, setActiveType] = useState<'evento' | 'timeline' | 'geral'>('geral');
  const [forceColor, setForceColor] = useState(false);
  const [hideCaptions, setHideCaptions] = useState(false);
  const [hideMask, setHideMask] = useState(false);
  const [hideAmbu, setHideAmbu] = useState(false);
  const [gridColumns, setGridColumns] = useState(5);

  useEffect(() => {
    const unsubscribe = subscribeChecklist(
      data => { setItems(data); setLoading(false); setError(null); },
      err => { console.error('Erro ao escutar galeria:', err); setError('Não foi possível carregar a galeria.'); setLoading(false); },
    );
    return () => unsubscribe();
  }, []);

  const withImages = useMemo(() => items.filter(i => !!i.imageUrl), [items]);
  const typedWithImages = useMemo(() => {
    // A aba Linha do Tempo traz os Modos e Transformações junto, porque os dois são do mesmo
    // personagem e é onde a pessoa espera ver o boneco dele inteiro. Dentro do grupo eles
    // aparecem separados por rótulo, não misturados.
    const byType = activeType === 'geral'
      ? withImages
      : activeType === 'timeline'
        ? withImages.filter(i => ehDoPersonagem(i.type))
        : withImages.filter(i => (i.type ?? 'evento') === activeType);
    if (activeType !== 'timeline' || !hideAmbu) return byType;
    // Ambu é fase da linha do tempo; nenhum modo se chama assim, então o filtro não os alcança
    return byType.filter(i => i.arco !== 'Ambu');
  }, [withImages, activeType, hideAmbu]);
  const groups = useMemo(() => groupItems(typedWithImages), [typedWithImages]);
  // Na Linha do Tempo o "nome" do item é só a fase (Prólogo, Clássico...), que se repete
  // em todo mundo — sem olhar `temporada` (o personagem) também, buscar pelo nome de
  // alguém nunca acha nada.
  const matchesSearch = (item: ChecklistItem, term: string) =>
    item.name.toLowerCase().includes(term) || item.temporada.toLowerCase().includes(term);

  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groups;
    const term = searchTerm.toLowerCase();
    return groups
      .map(g => ({
        ...g,
        arcos: g.arcos
          .map(a => ({
            ...a,
            subarcos: a.subarcos
              .map(s => ({ ...s, items: s.items.filter(i => matchesSearch(i, term)) }))
              .filter(s => s.items.length > 0),
          }))
          .filter(a => a.subarcos.length > 0),
      }))
      .filter(g => g.arcos.length > 0);
  }, [groups, searchTerm]);

  const flatFiltered = useMemo(() => {
    if (!searchTerm.trim()) return typedWithImages;
    const term = searchTerm.toLowerCase();
    return typedWithImages.filter(i => matchesSearch(i, term));
  }, [typedWithImages, searchTerm]);

  const toggleKey = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  };

  // Trocar de aba fecha os accordions abertos da aba anterior, pra não misturar estado.
  // A busca continua igual — trocar de Eventos pra Linha do Tempo não deve apagar o que já foi digitado.
  useEffect(() => {
    setExpandedTemporadas(new Set());
    setExpandedArcos(new Set());
  }, [activeType]);

  // Aplica um link direto /galeria/<personagem>/<fase>: força a aba Linha do Tempo,
  // expande a pasta do personagem e, se a fase também vier na URL, abre o lightbox nela.
  // Declarado DEPOIS do efeito acima de propósito: quando personagemSlugFromUrl muda
  // activeType pra 'timeline', os dois efeitos disparam no mesmo commit, nessa ordem —
  // o de cima limpa os accordions, este aqui reaplica a pasta certa por cima.
  useEffect(() => {
    if (loading || !personagemSlugFromUrl) return;
    const timelineItems = items.filter(i => ehDoPersonagem(i.type) && i.imageUrl);
    const personagemItem = timelineItems.find(i => slugify(i.temporada) === personagemSlugFromUrl);
    if (!personagemItem) return;
    if (activeType !== 'timeline') setActiveType('timeline');
    setExpandedTemporadas(prev => new Set(prev).add(personagemItem.temporada));
    if (faseSlugFromUrl) {
      const faseItem = timelineItems.find(i => i.temporada === personagemItem.temporada && slugify(i.arco) === faseSlugFromUrl);
      if (faseItem) setLightbox(faseItem);
    }
  }, [loading, items, personagemSlugFromUrl, faseSlugFromUrl, activeType]);

  // Aplica um link direto de Eventos: /galeria/<temporada>/<arco>/<subarco?>/<item>.
  // Os dois primeiros segmentos (temporada/arco) são compartilhados com o esquema da Linha
  // do Tempo; só segue se realmente baterem com algum evento (senão é link de personagem,
  // já tratado no efeito acima).
  useEffect(() => {
    if (loading || !personagemSlugFromUrl || !faseSlugFromUrl) return;
    const eventoItems = items.filter(i => (i.type ?? 'evento') === 'evento' && i.imageUrl);
    const matchTemporadaArco = (i: ChecklistItem) => slugify(i.temporada) === personagemSlugFromUrl && slugify(i.arco) === faseSlugFromUrl;
    const anyInArco = eventoItems.find(matchTemporadaArco);
    if (!anyInArco) return;

    if (activeType !== 'evento' && activeType !== 'geral') setActiveType('evento');
    setExpandedTemporadas(prev => new Set(prev).add(anyInArco.temporada));
    setExpandedArcos(prev => new Set(prev).add(`${anyInArco.temporada}::${anyInArco.arco}`));

    if (eventoSeg4FromUrl) {
      // temporada/arco/subarco/item
      const target = eventoItems.find(i => matchTemporadaArco(i) && i.subarco && slugify(i.subarco) === eventoSeg3FromUrl && slugify(i.name) === eventoSeg4FromUrl);
      if (target) setLightbox(target);
    } else if (eventoSeg3FromUrl) {
      // tenta temporada/arco/item (sem subarco) primeiro; se não achar, era só a pasta do subarco
      const target = eventoItems.find(i => matchTemporadaArco(i) && !i.subarco && slugify(i.name) === eventoSeg3FromUrl);
      if (target) setLightbox(target);
    }
  }, [loading, items, personagemSlugFromUrl, faseSlugFromUrl, eventoSeg3FromUrl, eventoSeg4FromUrl, activeType]);

  const subtitle = activeType === 'timeline'
    ? 'Linha do tempo e modos de cada personagem, já produzidos'
    : activeType === 'geral'
      ? 'Todas as imagens de Eventos e Linha do Tempo, juntas'
      : 'Todas as imagens já produzidas, por temporada/arco';

  const imgClass = `w-full h-full object-cover transition-all duration-300 ${forceColor ? 'opacity-100' : 'grayscale group-hover:grayscale-0'}`;
  // .crt::before (index.html) é fixed com z-index 9998 cobrindo a tela toda;
  // subir o tile acima disso faz só a imagem escapar do efeito, sem mexer no resto da página.
  const tileClass = `group relative aspect-video overflow-hidden border border-tech-border hover:border-tech-primary/60 transition-colors ${hideMask ? 'z-[9999]' : ''}`;
  // Linha do Tempo: retratos verticais (proporção 1080x1620 = 2:3), diferente do 16:9 dos Eventos.
  const timelineTileClass = `group relative aspect-[2/3] overflow-hidden border border-tech-border hover:border-tech-primary/60 transition-colors ${hideMask ? 'z-[9999]' : ''}`;
  // Colunas da grade de Linha do Tempo são ajustáveis (5 a 8) via toolbar; sm/md ficam menores
  // que o lg escolhido pra não espremer demais em telas menores.
  const timelineGridColsClass: Record<number, string> = {
    5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
    7: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7',
    8: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
  };
  const timelineGridClass = `grid gap-3 ${timelineGridColsClass[gridColumns]}`;

  // Abrir/fechar o lightbox reflete na URL, pra dar pra compartilhar o link de uma imagem
  // específica: /galeria/<personagem>/<fase> (Linha do Tempo) ou
  // /galeria/<temporada>/<arco>/<subarco?>/<item> (Eventos).
  const eventoFolderPath = (item: ChecklistItem) =>
    `/galeria/${encodeURIComponent(slugify(item.temporada))}/${encodeURIComponent(slugify(item.arco))}`;
  const eventoItemPath = (item: ChecklistItem) => {
    const parts = [slugify(item.temporada), slugify(item.arco)];
    if (item.subarco) parts.push(slugify(item.subarco));
    parts.push(slugify(item.name));
    return `/galeria/${parts.map(encodeURIComponent).join('/')}`;
  };

  const openLightbox = (item: ChecklistItem) => {
    setLightbox(item);
    // O modo tem a mesma forma da fase — personagem + nome —, então usa a URL de dois níveis. Com a
    // de evento, de três, o link não reabriria a imagem e o "fechar" cairia num caminho morto.
    if (ehDoPersonagem(item.type)) {
      navigate(`/galeria/${encodeURIComponent(slugify(item.temporada))}/${encodeURIComponent(slugify(item.arco))}`);
    } else {
      navigate(eventoItemPath(item));
    }
  };
  const closeLightbox = () => {
    setLightbox(null);
    if (!lightbox) return;
    if (ehDoPersonagem(lightbox.type)) {
      navigate(`/galeria/${encodeURIComponent(slugify(lightbox.temporada))}`);
    } else {
      navigate(eventoFolderPath(lightbox));
    }
  };

  // Navegação do lightbox segue sempre a ordem "Geral" (temporada > arco > subarco > item),
  // independente de qual view está ativa ou de quais accordions estão abertos.
  const lightboxIndex = lightbox ? flatFiltered.findIndex(i => i.docId === lightbox.docId) : -1;
  const goToOffset = useCallback((delta: number) => {
    if (lightboxIndex === -1) return;
    const next = flatFiltered[lightboxIndex + delta];
    if (next) openLightbox(next);
  }, [lightboxIndex, flatFiltered]);

  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToOffset(-1);
      else if (e.key === 'ArrowRight') goToOffset(1);
      else if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightbox, goToOffset]);

  const renderTile = (item: ChecklistItem, className?: string) => (
    <button
      key={item.docId}
      type="button"
      onClick={() => openLightbox(item)}
      className={className ?? (item.type === 'timeline' ? timelineTileClass : tileClass)}
    >
      <img src={item.imageUrl!} alt={item.name} loading="lazy" decoding="async" className={imgClass} />
      {!hideCaptions && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent pointer-events-none" />
          <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white leading-tight line-clamp-2 text-left pointer-events-none">{item.name}</span>
        </>
      )}
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <header className="mb-4 pl-6 py-2 relative">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-tech-primary"></div>
        <h1 className="text-3xl md:text-5xl font-black text-white mb-2 tracking-tighter uppercase relative inline-block">
          GALERIA<span className="text-tech-primary">_DO_RPG</span>
        </h1>
        <p className="text-tech-primary/80 text-sm flex items-center gap-2">
          <Radio size={13} className="animate-pulse" />
          <span className="uppercase tracking-widest">{subtitle}</span>
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-44 shrink-0 bg-black border border-tech-border flex items-center px-3 h-10 group focus-within:border-tech-primary focus-within:shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all">
          <Search size={14} className="text-tech-dim group-focus-within:text-tech-primary transition-colors" />
          <input
            type="text"
            placeholder="BUSCAR_IMAGEM..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-tech-primary w-full ml-2 placeholder:text-tech-dim uppercase text-xs"
          />
        </div>

        <div className="flex border border-tech-border shrink-0">
          <button
            type="button"
            onClick={() => setActiveType('geral')}
            className={`flex items-center gap-1.5 h-10 px-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${activeType === 'geral' ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
          >
            <LayoutGrid size={12} /> Geral
          </button>
          <button
            type="button"
            onClick={() => setActiveType('evento')}
            className={`flex items-center gap-1.5 h-10 px-2.5 text-[10px] font-black uppercase tracking-widest transition-all border-l border-tech-border ${activeType === 'evento' ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
          >
            <ListChecks size={12} /> Eventos
          </button>
          <button
            type="button"
            onClick={() => setActiveType('timeline')}
            className={`flex items-center gap-1.5 h-10 px-2.5 text-[10px] font-black uppercase tracking-widest transition-all border-l border-tech-border ${activeType === 'timeline' ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
          >
            <Clock size={12} /> Linha do Tempo
          </button>
        </div>

        <div className="flex border border-tech-border shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('temporada')}
            className={`flex items-center gap-1.5 h-10 px-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'temporada' ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
          >
            <Layers size={12} /> {activeType === 'timeline' ? 'Por Personagem' : 'Por Temporada'}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('geral')}
            className={`flex items-center gap-1.5 h-10 px-2.5 text-[10px] font-black uppercase tracking-widest transition-all border-l border-tech-border ${viewMode === 'geral' ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
          >
            <LayoutGrid size={12} /> Grade
          </button>
        </div>

        <div className="flex border border-tech-border shrink-0">
          <button
            type="button"
            onClick={() => setForceColor(v => !v)}
            className={`flex items-center gap-1.5 h-10 px-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${forceColor ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
          >
            <Palette size={12} /> Colorir
          </button>
          <button
            type="button"
            onClick={() => setHideMask(v => !v)}
            className={`flex items-center gap-1.5 h-10 px-2.5 text-[10px] font-black uppercase tracking-widest transition-all border-l border-tech-border ${hideMask ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
          >
            <ScanLine size={12} /> Máscara
          </button>
          <button
            type="button"
            onClick={() => setHideCaptions(v => !v)}
            className={`flex items-center gap-1.5 h-10 px-2.5 text-[10px] font-black uppercase tracking-widest transition-all border-l border-tech-border ${hideCaptions ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
          >
            <EyeOff size={12} /> Legenda
          </button>
          {activeType === 'timeline' && (
            <button
              type="button"
              onClick={() => setHideAmbu(v => !v)}
              className={`flex items-center gap-1.5 h-10 px-2.5 text-[10px] font-black uppercase tracking-widest transition-all border-l border-tech-border ${hideAmbu ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
            >
              <EyeOff size={12} /> Ambu
            </button>
          )}
        </div>

        {activeType === 'timeline' && (
          <label className="ml-auto shrink-0 flex items-center gap-1.5 h-10 pl-3 pr-2 border border-tech-primary/40 text-tech-primary" title="Imagens por linha na grade">
            <span className="text-[10px] font-black uppercase tracking-widest">Colunas</span>
            <select
              value={gridColumns}
              onChange={(e) => setGridColumns(Number(e.target.value))}
              className="bg-black border border-tech-border text-tech-primary text-[10px] font-black h-7 px-1.5 outline-none cursor-pointer"
            >
              {[5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-tech-primary/40 text-xs uppercase tracking-widest">
          <Images size={13} className="animate-pulse" /> Carregando galeria...
        </div>
      ) : error ? (
        <div className="text-red-400 text-xs">{error}</div>
      ) : withImages.length === 0 ? (
        <div className="border border-tech-border bg-tech-panel/30 p-8 text-center text-tech-primary/50 text-xs uppercase tracking-widest">
          Nenhuma imagem anexada ainda. Anexe imagens aos itens da checklist (modo Editar) para que apareçam aqui.
        </div>
      ) : viewMode === 'geral' ? (
        <div className={activeType === 'timeline' ? timelineGridClass : 'grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}>
          {flatFiltered.map(item => renderTile(item))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map(group => {
            const isSearching = searchTerm.trim().length > 0;
            const temporadaOpen = isSearching || expandedTemporadas.has(group.temporada);
            // Grupo de personagem: linha do tempo e modos entram aqui, e nenhum dos dois tem
            // arco/subarco pra navegar — a fase e o modo já SÃO a imagem.
            const groupIsTimeline = ehDoPersonagem(group.items[0]?.type);
            const toggleGroup = () => {
              const wasOpen = expandedTemporadas.has(group.temporada);
              toggleKey(expandedTemporadas, setExpandedTemporadas, group.temporada);
              // Sincroniza a URL — /galeria/<personagem> (Linha do Tempo) ou
              // /galeria/<temporada> (Eventos), mesmo esquema pros dois níveis de cima.
              if (wasOpen) {
                if (personagemSlugFromUrl === slugify(group.temporada)) navigate('/galeria');
              } else {
                navigate(`/galeria/${encodeURIComponent(slugify(group.temporada))}`);
              }
            };
            return (
              <div key={group.temporada} className="border border-tech-border bg-tech-panel/20">
                <button
                  type="button"
                  onClick={toggleGroup}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-tech-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ChevronDown size={16} className={`text-tech-primary shrink-0 transition-transform ${temporadaOpen ? '' : '-rotate-90'}`} />
                    <span className="text-white font-black uppercase tracking-wide truncate text-lg">{group.temporada}</span>
                  </div>
                  <span className="text-[10px] text-tech-primary/60 font-bold uppercase tracking-widest shrink-0">{group.items.length} imagem(ns)</span>
                </button>

                {temporadaOpen && (
                  <div className="border-t border-tech-border px-3 py-3 space-y-2">
                    {groupIsTimeline ? (() => {
                      // Nem fase nem modo tem arco/subarco pra navegar, então não existe accordion
                      // interno: é grade direta. O que existe é a separação por tipo, com rótulo —
                      // "Modos e Transformações" só aparece em quem tem.
                      const todos = group.arcos.flatMap(a => a.subarcos.flatMap(s => s.items));
                      const linha = todos.filter(i => (i.type ?? 'evento') === 'timeline');
                      const modos = todos.filter(i => i.type === 'transformacao');
                      const secao = (rotulo: string, lista: typeof todos) => (
                        <div>
                          <div className="text-xs font-black text-tech-primary/50 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <span>{rotulo}</span>
                            <span className="text-tech-primary/25">{lista.length}</span>
                            <span className="flex-1 h-px bg-tech-border/60" />
                          </div>
                          <div className={timelineGridClass}>
                            {lista.map(item => renderTile(item, timelineTileClass))}
                          </div>
                        </div>
                      );
                      // Só um dos dois? Sem rótulo: ele não separa nada de nada.
                      if (!modos.length) return <div className={timelineGridClass}>{linha.map(item => renderTile(item, timelineTileClass))}</div>;
                      if (!linha.length) return secao('Modos e Transformações', modos);
                      return (
                        <div className="space-y-5">
                          {secao('Linha do Tempo', linha)}
                          {secao('Modos e Transformações', modos)}
                        </div>
                      );
                    })() : group.arcos.map(arco => {
                      const arcoKey = `${group.temporada}::${arco.arco}`;
                      const arcoOpen = isSearching || expandedArcos.has(arcoKey);
                      const toggleArco = () => {
                        const wasOpen = expandedArcos.has(arcoKey);
                        toggleKey(expandedArcos, setExpandedArcos, arcoKey);
                        // Sincroniza a URL: /galeria/<temporada>/<arco>.
                        if (wasOpen) {
                          if (personagemSlugFromUrl === slugify(group.temporada) && faseSlugFromUrl === slugify(arco.arco)) {
                            navigate(`/galeria/${encodeURIComponent(slugify(group.temporada))}`);
                          }
                        } else {
                          navigate(`/galeria/${encodeURIComponent(slugify(group.temporada))}/${encodeURIComponent(slugify(arco.arco))}`);
                        }
                      };
                      return (
                        <div key={arco.arco} className="border border-tech-border/60 bg-black/30">
                          <button
                            type="button"
                            onClick={toggleArco}
                            className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-tech-primary/5 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <ChevronDown size={13} className={`text-tech-accent shrink-0 transition-transform ${arcoOpen ? '' : '-rotate-90'}`} />
                              <span className="text-tech-accent font-bold uppercase tracking-wide text-sm truncate">{arco.arco}</span>
                            </div>
                            <span className="text-[10px] text-tech-primary/50 font-bold uppercase shrink-0">{arco.items.length}</span>
                          </button>

                          {arcoOpen && (
                            <div className="border-t border-tech-border/60 px-3 py-3 space-y-4">
                              {arco.subarcos.map((sub, idx) => (
                                <div key={sub.subarco ?? `_flat_${idx}`}>
                                  {sub.subarco && (
                                    <div className="text-xs font-black text-tech-primary/50 uppercase tracking-widest mb-2">{sub.subarco}</div>
                                  )}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {sub.items.map(item => renderTile(item))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lightbox && (
        <div
          className={`fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 ${hideMask ? 'z-[9999]' : 'z-[100]'}`}
          onClick={() => closeLightbox()}
        >
          <button
            type="button"
            onClick={() => closeLightbox()}
            className="absolute top-4 right-4 text-white/70 hover:text-white border border-white/30 p-2"
          >
            <X size={18} />
          </button>

          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); goToOffset(-1); }}
              title="Imagem anterior (seta esquerda)"
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white border border-white/30 hover:border-white p-2 sm:p-3 bg-black/40"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          {lightboxIndex !== -1 && lightboxIndex < flatFiltered.length - 1 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); goToOffset(1); }}
              title="Próxima imagem (seta direita)"
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white border border-white/30 hover:border-white p-2 sm:p-3 bg-black/40"
            >
              <ChevronRight size={22} />
            </button>
          )}

          <div className="max-w-3xl max-h-[85vh] flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <img src={lightbox.imageUrl!} alt={lightbox.name} className="max-w-full max-h-[75vh] object-contain border border-tech-border" />
            <div className="text-center">
              <p className="text-white font-bold">{lightbox.name}</p>
              <p className="text-tech-primary/60 text-xs uppercase tracking-widest">{lightbox.temporada} · {lightbox.arco}{lightbox.subarco ? ` · ${lightbox.subarco}` : ''}</p>
              {lightboxIndex !== -1 && (
                <p className="text-tech-primary/30 text-[10px] uppercase tracking-widest mt-1">{lightboxIndex + 1} / {flatFiltered.length}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GalleryPage;
