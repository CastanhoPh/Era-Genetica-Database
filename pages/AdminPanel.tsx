import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Database, Users, Shield, Scroll, Images, Clock, HardDrive, RefreshCw, Loader, Radio, AlertTriangle, ListOrdered, CheckCircle2, Search, Skull, SkipForward, BookOpen, Download, X, ChevronDown, ChevronUp, CheckSquare, Square, MapPin, FlaskConical, Trash2, UserCheck, UserX, HeartPulse, Award, Sparkles, Link as LinkIcon } from 'lucide-react';
import { ref, listAll, getMetadata, StorageReference } from 'firebase/storage';
import JSZip from 'jszip';
import { storage } from '../firebaseStorage';
import { setCombatProfile, subscribeChecklist, fixChecklistOrder, subscribePrototype, deletePrototypeEntry, slugify, CHECKLIST_BLOCOS, setEventParticipants, setEventCastClosed } from '../data/firestore';
import { Character, ChecklistItem, PrototypeEntry, SEASON_LORE, SEASON_ORDER, PENDING_CHARACTERS, PENDING_ARSENAL } from '../types';
import { distribuirAtributos, FOCOS, MIN_POR_NC, type EstiloCombate, type FocoAtributo } from '../data/atributos';
import { Equipment } from '../types/Equipment';

interface AdminPanelProps {
  characters: Character[];
  arsenalItems: Equipment[];
}

interface StorageStats {
  totalBytes: number;
  fileCount: number;
}

// Aba "Links": catálogo de toda imagem do sistema, para pegar a URL de qualquer uma sem
// precisar abrir a ficha ou o console do Firebase.
const IMAGE_LINK_KINDS = ['Capas', 'Linha do Tempo', 'Modos e Transformações', 'Eventos', 'Técnicas', 'Arsenal'] as const;
type ImageLinkKind = typeof IMAGE_LINK_KINDS[number];

interface ImageLink {
  kind: ImageLinkKind;
  /** A quem pertence — personagem, arma ou item do checklist. */
  owner: string;
  /** O que é, dentro do dono: a fase, o nome da técnica, a variação. */
  detail: string;
  url: string;
}

/** Remove o `v=` de cache-busting. Para uso externo a URL limpa é melhor: o parâmetro não é
 *  entendido pelo Storage (serve só para furar cache), então sem ele o link continua entregando
 *  o arquivo atual mesmo depois de a arte ser substituída. */
const stripVersion = (url: string) => {
  const [base, query = ''] = url.split('?');
  const params = query.split('&').filter(p => p && !p.startsWith('v='));
  return params.length ? `${base}?${params.join('&')}` : base;
};

const FREE_TIER_BYTES = 5 * 1024 * 1024 * 1024;

async function walkStorage(folderRef: StorageReference): Promise<StorageStats> {
  const res = await listAll(folderRef);
  const metas = await Promise.all(res.items.map(item => getMetadata(item)));
  const own = metas.reduce(
    (acc, m) => ({ totalBytes: acc.totalBytes + (Number(m.size) || 0), fileCount: acc.fileCount + 1 }),
    { totalBytes: 0, fileCount: 0 },
  );
  const children = await Promise.all(res.prefixes.map(walkStorage));
  return children.reduce(
    (acc, c) => ({ totalBytes: acc.totalBytes + c.totalBytes, fileCount: acc.fileCount + c.fileCount }),
    own,
  );
}

const formatMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
const formatTime = (d: Date) => d.toLocaleTimeString('pt-BR');

const StatCard: React.FC<{ icon: React.ElementType; label: string; value: React.ReactNode; sub?: string }> = ({ icon: Icon, label, value, sub }) => (
  <div className="border border-tech-border bg-tech-panel/30 p-4 flex flex-col gap-2">
    <div className="flex items-center gap-2 text-tech-primary/70">
      <Icon size={13} />
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-3xl font-black text-white text-glow">{value}</div>
    {sub && <div className="text-[10px] text-tech-primary/40 uppercase tracking-wide">{sub}</div>}
  </div>
);

// A ordem aqui e a ordem da barra de abas. A rota da aba de Listas segue 'canva' mesmo depois de
// renomeada, para nao quebrar link que alguem tenha guardado.
const PANEL_TABS = ['geral', 'classificacoes', 'personagens', 'arsenal', 'invocacoes', 'canva', 'eventos', 'links', 'perfil', 'producao', 'prototipos'] as const;
type PanelTab = typeof PANEL_TABS[number];

const AdminPanel: React.FC<AdminPanelProps> = ({ characters, arsenalItems }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [fixOrderLoading, setFixOrderLoading] = useState(false);
  const [fixOrderResult, setFixOrderResult] = useState<string | null>(null);
  const [fixOrderError, setFixOrderError] = useState<string | null>(null);
  const [chronologySearch, setChronologySearch] = useState('');

  const [bulkFases, setBulkFases] = useState<Set<string>>(new Set());
  const [bulkChars, setBulkChars] = useState<Set<string>>(new Set());
  const [bulkCharSearch, setBulkCharSearch] = useState('');
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkPreviewOpen, setBulkPreviewOpen] = useState(false);

  // Download em lote das Capas: mesma ideia da Linha do Tempo acima, só que sem o passo de
  // "fase" — a capa é a própria `character.image`, um personagem = uma imagem.
  const [bulkCapaChars, setBulkCapaChars] = useState<Set<string>>(new Set());
  const [bulkCapaCharSearch, setBulkCapaCharSearch] = useState('');
  const [bulkCapaDownloading, setBulkCapaDownloading] = useState(false);
  const [bulkCapaProgress, setBulkCapaProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkCapaError, setBulkCapaError] = useState<string | null>(null);

  const [expandedVillages, setExpandedVillages] = useState<Set<string>>(new Set());
  const [expandedClans, setExpandedClans] = useState<Set<string>>(new Set());
  const [expandedArsenalOrigins, setExpandedArsenalOrigins] = useState<Set<string>>(new Set());
  const [expandedArsenalNatures, setExpandedArsenalNatures] = useState<Set<string>>(new Set());

  // Aba ativa (e, dentro de Protótipos, o item aberto) vêm direto da URL — /painel/<aba>[/<item>] —
  // mesmo princípio já usado na ficha do personagem: nada de estado próprio pra duplicar a URL.
  const panelSegments = location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).slice(1);
  const activeTab: PanelTab = (PANEL_TABS as readonly string[]).includes(panelSegments[0]) ? (panelSegments[0] as PanelTab) : 'geral';
  const prototypeSlugFromUrl = activeTab === 'prototipos' && panelSegments[1] ? decodeURIComponent(panelSegments[1]) : undefined;
  const goToPanelTab = (tab: PanelTab) => navigate(`/painel/${tab}`);

  const [prototypeEntries, setPrototypeEntries] = useState<PrototypeEntry[]>([]);
  const [prototypeVillage, setPrototypeVillage] = useState('Konohagakure');
  const [prototypeViewMode, setPrototypeViewMode] = useState<'grid' | 'kanban'>('grid');
  const [classificationVillage, setClassificationVillage] = useState('Konohagakure');
  const [classificationFilter, setClassificationFilter] = useState<'nc30' | 'nc26' | 'nc20' | 'nc16' | 'nc8' | null>(null);
  const [classificationFicha, setClassificationFicha] = useState<'todos' | 'ficha' | 'pendente'>('todos');
  const [perfilBusca, setPerfilBusca] = useState('');
  const [perfilFiltro, setPerfilFiltro] = useState<'todos' | 'faltando' | 'completos'>('todos');
  const [perfilSalvando, setPerfilSalvando] = useState<string | null>(null);
  const [perfilErro, setPerfilErro] = useState<string | null>(null);
  const [canvaSearch, setCanvaSearch] = useState('');
  const [canvaState, setCanvaState] = useState<'todos' | 'falta' | 'pronta'>('todos');
  const [canvaTextOf, setCanvaTextOf] = useState<string | null>(null);
  const [evBusca, setEvBusca] = useState('');
  const [evFiltro, setEvFiltro] = useState<'todos' | 'vazios' | 'aberto' | 'fechado' | 'comArte'>('todos');
  const [evTemporada, setEvTemporada] = useState<string | null>(null);
  // evento aberto no seletor de participantes, e busca dentro dele
  const [quemDoEvento, setQuemDoEvento] = useState<string | null>(null);
  const [quemBusca, setQuemBusca] = useState('');
  const [quemSalvando, setQuemSalvando] = useState<string | null>(null);
  const [quemErro, setQuemErro] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkKind, setLinkKind] = useState<ImageLinkKind | 'Todas'>('Todas');
  const [linkWithVersion, setLinkWithVersion] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const openPrototypeId = prototypeSlugFromUrl
    ? (prototypeEntries.find(e => slugify(e.title) === prototypeSlugFromUrl)?.docId ?? null)
    : null;

  useEffect(() => {
    const unsubscribe = subscribeChecklist(setChecklistItems, err => console.error('Erro ao escutar checklist:', err));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribePrototype(setPrototypeEntries, err => console.error('Erro ao escutar protótipos:', err));
    return () => unsubscribe();
  }, []);

  const handleDeletePrototypeEntry = useCallback(async (docId: string) => {
    if (!window.confirm('Apagar esse protótipo (com todas as imagens)? Não tem como desfazer.')) return;
    try {
      await deletePrototypeEntry(docId);
      if (openPrototypeId === docId) navigate('/painel/prototipos');
    } catch (e) {
      console.error('Erro ao apagar protótipo:', e);
    }
  }, [openPrototypeId, navigate]);

  const loadStorageStats = useCallback(async () => {
    setStorageLoading(true);
    setStorageError(null);
    try {
      const stats = await walkStorage(ref(storage));
      setStorageStats(stats);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Erro ao calcular uso do Storage:', e);
      setStorageError('Não foi possível calcular o uso do Storage.');
    } finally {
      setStorageLoading(false);
    }
  }, []);

  // Só varre o Storage inteiro (custoso) quando a aba "Geral" é aberta pela primeira vez —
  // não em toda montagem do Painel, independente de em qual aba a gente cai.
  useEffect(() => {
    if (activeTab === 'geral' && !storageStats && !storageLoading) {
      loadStorageStats();
    }
  }, [activeTab, storageStats, storageLoading, loadStorageStats]);

  const handleFixOrder = useCallback(async () => {
    if (!window.confirm('Renumerar a ordem de todos os itens da checklist? Isso corrige a sequência caso a Galeria "Geral" esteja fora de ordem. Não afeta nomes, imagens ou status de "feito".')) return;
    setFixOrderLoading(true);
    setFixOrderError(null);
    setFixOrderResult(null);
    try {
      const changed = await fixChecklistOrder();
      setFixOrderResult(changed > 0 ? `${changed} item(ns) renumerado(s).` : 'Já estava tudo em ordem, nada mudou.');
    } catch (e) {
      console.error('Erro ao corrigir ordem da checklist:', e);
      setFixOrderError('Não foi possível corrigir a ordem.');
    } finally {
      setFixOrderLoading(false);
    }
  }, []);

  const deadCount = characters.filter(c => c.isDead).length;
  const totalTechniques = characters.reduce((sum, c) => sum + (c.techniques?.length || 0), 0);
  const totalTimelineImages = checklistItems.filter(i => i.type === 'timeline' && !!i.imageUrl).length;
  const totalTransformacaoImages = checklistItems.filter(i => i.type === 'transformacao' && !!i.imageUrl).length;
  const totalEventoImages = checklistItems.filter(i => (i.type ?? 'evento') === 'evento' && !!i.imageUrl).length;
  const totalGalleryImages = totalTimelineImages + totalTransformacaoImages + totalEventoImages;
  const totalImageRefs = characters.length + arsenalItems.length + totalTechniques + totalGalleryImages;

  // Painel de personagens (aba Personagens): com ficha vs. só pendentes, vivos/mortos, e o
  // tier máximo de NC (30) — Hades fica de fora de propósito (NC 0 = fora de escala).
  const pendingCount = PENDING_CHARACTERS.reduce((sum, g) => sum + g.entries.length, 0);
  const totalCharactersOverall = characters.length + pendingCount;
  const aliveCount = characters.length - deadCount;
  const nc30Count = characters.filter(c => c.nc === 30).length;

  // Painel de arsenal (aba Arsenal): com ficha vs. pendentes, e contagem pelos ranks
  // mais altos da classificação (Z, S++, S+, S).
  const pendingArsenalCount = PENDING_ARSENAL.reduce((sum, g) => sum + g.entries.length, 0);
  const totalArsenalOverall = arsenalItems.length + pendingArsenalCount;
  const rankZCount = arsenalItems.filter(a => a.classification === 'Z').length;
  const rankSPlusPlusCount = arsenalItems.filter(a => a.classification === 'S++').length;
  const rankSPlusCount = arsenalItems.filter(a => a.classification === 'S+').length;
  const rankSCount = arsenalItems.filter(a => a.classification === 'S').length;

  // Arsenal por vila (origem) — com ficha + pendentes, mesmo padrão de "Personagens por Vila".
  const arsenalVillageRows = useMemo(() => {
    const registeredNames = new Map<string, string[]>();
    for (const a of arsenalItems) {
      const origin = a.origin || 'Sem origem';
      const list = registeredNames.get(origin) ?? [];
      list.push(a.name);
      registeredNames.set(origin, list);
    }
    const pendingNames = new Map<string, string[]>();
    for (const g of PENDING_ARSENAL) pendingNames.set(g.village, g.entries.map(e => e.name));
    const allOrigins = new Set([...registeredNames.keys(), ...pendingNames.keys()]);
    const rows = Array.from(allOrigins)
      .map(origin => {
        const reg = [...(registeredNames.get(origin) ?? [])].sort();
        const pend = [...(pendingNames.get(origin) ?? [])].sort();
        return { village: origin, registered: reg.length, pending: pend.length, total: reg.length + pend.length, registeredNames: reg, pendingNames: pend };
      })
      .sort((a, b) => b.total - a.total);
    return { rows, maxTotal: Math.max(1, ...rows.map(r => r.total)) };
  }, [arsenalItems]);

  // Arsenal por natureza — o campo `nature` junta várias naturezas com "+" (ex: "Suiton +
  // Fuinjutsu"), então uma arma conta em cada natureza separada, não só na string inteira.
  const arsenalNatureRows = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of arsenalItems) {
      const parts = (a.nature || 'Desconhecida').split('+').map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        const list = map.get(p) ?? [];
        list.push(a.name);
        map.set(p, list);
      }
    }
    const rows = Array.from(map.entries())
      .map(([nature, names]) => ({ nature, names: [...names].sort(), total: names.length }))
      .sort((a, b) => b.total - a.total);
    return { rows, maxTotal: Math.max(1, ...rows.map(r => r.total)) };
  }, [arsenalItems]);

  // Personagens por vila de nascença: soma quem já tem ficha (`birthVillage`, um valor só por
  // pessoa — evita contar duas vezes quem tem mais de uma vila em `categories`, tipo afiliação
  // atual) com quem ainda está só na lista de pendentes (agrupada por vila lá mesmo).
  const VILLAGES = ['Konohagakure', 'Kirigakure', 'Sunagakure', 'Iwagakure', 'Kumogakure'];
  const villageRows = useMemo(() => {
    const registeredNames = new Map<string, string[]>(VILLAGES.map(v => [v, []]));
    let unclassified = 0;
    for (const c of characters) {
      if (c.birthVillage && registeredNames.has(c.birthVillage)) {
        registeredNames.get(c.birthVillage)!.push(c.name);
      } else {
        unclassified++;
      }
    }
    const pendingNames = new Map<string, string[]>(VILLAGES.map(v => [v, []]));
    for (const g of PENDING_CHARACTERS) {
      if (pendingNames.has(g.village)) pendingNames.set(g.village, g.entries.map(e => e.name));
    }
    const rows = VILLAGES
      .map(v => {
        const reg = [...(registeredNames.get(v) ?? [])].sort();
        const pend = [...(pendingNames.get(v) ?? [])].sort();
        return { village: v, registered: reg.length, pending: pend.length, total: reg.length + pend.length, registeredNames: reg, pendingNames: pend };
      })
      .sort((a, b) => b.total - a.total);
    return { rows, unclassified, maxTotal: Math.max(1, ...rows.map(r => r.total)) };
  }, [characters]);

  // Personagens pendentes (ainda sem ficha) que já têm NC decidido, indexados por nome — usado
  // pra mostrar o NC nos cards/modal de Protótipo e pra entrar na Classificação junto com quem
  // já tem ficha.
  const pendingNcByName = new Map<string, number>();
  for (const g of PENDING_CHARACTERS) {
    for (const e of g.entries) if (e.nc !== undefined) pendingNcByName.set(e.name, e.nc);
  }

  // Classificações: personagens com ficha (só eles têm NC oficial) + pendentes que já têm NC
  // decidido, agrupados pela vila de nascença, ordenados do maior NC pro menor — referência pra
  // decidir o NC de personagens novos. OCA é a única exceção: não é vila de nascença, é a tag
  // `categories` — por isso um personagem pode entrar em OCA *e* na vila dele ao mesmo tempo
  // (duplicado de propósito). Pendentes nunca entram em OCA (essa tag só existe pra quem já tem ficha).
  const CLASSIFICATION_GROUPS = [...VILLAGES, 'OCA'];
  const classificationsByVillage = useMemo(() => {
    const map = new Map<string, { name: string; nc: number; clan: string; pending?: boolean; dead?: boolean }[]>(CLASSIFICATION_GROUPS.map(v => [v, []]));
    for (const c of characters) {
      const entrada = { name: c.name, nc: Number(c.nc) || 0, clan: c.clan, dead: !!c.isDead };
      // `birthVillage` é a fonte preferida, mas só 16 das 86 fichas o têm preenchido — sem cair
      // para as vilas de `categories`, 40 personagens não apareciam em grupo nenhum. Quem tem duas
      // vilas de atuação entra nas duas, como a OCA já duplica de propósito.
      const vilas = c.birthVillage && map.has(c.birthVillage)
        ? [c.birthVillage]
        : (c.categories ?? []).filter(x => x !== 'OCA' && map.has(x));
      for (const v of vilas) map.get(v)!.push(entrada);
      if (c.categories?.includes('OCA')) map.get('OCA')!.push(entrada);
    }
    for (const g of PENDING_CHARACTERS) {
      if (!map.has(g.village)) continue;
      for (const e of g.entries) {
        if (e.nc === undefined) continue;
        map.get(g.village)!.push({ name: e.name, nc: e.nc, clan: e.role ?? '', pending: true, dead: !!e.dead });
      }
    }
    for (const list of map.values()) list.sort((a, b) => b.nc - a.nc);
    return map;
  }, [characters]);
  // "Todos" junta as 5 vilas (sem OCA, pra não contar quem tem as duas tags duas vezes).
  // Aba Canva: a ordem definitiva das páginas de cada projeto, lida do checklist ao vivo. Cada
  // type é um projeto, e o número da página é a POSIÇÃO na faixa, não o `order` cru — assim
  // inserir um item no meio renumera a exibição sozinho, sem precisar mexer em nada.
  const CANVA_PROJETOS = useMemo(() => ([
    { tipo: 'timeline' as const, nome: 'Linha do Tempo', tam: '1080 × 1620', base: CHECKLIST_BLOCOS.timeline },
    { tipo: 'transformacao' as const, nome: 'Modos e Transformações', tam: '1080 × 1620', base: CHECKLIST_BLOCOS.transformacao },
    { tipo: 'capa' as const, nome: 'Capas', tam: '1024 × 768 (4:3)', base: CHECKLIST_BLOCOS.capa },
    { tipo: 'evento' as const, nome: 'Eventos', tam: '1600 × 900 (16:9)', base: CHECKLIST_BLOCOS.evento },
  ]), []);

  const canvaData = useMemo(() => CANVA_PROJETOS.map(p => {
    const itens = checklistItems
      .filter(i => (i.type ?? 'evento') === p.tipo)
      .sort((a, b) => a.order - b.order)
      .map((i, k) => ({
        pag: k + 1,
        docId: i.docId,
        // capa repete o nome do personagem nos três campos; evento tem até quatro níveis
        titulo: p.tipo === 'capa'
          ? i.temporada
          : p.tipo === 'evento'
            ? [i.temporada, i.arco, i.subarco, i.name].filter(Boolean).join(' - ')
            : `${i.temporada} - ${i.arco}`,
        pronta: !!i.imageUrl,
        placeholder: !!i.placeholder,
        doneBy: i.doneBy ?? null,
        personagens: i.personagens ?? [],
        fechado: !!i.elencoFechado,
        item: i,
      }));
    const prontas = itens.filter(i => i.pronta).length;
    return { ...p, itens, prontas, pct: itens.length ? Math.round((prontas / itens.length) * 100) : 0 };
  }), [CANVA_PROJETOS, checklistItems]);

  // Todo mundo que pode estar num evento: ficha, protótipo e pendente. Nome completo sempre —
  // com os três grupos juntos o primeiro nome deixa de ser único (Raizen Kurogane x Raizen
  // Kuroshio, Inazuma Kazuchi x Inazuma Uchiha), e o vínculo é feito por nome.
  const gentePossivel = useMemo(() => {
    const comFicha = characters.map(c => ({ nome: c.name, curto: c.name.split(' ')[0], grupo: 'ficha' as const, id: c.id, cla: c.clan || 'Desconhecido', extra: c.clan || '' }));
    const nomesFicha = new Set(comFicha.map(p => p.nome));
    const protos = prototypeEntries
      .filter(e => !nomesFicha.has(e.title))
      .map(e => ({ nome: e.title, curto: e.title, grupo: 'prototipo' as const, id: null, cla: e.village || 'Outros', extra: e.village ?? '' }));
    const nomesProto = new Set(protos.map(p => p.nome));
    const pendentes = PENDING_CHARACTERS.flatMap(g => g.entries.map(e => ({ ...e, village: g.village })))
      .filter(e => !nomesFicha.has(e.name) && !nomesProto.has(e.name))
      .map(e => ({ nome: e.name, curto: e.name, grupo: 'pendente' as const, id: null, cla: e.village, extra: e.role ?? e.village }));
    return [
      ...comFicha.sort((a, b) => a.id - b.id),
      ...protos.sort((a, b) => a.nome.localeCompare(b.nome)),
      ...pendentes.sort((a, b) => a.nome.localeCompare(b.nome)),
    ];
  }, [characters, prototypeEntries]);

  /**
   * Quebra um grupo do seletor em subgrupos. Nas fichas o subgrupo é o clã; nos protótipos e
   * pendentes é a vila, que é o que existe pra eles.
   *
   * Clã com uma pessoa só vai pra "Outros": dos 35 clãs das fichas, 18 têm um membro, e dar
   * cabeçalho a cada um deixaria pior de varrer do que a grade plana que estava aqui antes.
   * A ordem é a do menor id do grupo, então Senju, Uzumaki e Uchiha vêm primeiro, como no resto
   * do projeto.
   */
  const subgrupos = useCallback((lista: typeof gentePossivel) => {
    const mapa = new Map<string, typeof gentePossivel>();
    lista.forEach(p => { const k = p.cla || 'Outros'; mapa.set(k, [...(mapa.get(k) ?? []), p]); });
    const grandes: { cla: string; gente: typeof gentePossivel }[] = [];
    const sozinhos: typeof gentePossivel = [];
    for (const [cla, gente] of mapa) {
      if (gente.length > 1 && cla !== 'Outros') grandes.push({ cla, gente });
      else sozinhos.push(...gente);
    }
    const peso = (g: typeof gentePossivel) => Math.min(...g.map(p => p.id ?? 9999));
    grandes.sort((a, b) => peso(a.gente) - peso(b.gente) || a.cla.localeCompare(b.cla));
    return [...grandes, ...(sozinhos.length ? [{ cla: 'Outros', gente: sozinhos.sort((a, b) => (a.id ?? 9999) - (b.id ?? 9999) || a.nome.localeCompare(b.nome)) }] : [])];
  }, []);

  const eventoAberto = useMemo(
    () => (quemDoEvento ? checklistItems.find(i => i.docId === quemDoEvento) ?? null : null),
    [quemDoEvento, checklistItems],
  );

  const alternaParticipante = useCallback(async (nome: string) => {
    if (!eventoAberto?.docId) return;
    const atuais = eventoAberto.personagens ?? [];
    const novos = atuais.includes(nome) ? atuais.filter(n => n !== nome) : [...atuais, nome];
    setQuemSalvando(eventoAberto.docId);
    setQuemErro(null);
    try {
      await setEventParticipants(eventoAberto, novos, characters);
    } catch (e) {
      console.error('Erro ao gravar participantes do evento:', e);
      setQuemErro('Não foi possível gravar. Tente de novo.');
    } finally {
      setQuemSalvando(null);
    }
  }, [eventoAberto, characters]);

  // Aba Perfil: estilo de combate + foco de atributo por ficha. Com os dois, os sete atributos de
  // qualquer NC ficam determinados — é o que dispensa mandar atributo a atributo quando alguém sobe.
  const perfilLista = useMemo(() => {
    const termo = perfilBusca.trim().toLowerCase();
    return characters
      .filter(c => {
        const completo = !!c.combatStyle && !!c.focoAtributo;
        return (perfilFiltro === 'todos'
          || (perfilFiltro === 'completos' && completo)
          || (perfilFiltro === 'faltando' && !completo))
          && (!termo || c.name.toLowerCase().includes(termo) || (c.clan ?? '').toLowerCase().includes(termo));
      })
      .map(c => {
        // A prévia só existe quando os dois estão escolhidos e o NC está na tabela.
        const previa = c.combatStyle && c.focoAtributo && MIN_POR_NC[c.nc] !== undefined
          ? distribuirAtributos(c.nc, c.combatStyle as EstiloCombate, c.focoAtributo as FocoAtributo)
          : null;
        const atual = ['strength', 'dexterity', 'agility', 'intelligence', 'spirit', 'vigor', 'perception']
          .map(k => Number((c.stats as unknown as Record<string, unknown>)?.[k]) || 0);
        const prev = previa
          ? [previa.stats.strength, previa.stats.dexterity, previa.stats.agility,
            previa.stats.intelligence, previa.stats.spirit, previa.stats.vigor, previa.stats.perception].map(Number)
          : null;
        return { c, previa, atual, prev, igual: !!prev && prev.every((v, i) => v === atual[i]) };
      });
  }, [characters, perfilBusca, perfilFiltro]);

  const perfilCompletos = useMemo(() => characters.filter(c => c.combatStyle && c.focoAtributo).length, [characters]);

  const gravaPerfil = useCallback(async (c: Character, mudanca: { combatStyle?: Character['combatStyle']; focoAtributo?: Character['focoAtributo'] }) => {
    if (!c.docId) return;
    setPerfilSalvando(c.docId);
    setPerfilErro(null);
    try {
      await setCombatProfile(c.docId, mudanca);
    } catch (e) {
      console.error('Erro ao gravar perfil de combate:', e);
      setPerfilErro('Não foi possível gravar. Tente de novo.');
    } finally {
      setPerfilSalvando(null);
    }
  }, []);

  // Aba Eventos: os mesmos itens do projeto Eventos, mas o assunto aqui é quem estava em cada um.
  const eventosLista = useMemo(
    () => (canvaData.find(p => p.tipo === 'evento')?.itens ?? []),
    [canvaData],
  );
  const eventoTemporadas = useMemo(
    () => [...new Set(eventosLista.map(i => i.item.temporada))],
    [eventosLista],
  );
  const eventosFiltrados = useMemo(() => {
    const termo = evBusca.trim().toLowerCase();
    return eventosLista.filter(i =>
      (evFiltro === 'todos'
        || (evFiltro === 'vazios' && !i.personagens.length)
        || (evFiltro === 'aberto' && !i.fechado)
        || (evFiltro === 'fechado' && i.fechado)
        || (evFiltro === 'comArte' && i.pronta))
      && (!evTemporada || i.item.temporada === evTemporada)
      && (!termo || i.titulo.toLowerCase().includes(termo) || i.personagens.some(n => n.toLowerCase().includes(termo))));
  }, [eventosLista, evBusca, evFiltro, evTemporada]);
  const eventosComAlguem = useMemo(() => eventosLista.filter(i => i.personagens.length).length, [eventosLista]);
  const eventosFechados = useMemo(() => eventosLista.filter(i => i.fechado).length, [eventosLista]);

  const alternaFechado = useCallback(async (item: ChecklistItem, fechado: boolean) => {
    setQuemSalvando(item.docId ?? null);
    setQuemErro(null);
    try {
      await setEventCastClosed(item, fechado, characters);
    } catch (e) {
      console.error('Erro ao marcar elenco fechado:', e);
      setQuemErro('Não foi possível marcar. Tente de novo.');
    } finally {
      setQuemSalvando(null);
    }
  }, [characters]);

  const canvaFiltrado = useMemo(() => {
    const termo = canvaSearch.trim().toLowerCase();
    return canvaData.map(p => ({
      ...p,
      visiveis: p.itens.filter(i =>
        (canvaState === 'todos'
          || (canvaState === 'pronta' && i.pronta)
          || (canvaState === 'falta' && !i.pronta))
        && (!termo || i.titulo.toLowerCase().includes(termo) || (i.personagens ?? []).some(n => n.toLowerCase().includes(termo)))),
    }));
  }, [canvaData, canvaSearch, canvaState]);

  // "Todos" percorre TODOS os grupos, inclusive OCA, e tira repetido pelo nome: quem tem duas
  // vilas, ou vila e OCA, aparece uma vez só. Incluir a OCA é o que garante o Hades e o Genei (G),
  // que não têm vila nenhuma nas categorias.
  const classificationAllVillages = useMemo(() => {
    const vistos = new Set<string>();
    const all: { name: string; nc: number; clan: string; pending?: boolean; dead?: boolean }[] = [];
    for (const g of CLASSIFICATION_GROUPS) {
      for (const e of classificationsByVillage.get(g) ?? []) {
        const chave = `${e.name}|${e.pending ? 'p' : 'f'}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        all.push(e);
      }
    }
    return all.sort((a, b) => b.nc - a.nc);
  }, [classificationsByVillage]);

  // Catálogo de imagens da aba "Links", montado do que o Painel já tem em memória — personagens,
  // arsenal e checklist — sem nenhuma leitura extra.
  //
  // Duas decisões que valem explicar:
  //  · A arte é deduplicada pela URL. A mesma imagem costuma ser referenciada em dois lugares (a
  //    fase na galeria da ficha e o item do checklist), e listar as duas só geraria ruído para
  //    quem quer copiar um link. Ganha o rótulo da fonte mais específica, na ordem de PRIORIDADE.
  //  · O item do checklist é classificado pelo `type` dele, não como um balde "Checklist" — é
  //    assim que a arte de evento (que só existe no checklist) chega à categoria "Eventos".
  const imageLinks = useMemo<ImageLink[]>(() => {
    const PRIORIDADE: ImageLinkKind[] = ['Capas', 'Linha do Tempo', 'Modos e Transformações', 'Técnicas', 'Arsenal', 'Eventos'];
    const porUrl = new Map<string, ImageLink>();
    const registra = (l: ImageLink) => {
      const chave = stripVersion(l.url);
      const atual = porUrl.get(chave);
      if (atual && PRIORIDADE.indexOf(atual.kind) <= PRIORIDADE.indexOf(l.kind)) return;
      porUrl.set(chave, l);
    };

    for (const c of characters) {
      if (c.image) registra({ kind: 'Capas', owner: c.name, detail: 'capa da ficha — é a que o site usa', url: c.image });
      for (const g of c.gallery ?? []) {
        if (!g.url) continue;
        registra({
          kind: g.category === 'era' ? 'Linha do Tempo' : g.category === 'transformacao' ? 'Modos e Transformações' : 'Eventos',
          owner: c.name,
          detail: g.caption || '(sem legenda)',
          url: g.url,
        });
      }
      for (const t of c.techniques ?? []) {
        if (t.image) registra({ kind: 'Técnicas', owner: c.name, detail: t.name, url: t.image });
      }
    }
    for (const a of arsenalItems) {
      if (a.image) registra({ kind: 'Arsenal', owner: a.name, detail: 'imagem da arma', url: a.image });
      for (const v of a.variants ?? []) {
        if (v.image) registra({ kind: 'Arsenal', owner: a.name, detail: `variação: ${v.name}`, url: v.image });
      }
    }
    for (const i of checklistItems) {
      if (!i.imageUrl) continue;
      const tipo = i.type ?? 'evento';
      // Em item de capa, `temporada`, `arco` e `name` são todos o nome do personagem — montar o
      // rótulo com os três sairia "Oddy Uchiha · Oddy Uchiha · Oddy Uchiha".
      const detail = tipo === 'capa'
        ? 'capa no checklist de produção'
        : tipo === 'transformacao' ? i.arco
        : i.subarco ? `${i.arco} · ${i.subarco} · ${i.name}` : `${i.arco} · ${i.name}`;
      registra({
        kind: tipo === 'timeline' ? 'Linha do Tempo' : tipo === 'transformacao' ? 'Modos e Transformações' : tipo === 'capa' ? 'Capas' : 'Eventos',
        owner: i.temporada,
        detail,
        url: i.imageUrl,
      });
    }
    return [...porUrl.values()].sort((a, b) => a.owner.localeCompare(b.owner) || a.detail.localeCompare(b.detail));
  }, [characters, arsenalItems, checklistItems]);

  const filteredImageLinks = useMemo(() => {
    const term = linkSearch.trim().toLowerCase();
    return imageLinks.filter(l =>
      (linkKind === 'Todas' || l.kind === linkKind) &&
      (!term || l.owner.toLowerCase().includes(term) || l.detail.toLowerCase().includes(term)));
  }, [imageLinks, linkSearch, linkKind]);

  const copiaLink = useCallback((valor: string, id: string) => {
    navigator.clipboard.writeText(valor);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(prev => (prev === id ? null : prev)), 1800);
  }, []);
  const classificationBase = classificationVillage === 'Todos' ? classificationAllVillages : (classificationsByVillage.get(classificationVillage) ?? []);
  // A lista traz ficha e pendente juntos, marcados por `pending` — os dois botoes da direita
  // separam os dois lados sem mexer na vila escolhida.
  const classificationChars = classificationFicha === 'todos'
    ? classificationBase
    : classificationBase.filter(c => (classificationFicha === 'pendente') === !!c.pending);
  // Faixas exclusivas (não cumulativas): NC 30 é só o topo; 26+ é 26-29; 20+ é 20-25; etc.
  const NC_BANDS: Record<'nc30' | 'nc26' | 'nc20' | 'nc16' | 'nc8', (nc: number) => boolean> = {
    nc30: nc => nc === 30,
    nc26: nc => nc >= 26 && nc <= 29,
    nc20: nc => nc >= 20 && nc <= 25,
    nc16: nc => nc >= 16 && nc <= 19,
    nc8: nc => nc >= 8 && nc <= 15,
  };
  const classificationCounts = {
    nc30: classificationChars.filter(c => NC_BANDS.nc30(c.nc)).length,
    nc26: classificationChars.filter(c => NC_BANDS.nc26(c.nc)).length,
    nc20: classificationChars.filter(c => NC_BANDS.nc20(c.nc)).length,
    nc16: classificationChars.filter(c => NC_BANDS.nc16(c.nc)).length,
    nc8: classificationChars.filter(c => NC_BANDS.nc8(c.nc)).length,
  };
  const classificationFiltered = classificationFilter
    ? classificationChars.filter(c => NC_BANDS[classificationFilter](c.nc))
    : classificationChars;

  // Agrupa por NC para a lista sair com uma barra por faixa. A lista já vem ordenada do maior NC
  // pro menor, então basta cortar quando o número muda.
  const classificationPorNc = useMemo(() => {
    const grupos: { nc: number; gente: typeof classificationFiltered }[] = [];
    for (const c of classificationFiltered) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.nc === c.nc) ultimo.gente.push(c);
      else grupos.push({ nc: c.nc, gente: [c] });
    }
    return grupos;
  }, [classificationFiltered]);

  // Personagens por clã — combina quem já tem ficha (campo `clan`) com quem ainda está pendente.
  // A lista de pendentes não guarda clã explicitamente, mas a convenção de nomes do universo é
  // "Nome Clã" (o sobrenome é sempre o clã), então dá pra derivar do próprio nome.
  const clanRows = useMemo(() => {
    const registeredNames = new Map<string, string[]>();
    const pendingNames = new Map<string, string[]>();
    const bump = (map: Map<string, string[]>, clan: string, name: string) => {
      const list = map.get(clan) ?? [];
      list.push(name);
      map.set(clan, list);
    };
    for (const c of characters) bump(registeredNames, c.clan || 'Sem clã', c.name);
    for (const g of PENDING_CHARACTERS) {
      for (const e of g.entries) bump(pendingNames, e.name.split(' ')[1] || 'Sem clã', e.name);
    }
    const allClans = new Set([...registeredNames.keys(), ...pendingNames.keys()]);
    const rows = Array.from(allClans)
      .map(clan => {
        const reg = [...(registeredNames.get(clan) ?? [])].sort();
        const pend = [...(pendingNames.get(clan) ?? [])].sort();
        return { clan, registered: reg.length, pending: pend.length, total: reg.length + pend.length, registeredNames: reg, pendingNames: pend };
      })
      .sort((a, b) => b.total - a.total);
    return { rows, maxTotal: Math.max(1, ...rows.map(r => r.total)) };
  }, [characters]);

  const pctUsed = storageStats ? Math.min(100, (storageStats.totalBytes / FREE_TIER_BYTES) * 100) : 0;

  const chronologyExcluded = characters.filter(c => c.timelineExcluded);
  const chronologyRows = useMemo(() => {
    const term = chronologySearch.trim().toLowerCase();
    return characters
      .filter(c => !term || c.name.toLowerCase().includes(term))
      .sort((a, b) => a.id - b.id);
  }, [characters, chronologySearch]);

  // Download em lote: filtra a Linha do Tempo já pronta (com imagem) por fase + personagem,
  // busca cada imagem e monta um .zip só, pra baixar tudo de uma vez.
  const FASE_RANK: Record<string, number> = {
    'Prólogo': 0, 'Clássico': 1, '1ª Temporada': 2, '2ª Temporada': 3, 'Ambu': 4,
    'Kaminari': 5, 'Luta contra o Omega': 6, '3ª Temporada': 7, '4ª Temporada': 8,
    'Terceiro Hokage': 9, '5ª Temporada': 10,
  };
  const timelineDoneItems = useMemo(
    () => checklistItems.filter(i => i.type === 'timeline' && !!i.imageUrl),
    [checklistItems],
  );
  const bulkAvailableFases = useMemo(() => {
    const set: string[] = Array.from(new Set<string>(timelineDoneItems.map(i => i.arco)));
    return set.sort((a: string, b: string) => (FASE_RANK[a] ?? 99) - (FASE_RANK[b] ?? 99));
  }, [timelineDoneItems]);
  const charIdByName = useMemo(() => new Map<string, number>(characters.map(c => [c.name, c.id])), [characters]);
  const bulkAvailableChars = useMemo(() => {
    // Só mostra quem tem imagem na(s) fase(s) marcada(s) — nenhuma marcada = todo mundo.
    const relevant = bulkFases.size === 0 ? timelineDoneItems : timelineDoneItems.filter(i => bulkFases.has(i.arco));
    const set: string[] = Array.from(new Set<string>(relevant.map(i => i.temporada)));
    const term = bulkCharSearch.trim().toLowerCase();
    return set
      .filter((n: string) => !term || n.toLowerCase().includes(term))
      .sort((a: string, b: string) => (charIdByName.get(a) ?? 999) - (charIdByName.get(b) ?? 999));
  }, [timelineDoneItems, bulkFases, bulkCharSearch, charIdByName]);
  const bulkMatches = useMemo(() => {
    return timelineDoneItems.filter(i =>
      (bulkFases.size === 0 || bulkFases.has(i.arco)) &&
      (bulkChars.size === 0 || bulkChars.has(i.temporada)),
    );
  }, [timelineDoneItems, bulkFases, bulkChars]);

  // Separa as fases-padrão (Prólogo..5ª Temporada) dos marcos exclusivos (Ambu, Kaminari...)
  // só pra exibir em dois grupos visuais — não muda o filtro em si.
  const CORE_FASES = useMemo(() => new Set<string>(SEASON_ORDER), []);
  const bulkCoreFases = useMemo(() => bulkAvailableFases.filter(f => CORE_FASES.has(f)), [bulkAvailableFases, CORE_FASES]);
  const bulkExtraFases = useMemo(() => bulkAvailableFases.filter(f => !CORE_FASES.has(f)), [bulkAvailableFases, CORE_FASES]);

  // Agrupa o resultado final por personagem, na ordem cronológica das fases, só pra
  // dar uma pré-visualização do que exatamente vai entrar no zip antes de baixar.
  const bulkPreviewGroups = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const item of bulkMatches) {
      const list = map.get(item.temporada) ?? [];
      list.push(item);
      map.set(item.temporada, list);
    }
    return Array.from(map.entries())
      .map(([temporada, list]) => ({
        temporada,
        fases: [...list].sort((a, b) => (FASE_RANK[a.arco] ?? 99) - (FASE_RANK[b.arco] ?? 99)).map(i => i.arco),
      }))
      .sort((a, b) => (charIdByName.get(a.temporada) ?? 999) - (charIdByName.get(b.temporada) ?? 999));
  }, [bulkMatches, charIdByName]);

  const bulkCapaAvailableChars = useMemo(() => {
    const term = bulkCapaCharSearch.trim().toLowerCase();
    return characters
      .filter(c => !!c.image && (!term || c.name.toLowerCase().includes(term)))
      .sort((a, b) => a.id - b.id)
      .map(c => c.name);
  }, [characters, bulkCapaCharSearch]);
  const bulkCapaMatches = useMemo(() => {
    return characters.filter(c => !!c.image && (bulkCapaChars.size === 0 || bulkCapaChars.has(c.name)));
  }, [characters, bulkCapaChars]);

  const toggleInSet = (set: Set<string>, setSet: (s: Set<string>) => void, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setSet(next);
  };

  // Baixa uma imagem, tentando de novo se a primeira falhar. cache: 'no-store' evita pegar do
  // cache do navegador uma resposta antiga sem CORS (de quando a imagem foi vista via <img> em
  // outra tela, antes do bucket ter CORS liberado) — sem isso o fetch falha mesmo a imagem existindo.
  const fetchImageWithRetry = async (url: string): Promise<Blob> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.blob();
      } catch (e) {
        if (attempt === 1) throw e;
      }
    }
    throw new Error('unreachable');
  };

  const handleBulkDownload = useCallback(async () => {
    if (bulkMatches.length === 0) return;
    setBulkDownloading(true);
    setBulkError(null);
    setBulkProgress({ done: 0, total: bulkMatches.length });
    const failed: string[] = [];
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();
      for (let i = 0; i < bulkMatches.length; i++) {
        const item = bulkMatches[i];
        try {
          const blob = await fetchImageWithRetry(item.imageUrl!);
          const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
          let fileName = `${item.temporada} - ${item.arco}.${ext}`;
          let n = 2;
          while (usedNames.has(fileName)) { fileName = `${item.temporada} - ${item.arco} (${n}).${ext}`; n++; }
          usedNames.add(fileName);
          zip.file(fileName, blob);
        } catch (e) {
          console.error(`Falha ao baixar ${item.temporada} - ${item.arco}:`, e);
          failed.push(`${item.temporada} - ${item.arco}`);
        }
        setBulkProgress({ done: i + 1, total: bulkMatches.length });
      }
      if (failed.length === bulkMatches.length) {
        throw new Error('Nenhuma imagem pôde ser baixada.');
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `linha-do-tempo-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      if (failed.length > 0) {
        setBulkError(`${failed.length} imagem(ns) não entraram no zip (falha ao baixar): ${failed.join(', ')}`);
      }
    } catch (e) {
      console.error('Erro ao baixar imagens em lote:', e);
      setBulkError('Não foi possível gerar o zip.');
    } finally {
      setBulkDownloading(false);
      setBulkProgress(null);
    }
  }, [bulkMatches]);

  const handleBulkCapaDownload = useCallback(async () => {
    if (bulkCapaMatches.length === 0) return;
    setBulkCapaDownloading(true);
    setBulkCapaError(null);
    setBulkCapaProgress({ done: 0, total: bulkCapaMatches.length });
    const failed: string[] = [];
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();
      for (let i = 0; i < bulkCapaMatches.length; i++) {
        const char = bulkCapaMatches[i];
        try {
          const blob = await fetchImageWithRetry(char.image!);
          const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
          let fileName = `${char.name}.${ext}`;
          let n = 2;
          while (usedNames.has(fileName)) { fileName = `${char.name} (${n}).${ext}`; n++; }
          usedNames.add(fileName);
          zip.file(fileName, blob);
        } catch (e) {
          console.error(`Falha ao baixar capa de ${char.name}:`, e);
          failed.push(char.name);
        }
        setBulkCapaProgress({ done: i + 1, total: bulkCapaMatches.length });
      }
      if (failed.length === bulkCapaMatches.length) {
        throw new Error('Nenhuma imagem pôde ser baixada.');
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `capas-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      if (failed.length > 0) {
        setBulkCapaError(`${failed.length} imagem(ns) não entraram no zip (falha ao baixar): ${failed.join(', ')}`);
      }
    } catch (e) {
      console.error('Erro ao baixar capas em lote:', e);
      setBulkCapaError('Não foi possível gerar o zip.');
    } finally {
      setBulkCapaDownloading(false);
      setBulkCapaProgress(null);
    }
  }, [bulkCapaMatches]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <header className="mb-4 pl-6 py-2 relative">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-tech-primary"></div>
        <h1 className="text-3xl md:text-5xl font-black text-white mb-2 tracking-tighter uppercase relative inline-block">
          PAINEL<span className="text-tech-primary">_ADMINISTRATIVO</span>
        </h1>
        <p className="text-tech-primary/80 text-sm flex items-center gap-2">
          <Radio size={13} className="animate-pulse" />
          <span className="uppercase tracking-widest">Personagens e arsenal sincronizados em tempo real com o Firestore</span>
        </p>
      </header>

      <div className="flex items-center gap-1 border-b border-tech-border overflow-x-auto">
        {([
          { key: 'geral' as const, label: 'Visão Geral' },
          { key: 'classificacoes' as const, label: 'Classificações' },
          { key: 'personagens' as const, label: 'Personagens' },
          { key: 'arsenal' as const, label: 'Arsenal' },
          { key: 'invocacoes' as const, label: 'Invocações' },
          { key: 'canva' as const, label: 'Listas' },
          { key: 'eventos' as const, label: 'Eventos' },
          { key: 'links' as const, label: 'Links' },
          { key: 'perfil' as const, label: 'Perfil' },
          { key: 'producao' as const, label: 'Produção' },
          { key: 'prototipos' as const, label: 'Protótipos' },
        ]).map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => goToPanelTab(t.key)}
            className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 -mb-px whitespace-nowrap ${activeTab === t.key ? 'border-tech-primary text-tech-primary' : 'border-transparent text-tech-primary/40 hover:text-tech-primary/70'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'geral' && (
      <>
      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Banco de Dados</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard icon={Database} label="Total" value={totalImageRefs} sub="Personagens + Arsenal + Técnicas + Galeria" />
          <StatCard icon={Users} label="Personagens" value={characters.length} sub={characters.length ? `${deadCount} mortos (${((deadCount / characters.length) * 100).toFixed(0)}%)` : undefined} />
          <StatCard icon={Scroll} label="Técnicas cadastradas" value={totalTechniques} />
          <StatCard icon={Shield} label="Arsenal" value={arsenalItems.length} />
          <StatCard icon={Clock} label="Linha do tempo" value={totalTimelineImages} />
          <StatCard icon={Sparkles} label="Modos e transf." value={totalTransformacaoImages} />
          <StatCard icon={Images} label="Eventos" value={totalEventoImages} />
        </div>
      </section>

      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Firebase Storage</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>

        <div className="border border-tech-border bg-tech-panel/30 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div className="flex items-center gap-2 text-tech-primary/70">
              <HardDrive size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Armazenamento de imagens</span>
            </div>
            <button
              type="button"
              onClick={loadStorageStats}
              disabled={storageLoading}
              className="flex items-center gap-1.5 px-2 py-1 border border-tech-primary/40 text-tech-primary text-[9px] font-bold uppercase hover:bg-tech-primary hover:text-black transition-all disabled:opacity-50"
            >
              {storageLoading ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              {storageLoading ? 'Calculando...' : 'Atualizar'}
            </button>
          </div>

          {storageError ? (
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <AlertTriangle size={14} /> {storageError}
            </div>
          ) : storageStats ? (
            <>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <span className="text-2xl font-black text-white text-glow">{formatMB(storageStats.totalBytes)} MB</span>
                  <span className="text-tech-primary/40 text-sm"> / 5.120 MB grátis</span>
                </div>
                <span className="text-tech-primary text-sm font-bold">{pctUsed.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-black border border-tech-border overflow-hidden mb-3">
                <div
                  className="h-full bg-tech-primary shadow-[0_0_8px_rgba(0,255,65,0.5)] transition-all duration-700"
                  style={{ width: `${pctUsed}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-tech-primary/40 uppercase tracking-wide">
                <span>{storageStats.fileCount} arquivos no bucket</span>
                {lastUpdated && <span>Atualizado às {formatTime(lastUpdated)}</span>}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-tech-primary/40 text-xs uppercase tracking-widest">
              <Loader size={13} className="animate-spin" /> Calculando uso do Storage...
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Temporadas</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>
        <div className="border border-tech-border bg-tech-panel/30 p-5">
          <div className="flex items-center gap-2 text-tech-primary/70 mb-1">
            <BookOpen size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Temporadas — nomes e marcos</span>
          </div>
          <p className="text-[9px] text-tech-primary/40 uppercase tracking-wide mb-3">Provisório — só referência de contexto, ainda não é oficial.</p>
          <div className="flex flex-col gap-3">
            {SEASON_LORE.map(s => (
              <div key={s.season} className="border border-tech-border/60 bg-black/30 p-3">
                <div className="text-tech-primary font-black uppercase tracking-wide text-xs">{s.season}</div>
                {s.title && <div className="text-white text-sm mb-1">{s.title}</div>}
                <div className="text-[10px] text-tech-primary/50">Início: {s.start}</div>
                <div className="text-[10px] text-tech-primary/50">Final: {s.end}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      </>
      )}

      {activeTab === 'perfil' && (
      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Perfil de combate</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>

        <p className="text-[11px] text-tech-primary/50 mb-4 max-w-3xl leading-relaxed">
          Duas escolhas por personagem resolvem os sete atributos de qualquer NC. Nada disso aparece
          no site — é só para distribuir. <span className="text-tech-primary">Estilo</span> manda o par
          dele ao teto e o par oposto ao mínimo; <span className="text-tech-primary">foco</span> diz qual
          dos três livres puxa a sobra primeiro. A prévia mostra o resultado no NC de hoje.
        </p>

        <div className="border border-tech-border bg-tech-panel/30 p-4 mb-5">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="text-[10px] text-tech-primary/40 uppercase tracking-wide">
              <span className="text-white text-lg font-black">{perfilCompletos}</span>
              <span>/{characters.length} com estilo e foco definidos</span>
            </div>
            <div className="flex-1 min-w-[120px] h-1 bg-black border border-tech-border overflow-hidden">
              <div className="h-full bg-tech-primary transition-all duration-500" style={{ width: `${characters.length ? (perfilCompletos / characters.length) * 100 : 0}%` }} />
            </div>
            {perfilErro && <span className="text-[10px] text-red-400">{perfilErro}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tech-primary/40" />
              <input
                type="search"
                value={perfilBusca}
                onChange={e => setPerfilBusca(e.target.value)}
                placeholder="buscar personagem ou clã..."
                className="w-full bg-black border border-tech-border pl-8 pr-2 py-2 text-[11px] text-tech-primary placeholder:text-tech-primary/30 focus:border-tech-primary outline-none"
              />
            </div>
            {([
              { k: 'todos' as const, l: 'Todos' },
              { k: 'faltando' as const, l: 'Faltando' },
              { k: 'completos' as const, l: 'Definidos' },
            ]).map(f => (
              <button
                key={f.k}
                type="button"
                onClick={() => setPerfilFiltro(f.k)}
                className={`px-2.5 py-2 border text-[9px] font-bold uppercase tracking-widest transition-all ${perfilFiltro === f.k ? 'bg-tech-primary text-black border-tech-primary' : 'border-tech-border text-tech-primary/50 hover:text-tech-primary'}`}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>

        <div className="border border-tech-border bg-tech-panel/20 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-tech-panel/60 text-tech-primary/40 text-[9px] uppercase tracking-widest">
                <th className="py-2 pl-3 pr-3 text-left font-normal">Personagem</th>
                <th className="py-2 pr-3 text-right font-normal w-12">NC</th>
                <th className="py-2 pr-3 text-left font-normal w-52">Estilo</th>
                <th className="py-2 pr-3 text-left font-normal">Foco da sobra</th>
                <th className="py-2 pr-3 text-left font-normal w-56">Prévia · F/D/A/I/E/V/P</th>
              </tr>
            </thead>
            <tbody>
              {perfilLista.map(({ c, previa, atual, prev, igual }) => (
                <tr key={c.docId ?? c.name} className="border-t border-tech-border/40 hover:bg-tech-panel/40">
                  <td className="py-1.5 pl-3 pr-3">
                    <span className="text-white font-bold">{c.name}</span>
                    {c.clan && <span className="text-tech-primary/30 text-[9px] uppercase tracking-wide ml-2">{c.clan}</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-tech-primary/60">{c.nc || '—'}</td>
                  <td className="py-1.5 pr-3">
                    <div className="flex gap-1">
                      {(['Corporal', 'Distância'] as const).map(e => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => gravaPerfil(c, { combatStyle: c.combatStyle === e ? undefined : e })}
                          disabled={c.combatStyle === e}
                          title={e === 'Corporal' ? 'Força e Agilidade no teto' : 'Destreza e Percepção no teto'}
                          className={`px-2 py-0.5 border text-[9px] font-bold uppercase tracking-wide transition-all ${c.combatStyle === e ? 'bg-tech-primary text-black border-tech-primary' : 'border-tech-border text-tech-primary/40 hover:text-tech-primary hover:border-tech-primary/60'}`}
                        >
                          {e === 'Distância' ? 'Distância' : 'Corporal'}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {FOCOS.map(f => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => gravaPerfil(c, { focoAtributo: c.focoAtributo === f.key ? undefined : f.key })}
                          disabled={c.focoAtributo === f.key}
                          className={`px-2 py-0.5 border text-[9px] font-bold uppercase tracking-wide transition-all ${c.focoAtributo === f.key ? 'bg-tech-primary text-black border-tech-primary' : 'border-tech-border text-tech-primary/40 hover:text-tech-primary hover:border-tech-primary/60'}`}
                        >
                          {f.label}
                        </button>
                      ))}
                      {perfilSalvando === c.docId && <Loader size={10} className="animate-spin text-tech-primary self-center" />}
                    </div>
                  </td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {!prev ? (
                      <span className="text-tech-primary/25 text-[10px] uppercase tracking-wide">
                        {!c.nc ? 'sem NC' : 'escolha os dois'}
                      </span>
                    ) : (
                      <div className="flex flex-col gap-0.5 font-mono text-[10px] tabular-nums">
                        {/* verde quando a prévia bate com o que já está na ficha; âmbar quando difere,
                            porque aí aplicar mudaria atributo — e o Pedro precisa ver isso antes */}
                        <span className={igual ? 'text-tech-primary' : 'text-orange-400'}>
                          {prev.join('/')} <span className="opacity-50">= {previa!.soma}</span>
                        </span>
                        {!igual && <span className="text-tech-primary/30">hoje {atual.join('/')}</span>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {perfilLista.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-[10px] text-tech-primary/30 uppercase tracking-widest">Nenhum personagem com esse filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeTab === 'producao' && (
      <>
      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Manutenção</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>

        <div className="border border-tech-border bg-tech-panel/30 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
            <div className="flex items-center gap-2 text-tech-primary/70">
              <ListOrdered size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Ordem da checklist</span>
            </div>
            <button
              type="button"
              onClick={handleFixOrder}
              disabled={fixOrderLoading}
              className="flex items-center gap-1.5 px-2 py-1 border border-tech-primary/40 text-tech-primary text-[9px] font-bold uppercase hover:bg-tech-primary hover:text-black transition-all disabled:opacity-50"
            >
              {fixOrderLoading ? <Loader size={11} className="animate-spin" /> : <ListOrdered size={11} />}
              {fixOrderLoading ? 'Corrigindo...' : 'Corrigir Ordem'}
            </button>
          </div>
          <p className="text-[10px] text-tech-primary/40 uppercase tracking-wide mb-2">
            Renumera o campo de ordem de todos os itens do zero, sem lacunas nem colisões, preservando a sequência já exibida por temporada/arco/subarco. Use se a visão "Geral" da Galeria aparecer fora de ordem.
          </p>
          {fixOrderError && (
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <AlertTriangle size={14} /> {fixOrderError}
            </div>
          )}
          {fixOrderResult && (
            <div className="flex items-center gap-2 text-tech-primary text-xs">
              <CheckCircle2 size={14} /> {fixOrderResult}
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Baixar Imagens em Lote</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>

        <div className="border border-tech-border bg-tech-panel/30 p-5 space-y-5">
          <div className="flex items-center gap-2 text-tech-primary/70">
            <Download size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Linha do Tempo — escolha fase(s) e personagem(ns)</span>
          </div>

          {/* Passo 1: fases. Marcando alguma aqui já estreita a lista de personagens abaixo. */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[9px] text-tech-primary/50 uppercase tracking-widest flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-tech-primary/15 text-tech-primary text-[9px] font-black">1</span>
                Fases
                {bulkFases.size === 0
                  ? <span className="normal-case text-tech-primary/30">· nenhuma marcada, incluindo todas ({bulkAvailableFases.length})</span>
                  : <span className="normal-case text-tech-primary">· {bulkFases.size} de {bulkAvailableFases.length} marcada(s)</span>}
              </div>
              <div className="flex items-center gap-3">
                {bulkFases.size < bulkAvailableFases.length && (
                  <button type="button" onClick={() => setBulkFases(new Set(bulkAvailableFases))} className="text-[9px] text-tech-primary/50 hover:text-tech-primary flex items-center gap-1">
                    <CheckSquare size={10} /> marcar todas
                  </button>
                )}
                {bulkFases.size > 0 && (
                  <button type="button" onClick={() => setBulkFases(new Set())} className="text-[9px] text-tech-primary/50 hover:text-tech-primary flex items-center gap-1">
                    <X size={10} /> limpar
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {bulkCoreFases.map(fase => (
                <button
                  key={fase}
                  type="button"
                  onClick={() => toggleInSet(bulkFases, setBulkFases, fase)}
                  className={`px-2 py-1 border text-[10px] font-bold uppercase tracking-wide transition-all ${bulkFases.has(fase) ? 'bg-tech-primary text-black border-tech-primary' : 'border-tech-border text-tech-primary/70 hover:border-tech-primary/50'}`}
                >
                  {fase}
                </button>
              ))}
            </div>
            {bulkExtraFases.length > 0 && (
              <>
                <div className="text-[9px] text-tech-primary/30 uppercase tracking-widest mt-2 mb-1">Marcos exclusivos</div>
                <div className="flex flex-wrap gap-1.5">
                  {bulkExtraFases.map(fase => (
                    <button
                      key={fase}
                      type="button"
                      onClick={() => toggleInSet(bulkFases, setBulkFases, fase)}
                      className={`px-2 py-1 border text-[10px] font-bold uppercase tracking-wide transition-all ${bulkFases.has(fase) ? 'bg-tech-primary text-black border-tech-primary' : 'border-tech-border/60 text-tech-primary/50 hover:border-tech-primary/50'}`}
                    >
                      {fase}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Passo 2: personagens — a lista já reflete só quem tem imagem na(s) fase(s) marcada(s) acima. */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[9px] text-tech-primary/50 uppercase tracking-widest flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-tech-primary/15 text-tech-primary text-[9px] font-black">2</span>
                Personagens
                {bulkChars.size === 0
                  ? <span className="normal-case text-tech-primary/30">· nenhum marcado, incluindo todos ({bulkAvailableChars.length})</span>
                  : <span className="normal-case text-tech-primary">· {bulkChars.size} marcado(s)</span>}
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setBulkChars(new Set([...bulkChars, ...bulkAvailableChars]))} className="text-[9px] text-tech-primary/50 hover:text-tech-primary flex items-center gap-1">
                  <CheckSquare size={10} /> marcar visíveis ({bulkAvailableChars.length})
                </button>
                {bulkChars.size > 0 && (
                  <button type="button" onClick={() => setBulkChars(new Set())} className="text-[9px] text-tech-primary/50 hover:text-tech-primary flex items-center gap-1">
                    <X size={10} /> limpar
                  </button>
                )}
              </div>
            </div>
            <div className="w-full sm:w-64 bg-black border border-tech-border flex items-center px-3 h-9 group focus-within:border-tech-primary transition-all mb-2">
              <Search size={13} className="text-tech-dim group-focus-within:text-tech-primary transition-colors" />
              <input
                type="text"
                placeholder="BUSCAR_PERSONAGEM..."
                value={bulkCharSearch}
                onChange={(e) => setBulkCharSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-tech-primary w-full ml-2 placeholder:text-tech-dim uppercase text-xs"
              />
            </div>
            <div className="max-h-48 overflow-y-auto border border-tech-border/60 bg-black/30 p-2 flex flex-wrap gap-1.5">
              {bulkAvailableChars.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleInSet(bulkChars, setBulkChars, name)}
                  className={`px-2 py-1 border text-[10px] font-bold transition-all ${bulkChars.has(name) ? 'bg-tech-primary text-black border-tech-primary' : 'border-tech-border text-tech-primary/70 hover:border-tech-primary/50'}`}
                >
                  {name}
                </button>
              ))}
              {bulkAvailableChars.length === 0 && (
                <span className="text-tech-primary/40 text-[10px] uppercase tracking-widest">Nenhum personagem encontrado.</span>
              )}
            </div>
          </div>

          {/* Passo 3: conferir e baixar. */}
          <div className="border-t border-tech-border/60 pt-4 space-y-3">
            <button
              type="button"
              onClick={() => setBulkPreviewOpen(o => !o)}
              disabled={bulkMatches.length === 0}
              className="flex items-center gap-1.5 text-[10px] text-tech-primary/70 hover:text-tech-primary uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {bulkPreviewOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {bulkPreviewOpen ? 'Esconder' : 'Conferir'} o que vai no zip ({bulkMatches.length} {bulkMatches.length === 1 ? 'imagem' : 'imagens'} de {bulkPreviewGroups.length} {bulkPreviewGroups.length === 1 ? 'personagem' : 'personagens'})
            </button>

            {bulkPreviewOpen && bulkMatches.length > 0 && (
              <div className="max-h-56 overflow-y-auto border border-tech-border/60 bg-black/30 p-3 space-y-2">
                {bulkPreviewGroups.map(g => (
                  <div key={g.temporada} className="text-xs">
                    <span className="text-white font-bold">{g.temporada}</span>
                    <span className="text-tech-primary/50"> — {g.fases.join(', ')}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleBulkDownload}
                disabled={bulkDownloading || bulkMatches.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 border border-tech-primary/40 text-tech-primary text-[10px] font-bold uppercase hover:bg-tech-primary hover:text-black transition-all disabled:opacity-50"
              >
                {bulkDownloading ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
                {bulkDownloading ? `Baixando ${bulkProgress?.done ?? 0}/${bulkProgress?.total ?? 0}...` : `Baixar ZIP (${bulkMatches.length} ${bulkMatches.length === 1 ? 'imagem' : 'imagens'})`}
              </button>
              {bulkMatches.length === 0 && (
                <span className="text-tech-primary/40 text-[10px] uppercase tracking-wide">Nenhuma imagem bate com essa combinação de fase/personagem.</span>
              )}
              {bulkError && (
                <span className="flex items-center gap-1.5 text-red-400 text-xs"><AlertTriangle size={13} /> {bulkError}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Baixar Capas em Lote</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>

        <div className="border border-tech-border bg-tech-panel/30 p-5 space-y-5">
          <div className="flex items-center gap-2 text-tech-primary/70">
            <Images size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Capas — escolha o(s) personagem(ns)</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[9px] text-tech-primary/50 uppercase tracking-widest flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-tech-primary/15 text-tech-primary text-[9px] font-black">1</span>
                Personagens
                {bulkCapaChars.size === 0
                  ? <span className="normal-case text-tech-primary/30">· nenhum marcado, incluindo todos ({bulkCapaAvailableChars.length})</span>
                  : <span className="normal-case text-tech-primary">· {bulkCapaChars.size} marcado(s)</span>}
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setBulkCapaChars(new Set([...bulkCapaChars, ...bulkCapaAvailableChars]))} className="text-[9px] text-tech-primary/50 hover:text-tech-primary flex items-center gap-1">
                  <CheckSquare size={10} /> marcar visíveis ({bulkCapaAvailableChars.length})
                </button>
                {bulkCapaChars.size > 0 && (
                  <button type="button" onClick={() => setBulkCapaChars(new Set())} className="text-[9px] text-tech-primary/50 hover:text-tech-primary flex items-center gap-1">
                    <X size={10} /> limpar
                  </button>
                )}
              </div>
            </div>
            <div className="w-full sm:w-64 bg-black border border-tech-border flex items-center px-3 h-9 group focus-within:border-tech-primary transition-all mb-2">
              <Search size={13} className="text-tech-dim group-focus-within:text-tech-primary transition-colors" />
              <input
                type="text"
                placeholder="BUSCAR_PERSONAGEM..."
                value={bulkCapaCharSearch}
                onChange={(e) => setBulkCapaCharSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-tech-primary w-full ml-2 placeholder:text-tech-dim uppercase text-xs"
              />
            </div>
            <div className="max-h-48 overflow-y-auto border border-tech-border/60 bg-black/30 p-2 flex flex-wrap gap-1.5">
              {bulkCapaAvailableChars.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleInSet(bulkCapaChars, setBulkCapaChars, name)}
                  className={`px-2 py-1 border text-[10px] font-bold transition-all ${bulkCapaChars.has(name) ? 'bg-tech-primary text-black border-tech-primary' : 'border-tech-border text-tech-primary/70 hover:border-tech-primary/50'}`}
                >
                  {name}
                </button>
              ))}
              {bulkCapaAvailableChars.length === 0 && (
                <span className="text-tech-primary/40 text-[10px] uppercase tracking-widest">Nenhum personagem encontrado.</span>
              )}
            </div>
          </div>

          <div className="border-t border-tech-border/60 pt-4 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleBulkCapaDownload}
              disabled={bulkCapaDownloading || bulkCapaMatches.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-tech-primary/40 text-tech-primary text-[10px] font-bold uppercase hover:bg-tech-primary hover:text-black transition-all disabled:opacity-50"
            >
              {bulkCapaDownloading ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
              {bulkCapaDownloading ? `Baixando ${bulkCapaProgress?.done ?? 0}/${bulkCapaProgress?.total ?? 0}...` : `Baixar ZIP (${bulkCapaMatches.length} ${bulkCapaMatches.length === 1 ? 'capa' : 'capas'})`}
            </button>
            {bulkCapaMatches.length === 0 && (
              <span className="text-tech-primary/40 text-[10px] uppercase tracking-wide">Nenhum personagem com capa cadastrada bate com essa seleção.</span>
            )}
            {bulkCapaError && (
              <span className="flex items-center gap-1.5 text-red-400 text-xs"><AlertTriangle size={13} /> {bulkCapaError}</span>
            )}
          </div>
        </div>
      </section>
      </>
      )}

      {activeTab === 'personagens' && (
      <>
      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Personagens</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Users} label="Personagens totais" value={totalCharactersOverall} sub="Com ficha + pendentes" />
          <StatCard icon={UserCheck} label="Com ficha" value={characters.length} />
          <StatCard icon={UserX} label="Sem ficha" value={pendingCount} sub="Pendentes" />
          <StatCard icon={HeartPulse} label="Vivos" value={aliveCount} />
          <StatCard icon={Skull} label="Mortos" value={deadCount} sub={characters.length ? `${((deadCount / characters.length) * 100).toFixed(0)}%` : undefined} />
          <StatCard icon={Award} label="NC 30" value={nc30Count} sub="Tier máximo" />
        </div>
      </section>

      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Cronologia da Linha do Tempo</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>

        <div className="border border-tech-border bg-tech-panel/30 p-5 space-y-4">
          <div className="flex items-center gap-2 text-tech-primary/70">
            <Clock size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Aparição / buracos / morte por personagem</span>
          </div>

          <div className="w-full sm:w-64 bg-black border border-tech-border flex items-center px-3 h-9 group focus-within:border-tech-primary transition-all">
            <Search size={13} className="text-tech-dim group-focus-within:text-tech-primary transition-colors" />
            <input
              type="text"
              placeholder="BUSCAR_PERSONAGEM..."
              value={chronologySearch}
              onChange={(e) => setChronologySearch(e.target.value)}
              className="bg-transparent border-none outline-none text-tech-primary w-full ml-2 placeholder:text-tech-dim uppercase text-xs"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] text-tech-primary/50 uppercase tracking-widest border-b border-tech-border">
                  <th className="text-left font-black py-2 pr-3">Personagem</th>
                  <th className="text-left font-black py-2 pr-3">Aparição</th>
                  <th className="text-left font-black py-2 pr-3">Não apareceu</th>
                  <th className="text-left font-black py-2 pr-3">Morte</th>
                </tr>
              </thead>
              <tbody>
                {chronologyRows.map(c => (
                  <tr key={c.docId ?? c.name} className="border-b border-tech-border/40 hover:bg-tech-primary/5">
                    <td className="py-1.5 pr-3 text-white font-bold whitespace-nowrap">{c.name}</td>
                    <td className="py-1.5 pr-3 text-tech-primary whitespace-nowrap">{c.timelineAppearance ?? 'Prólogo'}</td>
                    <td className="py-1.5 pr-3 text-yellow-400/80 whitespace-nowrap">
                      {c.timelineSkipped && c.timelineSkipped.length > 0 ? (
                        <span className="flex items-center gap-1"><SkipForward size={11} /> {c.timelineSkipped.join(', ')}</span>
                      ) : (
                        <span className="text-tech-primary/30">—</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {c.timelineDeath ? (
                        <span className="flex items-center gap-1 text-red-400"><Skull size={11} /> {c.timelineDeath}</span>
                      ) : (
                        <span className="text-tech-primary/30">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {chronologyRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-tech-primary/40 uppercase tracking-widest text-[10px]">
                      Nenhum personagem encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {chronologyExcluded.length > 0 && (
            <div className="text-[10px] text-tech-primary/40 uppercase tracking-wide">
              Fora da Linha do Tempo de propósito: {chronologyExcluded.map(c => c.name).join(', ')}.
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Personagens por Vila</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>

        <div className="border border-tech-border bg-tech-panel/30 p-5 space-y-3">
          <div className="flex items-center gap-2 text-tech-primary/70 mb-1">
            <MapPin size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Vila de nascença — com ficha + pendentes</span>
          </div>

          {villageRows.rows.map(r => {
            const isOpen = expandedVillages.has(r.village);
            return (
              <div key={r.village}>
                <button
                  type="button"
                  onClick={() => toggleInSet(expandedVillages, setExpandedVillages, r.village)}
                  disabled={r.total === 0}
                  className="w-full text-left group disabled:cursor-default"
                >
                  <div className="flex items-end justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-white font-bold text-sm group-hover:text-tech-primary transition-colors">
                      {r.total > 0 && (isOpen ? <ChevronUp size={13} className="text-tech-primary shrink-0" /> : <ChevronDown size={13} className="text-tech-primary/50 shrink-0" />)}
                      {r.village}
                    </span>
                    <span className="text-[10px] text-tech-primary/50 uppercase tracking-wide">
                      <span className="text-tech-primary font-bold">{r.registered}</span> com ficha
                      {r.pending > 0 && <> + <span className="text-tech-primary font-bold">{r.pending}</span> pendente{r.pending === 1 ? '' : 's'}</>}
                      {' '}= <span className="text-white font-black">{r.total}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-black border border-tech-border overflow-hidden">
                    <div
                      className="h-full bg-tech-primary shadow-[0_0_8px_rgba(0,255,65,0.5)] transition-all duration-700"
                      style={{ width: `${(r.total / villageRows.maxTotal) * 100}%` }}
                    />
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-2 mb-1 pl-1 flex flex-wrap gap-1.5">
                    {r.registeredNames.map(name => (
                      <span key={name} className="px-2 py-0.5 border border-tech-border/60 bg-black/30 text-white text-[10px]">{name}</span>
                    ))}
                    {r.pendingNames.map(name => (
                      <span key={name} className="px-2 py-0.5 border border-tech-border/40 text-tech-primary/50 text-[10px] italic">{name} (pendente)</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {villageRows.unclassified > 0 && (
            <div className="text-[10px] text-tech-primary/40 uppercase tracking-wide pt-1">
              {villageRows.unclassified} personagem(ns) com ficha ainda sem vila de nascença definida.
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Personagens por Clã</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>

        <div className="border border-tech-border bg-tech-panel/30 p-5 space-y-3">
          <div className="flex items-center gap-2 text-tech-primary/70 mb-1">
            <Users size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Com ficha + pendentes (clã derivado do sobrenome)</span>
          </div>

          {clanRows.rows.map(r => {
            const isOpen = expandedClans.has(r.clan);
            return (
              <div key={r.clan}>
                <button
                  type="button"
                  onClick={() => toggleInSet(expandedClans, setExpandedClans, r.clan)}
                  disabled={r.total === 0}
                  className="w-full text-left group disabled:cursor-default"
                >
                  <div className="flex items-end justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-white font-bold text-sm group-hover:text-tech-primary transition-colors">
                      {r.total > 0 && (isOpen ? <ChevronUp size={13} className="text-tech-primary shrink-0" /> : <ChevronDown size={13} className="text-tech-primary/50 shrink-0" />)}
                      {r.clan}
                    </span>
                    <span className="text-[10px] text-tech-primary/50 uppercase tracking-wide">
                      <span className="text-tech-primary font-bold">{r.registered}</span> com ficha
                      {r.pending > 0 && <> + <span className="text-tech-primary font-bold">{r.pending}</span> pendente{r.pending === 1 ? '' : 's'}</>}
                      {' '}= <span className="text-white font-black">{r.total}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-black border border-tech-border overflow-hidden">
                    <div
                      className="h-full bg-tech-primary shadow-[0_0_8px_rgba(0,255,65,0.5)] transition-all duration-700"
                      style={{ width: `${(r.total / clanRows.maxTotal) * 100}%` }}
                    />
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-2 mb-1 pl-1 flex flex-wrap gap-1.5">
                    {r.registeredNames.map(name => (
                      <span key={name} className="px-2 py-0.5 border border-tech-border/60 bg-black/30 text-white text-[10px]">{name}</span>
                    ))}
                    {r.pendingNames.map(name => (
                      <span key={name} className="px-2 py-0.5 border border-tech-border/40 text-tech-primary/50 text-[10px] italic">{name} (pendente)</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      </>
      )}

      {activeTab === 'arsenal' && (
      <>
      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Arsenal</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Shield} label="Arsenal" value={totalArsenalOverall} sub="Com ficha + pendentes" />
          <StatCard icon={UserX} label="Arsenal sem ficha" value={pendingArsenalCount} sub="Pendentes" />
          <StatCard icon={Award} label="Rank Z" value={rankZCount} />
          <StatCard icon={Award} label="Rank S++" value={rankSPlusPlusCount} />
          <StatCard icon={Award} label="Rank S+" value={rankSPlusCount} />
          <StatCard icon={Award} label="Rank S" value={rankSCount} />
        </div>
      </section>

      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Arsenal por Vila</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>

        <div className="border border-tech-border bg-tech-panel/30 p-5 space-y-3">
          <div className="flex items-center gap-2 text-tech-primary/70 mb-1">
            <MapPin size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Origem — com ficha + pendentes</span>
          </div>

          {arsenalVillageRows.rows.map(r => {
            const isOpen = expandedArsenalOrigins.has(r.village);
            return (
              <div key={r.village}>
                <button
                  type="button"
                  onClick={() => toggleInSet(expandedArsenalOrigins, setExpandedArsenalOrigins, r.village)}
                  disabled={r.total === 0}
                  className="w-full text-left group disabled:cursor-default"
                >
                  <div className="flex items-end justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-white font-bold text-sm group-hover:text-tech-primary transition-colors">
                      {r.total > 0 && (isOpen ? <ChevronUp size={13} className="text-tech-primary shrink-0" /> : <ChevronDown size={13} className="text-tech-primary/50 shrink-0" />)}
                      {r.village}
                    </span>
                    <span className="text-[10px] text-tech-primary/50 uppercase tracking-wide">
                      <span className="text-tech-primary font-bold">{r.registered}</span> com ficha
                      {r.pending > 0 && <> + <span className="text-tech-primary font-bold">{r.pending}</span> pendente{r.pending === 1 ? '' : 's'}</>}
                      {' '}= <span className="text-white font-black">{r.total}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-black border border-tech-border overflow-hidden">
                    <div
                      className="h-full bg-tech-primary shadow-[0_0_8px_rgba(0,255,65,0.5)] transition-all duration-700"
                      style={{ width: `${(r.total / arsenalVillageRows.maxTotal) * 100}%` }}
                    />
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-2 mb-1 pl-1 flex flex-wrap gap-1.5">
                    {r.registeredNames.map(name => (
                      <span key={name} className="px-2 py-0.5 border border-tech-border/60 bg-black/30 text-white text-[10px]">{name}</span>
                    ))}
                    {r.pendingNames.map(name => (
                      <span key={name} className="px-2 py-0.5 border border-tech-border/40 text-tech-primary/50 text-[10px] italic">{name} (pendente)</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Arsenal por Natureza</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>

        <div className="border border-tech-border bg-tech-panel/30 p-5 space-y-3">
          <div className="flex items-center gap-2 text-tech-primary/70 mb-1">
            <Scroll size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Uma arma com natureza composta (ex: "Suiton + Fuinjutsu") conta em cada natureza separada</span>
          </div>

          {arsenalNatureRows.rows.map(r => {
            const isOpen = expandedArsenalNatures.has(r.nature);
            return (
              <div key={r.nature}>
                <button
                  type="button"
                  onClick={() => toggleInSet(expandedArsenalNatures, setExpandedArsenalNatures, r.nature)}
                  disabled={r.total === 0}
                  className="w-full text-left group disabled:cursor-default"
                >
                  <div className="flex items-end justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-white font-bold text-sm group-hover:text-tech-primary transition-colors">
                      {r.total > 0 && (isOpen ? <ChevronUp size={13} className="text-tech-primary shrink-0" /> : <ChevronDown size={13} className="text-tech-primary/50 shrink-0" />)}
                      {r.nature}
                    </span>
                    <span className="text-[10px] text-tech-primary/50 uppercase tracking-wide">
                      <span className="text-white font-black">{r.total}</span> arma{r.total === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="h-2 bg-black border border-tech-border overflow-hidden">
                    <div
                      className="h-full bg-tech-primary shadow-[0_0_8px_rgba(0,255,65,0.5)] transition-all duration-700"
                      style={{ width: `${(r.total / arsenalNatureRows.maxTotal) * 100}%` }}
                    />
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-2 mb-1 pl-1 flex flex-wrap gap-1.5">
                    {r.names.map(name => (
                      <span key={name} className="px-2 py-0.5 border border-tech-border/60 bg-black/30 text-white text-[10px]">{name}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      </>
      )}

      {activeTab === 'prototipos' && (
      <>
      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Protótipos</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>

        <div className="border border-tech-border bg-tech-panel/30 p-5 space-y-4">
          <div className="flex items-center gap-2 text-tech-primary/70 mb-1">
            <FlaskConical size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Rascunho de personagem em desenvolvimento</span>
          </div>
          <p className="text-[9px] text-tech-primary/40 uppercase tracking-wide">
            Um quadrado por protótipo (nome do personagem), organizado por vila. Clique num quadrado pra ver todas as imagens e textos dele. Guardado num lugar simples no Storage — tudo é apagado ao fim do RPG. Envie as imagens e textos direto no chat — sem upload por aqui, por enquanto.
          </p>

          <div className="flex flex-nowrap gap-1.5 overflow-x-auto">
            {['Todos', ...VILLAGES].map(v => {
              const count = v === 'Todos' ? prototypeEntries.length : prototypeEntries.filter(e => e.village === v).length;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPrototypeVillage(v)}
                  className={`shrink-0 whitespace-nowrap px-2.5 py-1 border text-[10px] font-bold uppercase tracking-wide transition-all ${prototypeVillage === v ? 'bg-tech-primary text-black border-tech-primary' : 'border-tech-border text-tech-primary/70 hover:border-tech-primary/50'}`}
                >
                  {v} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>

          {prototypeVillage === 'Kirigakure' && (
            <div className="flex gap-1.5">
              {(['grid', 'kanban'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPrototypeViewMode(mode)}
                  className={`px-2.5 py-1 border text-[9px] font-bold uppercase tracking-wide transition-all ${prototypeViewMode === mode ? 'bg-tech-primary/20 border-tech-primary text-tech-primary' : 'border-tech-border/60 text-tech-primary/50 hover:border-tech-primary/40'}`}
                >
                  {mode === 'grid' ? 'Quadrados' : 'Kanban (frotas)'}
                </button>
              ))}
            </div>
          )}

          {prototypeVillage === 'Kirigakure' && prototypeViewMode === 'kanban' ? (() => {
            const FLEET_ORDER = ['Kraken', 'Leviatã', 'Megalodon', 'Jörmungandr'];
            const RANK_ORDER = ['Almirante', 'Vice-Almirante', 'Capitão de Frota', 'Capitão-Tenente'];
            const entryFor = (fleet: string, rank: string) =>
              prototypeEntries.find(e => e.village === 'Kirigakure' && e.subgroup === fleet && e.rank === rank);
            return (
              <div className="overflow-x-auto">
                <div className="grid gap-2 min-w-[720px]" style={{ gridTemplateColumns: `120px repeat(${FLEET_ORDER.length}, 1fr)` }}>
                  <div />
                  {FLEET_ORDER.map(fleet => (
                    <div key={fleet} className="text-center text-[10px] font-black text-tech-primary uppercase tracking-widest border-b border-tech-border pb-1.5">
                      {fleet}
                    </div>
                  ))}
                  {RANK_ORDER.map(rank => (
                    <React.Fragment key={rank}>
                      <div className="flex items-center text-[9px] font-black text-tech-primary/50 uppercase tracking-wide">
                        {rank}
                      </div>
                      {FLEET_ORDER.map(fleet => {
                        const entry = entryFor(fleet, rank);
                        return (
                          <div key={fleet} className="aspect-square">
                            {entry ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/painel/prototipos/${encodeURIComponent(slugify(entry.title))}`)}
                                className="w-full h-full border border-tech-border/60 bg-black/30 hover:border-tech-primary/60 transition-all relative overflow-hidden group text-left"
                              >
                                {entry.images[0] ? (
                                  <img src={entry.images[0]} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                                ) : (
                                  <FlaskConical size={16} className="absolute inset-0 m-auto text-tech-primary/30" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                                <span className="absolute bottom-1 left-1 right-1 text-white font-bold text-[10px] leading-tight">{entry.title}</span>
                              </button>
                            ) : (
                              <div className="w-full h-full border border-dashed border-tech-border/30 flex items-center justify-center">
                                <span className="text-tech-primary/20 text-[9px] uppercase">vago</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })() : (() => {
            const filtered = prototypeVillage === 'Todos' ? prototypeEntries : prototypeEntries.filter(e => e.village === prototypeVillage);
            if (filtered.length === 0) {
              return <div className="text-tech-primary/40 text-xs uppercase tracking-widest text-center py-6">Nada guardado ainda em {prototypeVillage}.</div>;
            }

            // A primeira linha do texto do protótipo é sempre o cargo/posição (ex: "Almirante
            // da Frota Kraken.") — mostra ela como subtítulo embaixo do nome no card.
            const roleOf = (entry: PrototypeEntry) => entry.text?.split('\n')[0]?.trim().replace(/\.$/, '') || '';

            const renderCard = (entry: PrototypeEntry) => (
              <button
                key={entry.docId}
                type="button"
                onClick={() => navigate(`/painel/prototipos/${encodeURIComponent(slugify(entry.title))}`)}
                className="aspect-square border border-tech-border/60 bg-black/30 hover:border-tech-primary/60 transition-all relative overflow-hidden group text-left"
              >
                {entry.images[0] ? (
                  <img src={entry.images[0]} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                ) : (
                  <FlaskConical size={20} className="absolute inset-0 m-auto text-tech-primary/30" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute bottom-1.5 left-1.5 right-1.5">
                  <span className="block text-white font-bold text-xs leading-tight">{entry.title}</span>
                  {roleOf(entry) && (
                    <span className="block text-tech-primary/70 text-[9px] uppercase tracking-wide leading-tight truncate">{roleOf(entry)}</span>
                  )}
                </div>
                {pendingNcByName.get(entry.title) !== undefined && (
                  <span className="absolute top-1.5 left-1.5 bg-black/70 text-tech-primary text-[9px] font-black px-1.5 py-0.5 border border-tech-border/60">NC {pendingNcByName.get(entry.title)}</span>
                )}
                {entry.images.length > 1 && (
                  <span className="absolute top-1.5 right-1.5 bg-black/70 text-tech-primary text-[9px] font-bold px-1.5 py-0.5 border border-tech-border/60">{entry.images.length}</span>
                )}
              </button>
            );

            const hasSubgroups = filtered.some(e => e.subgroup);
            if (!hasSubgroups) {
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filtered.map(renderCard)}
                </div>
              );
            }

            const FLEET_ORDER = ['Kraken', 'Leviatã', 'Megalodon', 'Jörmungandr'];
            const subgroupNames = [...new Set<string>(filtered.map(e => e.subgroup || 'Outros'))].sort((a, b) => {
              const ia = FLEET_ORDER.indexOf(a);
              const ib = FLEET_ORDER.indexOf(b);
              if (ia === -1 && ib === -1) return a.localeCompare(b);
              if (ia === -1) return 1;
              if (ib === -1) return -1;
              return ia - ib;
            });

            return (
              <div className="space-y-5">
                {subgroupNames.map(sg => (
                  <div key={sg}>
                    <div className="text-[9px] font-black text-tech-primary/50 uppercase tracking-widest mb-2">{sg}</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {filtered.filter(e => (e.subgroup || 'Outros') === sg).map(renderCard)}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </section>

      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Personagens Pendentes</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>
        <div className="border border-tech-border bg-tech-panel/30 p-5">
          <div className="flex items-center gap-2 text-tech-primary/70 mb-1">
            <Users size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Adicionar futuramente no Banco de Dados</span>
          </div>
          <p className="text-[9px] text-tech-primary/40 uppercase tracking-wide mb-3">Personagens que já existem na história mas ainda não foram cadastrados. † = morto.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PENDING_CHARACTERS.map(g => (
              <div key={g.village} className="border border-tech-border/60 bg-black/30 p-3">
                <div className="text-tech-primary font-black uppercase tracking-wide text-xs mb-2">{g.village}</div>
                <ul className="space-y-3">
                  {g.entries.map((e, i) => (
                    <li key={`${e.name}-${i}`} className="text-white text-xs">
                      <span className="inline-flex items-center gap-1">
                        {e.name}
                        {e.dead && <Skull size={10} className="text-red-400 shrink-0" />}
                        {e.nc !== undefined && <span className="text-tech-primary font-bold">NC {e.nc}</span>}
                      </span>
                      {e.role && <span className="text-tech-primary/50"> ({e.role})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
      </>
      )}

      {openPrototypeId && (() => {
        const entry = prototypeEntries.find(e => e.docId === openPrototypeId);
        if (!entry) return null;
        return (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => navigate('/painel/prototipos')}>
            <div className="max-w-3xl w-full max-h-[85vh] overflow-y-auto border border-tech-primary/40 bg-tech-panel p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">{entry.title}</h2>
                  {pendingNcByName.get(entry.title) !== undefined && (
                    <span className="text-tech-primary font-black text-sm border border-tech-primary/40 px-2 py-0.5 shrink-0">NC {pendingNcByName.get(entry.title)}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDeletePrototypeEntry(entry.docId!)}
                    title="Apagar protótipo"
                    className="text-red-500/70 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button type="button" onClick={() => navigate('/painel/prototipos')} title="Fechar" className="text-tech-primary/70 hover:text-tech-primary transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>
              {entry.images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {entry.images.map(url => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt="" className="w-full h-32 object-cover object-top border border-tech-border" />
                    </a>
                  ))}
                </div>
              )}
              {entry.text && <p className="text-white text-sm whitespace-pre-wrap leading-relaxed">{entry.text}</p>}
            </div>
          </div>
        );
      })()}

      {activeTab === 'classificacoes' && (
      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Classificações</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>

        <div className="border border-tech-border bg-tech-panel/30 p-5 space-y-4">
          <div className="flex items-center gap-2 text-tech-primary/70 mb-1">
            <Award size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">NC por vila — ficha e pendente juntos</span>
          </div>
          <p className="text-[9px] text-tech-primary/40 uppercase tracking-wide">
            Referência pra decidir o NC de personagens novos. Ordenado do maior NC pro menor dentro de cada vila.
          </p>

          {/* As vilas rolam quando não cabem; os dois botões de ficha ficam fixos na direita, fora
              da área de rolagem, para não sumirem de vista. */}
          <div className="flex items-center gap-3">
            <div className="flex flex-nowrap gap-1.5 overflow-x-auto flex-1 min-w-0">
              {['Todos', ...CLASSIFICATION_GROUPS].map(v => {
                const count = v === 'Todos' ? classificationAllVillages.length : (classificationsByVillage.get(v)?.length ?? 0);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { setClassificationVillage(v); setClassificationFilter(null); }}
                    className={`shrink-0 whitespace-nowrap px-2.5 py-1 border text-[10px] font-bold uppercase tracking-wide transition-all ${classificationVillage === v ? 'bg-tech-primary text-black border-tech-primary' : 'border-tech-border text-tech-primary/70 hover:border-tech-primary/50'}`}
                  >
                    {v} {count > 0 && `(${count})`}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1.5 shrink-0">
              {([
                { k: 'ficha' as const, l: 'Com Ficha', n: classificationBase.filter(c => !c.pending).length },
                { k: 'pendente' as const, l: 'Sem Ficha', n: classificationBase.filter(c => c.pending).length },
              ]).map(b => (
                <button
                  key={b.k}
                  type="button"
                  // clicar no que já está ativo volta pra todos, então não fica preso num filtro
                  onClick={() => setClassificationFicha(classificationFicha === b.k ? 'todos' : b.k)}
                  className={`whitespace-nowrap px-2.5 py-1 border text-[10px] font-bold uppercase tracking-wide transition-all ${classificationFicha === b.k ? 'bg-tech-primary text-black border-tech-primary' : 'border-tech-border text-tech-primary/70 hover:border-tech-primary/50'}`}
                >
                  {b.l} ({b.n})
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {([
              { key: 'nc30' as const, label: 'NC 30' },
              { key: 'nc26' as const, label: 'NC 26+' },
              { key: 'nc20' as const, label: 'NC 20+' },
              { key: 'nc16' as const, label: 'NC 16+' },
              { key: 'nc8' as const, label: 'NC 8+' },
            ]).map(band => (
              <button
                key={band.key}
                type="button"
                onClick={() => setClassificationFilter(f => f === band.key ? null : band.key)}
                disabled={classificationCounts[band.key] === 0}
                className={`text-left border p-4 flex flex-col gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${classificationFilter === band.key ? 'border-tech-primary bg-tech-primary/10' : 'border-tech-border bg-tech-panel/30 hover:border-tech-primary/50'}`}
              >
                <div className="flex items-center gap-2 text-tech-primary/70">
                  <Award size={13} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{band.label}</span>
                </div>
                <div className="text-3xl font-black text-white text-glow">{classificationCounts[band.key]}</div>
              </button>
            ))}
          </div>

          {classificationFilter && (
            <button
              type="button"
              onClick={() => setClassificationFilter(null)}
              className="text-[9px] text-tech-primary/50 hover:text-tech-primary flex items-center gap-1"
            >
              <X size={10} /> limpar filtro
            </button>
          )}

          {classificationFiltered.length === 0 ? (
            <div className="text-tech-primary/40 text-xs uppercase tracking-widest text-center py-6">
              {classificationChars.length === 0 ? `Nenhum personagem com ficha em ${classificationVillage}.` : 'Nenhum personagem nessa faixa.'}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Sem moldura em volta da lista inteira: com 17 faixas preenchidas dentro de um
                  quadro só, virava zebrado. Cada NC é um bloco solto, e o cabeçalho usa o idioma
                  que o projeto já tem pra grupo — etiqueta sólida de canto cortado + fio até a
                  borda, igual às seções da Galeria da ficha. */}
              {classificationPorNc.map(g => (
                <div key={g.nc}>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-[11px] font-black text-black bg-tech-primary px-2 py-0.5 uppercase tracking-wide clip-corner-sm shrink-0">
                      NC {g.nc}
                    </span>
                    <span className="flex-1 h-px bg-tech-border"></span>
                    <span className="text-[9px] text-tech-primary/35 uppercase tracking-widest shrink-0 tabular-nums">
                      {g.gente.length}
                    </span>
                  </div>
                  <div className="border border-tech-border/50 bg-black/25 divide-y divide-tech-border/30">
                    {g.gente.map(c => (
                      <div key={c.name} className="flex items-baseline justify-between gap-3 px-3 py-1.5 hover:bg-tech-panel/40 transition-colors">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className={`text-sm truncate ${c.pending ? 'text-tech-primary/60 italic font-medium' : 'text-white font-bold'}`}>{c.name}</span>
                          {c.dead && <Skull size={11} className="text-red-500/80 shrink-0 self-center" />}
                        </div>
                        <span className="text-[10px] uppercase tracking-wide shrink-0 truncate max-w-[48%] text-tech-primary/40" title={c.clan || undefined}>
                          {c.pending ? (c.clan || 'pendente') : c.clan}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      {activeTab === 'invocacoes' && (
      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Invocações</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>
        <div className="border border-tech-border border-dashed bg-tech-panel/10 p-10 flex flex-col items-center justify-center text-center gap-3">
          <Sparkles size={28} className="text-tech-primary/30" />
          <span className="text-xs text-tech-dim uppercase tracking-widest">Será adicionado em breve</span>
          <p className="text-[10px] text-tech-primary/35 max-w-md leading-relaxed">
            A faixa <span className="text-tech-primary/60">40000</span> do checklist já está reservada
            para o projeto de Invocações, então quando os itens entrarem eles não deslocam a
            numeração de nenhum dos outros quatro.
          </p>
        </div>
      </section>
      )}

      {activeTab === 'canva' && (
      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Projetos do Canva</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>

        <p className="text-[11px] text-tech-primary/50 mb-4 max-w-3xl leading-relaxed">
          A ordem definitiva das páginas de cada projeto, lida do checklist agora — o número da
          esquerda <span className="text-tech-primary">é</span> o número da página no Canva. Um projeto
          por tipo do checklist, e é isso que permite conferir a contagem de páginas de cada arquivo.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tech-primary/40" />
            <input
              type="search"
              value={canvaSearch}
              onChange={e => setCanvaSearch(e.target.value)}
              placeholder="buscar personagem, fase, evento..."
              className="w-full bg-black border border-tech-border pl-8 pr-2 py-2 text-[11px] text-tech-primary placeholder:text-tech-primary/30 focus:border-tech-primary outline-none"
            />
          </div>
          {([
            { k: 'todos' as const, l: 'Todas' },
            { k: 'falta' as const, l: 'A fazer' },
            { k: 'pronta' as const, l: 'Prontas' },
          ]).map(f => (
            <button
              key={f.k}
              type="button"
              onClick={() => setCanvaState(f.k)}
              className={`px-2.5 py-2 border text-[9px] font-bold uppercase tracking-widest transition-all ${canvaState === f.k ? 'bg-tech-primary text-black border-tech-primary' : 'border-tech-border text-tech-primary/50 hover:text-tech-primary'}`}
            >
              {f.l}
            </button>
          ))}
        </div>

        <div className="space-y-8">
          {canvaFiltrado.map(p => (
            <div key={p.tipo}>
              <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-tech-primary/60 pb-2 mb-0">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wide">{p.nome}</h3>
                  <p className="text-[10px] text-tech-primary/40 uppercase tracking-wide mt-0.5">
                    <span className="text-tech-primary/70">{p.tam}</span>
                    {' · '}{p.itens.length} páginas
                    {' · '}faixa {p.base}–{p.base + Math.max(0, p.itens.length - 1)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-tech-primary/40 uppercase tracking-wide mb-1">
                    <span className="text-white text-sm font-black">{p.prontas}</span>/{p.itens.length} prontas
                  </div>
                  <div className="w-32 h-1 bg-black border border-tech-border overflow-hidden">
                    <div className="h-full bg-tech-primary transition-all duration-500" style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              </div>

              <div className="border border-t-0 border-tech-border bg-tech-panel/20 max-h-[420px] overflow-auto">
                <table className="w-full text-[11px]">
                  <tbody>
                    {p.visiveis.map(i => (
                      <tr key={i.docId ?? i.pag} className="border-b border-tech-border/40 last:border-0 hover:bg-tech-panel/50 align-top">
                        <td className="py-1 pl-3 pr-3 text-right w-12 text-tech-primary/40 tabular-nums">{i.pag}</td>
                        <td className="py-1 pr-3 text-tech-primary/90">{i.titulo}</td>
                        <td className="py-1 pr-3 w-24 whitespace-nowrap">
                          {i.pronta
                            ? <span className="text-[9px] font-bold uppercase tracking-widest text-tech-primary border border-tech-primary px-1.5 py-0.5">pronta</span>
                            : i.placeholder
                              ? <span className="text-[9px] font-bold uppercase tracking-widest text-tech-primary/30 border border-tech-primary/30 px-1.5 py-0.5">placeholder</span>
                              : <span className="text-[9px] font-bold uppercase tracking-widest text-orange-400 border border-orange-400/60 px-1.5 py-0.5">a fazer</span>}
                        </td>
                      </tr>
                    ))}
                    {p.visiveis.length === 0 && (
                      <tr><td colSpan={3} className="py-5 text-center text-[10px] text-tech-primary/30 uppercase tracking-widest">Nada neste projeto com esse filtro.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() => setCanvaTextOf(canvaTextOf === p.tipo ? null : p.tipo)}
                className="mt-2 text-[10px] text-tech-primary/40 hover:text-tech-primary uppercase tracking-wide"
              >
                {canvaTextOf === p.tipo ? '− esconder' : '+ '}lista em texto puro, na ordem
              </button>
              {canvaTextOf === p.tipo && (
                <textarea
                  readOnly
                  value={p.itens.map(i => `${i.pag}\t${i.titulo}`).join('\n')}
                  onFocus={e => e.currentTarget.select()}
                  className="w-full mt-2 h-52 bg-black border border-tech-border p-3 text-[10px] font-mono text-tech-primary/70 resize-y outline-none focus:border-tech-primary"
                />
              )}
            </div>
          ))}
        </div>
      </section>
      )}

      {activeTab === 'eventos' && (
      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Quem estava em cada evento</span>
          <span className="flex-1 h-px bg-tech-border"></span>
        </div>

        <p className="text-[11px] text-tech-primary/50 mb-4 max-w-3xl leading-relaxed">
          Marcar alguém aqui coloca a imagem do evento na aba <span className="text-tech-primary">Eventos</span> da
          ficha dele, na hora — não existe botão de salvar. Quem ainda não tem ficha (protótipo ou
          pendente) fica guardado no evento e passa a aparecer no dia em que a ficha existir.
        </p>

        <div className="border border-tech-border bg-tech-panel/30 p-4 mb-5">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="text-[10px] text-tech-primary/40 uppercase tracking-wide">
              <span className="text-white text-lg font-black">{eventosFechados}</span>
              <span className="text-tech-primary/40">/{eventosLista.length} com elenco fechado</span>
              <span className="text-tech-primary/25"> · {eventosComAlguem} com alguém marcado</span>
            </div>
            {/* Duas barras empilhadas: a de baixo, mais fraca, é quem tem alguém; a de cima, cheia,
                é quem está fechado. A diferença entre elas é o trabalho pela metade. */}
            <div className="flex-1 min-w-[140px] relative h-2 bg-black border border-tech-border overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-tech-primary/25"
                style={{ width: `${eventosLista.length ? (eventosComAlguem / eventosLista.length) * 100 : 0}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-tech-primary transition-all duration-500"
                style={{ width: `${eventosLista.length ? (eventosFechados / eventosLista.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tech-primary/40" />
              <input
                type="search"
                value={evBusca}
                onChange={e => setEvBusca(e.target.value)}
                placeholder="buscar evento ou quem está marcado..."
                className="w-full bg-black border border-tech-border pl-8 pr-2 py-2 text-[11px] text-tech-primary placeholder:text-tech-primary/30 focus:border-tech-primary outline-none"
              />
            </div>
            {([
              { k: 'todos' as const, l: 'Todos' },
              { k: 'aberto' as const, l: 'Em aberto' },
              { k: 'fechado' as const, l: 'Fechados' },
              { k: 'vazios' as const, l: 'Sem ninguém' },
              { k: 'comArte' as const, l: 'Com arte' },
            ]).map(f => (
              <button
                key={f.k}
                type="button"
                onClick={() => setEvFiltro(f.k)}
                className={`px-2.5 py-2 border text-[9px] font-bold uppercase tracking-widest transition-all ${evFiltro === f.k ? 'bg-tech-primary text-black border-tech-primary' : 'border-tech-border text-tech-primary/50 hover:text-tech-primary'}`}
              >
                {f.l}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {eventoTemporadas.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setEvTemporada(evTemporada === t ? null : t)}
                className={`px-2 py-1 border text-[9px] uppercase tracking-widest transition-all ${evTemporada === t ? 'bg-tech-primary/20 border-tech-primary text-tech-primary' : 'border-tech-border/60 text-tech-primary/40 hover:text-tech-primary/80'}`}
              >
                {t} <span className="opacity-50">{eventosLista.filter(i => i.item.temporada === t).length}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border border-tech-border bg-tech-panel/20">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-tech-panel/60 text-tech-primary/40 text-[9px] uppercase tracking-widest">
                <th className="py-2 pl-3 pr-3 text-right w-12 font-normal">Pág.</th>
                <th className="py-2 pr-3 text-left font-normal">Evento</th>
                <th className="py-2 pr-3 text-left font-normal">Quem estava</th>
                <th className="py-2 pr-3 text-left font-normal w-28">Elenco</th>
                <th className="py-2 pr-3 text-left font-normal w-20">Arte</th>
              </tr>
            </thead>
            <tbody>
              {eventosFiltrados.map(i => (
                <tr
                  key={i.docId}
                  className={`border-t border-tech-border/40 align-top transition-colors ${i.fechado ? 'bg-tech-primary/[0.07] hover:bg-tech-primary/[0.12]' : 'hover:bg-tech-panel/50'}`}
                >
                  {/* faixa verde na borda esquerda: dá pra correr o olho pela coluna e ver
                      de onde até onde o elenco já foi fechado */}
                  <td className={`py-1.5 pl-3 pr-3 text-right tabular-nums border-l-2 ${i.fechado ? 'border-tech-primary text-tech-primary/70' : 'border-transparent text-tech-primary/40'}`}>{i.pag}</td>
                  <td className="py-1.5 pr-3 text-tech-primary/90 max-w-[360px]">
                    <span className="block text-[9px] uppercase tracking-widest text-tech-primary/35">{i.item.temporada}</span>
                    {[i.item.arco, i.item.subarco, i.item.name].filter(Boolean).join(' · ')}
                  </td>
                  <td className="py-1.5 pr-3 w-[38%]">
                    <div className="flex flex-wrap items-center gap-1">
                      {i.personagens.map(n => {
                        const temFicha = characters.some(c => c.name === n);
                        return (
                          <span
                            key={n}
                            title={temFicha ? n : `${n} — sem ficha ainda, guardado`}
                            className={`text-[9px] px-1.5 py-0.5 border ${temFicha ? 'border-tech-primary/60 text-tech-primary' : 'border-dashed border-orange-400/50 text-orange-400/80'}`}
                          >
                            {n.split(' ')[0]}
                          </span>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => { setQuemDoEvento(i.docId ?? null); setQuemBusca(''); setQuemErro(null); }}
                        className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-dashed border-tech-border text-tech-primary/40 hover:text-tech-primary hover:border-tech-primary"
                      >
                        {i.personagens.length ? 'editar' : '+ quem estava'}
                      </button>
                      {quemSalvando === i.docId && <Loader size={10} className="animate-spin text-tech-primary" />}
                    </div>
                  </td>
                  <td className="py-1.5 pr-3 w-28">
                    <button
                      type="button"
                      onClick={() => alternaFechado(i.item, !i.fechado)}
                      title={i.fechado ? 'Elenco fechado — clique para reabrir' : 'Marcar que já adicionei todo mundo dessa imagem'}
                      className={`flex items-center gap-1.5 px-2 py-1 border text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${i.fechado
                        ? 'bg-tech-primary text-black border-tech-primary'
                        : 'border-tech-border text-tech-primary/35 hover:text-tech-primary hover:border-tech-primary/60'}`}
                    >
                      {i.fechado ? <CheckSquare size={11} /> : <Square size={11} />}
                      {i.fechado ? 'fechado' : 'fechar'}
                    </button>
                  </td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {i.pronta
                      ? <span className="text-[9px] font-bold uppercase tracking-widest text-tech-primary border border-tech-primary px-1.5 py-0.5">pronta</span>
                      : i.placeholder
                        ? <span className="text-[9px] font-bold uppercase tracking-widest text-tech-primary/30 border border-tech-primary/30 px-1.5 py-0.5">placeholder</span>
                        : <span className="text-[9px] font-bold uppercase tracking-widest text-orange-400 border border-orange-400/60 px-1.5 py-0.5">a fazer</span>}
                  </td>
                </tr>
              ))}
              {eventosFiltrados.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-[10px] text-tech-primary/30 uppercase tracking-widest">Nenhum evento com esse filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Seletor de participantes: fixo no rodapé, um evento por vez. Cada clique grava na hora,
            no item do checklist e na Galeria de quem tem ficha — não existe botão de salvar. */}
        {eventoAberto && (
          <div className="fixed inset-x-0 bottom-0 z-50 bg-black border-t-2 border-tech-primary max-h-[62vh] overflow-auto p-4 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.9)]">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-tech-primary">Quem estava</span>
              <span className="text-[10px] text-tech-primary/50">
                {[eventoAberto.temporada, eventoAberto.arco, eventoAberto.subarco, eventoAberto.name].filter(Boolean).join(' · ')}
              </span>
              {!eventoAberto.imageUrl && (
                <span className="text-[9px] uppercase tracking-widest text-orange-400 border border-orange-400/60 px-1.5 py-0.5">
                  sem arte — fica guardado e aparece quando a imagem entrar
                </span>
              )}
              {quemErro && <span className="text-[10px] text-red-400">{quemErro}</span>}
              <div className="relative ml-auto">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-tech-primary/40" />
                <input
                  type="search"
                  value={quemBusca}
                  onChange={e => setQuemBusca(e.target.value)}
                  autoFocus
                  placeholder="buscar nome, clã ou vila..."
                  className="bg-black border border-tech-primary/50 pl-7 pr-2 py-2 text-[11px] text-tech-primary placeholder:text-tech-primary/30 focus:border-tech-primary outline-none w-64"
                />
              </div>
              <button
                type="button"
                onClick={() => setQuemDoEvento(null)}
                className="flex items-center gap-1 px-2 py-1.5 border border-tech-border text-[9px] font-bold uppercase tracking-widest text-tech-primary/60 hover:text-tech-primary"
              >
                <X size={11} /> fechar
              </button>
            </div>

            {([
              { g: 'ficha' as const, rot: 'Com ficha' },
              { g: 'prototipo' as const, rot: 'Protótipos' },
              { g: 'pendente' as const, rot: 'Pendentes' },
            ]).map(bloco => {
              const termo = quemBusca.trim().toLowerCase();
              const lista = gentePossivel.filter(p => p.grupo === bloco.g
                && (!termo || p.nome.toLowerCase().includes(termo) || (p.extra ?? '').toLowerCase().includes(termo)));
              if (!lista.length) return null;
              return (
                <div key={bloco.g} className="mb-4">
                  <div className="text-[9px] font-black uppercase tracking-widest text-tech-primary/50 mb-2 pb-1 border-b border-tech-border">
                    {bloco.rot} <span className="text-tech-primary/25">{lista.length}</span>
                  </div>
                  <div className="space-y-2">
                    {subgrupos(lista).map(sg => (
                      <div key={sg.cla} className="flex flex-wrap items-start gap-x-3 gap-y-1">
                        <div className="w-24 shrink-0 text-[9px] uppercase tracking-wide text-tech-primary/35 pt-1 text-right">
                          {sg.cla}
                        </div>
                        <div className="flex-1 min-w-[200px] grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1">
                          {sg.gente.map(p => {
                            const marcado = (eventoAberto.personagens ?? []).includes(p.nome);
                            return (
                              <button
                                key={p.nome}
                                type="button"
                                title={`${p.nome}${p.extra ? ` · ${p.extra}` : ''}`}
                                onClick={() => alternaParticipante(p.nome)}
                                className={`flex items-baseline gap-1.5 px-2 py-1 border text-left text-[10px] transition-all ${marcado ? 'bg-tech-primary text-black border-tech-primary font-bold' : 'bg-tech-panel/30 border-tech-border text-tech-primary/70 hover:border-tech-primary/60 hover:text-tech-primary'}`}
                              >
                                <span className="opacity-50 tabular-nums text-[8px]">{p.id ?? '·'}</span>
                                <span className="truncate">{p.grupo === 'ficha' ? p.curto : p.nome}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

      {activeTab === 'links' && (
      <section>
        <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>Links de imagem</span>
          <span className="flex-1 h-px bg-tech-border"></span>
          <span className="text-tech-primary/40">{filteredImageLinks.length} de {imageLinks.length}</span>
        </div>

        <div className="border border-tech-border bg-tech-panel/30 p-5 space-y-4">
          <div className="flex items-center gap-2 text-tech-primary/70">
            <LinkIcon size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Toda imagem do sistema, com o link para copiar</span>
          </div>
          <p className="text-[9px] text-tech-primary/40 uppercase tracking-wide">
            Para usar as imagens em outro lugar sem precisar abrir a ficha ou o console do Firebase. Clique em qualquer linha para copiar o link dela.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tech-primary/40" />
              <input
                type="search"
                value={linkSearch}
                onChange={e => setLinkSearch(e.target.value)}
                placeholder="Buscar por personagem, arma, fase ou técnica..."
                className="w-full bg-black/60 border border-tech-border pl-8 pr-3 py-2 text-[11px] text-tech-primary placeholder:text-tech-primary/30 focus:border-tech-primary focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-2 px-3 py-2 border border-tech-border bg-black/40 text-[9px] font-black uppercase tracking-widest text-tech-primary/70 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={linkWithVersion}
                onChange={e => setLinkWithVersion(e.target.checked)}
                className="accent-tech-primary"
              />
              Copiar com versão
            </label>
          </div>

          <p className="text-[9px] text-tech-primary/40 leading-relaxed">
            O parâmetro <code className="text-tech-secondary">&amp;v=</code> só serve para furar cache — o Storage o ignora.
            Sem ele (padrão), o link continua entregando a arte atual mesmo depois de ela ser substituída, o que é o
            que você quer num app externo. Com ele, o link fica preso à versão de agora nos caches.
          </p>

          <div className="flex flex-nowrap gap-1.5 overflow-x-auto">
            {(['Todas', ...IMAGE_LINK_KINDS] as const).map(k => {
              const count = k === 'Todas' ? imageLinks.length : imageLinks.filter(l => l.kind === k).length;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setLinkKind(k)}
                  className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${linkKind === k ? 'bg-tech-primary text-black border-tech-primary' : 'border-tech-border text-tech-primary/60 hover:border-tech-primary/60'}`}
                >
                  {k} <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>

          {filteredImageLinks.length > 0 && (
            <button
              type="button"
              onClick={() => copiaLink(
                JSON.stringify(filteredImageLinks.map(l => ({
                  tipo: l.kind, de: l.owner, oque: l.detail,
                  url: linkWithVersion ? l.url : stripVersion(l.url),
                })), null, 2),
                '__json__')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-tech-secondary/50 text-tech-secondary text-[9px] font-black uppercase tracking-widest hover:bg-tech-secondary hover:text-black transition-colors"
            >
              {copiedLink === '__json__'
                ? <><CheckCircle2 size={11} /> {filteredImageLinks.length} links copiados</>
                : <><Download size={11} /> Copiar os {filteredImageLinks.length} como JSON</>}
            </button>
          )}

          <div className="border border-tech-border divide-y divide-tech-border max-h-[32rem] overflow-y-auto">
            {filteredImageLinks.length === 0 ? (
              <p className="p-4 text-[10px] text-tech-primary/40 uppercase tracking-widest text-center">
                Nenhuma imagem para esse filtro.
              </p>
            ) : filteredImageLinks.map((l, i) => {
              const id = `${l.kind}|${l.owner}|${l.detail}|${i}`;
              const valor = linkWithVersion ? l.url : stripVersion(l.url);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => copiaLink(valor, id)}
                  title={valor}
                  className="w-full flex items-center gap-3 p-2 text-left hover:bg-tech-primary/5 transition-colors group"
                >
                  <img
                    src={l.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-10 h-10 object-cover border border-tech-border bg-black shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-white truncate">{l.owner}</span>
                    <span className="block text-[9px] text-tech-primary/50 uppercase tracking-wide truncate">
                      {l.kind} · {l.detail}
                    </span>
                  </span>
                  <span className={`text-[9px] font-black uppercase tracking-widest shrink-0 px-2 ${copiedLink === id ? 'text-tech-primary' : 'text-tech-primary/30 group-hover:text-tech-primary/70'}`}>
                    {copiedLink === id ? 'Copiado!' : 'Copiar'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
      )}

      <div className="text-[10px] text-tech-primary/40 uppercase tracking-widest border-t border-tech-border pt-3">
        Personagens e arsenal acima refletem o Firestore em tempo real (nenhum recarregamento necessário). O uso de Storage é recalculado ao abrir esta página ou clicar em "Atualizar".
      </div>
    </div>
  );
};

export default AdminPanel;
