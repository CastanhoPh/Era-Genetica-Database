import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Search, ChevronDown, ChevronLeft, ChevronRight, Loader, Terminal, Database, Shield, AlertTriangle, X, User, Hexagon, History, PawPrint, Link2, Check } from 'lucide-react';
import { subscribeChecklist, slugify } from '../data/firestore';
import { carregaChecklist, fonteEstatica } from '../data/dados-publicos';
import { Character, ChecklistItem, CLASSIFICATION_PRIORITY } from '../types';
import { formatImageUrl } from '../utils/formatters';
import InvocacaoCard, { InvocacaoCardData } from '../components/InvocacaoCard';
import BotaoDeCores, { useCapasColoridas } from '../components/BotaoDeCores';
import { FAMILIAS_DE_INVOCACAO } from '../data/familias-de-invocacao';

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
  const [colorido, setColorido] = useCapasColoridas();
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Os filtros vivem na URL, não no estado: é o que faz o link chegar no amigo com a tela que o
  // Pedro estava vendo. Ausente = o padrão, então /invocacoes limpo continua sendo "tudo".
  const [params, setParams] = useSearchParams();
  const leia = (chave: string, padrao: string) => params.get(chave) ?? padrao;
  const escreva = (chave: string, valor: string, padrao: string, substitui = false) => {
    const p = new URLSearchParams(params);
    if (valor === padrao) p.delete(chave); else p.set(chave, valor);
    setParams(p, { replace: substitui });
  };

  const vila = leia('vila', 'Todos');
  const setVila = (v: string) => escreva('vila', v, 'Todos');
  const dono = leia('dono', 'Todos');
  const setDono = (v: string) => escreva('dono', v, 'Todos');
  const rank = leia('rank', 'Todos');
  const setRank = (v: string) => escreva('rank', v, 'Todos');
  const natureza = leia('natureza', 'Todos');
  const setNatureza = (v: string) => escreva('natureza', v, 'Todos');
  const familia = leia('familia', 'Todos');
  const setFamilia = (v: string) => escreva('familia', v, 'Todos');
  const ordem = leia('ordem', 'pagina');
  const setOrdem = (v: string) => escreva('ordem', v, 'pagina');
  // `replace` na busca: sem isso cada tecla empilha uma entrada e o voltar vira desfazer-letra.
  const busca = leia('busca', '');
  const setBusca = (v: string) => escreva('busca', v, '', true);

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
          familia: i.familia,
          hierarquia: i.hierarquia,
          originalOwner: i.originalOwner,
          pastOwners: i.pastOwners,
          nomeAntigo: i.nomeAntigo,
          descricao: i.descricao,
          habilidades: i.habilidades,
          habilidadeSuprema: i.habilidadeSuprema,
        };
      });
  }, [items]);

  // O `filter(Boolean)` tira a invocação sem invocador: ela existe, mas não é uma opção de
  // filtro — seria uma linha em branco no seletor.
  const donos = useMemo(
    () => Array.from(new Set(invocacoes.map(i => i.dono).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
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

  // Ordem canônica do catálogo, não alfabética, e só as famílias que alguém de fato tem.
  const familias = useMemo(
    () => FAMILIAS_DE_INVOCACAO.filter(f => invocacoes.some(i => i.familia === f)),
    [invocacoes],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = invocacoes.filter(i =>
      (vila === 'Todos' || i.village === vila)
      && (dono === 'Todos' || i.dono === dono)
      && (rank === 'Todos' || i.rank === rank)
      && (natureza === 'Todos' || i.nature === natureza)
      && (familia === 'Todos' || i.familia === familia)
      && (!termo || i.nome.toLowerCase().includes(termo) || i.dono.toLowerCase().includes(termo)));
    if (ordem === 'alfabetico') return [...lista].sort((a, b) => a.nome.localeCompare(b.nome));
    if (ordem === 'dono') return [...lista].sort((a, b) => a.dono.localeCompare(b.dono) || a.pagina - b.pagina);
    if (ordem === 'familia') {
      // ordem canonica do catalogo; quem nao tem familia vai para o fim
      const pos = (f?: string) => {
        const k = FAMILIAS_DE_INVOCACAO.indexOf(f as never);
        return k < 0 ? FAMILIAS_DE_INVOCACAO.length : k;
      };
      return [...lista].sort((a, b) => pos(a.familia) - pos(b.familia) || a.pagina - b.pagina);
    }
    if (ordem === 'rank') {
      return [...lista].sort((a, b) =>
        (CLASSIFICATION_PRIORITY[b.rank ?? ''] ?? -1) - (CLASSIFICATION_PRIORITY[a.rank ?? ''] ?? -1)
        || a.pagina - b.pagina);
    }
    return lista;
  }, [invocacoes, busca, vila, dono, rank, natureza, familia, ordem]);

  const filtrosAtivos = vila !== 'Todos' || dono !== 'Todos' || rank !== 'Todos' || natureza !== 'Todos'
    || familia !== 'Todos' || busca !== '';
  // Uma escrita só, senão seriam seis navegações e seis entradas no histórico. `ordem` fica de
  // fora porque não é filtro, é como a lista está apresentada — mesmo comportamento de antes.
  const limpar = () => {
    const p = new URLSearchParams(params);
    ['vila', 'dono', 'rank', 'natureza', 'familia', 'busca'].forEach(k => p.delete(k));
    setParams(p);
  };

  /** O link que o botão copia é a URL inteira: caminho, filtros e a invocação aberta, se houver. */
  const copiaLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  };
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
  // A query vai junto: sem ela, abrir uma criatura apagaria os filtros e o link perderia o
  // sentido. `params.toString()` já sai codificado.
  const comFiltros = (caminho: string) => {
    const q = params.toString();
    return q ? `${caminho}?${q}` : caminho;
  };
  const abre = (i: InvocacaoCardData) => navigate(comFiltros(`/invocacoes/${encodeURIComponent(slugify(i.nome))}`));
  const fecha = () => navigate(comFiltros('/invocacoes'));
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
              <BotaoDeCores colorido={colorido} onToggle={() => setColorido(v => !v)} oQue="as artes" />
              <button
                type="button"
                onClick={copiaLink}
                title="Copiar o link desta tela, com os filtros ativos"
                className={`h-10 w-10 shrink-0 border flex items-center justify-center transition-all clip-corner-sm ${linkCopiado
                  ? 'border-tech-primary text-black bg-tech-primary'
                  : 'border-tech-border text-tech-dim hover:text-tech-primary hover:border-tech-primary'}`}
              >
                {linkCopiado ? <Check size={15} /> : <Link2 size={15} />}
              </button>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 border-t border-tech-border/50 pt-4 mt-2">
            {familias.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-tech-primary/60 font-bold uppercase flex items-center gap-1">
                  <PawPrint size={10} /> FAMÍLIA
                </label>
                <div className="relative group">
                  <select
                    value={familia}
                    onChange={e => setFamilia(e.target.value)}
                    className="w-full bg-black border border-tech-border text-tech-primary text-xs py-2 pl-2 pr-8 outline-none focus:border-tech-primary appearance-none uppercase cursor-pointer hover:bg-tech-dim/20 transition-all"
                  >
                    <option value="Todos" className="bg-black">TODAS</option>
                    {familias.map(f => <option key={f} value={f} className="bg-black">{f.toUpperCase()}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 text-tech-dim group-hover:text-tech-primary transition-colors pointer-events-none" size={14} />
                </div>
              </div>
            )}

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
                  {familias.length > 0 && <option value="familia" className="bg-black">FAMÍLIA</option>}
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
                <InvocacaoCard key={inv.nome} inv={inv} index={index} onClick={() => abre(inv)} colorido={colorido} />
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
          <div
            className="max-w-6xl w-full max-h-[92vh] overflow-y-auto scrollbar-custom bg-tech-bg border-2 border-tech-primary/50 shadow-[0_0_30px_rgba(0,255,65,0.1)] clip-corner relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-tech-primary z-30 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-tech-primary z-30 pointer-events-none" />

            <div className="flex flex-col lg:flex-row">
              {/* ---------------- a arte ---------------- */}
              <div className="lg:w-[52%] border-b lg:border-b-0 lg:border-r border-tech-border bg-tech-panel/20 shrink-0">
                <div className="p-2 border-b border-tech-border text-[10px] flex justify-between text-tech-primary/50">
                  <span>IMG_DATA_BLOCK_01</span>
                  <span>{idxAberta + 1} / {filtradas.length}</span>
                </div>

                {/* 4:3 fixo, o formato real das duas artes de invocação */}
                <div className="relative w-full aspect-[4/3] bg-black overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.08)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none z-20" />
                  <div className="absolute top-0 left-0 w-full h-1 bg-tech-primary/50 shadow-[0_0_10px_#00ff41] animate-[scanline_3s_linear_infinite] pointer-events-none z-30 opacity-50" />
                  <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-tech-primary z-20 opacity-60" />
                  <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-tech-primary z-20 opacity-60" />
                  {aberta.arteUrl && !aberta.placeholder ? (
                    <img src={formatImageUrl(aberta.arteUrl)} alt={aberta.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <Sparkles size={32} className="text-tech-primary/15" />
                      <span className="text-[10px] uppercase tracking-widest text-tech-primary/30">a arte desta invocação ainda não foi feita</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ---------------- os dados ---------------- */}
              <div className="flex-1 p-5 flex flex-col gap-5 min-w-0">
                <div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <h3 className="text-2xl font-black text-white uppercase tracking-wide">{aberta.nome}</h3>
                    {aberta.rank && <span className="bg-tech-accent text-black text-[10px] font-black px-2 py-0.5 clip-corner-sm">{aberta.rank}</span>}
                  </div>
                  {aberta.hierarquia && (
                    <p className="text-[11px] uppercase tracking-widest text-tech-accent/80 mt-1">{aberta.hierarquia}</p>
                  )}
                  {aberta.nomeAntigo && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      <span className="text-[10px] uppercase tracking-widest text-tech-primary/50">antes chamado de</span>{' '}
                      {aberta.nomeAntigo}
                    </p>
                  )}
                </div>

                {/* Posse: o atual sempre. Os outros dois só quando há cadeia de verdade —
                    `originalOwner` ausente, ou igual ao atual, significa que não houve troca. */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-widest text-tech-primary/50 flex items-center gap-1.5">
                      <User size={11} /> Invocador Atual
                    </span>
                    {!aberta.dono ? (
                      <span className="text-sm text-slate-400 italic">não possui invocador</span>
                    ) : fichaAberta ? (
                      <button
                        onClick={() => onOpenCharacter(fichaAberta)}
                        title={`Abrir a ficha de ${fichaAberta.name}`}
                        className="self-start text-sm text-tech-primary hover:underline decoration-dotted underline-offset-4"
                      >
                        {fichaAberta.name}
                      </button>
                    ) : (
                      <span title="Este invocador ainda não tem ficha" className="text-sm text-slate-300">{aberta.dono}</span>
                    )}
                  </div>

                  {/* O `dono` e o nome CURTO ("Kuromi") e o `originalOwner` o completo ("Kuromi
                      Uchiha"), entao a comparacao tem que ser contra o nome da ficha quando
                      ela existe. Sem isso, invocacao cujo invocador original e o atual
                      mostraria a mesma pessoa duas vezes. */}
                  {aberta.originalOwner && aberta.originalOwner !== (fichaAberta?.name ?? aberta.dono) && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
                        <Hexagon size={11} /> Invocador Original
                      </span>
                      <span className="text-sm text-sky-300">{aberta.originalOwner}</span>
                    </div>
                  )}

                  {aberta.pastOwners?.length ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-widest text-yellow-500 flex items-center gap-1.5">
                        <History size={11} /> Invocadores Antigos
                      </span>
                      <span className="text-sm text-yellow-200/90">{aberta.pastOwners.join(' · ')}</span>
                    </div>
                  ) : null}
                </div>

                {(aberta.familia || aberta.nature || aberta.village) && (
                  <div className="flex gap-6 flex-wrap border-t border-tech-border/50 pt-4">
                    {aberta.familia && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase tracking-widest text-tech-primary/50">Família</span>
                        <span className="text-sm text-slate-200">{aberta.familia}</span>
                      </div>
                    )}
                    {aberta.nature && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase tracking-widest text-tech-primary/50">Natureza</span>
                        <span className="text-sm text-slate-200">{aberta.nature}</span>
                      </div>
                    )}
                    {aberta.village && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase tracking-widest text-tech-primary/50">Vila</span>
                        <span className="text-sm text-slate-200">{aberta.village}</span>
                      </div>
                    )}
                  </div>
                )}

                {aberta.descricao && (
                  <div className="border-t border-tech-border/50 pt-4 flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-tech-primary/50">Descrição</span>
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{aberta.descricao}</p>
                  </div>
                )}

                {(aberta.habilidades?.length || aberta.habilidadeSuprema) && (
                  <div className="border-t border-tech-border/50 pt-4 flex flex-col gap-2.5">
                    {(aberta.habilidades ?? []).map((h, k, todas) => (
                      <div key={k} className="border-l-2 border-tech-primary/50 pl-3 flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-widest text-tech-primary/60">
                          Habilidade{todas.length > 1 ? ` ${k + 1}` : ''}
                        </span>
                        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{h}</p>
                      </div>
                    ))}
                    {/* A Suprema é uma só por invocação, e ganha o âmbar por isso — o mesmo
                        destaque que o rank usa no card. */}
                    {aberta.habilidadeSuprema && (
                      <div className="border-l-2 border-tech-accent pl-3 py-1 flex flex-col gap-1 bg-tech-accent/[0.04]">
                        <span className="text-[10px] uppercase tracking-widest text-tech-accent">Habilidade Suprema</span>
                        <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-line">{aberta.habilidadeSuprema}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Invocacoes;
