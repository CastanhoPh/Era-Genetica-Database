import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, Terminal, Cpu, Database, ChevronRight, Skull, Filter, ChevronDown, Award, Power, Radio, Shield, Lock, LogOut, LayoutDashboard, ListChecks, Images, GitBranch, Sparkles } from 'lucide-react';
import { subscribeCharacters, subscribeArsenal, saveCharacter, deleteCharacter, saveEquipment, deleteEquipment, slugify } from './data/firestore';
import { Character } from './types';
import { Equipment } from './types/Equipment';
import { useAuth } from './useAuth';
import { formatImageUrl, seloDe, corDoSelo, macrosDe, postoDe } from './utils/formatters';
import { CARGOS_DE_VILA } from './data/cargos-de-vila';
import { rankDeNC } from './data/atributos';

// Carregados sob demanda: reduzem o bundle inicial, já que só entram em cena
// depois de uma interação do usuário (abrir ficha, trocar de aba, editar, logar).
const CharacterModal = lazy(() => import('./components/CharacterModal'));
const AddCharacterModal = lazy(() => import('./components/AddCharacterModal'));
const AddEquipmentModal = lazy(() => import('./components/AddEquipmentModal'));
const LoginModal = lazy(() => import('./components/LoginModal'));
const EquipmentModal = lazy(() => import('./components/EquipmentModal'));
const Arsenal = lazy(() => import('./pages/Arsenal'));
const Invocacoes = lazy(() => import('./pages/Invocacoes'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const ChecklistPanel = lazy(() => import('./pages/ChecklistPanel'));
const GalleryPage = lazy(() => import('./pages/GalleryPage'));
const FamilyTreePage = lazy(() => import('./pages/FamilyTreePage'));

// ONDE o termo da busca casou, e o quão perto do que a pessoa provavelmente quis.
//
// A busca varre oito campos de propósito: procurar "katon" ou "chunin" tem que achar gente. O preço
// é que um termo curto traz muita coisa — "shin" casa em "Lenda Shinobi" (o rank de quem tem NC 30),
// em "Hiraishin" e em "Shingan", e de 20 resultados só 2 eram nome. Sem dizer onde casou, o
// resultado parece aleatório.
//
// O `nivel` serve pras duas coisas: o card mostra o `motivo` quando o casamento não foi no nome, e a
// ordenação usa o nível pra empurrar nome e clã pra frente.
type CasamentoBusca = { nivel: number; motivo: string | null };
const casaBusca = (c: Character, termo: string): CasamentoBusca | null => {
    if (!termo) return { nivel: 0, motivo: null };
    const acha = (v?: string) => !!v && v.toLowerCase().includes(termo);
    if (acha(c.name)) return { nivel: 0, motivo: null };
    if (acha(c.clan)) return { nivel: 1, motivo: null };          // o card já mostra o clã
    const posto = [...(c.cargo ?? []), ...(c.patente ?? [])].find(acha);
    if (posto) return { nivel: 2, motivo: posto };
    const titulo = (c.titles ?? []).find(acha);
    if (titulo) return { nivel: 3, motivo: titulo };
    if (acha(rankDeNC(c.nc))) return { nivel: 4, motivo: rankDeNC(c.nc) };
    const apt = (c.aptitudes ?? []).find(acha);
    if (apt) return { nivel: 5, motivo: apt };
    if (acha(c.position)) return { nivel: 6, motivo: c.position };
    return null;
};

// As quatro funções que o filtro oferece. `role` guarda combinação livre ("Suporte e DPS"), então o
// casamento é por substring — e "Tank" tem que aceitar "Tanque", que convive nas fichas.
const FUNCOES = ['DPS', 'Tank', 'Suporte', 'Controle'];

// Os postos que a ficha tem por CARGO, sem ordinal. Separado de `macrosDe`, que junta cargo e
// patente e ainda corta o qualificador: o filtro de uma vila só pode oferecer cargo (senão
// "Líder dos 75%" da OCA apareceria como posto de Konoha) e precisa do posto INTEIRO (senão
// "Líder dos Monges" e "Líder de Inovações" viram os dois "Líder" e colidem).
const postosDeCargo = (c: Character): string[] => [...new Set((c.cargo ?? []).map(postoDe))];
const casaFuncao = (c: Character, funcao: string): boolean => {
    const r = (c.role ?? '').toLowerCase();
    return funcao === 'Tank' ? r.includes('tank') || r.includes('tanque') : r.includes(funcao.toLowerCase());
};

export default function App() {
    const [loading, setLoading] = useState(true);
    const [splashDone, setSplashDone] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const location = useLocation();
    const navigate = useNavigate();
    // Aba ativa e slug (ficha aberta) vêm direto da URL — nada de estado próprio pra
    // duplicar o que o navegador já sabe. Isso é o que torna cada aba uma página de
    // verdade (compartilhável, com voltar/avançar funcionando).
    const KNOWN_TABS = ['characters', 'arsenal', 'invocacoes', 'painel', 'checklist', 'galeria', 'arvore', 'login'] as const;
    type MainTab = typeof KNOWN_TABS[number];
    const pathSegments = location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    const firstSegment = pathSegments[0] ?? '';
    const activeMainTab: Exclude<MainTab, 'login'> = (
        (KNOWN_TABS as readonly string[]).includes(firstSegment) && firstSegment !== 'login'
            ? firstSegment as Exclude<MainTab, 'login'>
            : (location.state as { underTab?: Exclude<MainTab, 'login'> } | null)?.underTab ?? 'characters'
    );
    const showLoginModal = firstSegment === 'login';
    const slug = firstSegment && !(KNOWN_TABS as readonly string[]).includes(firstSegment) ? decodeURIComponent(firstSegment) : '';
    // Segundo segmento da URL, só usado como filtro (categoria em /characters/<x>,
    // origem em /arsenal/<x>) quando o primeiro segmento já é uma dessas duas abas.
    const filterSegment = (activeMainTab === 'characters' || activeMainTab === 'arsenal') ? pathSegments[1] : undefined;
    const [characters, setCharacters] = useState<Character[]>([]);
    const [arsenalItems, setArsenalItems] = useState<Equipment[]>([]);
    const [arsenalReady, setArsenalReady] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [selectedOrigin, setSelectedOrigin] = useState('Todos');
    const [selectedChar, setSelectedChar] = useState<Character | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingChar, setEditingChar] = useState<Character | null>(null);
    const [showAddEquipment, setShowAddEquipment] = useState(false);
    const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
    const { user, isAdmin, isChecklistEditor, authReady, login, logout } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    // Chave = id+URL da imagem (não só o id), pra que uma correção de URL feita no Painel
    // "esqueça" o erro antigo automaticamente, sem precisar de F5.
    const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

    // Advanced Filters State
    const [selectedClan, setSelectedClan] = useState('Todos');
    const [selectedRole, setSelectedRole] = useState('Todos');
    const [selectedStatus, setSelectedStatus] = useState('Todos');
    const [selectedPosition, setSelectedPosition] = useState('Todos');
    const [sortBy, setSortBy] = useState('id');

    const categories = ['Todos', 'Personagem', 'NPC', 'Konohagakure', 'Kirigakure', 'Kumogakure', 'Sunagakure', 'Iwagakure', 'OCA'];

    // Escuta os personagens do Firestore em tempo real (qualquer edição feita por um admin,
    // em qualquer dispositivo, aparece aqui na hora, sem precisar recarregar a página).
    useEffect(() => {
        const unsubscribe = subscribeCharacters(
            data => {
                setCharacters(data);
                setLoadError(null);
                setLoading(false);
            },
            err => {
                console.error('Erro ao escutar personagens do Firestore:', err);
                setLoadError('Não foi possível carregar os dados do banco.');
                setLoading(false);
            },
        );
        return () => unsubscribe();
    }, []);

    // Escuta o arsenal do Firestore em tempo real (usado também pelo roteamento por slug)
    useEffect(() => {
        const unsubscribe = subscribeArsenal(
            data => {
                setArsenalItems(data);
                setArsenalReady(true);
            },
            err => {
                console.error('Erro ao escutar arsenal do Firestore:', err);
                setArsenalReady(true);
            },
        );
        return () => unsubscribe();
    }, []);

    // Sai do Painel/Checklist automaticamente se não tiver permissão (ou deslogar).
    // Espera authReady pra não expulsar num reload direto, antes do Firebase restaurar a sessão.
    useEffect(() => {
        if (!authReady) return;
        if (!isAdmin && activeMainTab === 'painel') {
            navigate('/characters', { replace: true });
        } else if (!isChecklistEditor && activeMainTab === 'checklist') {
            navigate('/characters', { replace: true });
        }
    }, [authReady, isAdmin, isChecklistEditor, activeMainTab, navigate]);

    // Abre personagem ou arma navegando pra URL — o estado (selectedChar/selectedItem)
    // é só um espelho do que a URL diz, sincronizado no efeito logo abaixo. Assim a
    // ficha aberta funciona com voltar/avançar do navegador e pode ser compartilhada.
    const openCharacter = (c: Character) => navigate(`/${encodeURIComponent(c.docId!)}`, { state: { underTab: activeMainTab } });
    const openItem = (it: Equipment) => navigate(`/${encodeURIComponent(slugify(it.name))}`, { state: { underTab: 'arsenal' } });

    // Tempo mínimo do splash de boas-vindas (~3s) — só na primeira vez em cada sessão do
    // navegador. Quem já viu (recarregou a página, voltou de outra aba) não espera de novo.
    useEffect(() => {
        if (sessionStorage.getItem('splashSeen')) {
            setSplashDone(true);
            return;
        }
        const timer = setTimeout(() => {
            sessionStorage.setItem('splashSeen', '1');
            setSplashDone(true);
        }, 3000);
        return () => clearTimeout(timer);
    }, []);

    // Tudo que o SITE mostra sai daqui, não do `characters` cru: grade, busca, filtros, árvore,
    // invocações e a cadeia de posse do arsenal. O `characters` completo continua indo pro Painel
    // (é lá que o Pedro administra o que está oculto) e pro cálculo do próximo id, que não pode
    // ignorar as fichas ocultas senão a ficha nova nasce com id repetido.
    const charsPublicos = useMemo(() => characters.filter(c => !c.oculto), [characters]);

    // ---- Links diretos na raiz: /<slug> (personagem OU arma) ----
    // Resolve o slug atual da URL sempre que ela mudar (inclui voltar/avançar do navegador,
    // que o react-router já trata sozinho — não precisa de listener de popstate manual).
    useEffect(() => {
        if (loading || !arsenalReady) return;
        if (!slug) { setSelectedChar(null); setSelectedItem(null); return; }
        const ch = charsPublicos.find(c => c.docId === slug);
        if (ch) { setSelectedItem(null); setSelectedChar(ch); return; }
        const it = arsenalItems.find(i => slugify(i.name) === slug);
        if (it) {
            setSelectedChar(null); setSelectedItem(it);
            // Link de arma acessado direto (sem vir de openItem): garante que o "por baixo" seja o Arsenal.
            if ((location.state as { underTab?: string } | null)?.underTab !== 'arsenal') {
                navigate(location.pathname, { replace: true, state: { underTab: 'arsenal' } });
            }
            return;
        }
        setSelectedChar(null); setSelectedItem(null);
    }, [slug, loading, arsenalReady, charsPublicos, arsenalItems]);

    // Extract unique origins dynamically (usado pra validar /arsenal/<origem> na URL)
    const uniqueOrigins = useMemo(() => {
        const set = new Set(arsenalItems.map(i => i.origin).filter(Boolean));
        return Array.from(set);
    }, [arsenalItems]);

    // ---- Categoria/origem também vivem na URL: /characters/<categoria>, /arsenal/<origem> ----
    // Sincroniza só URL -> estado (a direção estado -> URL é feita explicitamente em cada
    // ação que muda o filtro, via mainTabPath/handleSelectOrigin/handleFilterTag etc.).
    useEffect(() => {
        if (activeMainTab === 'characters') {
            if (!filterSegment) { if (selectedCategory !== 'Todos') setSelectedCategory('Todos'); return; }
            const match = categories.find(c => slugify(c) === filterSegment.toLowerCase());
            if (match && match !== selectedCategory) setSelectedCategory(match);
        } else if (activeMainTab === 'arsenal') {
            if (!filterSegment) { if (selectedOrigin !== 'Todos') setSelectedOrigin('Todos'); return; }
            const match = uniqueOrigins.find(o => slugify(o) === filterSegment.toLowerCase());
            if (match && match !== selectedOrigin) setSelectedOrigin(match);
        }
    }, [activeMainTab, filterSegment, uniqueOrigins]);

    // Path da aba atual, incluindo o filtro ativo (categoria/origem) quando houver —
    // usado sempre que navegamos "de volta" pra aba sem trocar o filtro selecionado.
    const mainTabPath = (tab: Exclude<MainTab, 'login'>) => {
        if (tab === 'characters' && selectedCategory !== 'Todos') return `/characters/${slugify(selectedCategory)}`;
        if (tab === 'arsenal' && selectedOrigin !== 'Todos') return `/arsenal/${slugify(selectedOrigin)}`;
        return `/${tab}`;
    };

    const handleSelectCategory = (category: string) => {
        setSelectedCategory(category);
        navigate(category === 'Todos' ? '/characters' : `/characters/${slugify(category)}`);
    };

    const handleSelectOrigin = (origin: string) => {
        setSelectedOrigin(origin);
        navigate(origin === 'Todos' ? '/arsenal' : `/arsenal/${slugify(origin)}`);
    };


    // Um casamento por ficha, calculado uma vez: o filtro, a ordenação e o card leem daqui.
    const termoBusca = searchTerm.trim().toLowerCase();
    const casamentos = useMemo(
        () => new Map(charsPublicos.map(c => [c.docId ?? String(c.id), casaBusca(c, termoBusca)])),
        [charsPublicos, termoBusca],
    );
    const motivoDe = useCallback(
        (c: Character) => casamentos.get(c.docId ?? String(c.id))?.motivo ?? null,
        [casamentos],
    );

    // FILTRO FACETADO: cada dropdown oferece só o que existe depois dos OUTROS filtros. Escolher
    // "Konohagakure" encolhe clã, posto, função e vitalidade para o que Konoha tem — antes as quatro
    // listas vinham do banco inteiro e ofereciam combinação que dava zero resultado.
    //
    // Cada filtro virou predicado nomeado justamente pra isso: montar as opções de um deles a partir
    // de quem passa em todos os demais, ignorando o próprio.
    const passaCategoria = useCallback(
        (c: Character) => selectedCategory === 'Todos' || c.categories.includes(selectedCategory), [selectedCategory]);
    const passaBusca = useCallback(
        (c: Character) => casamentos.get(c.docId ?? String(c.id)) !== null, [casamentos]);
    const passaCla = useCallback(
        (c: Character) => selectedClan === 'Todos' || c.clan === selectedClan, [selectedClan]);
    const passaPosto = useCallback((c: Character) => {
        if (selectedPosition === 'Todos') return true;
        // Dentro de uma vila com catálogo o rótulo pode cobrir vários cargos — "Líder de Esquadrão"
        // cobre os seis esquadrões de Konoha, e "Líder Corporal" cobre o dos samurais e o dos
        // monges — então casa pela lista de `postos` do rótulo, e só contra cargo.
        const cat = CARGOS_DE_VILA[selectedCategory];
        if (cat) {
            const e = cat.find(x => x.label === selectedPosition);
            return e ? postosDeCargo(c).some(x => e.postos.includes(x)) : false;
        }
        return macrosDe(c).includes(selectedPosition);
    }, [selectedPosition, selectedCategory]);
    const passaFuncao = useCallback(
        (c: Character) => selectedRole === 'Todos' || casaFuncao(c, selectedRole), [selectedRole]);
    const passaVitalidade = useCallback(
        (c: Character) => selectedStatus === 'Todos' || (selectedStatus === 'Vivo' ? !c.isDead : !!c.isDead), [selectedStatus]);

    /** Quem passa em todos os filtros, menos o que for pedido pra ignorar. */
    const escopo = useCallback((ignorar: 'cla' | 'posto' | 'funcao' | 'vitalidade' | null) => charsPublicos.filter(c =>
        passaCategoria(c) && passaBusca(c)
        && (ignorar === 'cla' || passaCla(c))
        && (ignorar === 'posto' || passaPosto(c))
        && (ignorar === 'funcao' || passaFuncao(c))
        && (ignorar === 'vitalidade' || passaVitalidade(c))),
        [charsPublicos, passaCategoria, passaBusca, passaCla, passaPosto, passaFuncao, passaVitalidade]);

    const uniqueClans = useMemo(
        () => Array.from(new Set(escopo('cla').map(c => c.clan).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt')),
        [escopo]);
    const roleOptions = useMemo(
        () => FUNCOES.filter(f => escopo('funcao').some(c => casaFuncao(c, f))),
        [escopo]);
    const statusOptions = useMemo(() => {
        const gente = escopo('vitalidade');
        return ['Vivo', 'Morto'].filter(v => gente.some(c => (v === 'Vivo' ? !c.isDead : !!c.isDead)));
    }, [escopo]);

    // O filtro oferece o posto MACRO: sem ordinal E sem a organização ou frota a que ele pertence.
    // Com o posto completo eram 69 opções — quatro linhas só de "Almirante da Frota X" e catorze de
    // "Líder de alguma coisa", cada uma com um ou dois personagens, o que não filtra nada. Agora são
    // 27, e "Almirante" traz os quatro. Cargo e patente entram os dois, senão as fichas que só têm
    // patente de organização ficariam de fora.
    // Vila com catálogo (hoje só Konohagakure) oferece os cargos DELA, na ordem de importância que o
    // Pedro ditou, e só os que alguém no escopo de fato tem. Fora dela, segue a lista derivada em
    // ordem alfabética.
    const catalogoDaVila = CARGOS_DE_VILA[selectedCategory] ?? null;
    const uniquePositions = useMemo(() => {
        const gente = escopo('posto');
        if (catalogoDaVila) {
            return catalogoDaVila
                .filter(e => gente.some(c => postosDeCargo(c).some(x => e.postos.includes(x))))
                .map(e => e.label);
        }
        return Array.from(new Set(gente.flatMap(macrosDe))).sort((a, b) => a.localeCompare(b, 'pt'));
    }, [escopo, catalogoDaVila]);

    // Uma escolha pode deixar de existir no escopo novo — clã Sabaku com Konohagakure selecionada,
    // por exemplo. Sem isto o seletor ficaria mostrando um valor fora da lista e a grade viria
    // vazia, sem o usuário ter como voltar a não ser limpando tudo.
    useEffect(() => { if (selectedClan !== 'Todos' && !uniqueClans.includes(selectedClan)) setSelectedClan('Todos'); }, [uniqueClans, selectedClan]);
    useEffect(() => { if (selectedPosition !== 'Todos' && !uniquePositions.includes(selectedPosition)) setSelectedPosition('Todos'); }, [uniquePositions, selectedPosition]);
    useEffect(() => { if (selectedRole !== 'Todos' && !roleOptions.includes(selectedRole)) setSelectedRole('Todos'); }, [roleOptions, selectedRole]);
    useEffect(() => { if (selectedStatus !== 'Todos' && !statusOptions.includes(selectedStatus)) setSelectedStatus('Todos'); }, [statusOptions, selectedStatus]);

    const filteredCharacters = useMemo(() => {
        const filtered = escopo(null);

        // Apply Sorting
        return [...filtered].sort((a, b) => {
            // Com busca ativa, o nível do casamento manda antes do critério escolhido: quem casou no
            // NOME vem antes de quem casou numa aptidão. Sem busca todos têm nível 0 e isto não faz
            // nada — o critério do seletor segue sendo o único.
            if (termoBusca) {
                const na = casamentos.get(a.docId ?? String(a.id))?.nivel ?? 9;
                const nb = casamentos.get(b.docId ?? String(b.id))?.nivel ?? 9;
                if (na !== nb) return na - nb;
            }
            if (sortBy === 'nc') {
                return Number(b.nc) - Number(a.nc);
            }
            if (sortBy === 'alfabetico') {
                return a.name.localeCompare(b.name);
            }
            // Default: ID
            return a.id - b.id;
        });
    }, [escopo, casamentos, termoBusca, sortBy]);

    // Adiciona um personagem novo gravando no Firestore.
    const handleAddCharacter = async (newChar: Character) => {
        const nextId = characters.length ? Math.max(...characters.map(c => c.id)) + 1 : 1;
        const takenDocIds = characters.map(c => c.docId).filter(Boolean) as string[];
        const toSave: Character = { ...newChar, id: nextId };
        const docId = await saveCharacter(toSave, takenDocIds);
        setCharacters([...characters, { ...toSave, docId }]);
    };

    // Edita um personagem existente gravando no Firestore.
    const handleEditCharacter = async (edited: Character) => {
        const takenDocIds = characters.map(c => c.docId).filter(Boolean) as string[];
        const newDocId = await saveCharacter(edited, takenDocIds, edited.docId);
        setCharacters(characters.map(c => (c.id === edited.id ? { ...edited, docId: newDocId } : c)));
        setSelectedChar(null);
    };

    // Exclui um personagem do Firestore.
    const handleDeleteCharacter = async (target: Character) => {
        if (target.docId) await deleteCharacter(target.docId);
        setCharacters(characters.filter(c => c.id !== target.id));
        navigate(mainTabPath(activeMainTab));
    };

    // ----- Admin de Arsenal (armas) -----
    const handleAddEquipment = async (item: Equipment) => {
        const nextId = arsenalItems.length ? Math.max(...arsenalItems.map(i => i.id)) + 1 : 1;
        const takenDocIds = arsenalItems.map(i => i.docId).filter(Boolean) as string[];
        const toSave: Equipment = { ...item, id: nextId };
        const docId = await saveEquipment(toSave, takenDocIds);
        setArsenalItems([...arsenalItems, { ...toSave, docId }]);
    };
    const handleEditEquipment = async (item: Equipment) => {
        const takenDocIds = arsenalItems.map(i => i.docId).filter(Boolean) as string[];
        const newDocId = await saveEquipment(item, takenDocIds, item.docId);
        setArsenalItems(arsenalItems.map(i => (i.id === item.id ? { ...item, docId: newDocId } : i)));
        setSelectedItem(null);
    };
    const handleDeleteEquipment = async (item: Equipment) => {
        if (item.docId) await deleteEquipment(item.docId);
        setArsenalItems(arsenalItems.filter(i => i.id !== item.id));
        navigate(mainTabPath(activeMainTab));
    };

    // Filtros a partir da ficha (clã / tag clicáveis)
    const handleFilterClan = (clan: string) => {
        navigate('/characters');
        setSearchTerm(''); setSelectedCategory('Todos'); setSelectedRole('Todos');
        setSelectedStatus('Todos'); setSelectedPosition('Todos'); setSelectedClan(clan);
    };
    const handleFilterTag = (tag: string) => {
        navigate(tag === 'Todos' ? '/characters' : `/characters/${slugify(tag)}`);
        setSearchTerm(''); setSelectedClan('Todos'); setSelectedRole('Todos');
        setSelectedStatus('Todos'); setSelectedPosition('Todos'); setSelectedCategory(tag);
    };

    const handleImageError = (id: number, image: string) => {
        setImgErrors(prev => ({ ...prev, [`${id}:${image}`]: true }));
    };

    const resetFilters = () => {
        navigate('/characters');
        setSelectedCategory('Todos');
        setSearchTerm('');
        setSelectedClan('Todos');
        setSelectedRole('Todos');
        setSelectedStatus('Todos');
        setSelectedPosition('Todos');
        setSortBy('id');
    };

    if (!loadError && (loading || !splashDone)) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-tech-primary font-mono z-50 fixed inset-0 px-6">
                <div className="w-full max-w-lg text-center">
                    <p className="text-[10px] tracking-[0.4em] text-tech-primary/50 uppercase mb-4 animate-fade-in-up">
                        Sistema de Fichas
                    </p>
                    <h1 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tighter leading-tight mb-2 animate-fade-in-up">
                        Bem-vindo ao banco de dados&nbsp;de
                    </h1>
                    <h1 className="text-3xl sm:text-5xl font-black text-tech-primary uppercase tracking-tighter mb-8 animate-glitch">
                        Era Genética
                    </h1>
                    <div className="w-full max-w-xs mx-auto h-1 bg-tech-dim relative overflow-hidden mb-3">
                        <div className="absolute top-0 left-0 h-full bg-tech-primary animate-[scanline_2s_ease-in-out_infinite] w-full"></div>
                    </div>
                    <p className="text-[10px] tracking-widest text-tech-primary/60 uppercase animate-pulse">
                        {loading ? 'Acessando banco de dados...' : 'Acesso autorizado.'}
                    </p>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-tech-primary font-mono z-50 fixed inset-0 px-6 text-center">
                <Database className="w-12 h-12 mb-4 opacity-70" />
                <p className="text-red-400 mb-2">{loadError}</p>
                <p className="text-xs opacity-60 mb-6">Verifique sua conexão e tente novamente.</p>
                <button
                    onClick={() => window.location.reload()}
                    className="border border-tech-primary px-4 py-2 text-sm hover:bg-tech-primary hover:text-black transition-colors"
                >
                    Tentar novamente
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20 overflow-x-hidden font-mono text-sm">

            {/* Top System Bar */}
            <div className="fixed top-0 left-0 right-0 h-8 bg-black/90 backdrop-blur border-b border-tech-border z-50 flex items-center justify-between px-4 text-xs text-tech-primary/60 uppercase shadow-[0_0_20px_rgba(0,255,65,0.1)]">
                <div className="flex gap-6 items-center">
                    <div className="flex items-center gap-2 text-tech-primary">
                        <Power size={12} />
                        <span className="font-bold">SYS.ON</span>
                    </div>
                    <span className="hidden sm:inline opacity-50">|</span>
                    <span className="hidden sm:inline">MEM: 64TB [OK]</span>
                    <span className="hidden sm:inline">NET: ENCRYPTED</span>
                    <span className="hidden sm:inline opacity-50">|</span>
                    {/* Main Navigation Tabs */}
                    <div className="hidden sm:flex gap-1 items-center">
                        <button
                            onClick={() => navigate(mainTabPath('characters'))}
                            className={`px-3 py-0.5 text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 ${activeMainTab === 'characters'
                                    ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                                    : 'text-tech-primary/50 border-tech-border hover:border-tech-primary/50 hover:text-tech-primary'
                                }`}
                        >
                            <Database size={10} /> CHARACTERS
                        </button>
                        <button
                            onClick={() => navigate(mainTabPath('arsenal'))}
                            className={`px-3 py-0.5 text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 ${activeMainTab === 'arsenal'
                                    ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                                    : 'text-tech-primary/50 border-tech-border hover:border-tech-primary/50 hover:text-tech-primary'
                                }`}
                        >
                            <Shield size={10} /> ARSENAL
                        </button>
                        <button
                            onClick={() => navigate('/invocacoes')}
                            title="Todas as invocações do RPG"
                            className={`px-3 py-0.5 text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 ${activeMainTab === 'invocacoes'
                                    ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                                    : 'text-tech-primary/50 border-tech-border hover:border-tech-primary/50 hover:text-tech-primary'
                                }`}
                        >
                            <Sparkles size={10} /> INVOCAÇÕES
                        </button>
                        <button
                            onClick={() => navigate('/galeria')}
                            title="Galeria de imagens do RPG"
                            className={`px-3 py-0.5 text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 ${activeMainTab === 'galeria'
                                    ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                                    : 'text-tech-primary/50 border-tech-border hover:border-tech-primary/50 hover:text-tech-primary'
                                }`}
                        >
                            <Images size={10} /> GALERIA
                        </button>
                        <button
                            onClick={() => navigate('/arvore')}
                            title="Árvore genealógica das famílias"
                            className={`px-3 py-0.5 text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 ${activeMainTab === 'arvore'
                                    ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                                    : 'text-tech-primary/50 border-tech-border hover:border-tech-primary/50 hover:text-tech-primary'
                                }`}
                        >
                            <GitBranch size={10} /> ÁRVORE
                        </button>
                    </div>
                </div>
                <div className="flex gap-2 sm:gap-4 items-center">
                    <span className="hidden sm:flex animate-pulse text-tech-accent items-center gap-2">
                        <Radio size={12} className="animate-ping absolute opacity-75" />
                        <Radio size={12} />
                        LIVE FEED
                    </span>
                    {isAdmin && (
                        <button
                            onClick={() => navigate('/painel')}
                            title="Painel administrativo"
                            className={`flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border transition-all ${activeMainTab === 'painel'
                                    ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                                    : 'border-tech-primary/40 text-tech-primary hover:bg-tech-primary/10'
                                }`}
                        >
                            <LayoutDashboard size={10} /> PAINEL
                        </button>
                    )}
                    {isChecklistEditor && (
                        <button
                            onClick={() => navigate('/checklist')}
                            title="Checklist de produção de imagens"
                            className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border transition-all ${activeMainTab === 'checklist'
                                    ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                                    : 'border-tech-primary/40 text-tech-primary hover:bg-tech-primary/10'
                                }`}
                        >
                            <ListChecks size={10} /> CHECKLIST
                        </button>
                    )}
                    {user ? (
                        <button
                            onClick={() => logout()}
                            title="Sair"
                            className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border border-tech-primary text-tech-primary hover:bg-red-500 hover:text-black hover:border-red-500 transition-all"
                        >
                            <LogOut size={10} /> {isAdmin ? 'ADMIN' : (user.displayName || 'SAIR')}
                        </button>
                    ) : (
                        <button
                            onClick={() => navigate('/login')}
                            title="Entrar como admin"
                            className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border border-tech-border text-tech-primary/50 hover:border-tech-primary hover:text-tech-primary transition-all"
                        >
                            <Lock size={10} /> LOGIN
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile Tab Navigation */}
            <div className="sm:hidden fixed top-8 left-0 right-0 h-9 bg-black/95 backdrop-blur border-b border-tech-border z-40 flex items-center gap-2 px-4 overflow-x-auto">
                <button
                    onClick={() => navigate(mainTabPath('characters'))}
                    className={`shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5 ${activeMainTab === 'characters'
                            ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                            : 'text-tech-primary/50 border-tech-border'
                        }`}
                >
                    <Database size={10} /> CHARACTERS
                </button>
                <button
                    onClick={() => navigate(mainTabPath('arsenal'))}
                    className={`shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5 ${activeMainTab === 'arsenal'
                            ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                            : 'text-tech-primary/50 border-tech-border'
                        }`}
                >
                    <Shield size={10} /> ARSENAL
                </button>
                <button
                    onClick={() => navigate('/invocacoes')}
                    className={`shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5 ${activeMainTab === 'invocacoes'
                            ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                            : 'text-tech-primary/50 border-tech-border'
                        }`}
                >
                    <Sparkles size={10} /> INVOCAÇÕES
                </button>
                {isChecklistEditor && (
                    <button
                        onClick={() => navigate('/checklist')}
                        className={`shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5 ${activeMainTab === 'checklist'
                                ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                                : 'text-tech-primary/50 border-tech-border'
                            }`}
                    >
                        <ListChecks size={10} /> CHECKLIST
                    </button>
                )}
                <button
                    onClick={() => navigate('/galeria')}
                    className={`shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5 ${activeMainTab === 'galeria'
                            ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                            : 'text-tech-primary/50 border-tech-border'
                        }`}
                >
                    <Images size={10} /> GALERIA
                </button>
                <button
                    onClick={() => navigate('/arvore')}
                    className={`shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5 ${activeMainTab === 'arvore'
                            ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                            : 'text-tech-primary/50 border-tech-border'
                        }`}
                >
                    <GitBranch size={10} /> ÁRVORE
                </button>
            </div>

            <div className="max-w-7xl mx-auto pt-20 sm:pt-20 px-4">
                <div className="sm:hidden h-9" />

                {activeMainTab === 'characters' ? (
                    <>
                        {/* Header Section */}
                        <header className="mb-12 pl-6 py-2 relative group cursor-default">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-tech-primary group-hover:h-full transition-all duration-500 h-1/2"></div>

                            <h1 className="text-3xl md:text-5xl font-black text-white mb-2 tracking-tighter uppercase group-hover:animate-glitch relative inline-block">
                                ERA<span className="text-tech-primary">_GENÉTICA</span>
                            </h1>
                            <p className="text-tech-primary/80 text-base flex items-center gap-2">
                                <Terminal size={14} />
                                <span className="typing-animation border-r-2 border-tech-primary pr-1 animate-pulse">ACESSO AO BANCO DE DADOS GENÉTICO</span>
                            </p>
                        </header>

                        {/* Controls Bar */}
                        <div className="bg-tech-panel/80 backdrop-blur-sm border border-tech-border p-4 mb-8 flex flex-col gap-4 clip-corner shadow-[0_0_20px_rgba(0,255,65,0.05)] animate-fade-in-up">

                            {/* Top Row: Categories & Search */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                {/* Filter Tabs */}
                                <div className="flex flex-nowrap gap-1.5 min-w-0 overflow-x-auto">
                                    {categories.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => handleSelectCategory(cat)}
                                            className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 border uppercase text-[11px] font-bold tracking-wider transition-all duration-300 clip-corner-sm
                            ${selectedCategory === cat
                                                    ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_15px_rgba(0,255,65,0.4)] translate-y-[-2px]'
                                                    : 'bg-transparent text-tech-primary border-tech-border hover:border-tech-primary hover:text-white hover:bg-tech-primary/10'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>

                                {/* Search & Action */}
                                <div className="flex gap-4 w-full md:w-auto">
                                    <div className="flex-1 md:w-64 bg-black border border-tech-border flex items-center px-3 h-10 group focus-within:border-tech-primary focus-within:shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all">
                                        <Search size={14} className="text-tech-dim group-focus-within:text-tech-primary transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="BUSCAR_ALVO..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="bg-transparent border-none outline-none text-tech-primary w-full ml-2 placeholder:text-tech-dim uppercase text-xs"
                                        />
                                    </div>
                                    {isAdmin && (
                                        <button
                                            onClick={() => setShowAddModal(true)}
                                            className="h-10 px-4 bg-tech-dim border border-tech-border text-tech-primary hover:bg-tech-primary hover:text-black transition-all hover:shadow-[0_0_15px_rgba(0,255,65,0.4)] uppercase text-xs font-bold flex items-center gap-2 whitespace-nowrap clip-corner-sm"
                                        >
                                            <Plus size={14} /> NOVO
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Bottom Row: Advanced Filters */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 border-t border-tech-border/50 pt-4 mt-2">

                                {/* Selectors Helper Component */}
                                {[
                                    { label: 'CLÃ', icon: Filter, value: selectedClan, setter: setSelectedClan, options: uniqueClans },
                                    { label: 'RANK / POSIÇÃO', icon: Award, value: selectedPosition, setter: setSelectedPosition, options: uniquePositions },
                                    { label: 'FUNÇÃO', icon: Database, value: selectedRole, setter: setSelectedRole, options: roleOptions },
                                    { label: 'VITALIDADE', icon: Skull, value: selectedStatus, setter: setSelectedStatus, options: statusOptions }
                                ].map((filter, idx) => (
                                    <div key={idx} className="flex flex-col gap-1">
                                        <label className="text-[10px] text-tech-primary/60 font-bold uppercase flex items-center gap-1">
                                            <filter.icon size={10} /> {filter.label}
                                        </label>
                                        <div className="relative group">
                                            <select
                                                value={filter.value}
                                                onChange={e => filter.setter(e.target.value)}
                                                className="w-full bg-black border border-tech-border text-tech-primary text-xs py-2 pl-2 pr-8 outline-none focus:border-tech-primary appearance-none uppercase cursor-pointer hover:bg-tech-dim/20 transition-all"
                                            >
                                                <option value="Todos" className="bg-black">TODOS</option>
                                                {filter.options.map(opt => <option key={opt} value={opt} className="bg-black">{opt.toUpperCase()}</option>)}
                                            </select>
                                            <ChevronDown className="absolute right-2 top-2.5 text-tech-dim group-hover:text-tech-primary transition-colors pointer-events-none" size={14} />
                                        </div>
                                    </div>
                                ))}

                                {/* Sort Selector */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-tech-accent font-bold uppercase flex items-center gap-1">
                                        <Cpu size={10} /> CLASSIFICAR
                                    </label>
                                    <div className="relative group">
                                        <select
                                            value={sortBy}
                                            onChange={e => setSortBy(e.target.value)}
                                            className="w-full bg-black border border-tech-accent/30 text-tech-accent text-xs py-2 pl-2 pr-8 outline-none focus:border-tech-accent appearance-none uppercase cursor-pointer hover:bg-tech-accent/5 transition-all"
                                        >
                                            <option value="id" className="bg-black">ID (PADRÃO)</option>
                                            <option value="nc" className="bg-black">NC (MAIOR &gt; MENOR)</option>
                                            <option value="alfabetico" className="bg-black">ALFABÉTICO (A-Z)</option>
                                        </select>
                                        <ChevronDown className="absolute right-2 top-2.5 text-tech-accent/60 group-hover:text-tech-accent transition-colors pointer-events-none" size={14} />
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Results Info */}
                        <div className="mb-4 text-xs text-tech-dim flex items-center gap-2 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                            <Database size={12} />
                            <span>REGISTROS ENCONTRADOS: {filteredCharacters.length}</span>
                            <div className="h-px bg-tech-border flex-1"></div>
                            {(selectedClan !== 'Todos' || selectedRole !== 'Todos' || selectedStatus !== 'Todos' || selectedPosition !== 'Todos' || selectedCategory !== 'Todos' || searchTerm) && (
                                <button onClick={resetFilters} className="text-[10px] text-red-500 hover:text-red-400 uppercase font-bold tracking-wider border border-transparent hover:border-red-900/50 px-2 transition-colors">
                                    [Limpar Filtros]
                                </button>
                            )}
                        </div>

                        {/* Grid with Staggered Animation */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredCharacters.map((char, index) => (
                                <div
                                    key={char.docId ?? char.id}
                                    onClick={() => openCharacter(char)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCharacter(char); } }}
                                    className={`group relative border bg-black/50 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-full opacity-0 animate-fade-in-up hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-tech-primary ${char.isDead
                                            ? 'border-red-900/30 hover:border-red-500 hover:shadow-[0_0_20px_rgba(220,38,38,0.2)]'
                                            : 'border-tech-border hover:bg-tech-panel/50 hover:border-tech-primary hover:shadow-[0_0_20px_rgba(0,255,65,0.15)]'
                                        }`}
                                    style={{ animationDelay: `${Math.min(index * 50, 1000)}ms` }}
                                >
                                    {/* Header Strip */}
                                    <div className="h-6 bg-tech-dim/30 border-b border-tech-border flex justify-between items-center px-2 text-[10px] text-tech-primary font-mono shrink-0 group-hover:bg-tech-primary/10 transition-colors">
                                        <span>ID: {char.id.toString().padStart(4, '0')}</span>
                                        {/* Always show NC, but color red if dead */}
                                        <span className={char.isDead ? 'text-red-500 font-bold' : ''}>NC: {char.nc}</span>
                                    </div>

                                    {/* Image Area - Fixed Height for Consistency */}
                                    <div className="h-[250px] relative overflow-hidden bg-tech-dim/10 border-b border-tech-border shrink-0 card-zoom-container">
                                        {/* Overlay Grid */}
                                        <div className="absolute inset-0 z-10 bg-[linear-gradient(transparent_2px,rgba(0,0,0,0.5)_3px)] bg-[size:100%_4px] pointer-events-none opacity-20"></div>

                                        {/* Animated Border on Hover */}
                                        <div className={`absolute inset-0 z-10 border-2 border-transparent transition-colors pointer-events-none m-1 ${char.isDead ? 'group-hover:border-red-900/60' : 'group-hover:border-tech-primary/60'}`}></div>

                                        {/* Dead Banner */}
                                        {char.isDead && (
                                            <div className="absolute top-4 -right-10 bg-red-600 text-black font-black text-[9px] py-1 w-32 text-center rotate-45 z-30 border border-black shadow-[0_0_10px_rgba(255,0,0,0.6)] tracking-widest">
                                                MORTO
                                            </div>
                                        )}

                                        {/* Selo de patente sobre o pé da arte. Estava na linha do título, disputando largura com
                                            ele — e em 23 das 82 fichas com selo os dois não cabiam, então o título perdia o fim.
                                            Aqui cada um tem a linha inteira e nenhum é cortado. O fundo opaco é obrigatório: o
                                            selo pousa sobre arte de qualquer cor. z-30 para ficar acima da grade de varredura. */}
                                        {seloDe(char) && (
                                            <span className={`absolute bottom-2 left-2 z-30 text-[10px] uppercase tracking-wide px-1.5 py-px border max-w-[calc(100%-1rem)] truncate bg-black/85 backdrop-blur-sm ${corDoSelo(char).borda} ${corDoSelo(char).texto}`}>
                                                {seloDe(char)}
                                            </span>
                                        )}

                                        {/* Corner Targets */}
                                        {!char.isDead && (
                                            <>
                                                <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-tech-primary z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                                <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-tech-primary z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                                <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-tech-primary z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                                <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-tech-primary z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                            </>
                                        )}

                                        {char.image && !imgErrors[`${char.id}:${char.image}`] ? (
                                            <img
                                                src={formatImageUrl(char.image)}
                                                alt={char.name}
                                                loading="lazy"
                                                decoding="async"
                                                onError={() => handleImageError(char.id, char.image)}
                                                className={`w-full h-full object-cover transition-transform duration-700 ${char.isDead
                                                        ? 'grayscale brightness-50 contrast-125'
                                                        : 'grayscale brightness-90 group-hover:grayscale-0 group-hover:brightness-110'
                                                    }`}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-striped-pattern opacity-50">
                                                <Cpu size={48} className="text-tech-dim animate-pulse" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info Footer */}
                                    <div className="p-3 flex flex-col justify-between flex-1 relative overflow-hidden">
                                        {/* Background scan for card body on hover */}
                                        <div className="absolute inset-0 bg-tech-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500 pointer-events-none"></div>

                                        <div className="relative z-10">
                                            <h3 className={`text-lg font-bold uppercase truncate transition-colors text-glow ${char.isDead
                                                    ? 'text-red-700 decoration-line-through'
                                                    : 'text-white group-hover:text-tech-primary'
                                                }`}>
                                                {char.name}
                                            </h3>
                                            {/* O selo saiu daqui para o pé da arte, então o título tem a largura inteira. O truncate
                                                fica como rede: o título mais longo do banco tem 34 caracteres e cabe, mas em três
                                                colunas numa tela estreita o card encolhe. */}
                                            <p className="text-xs text-tech-secondary font-bold uppercase truncate mt-1">{char.titles[0]}</p>
                                        {/* Só aparece quando a busca casou em algo que NÃO é o nome nem o clã:
                                            sem isso, procurar "shin" devolvia 20 fichas sem nenhuma pista de por
                                            quê. O texto é o valor que casou, cru, pra bater com o que foi digitado. */}
                                        {motivoDe(char) && (
                                            <p className="text-[10px] text-amber-300/80 uppercase truncate mt-1" title={`Casou com a busca em: ${motivoDe(char)}`}>
                                                ↳ {motivoDe(char)}
                                            </p>
                                        )}

                                            {/* Killer Info on Card */}
                                            {char.isDead && (
                                                <div className="mt-2 pt-2 border-t border-red-900/30 flex items-center gap-2 text-[10px] text-red-500 font-bold uppercase">
                                                    <Skull size={12} className="shrink-0" />
                                                    <span className="truncate">MORTO POR: {char.killedBy || 'DESCONHECIDO'}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-3 flex justify-end relative z-10">
                                            <span className={`text-[10px] flex items-center gap-1 group-hover:gap-2 transition-all ${char.isDead ? 'text-red-900' : 'text-tech-primary'}`}>
                                                ACESSAR_DADOS <ChevronRight size={10} />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {filteredCharacters.length === 0 && (
                            <div className="border border-red-900/50 bg-red-900/10 p-12 text-center text-red-500 font-mono animate-pulse">
                                <h3 className="text-xl font-bold mb-2">ERRO 404: DADOS NÃO ENCONTRADOS</h3>
                                <p className="text-sm opacity-70">REFINAR PARÂMETROS DE BUSCA.</p>
                                <button onClick={resetFilters} className="mt-4 border border-red-500 px-4 py-2 hover:bg-red-500 hover:text-black transition-colors uppercase text-xs">Resetar Sistema</button>
                            </div>
                        )}
                    </>
                ) : (
                    <Suspense fallback={<div className="text-tech-primary/40 text-xs uppercase tracking-widest py-12 text-center">Carregando...</div>}>
                        {activeMainTab === 'arsenal' ? (
                            <Arsenal
                                arsenalItems={arsenalItems}
                                loading={!arsenalReady}
                                onOpenItem={openItem}
                                isAdmin={isAdmin}
                                onAddNew={() => setShowAddEquipment(true)}
                                selectedOrigin={selectedOrigin}
                                onSelectOrigin={handleSelectOrigin}
                            />
                        ) : activeMainTab === 'invocacoes' ? (
                            <Invocacoes characters={charsPublicos} onOpenCharacter={openCharacter} />
                        ) : activeMainTab === 'checklist' ? (
                            <ChecklistPanel canEdit={isChecklistEditor} displayName={user?.displayName ?? null} onRequestLogin={() => navigate('/login')} />
                        ) : activeMainTab === 'galeria' ? (
                            <GalleryPage />
                        ) : activeMainTab === 'arvore' ? (
                            <FamilyTreePage characters={charsPublicos} onOpenCharacter={openCharacter} />
                        ) : (
                            <AdminPanel characters={characters} arsenalItems={arsenalItems} />
                        )}
                    </Suspense>
                )}

            </div>

            <Suspense fallback={null}>
                <CharacterModal
                    key={selectedChar ? (selectedChar.docId ?? String(selectedChar.id)) : 'closed'}
                    char={selectedChar}
                    onClose={() => navigate(mainTabPath(activeMainTab))}
                    isAdmin={isAdmin}
                    onEdit={(c) => { setEditingChar(c); navigate(mainTabPath(activeMainTab)); }}
                    onDelete={handleDeleteCharacter}
                    onFilterClan={handleFilterClan}
                    onFilterTag={handleFilterTag}
                    arsenalOptions={arsenalItems}
                />
                <EquipmentModal
                    item={selectedItem}
                    onClose={() => navigate(mainTabPath(activeMainTab))}
                    characters={charsPublicos}
                    onOpenCharacter={openCharacter}
                    isAdmin={isAdmin}
                    onEdit={(it) => { setEditingEquipment(it); navigate(mainTabPath(activeMainTab)); }}
                    onDelete={handleDeleteEquipment}
                />
                {showAddModal && <AddCharacterModal onClose={() => setShowAddModal(false)} onAdd={handleAddCharacter} arsenalOptions={arsenalItems} />}
                {editingChar && (
                    <AddCharacterModal
                        initialCharacter={editingChar}
                        onClose={() => setEditingChar(null)}
                        onAdd={handleEditCharacter}
                        arsenalOptions={arsenalItems}
                    />
                )}
                {showAddEquipment && <AddEquipmentModal onClose={() => setShowAddEquipment(false)} onSave={handleAddEquipment} />}
                {editingEquipment && (
                    <AddEquipmentModal
                        initialEquipment={editingEquipment}
                        onClose={() => setEditingEquipment(null)}
                        onSave={handleEditEquipment}
                    />
                )}
                {showLoginModal && <LoginModal onClose={() => navigate(mainTabPath(activeMainTab))} onLogin={login} />}
            </Suspense>
        </div>
    );
}