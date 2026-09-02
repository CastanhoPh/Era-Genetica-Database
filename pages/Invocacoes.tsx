import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Search, ChevronDown, ChevronLeft, ChevronRight, Loader, Terminal, Database, Shield, AlertTriangle, X, User } from 'lucide-react';
import { subscribeChecklist, slugify } from '../data/firestore';
import { carregaChecklist, fonteEstatica } from '../data/dados-publicos';
import { Character, ChecklistItem, CLASSIFICATION_PRIORITY } from '../types';
import { formatImageUrl } from '../utils/formatters';
import InvocacaoCard, { InvocacaoCardData } from '../components/InvocacaoCard';

/**
 * Os chips são fixos, não derivados dos dados: uma vila sem invocação tem que aparecer e dizer que
 * não existe nenhuma, em vez de simplesmente não estar lá. A ordem é a que o projeto já usa em
 * outras telas, com a OCA no fim porque ela não é vila.
 */
const VILAS = ['Konohagakure', 'Kirigakure', 'Sunagakure', 'Iwagakure', 'Kumogakure', 'OCA'] as const;

interface InvocacoesProps {
  characters: Character[];
  onOpenCharacter: (char: Character) => void;
}

const Invocacoes: React.FC<InvocacoesProps> = ({ characters, onOpenCharacter }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [vila, setVila] = useState('Todos');
  const [dono, setDono] = useState('Todos');
  const [rank, setRank] = useState('Todos');
  const [natureza, setNatureza] = useState('Todos');
  const [ordem, setOrdem] = useState('pagina');

  // Mesma fonte da Galeria: a lista de verdade é o checklist. A ficha carrega uma cópia
  // desnormalizada, mas ela só tem as invocações de quem TEM ficha — aqui a página é sobre
  // invocação, não sobre personagem, então nenhuma pode faltar.
  useEffect(() => {
    // Mesma troca da Galeria, e aqui o desperdício era maior: esta tela lê os 1.285 documentos do
    // checklist e usa 128 — só os tipos `invocacao` e `capaInvocacao`.
    const unsubscribe = fonteEstatica(
      carregaChecklist,
      subscribeChecklist,
      data => { setItems(data); setLoading(false); },
      e => { console.error('Erro ao carregar o checklist:', e); setErro('Não foi possível carregar as invocações.'); setLoading(false); },
    );
    return () => unsubscribe();
  }, []);

  const invocacoes = useMemo<InvocacaoCardData[]>(() => {
    const capas = new Map(items.filter(i => i.type === 'capaInvocacao').map(i => [i.name, i]));
    return items
      .filter(i => i.type === 'invocacao')
      .sort((a, b) => a.order - b.order)   // ordem das páginas do Canva
      .map((i, k) => {
        const capa = capas.get(i.name);
        return {
          nome: i.name,
          dono: i.temporada,
          capaUrl: capa?.imageUrl ?? undefined,
          arteUrl: i.imageUrl ?? undefined,
          rank: i.rank,
          nature: i.nature,
          village: i.village,
          placeholder: !!(i.placeholder || capa?.placeholder),
          pagina: k + 1,
        };
      });
  }, [items]);

  const donos = useMemo(
    () => Array.from(new Set(invocacoes.map(i => i.dono))).sort((a, b) => a.localeCompare(b)),
    [invocacoes],
  );
  // Os seletores de rank e natureza só aparecem quando há valor para escolher — um seletor vazio
  // ocuparia espaço sem servir.
  const ranks = useMemo(() => {
    const set = new Set(invocacoes.map(i => i.rank).filter((r): r is string => !!r));
    return Array.from(set).sort((a, b) => (CLASSIFICATION_PRIORITY[b] ?? 0) - (CLASSIFICATION_PRIORITY[a] ?? 0));
  }, [invocacoes]);

  const naturezas = useMemo(
    () => Array.from(new Set(invocacoes.map(i => i.nature).filter((n): n is string => !!n))).sort((a, b) => a.localeCompare(b)),
    [invocacoes],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = invocacoes.filter(i =>
      (vila === 'Todos' || i.village === vila)
      && (dono === 'Todos' || i.dono === dono)
      && (rank === 'Todos' || i.rank === rank)
      && (natureza === 'Todos' || i.nature === natureza)
      && (!termo || i.nome.toLowerCase().includes(termo) || i.dono.toLowerCase().includes(termo)));
    if (ordem === 'alfabetico') return [...lista].sort((a, b) => a.nome.localeCompare(b.nome));
    if (ordem === 'dono') return [...lista].sort((a, b) => a.dono.localeCompare(b.dono) || a.pagina - b.pagina);
    if (ordem === 'rank') {
      return [...lista].sort((a, b) =>
        (CLASSIFICATION_PRIORITY[b.rank ?? ''] ?? -1) - (CLASSIFICATION_PRIORITY[a.rank ?? ''] ?? -1)
        || a.pagina - b.pagina);
    }
    return lista;
  }, [invocacoes, busca, vila, dono, rank, natureza, ordem]);

  const filtrosAtivos = vila !== 'Todos' || dono !== 'Todos' || rank !== 'Todos' || natureza !== 'Todos' || busca !== '';
  const limpar = () => { setVila('Todos'); setDono('Todos'); setRank('Todos'); setNatureza('Todos'); setBusca(''); };
  /** Quantas invocações cada vila tem, para o chip poder dizer que não existe nenhuma. */
  const porVila = useMemo(() => {
    const m: Record<string, number> = {};
    invocacoes.forEach(i => { if (i.village) m[i.village] = (m[i.village] ?? 0) + 1; });
    return m;
  }, [invocacoes]);

  // /invocacoes/<nome> abre a arte cheia. Fica na URL para o link ser compartilhável.
  const slugAberto = location.pathname.replace(/^\/+|\/+$/g, '').split('/')[1];
  const aberta = slugAberto ? filtradas.find(i => slugify(i.nome) === decodeURIComponent(slugAberto)) : undefined;
  const idxAberta = aberta ? filtradas.indexOf(aberta) : -1;
  const abre = (i: InvocacaoCardData) => navigate(`/invocacoes/${encodeURIComponent(slugify(i.nome))}`);
  const fecha = () => navigate('/invocacoes');
  const anda = (passo: 1 | -1) => {
    if (idxAberta < 0) return;
    const prox = filtradas[(idxAberta + passo + filtradas.length) % filtradas.length];
    if (prox) abre(prox);
  };

  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fecha();
      else if (e.key === 'ArrowRight') anda(1);
      else if (e.key === 'ArrowLeft') anda(-1);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberta, idxAberta, filtradas]);

  /** Ficha do dono, quando existe: o vínculo é pelo primeiro nome, como no reconciliador. */
  const fichaDo = (primeiro: string) => characters.find(c => c.name.split(' ')[0] === primeiro);
  const fichaAberta = aberta ? fichaDo(aberta.dono) : undefined;
  const pendentes = invocacoes.filter(i => i.placeholder).length;

  return (
    <>
      <div className="animate-fade-in-up">

        <header className="mb-8 pl-6 py-2 relative group cursor-default">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-tech-primary group-hover:h-full transition-all duration-500 h-1/2" />
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={28} className="text-tech-primary" />
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase group-hover:animate-glitch relative inline-block">
              INVOCAÇÕES<span className="text-tech-primary">_DB</span>
            </h1>
          </div>
          <p className="text-tech-primary/80 text-base flex items-center gap-2">
            <Terminal size={14} />
            <span className="typing-animation border-r-2 border-tech-primary pr-1 animate-pulse">CRIATURAS INVOCÁVEIS E SEUS CONTRATOS</span>
          </p>
        </header>

        {/* Barra de controles */}
        <div className="bg-tech-panel/80 backdrop-blur-sm border border-tech-border p-4 mb-8 flex flex-col gap-4 clip-corner shadow-[0_0_20px_rgba(0,255,65,0.05)] animate-fade-in-up" style={{ animationDelay: '100ms' }}>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            {/* Vila fixa, não derivada: a que não tem invocação aparece apagada e continua clicável,
                para a resposta ser "não existe nenhuma" em vez do chip simplesmente faltar. */}
            <div className="flex flex-nowrap gap-1.5 min-w-0 overflow-x-auto">
              {['Todos', ...VILAS].map(v => {
                const vazia = v !== 'Todos' && !porVila[v];
                return (
                  <button
                    key={v}
                    onClick={() => setVila(v)}
                    title={vazia ? `Nenhuma invocação de ${v}` : undefined}
                    className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 border uppercase text-[11px] font-bold tracking-wider transition-all duration-300 clip-corner-sm
                      ${vila === v
                        ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_15px_rgba(0,255,65,0.4)] translate-y-[-2px]'
                        : vazia
                          ? 'bg-transparent text-tech-primary/25 border-tech-border/50 hover:border-tech-primary/40 hover:text-tech-primary/50'
                          : 'bg-transparent text-tech-primary border-tech-border hover:border-tech-primary hover:text-white hover:bg-tech-primary/10'}`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-4 w-full md:w-auto">
              <div className="flex-1 md:w-80 bg-black border border-tech-border flex items-center px-3 h-10 group focus-within:border-tech-primary focus-within:shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all">
                <Search size={14} className="text-tech-dim group-focus-within:text-tech-primary transition-colors" />
                <input
                  type="text"
                  placeholder="BUSCAR_INVOCAÇÃO..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="bg-transparent border-none outline-none text-tech-primary w-full ml-2 placeholder:text-tech-dim uppercase text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-tech-border/50 pt-4 mt-2">
            {ranks.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-tech-primary/60 font-bold uppercase flex items-center gap-1">
                  <Shield size={10} /> RANK
                </label>
                <div className="relative group">
                  <select
                    value={rank}
                    onChange={e => setRank(e.target.value)}
                    className="w-full bg-black border border-tech-border text-tech-primary text-xs py-2 pl-2 pr-8 outline-none focus:border-tech-primary appearance-none uppercase cursor-pointer hover:bg-tech-dim/20 transition-all"
                  >
                    <option value="Todos" className="bg-black">TODOS</option>
                    {ranks.map(r => <option key={r} value={r} className="bg-black">{r}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 text-tech-dim group-hover:text-tech-primary transition-colors pointer-events-none" size={14} />
                </div>
              </div>
            )}

            {naturezas.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-tech-primary/60 font-bold uppercase flex items-center gap-1">
                  <Database size={10} /> NATUREZA
                </label>
                <div className="relative group">
                  <select
                    value={natureza}
                    onChange={e => setNatureza(e.target.value)}
                    className="w-full bg-black border border-tech-border text-tech-primary text-xs py-2 pl-2 pr-8 outline-none focus:border-tech-primary appearance-none uppercase cursor-pointer hover:bg-tech-dim/20 transition-all"
                  >
                    <option value="Todos" className="bg-black">TODOS</option>
                    {naturezas.map(n => <option key={n} value={n} className="bg-black">{n.toUpperCase()}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 text-tech-dim group-hover:text-tech-primary transition-colors pointer-events-none" size={14} />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-tech-primary/60 font-bold uppercase flex items-center gap-1">
                <User size={10} /> DONO
              </label>
              <div className="relative group">
                <select
                  value={dono}
                  onChange={e => setDono(e.target.value)}
                  className="w-full bg-black border border-tech-border text-tech-primary text-xs py-2 pl-2 pr-8 outline-none focus:border-tech-primary appearance-none uppercase cursor-pointer hover:bg-tech-dim/20 transition-all"
                >
                  <option value="Todos" className="bg-black">TODOS</option>
                  {donos.map(d => <option key={d} value={d} className="bg-black">{d.toUpperCase()}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 text-tech-dim group-hover:text-tech-primary transition-colors pointer-events-none" size={14} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-tech-accent font-bold uppercase flex items-center gap-1">
                <Database size={10} /> CLASSIFICAR
              </label>
              <div className="relative group">
                <select
                  value={ordem}
                  onChange={e => setOrdem(e.target.value)}
                  className="w-full bg-black border border-tech-accent/30 text-tech-accent text-xs py-2 pl-2 pr-8 outline-none focus:border-tech-accent appearance-none uppercase cursor-pointer hover:bg-tech-accent/5 transition-all"
                >
                  <option value="pagina" className="bg-black">PÁGINA (PADRÃO)</option>
                  <option value="dono" className="bg-black">DONO (A-Z)</option>
                  <option value="alfabetico" className="bg-black">ALFABÉTICO (A-Z)</option>
                  {ranks.length > 0 && <option value="rank" className="bg-black">RANK (Z &gt; F)</option>}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 text-tech-accent/60 group-hover:text-tech-accent transition-colors pointer-events-none" size={14} />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 text-xs text-tech-dim flex items-center gap-2 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <Sparkles size={12} />
          <span>INVOCAÇÕES ENCONTRADAS: {filtradas.length}</span>
          {pendentes > 0 && <span className="text-tech-primary/30">· {pendentes} COM ARTE PENDENTE</span>}
          <div className="h-px bg-tech-border flex-1" />
          {filtrosAtivos && (
            <button onClick={limpar} className="text-[10px] text-red-500 hover:text-red-400 uppercase font-bold tracking-wider border border-transparent hover:border-red-900/50 px-2 transition-colors">
              [Limpar Filtros]
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-tech-primary animate-pulse">
            <Loader size={32} className="animate-spin mb-4" />
            <span className="text-xs uppercase tracking-widest">Carregando invocações...</span>
            <div className="w-48 h-1 bg-tech-dim mt-4 overflow-hidden relative">
              <div className="absolute inset-0 bg-tech-primary animate-[scanline_1.5s_ease-in-out_infinite]" />
            </div>
          </div>
        ) : erro ? (
          <div className="border border-orange-400/50 bg-orange-400/5 p-5 flex items-center gap-3">
            <AlertTriangle size={16} className="text-orange-400" />
            <span className="text-[12px] text-orange-400">{erro}</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtradas.map((inv, index) => (
                <InvocacaoCard key={inv.nome} inv={inv} index={index} onClick={() => abre(inv)} />
              ))}
            </div>

            {filtradas.length === 0 && (
              <div className="border border-tech-border bg-tech-panel/20 py-16 text-center">
                <Sparkles size={24} className="mx-auto text-tech-primary/20 mb-3" />
                {/* quando o único filtro é a vila, o motivo exato é mais útil que "nenhuma com esse filtro" */}
                <p className="text-[11px] uppercase tracking-widest text-tech-primary/30">
                  {vila !== 'Todos' && !porVila[vila] && dono === 'Todos' && rank === 'Todos' && natureza === 'Todos' && !busca
                    ? `Não existe invocação de ${vila}.`
                    : 'Nenhuma invocação com esse filtro.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* a arte cheia */}
      {aberta && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={fecha}>
          <button onClick={fecha} title="Fechar" className="absolute top-4 right-4 text-tech-primary/60 hover:text-tech-primary transition-colors z-10">
            <X size={22} />
          </button>
          {filtradas.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); anda(-1); }} title="Anterior" className="absolute left-3 sm:left-6 text-tech-primary/40 hover:text-tech-primary transition-colors z-10">
                <ChevronLeft size={30} />
              </button>
              <button onClick={e => { e.stopPropagation(); anda(1); }} title="Próxima" className="absolute right-3 sm:right-6 text-tech-primary/40 hover:text-tech-primary transition-colors z-10">
                <ChevronRight size={30} />
              </button>
            </>
          )}
          <div className="max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-baseline gap-3 flex-wrap mb-3">
              <h3 className="text-xl font-black text-white uppercase tracking-wide">{aberta.nome}</h3>
              {aberta.rank && <span className="bg-tech-accent text-black text-[9px] font-black px-2 py-0.5 clip-corner-sm">{aberta.rank}</span>}
              {aberta.nature && <span className="text-[10px] uppercase tracking-widest text-tech-primary/40">{aberta.nature}</span>}
              {aberta.village && <span className="text-[10px] uppercase tracking-widest text-tech-primary/25">{aberta.village}</span>}
              {fichaAberta ? (
                <button
                  onClick={() => onOpenCharacter(fichaAberta)}
                  title={`Abrir a ficha de ${fichaAberta.name}`}
                  className="text-[10px] uppercase tracking-widest text-tech-primary/50 hover:text-tech-primary transition-colors flex items-center gap-1"
                >
                  <User size={10} /> de {aberta.dono}
                </button>
              ) : (
                <span title="Este dono ainda não tem ficha" className="text-[10px] uppercase tracking-widest text-tech-primary/25 flex items-center gap-1">
                  <User size={10} /> de {aberta.dono}
                </span>
              )}
              <span className="text-[10px] font-mono text-tech-primary/25 ml-auto">{idxAberta + 1} / {filtradas.length}</span>
            </div>
            {aberta.arteUrl && !aberta.placeholder ? (
              <img src={formatImageUrl(aberta.arteUrl)} alt={aberta.nome} className="w-full h-auto border border-tech-border" />
            ) : (
              <div className="border border-tech-border bg-tech-panel/20 aspect-[4/3] flex flex-col items-center justify-center gap-2">
                <Sparkles size={32} className="text-tech-primary/15" />
                <span className="text-[10px] uppercase tracking-widest text-tech-primary/30">a arte desta invocação ainda não foi feita</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Invocacoes;
