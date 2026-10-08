import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Search, ChevronDown, ChevronLeft, ChevronRight, Loader, Terminal, Database, Shield, AlertTriangle, X, User, PawPrint } from 'lucide-react';
import { subscribeChecklist, slugify } from '../data/firestore';
import { carregaChecklist, fonteEstatica } from '../data/dados-publicos';
import { Character, ChecklistItem, CLASSIFICATION_PRIORITY } from '../types';
import { formatImageUrl } from '../utils/formatters';
import InvocacaoCard, { InvocacaoCardData } from '../components/InvocacaoCard';
import BotaoDeCores, { useCapasColoridas } from '../components/BotaoDeCores';
import BotaoDeLink from '../components/BotaoDeLink';
import { FAMILIAS_DE_INVOCACAO } from '../data/familias-de-invocacao';
import { classificationColors } from '../types/Equipment';

/**
 * Os chips são fixos, não derivados dos dados: uma vila sem invocação tem que aparecer e dizer que
 * não existe nenhuma, em vez de simplesmente não estar lá. A ordem é a que o projeto já usa em
 * outras telas, com a OCA no fim porque ela não é vila.
 */
const VILAS = ['Konohagakure', 'Kirigakure', 'Sunagakure', 'Iwagakure', 'Kumogakure', 'OCA'] as const;

/**
 * A cor do rank e o unico acento cromatico que varia de invocacao para invocacao — Z vermelho,
 * S++ laranja, S+ ambar, S amarelo. As 100 tem rank, mas o fallback existe porque o campo e
 * opcional no tipo.
 */
const corDoRank = (rank?: string) => classificationColors[rank ?? ''] ?? classificationColors['F'];

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

  /** Ficha do dono, quando existe: o vínculo é pelo nome completo, como no reconciliador. */
  const fichaDo = (nome: string) => characters.find(c => c.name === (nome || '').trim());
  const fichaAberta = aberta ? fichaDo(aberta.dono) : undefined;

  // 35 das 100 nao tem descricao nem habilidade. Sem isso o card abriria largo com a coluna da
  // direita vazia, que e o mesmo defeito do buraco preto, so do outro lado.
  const temTexto = !!(aberta && (aberta.descricao || (aberta.habilidades ?? []).length || aberta.habilidadeSuprema));
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
              <BotaoDeLink oQue="das invocações" />
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
          {/* Sem descricao e sem habilidade — um terco delas — a direita nao teria nada, entao o
              card e uma coluna so, do tamanho do poster. Card largo com metade vazia e o mesmo
              defeito de antes, do outro lado. */}
          <div
            className={`w-full max-h-[90vh] bg-tech-bg border-2 border-tech-primary/50 shadow-[0_0_60px_-15px_rgba(0,255,65,0.3)] clip-corner relative flex flex-col ${temTexto ? 'max-w-6xl' : 'max-w-md'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-tech-primary z-40 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-tech-primary z-40 pointer-events-none" />

            {/* a faixa fica FORA da area que rola: o contador nao sai da tela */}
            <div className="shrink-0 border-b border-tech-border bg-tech-panel/40 pl-6 pr-4 py-2 flex items-center justify-between gap-3 text-[10px] tracking-[0.16em] text-tech-primary/50">
              <span className="flex items-center gap-2 min-w-0">
                <Database size={10} className="shrink-0" />
                <span className="truncate">IMG_DATA_BLOCK_01{aberta.familia ? ` · ${aberta.familia.toUpperCase()}` : ''}</span>
              </span>
              <span className="shrink-0">{String(idxAberta + 1).padStart(3, '0')} / {filtradas.length}</span>
            </div>

            {/* É ESTE div que rola, e a coluna da esquerda e `sticky` dentro dele. Sticky nao
                estica, e `items-start` impede que qualquer coluna seja alongada — que era a raiz
                do problema: a coluna esticava, a arte esticava com ela, e o `object-contain`
                preenchia a diferenca com as faixas pretas. Agora o quadro da arte TEM 4:3 e a
                imagem cobre: nao existe diferenca para preencher. */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="flex flex-col lg:flex-row lg:items-start">
                <div className={`p-5 flex flex-col gap-3 ${temTexto ? 'lg:w-[430px] shrink-0 lg:sticky lg:top-0 lg:pr-6' : 'w-full'}`}>

                  {/* ---------- o poster: a arte e a placa do nome num quadro so ---------- */}
                  <div className="border border-tech-border bg-black">
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <div className="absolute inset-0 z-10 bg-[linear-gradient(transparent_2px,rgba(0,0,0,0.45)_3px)] bg-[size:100%_4px] pointer-events-none opacity-20" />
                      <div className="absolute top-0 left-0 w-full h-px bg-tech-primary/60 shadow-[0_0_10px_#00ff41] animate-[scanline_4s_linear_infinite] pointer-events-none z-20 opacity-60" />
                      <div className="absolute top-2.5 left-2.5 w-4 h-4 border-t border-l border-tech-primary/60 z-20" />
                      <div className="absolute top-2.5 right-2.5 w-4 h-4 border-t border-r border-tech-primary/60 z-20" />
                      <div className="absolute bottom-2.5 left-2.5 w-4 h-4 border-b border-l border-tech-primary/60 z-20" />
                      <div className="absolute bottom-2.5 right-2.5 w-4 h-4 border-b border-r border-tech-primary/60 z-20" />
                      {aberta.arteUrl && !aberta.placeholder ? (
                        // 4:3 no quadro e 4:3 na pagina do Canva: `cover` preenche exato, sem
                        // faixa preta e sem recortar desenho.
                        <img src={formatImageUrl(aberta.arteUrl)} alt={aberta.nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-striped-pattern opacity-50">
                          <Sparkles size={36} className="text-tech-dim animate-pulse" />
                          <span className="text-[9px] uppercase tracking-[0.2em] text-tech-primary/30">arte pendente</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-tech-border bg-tech-panel/60 px-4 py-3 flex items-start gap-3">
                      <span className={`w-1 self-stretch shrink-0 ${corDoRank(aberta.rank).bg}`} />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[22px] leading-none font-black text-white uppercase tracking-wide truncate">{aberta.nome}</h3>
                        {aberta.hierarquia && (
                          <p className="text-[10px] uppercase tracking-[0.18em] text-tech-accent/90 mt-2">{aberta.hierarquia}</p>
                        )}
                        {aberta.nomeAntigo && (
                          <p className="text-[10px] uppercase tracking-[0.14em] text-tech-primary/40 mt-2">antes chamado de {aberta.nomeAntigo}</p>
                        )}
                      </div>
                      {aberta.rank && (
                        <span className={`shrink-0 text-black text-[11px] font-black px-2.5 py-1 leading-none clip-corner-sm ${corDoRank(aberta.rank).bg}`}>{aberta.rank}</span>
                      )}
                    </div>
                  </div>

                  {/* ---------- a ficha tecnica ---------- */}
                  {/* A REGRA DE POSSE (Pedro, 10/09/2026): Atual, Passados, Original — e invocador
                      atual MORTO mostra "sem invocador", mas o morto desce para Passados, no fim
                      da lista, porque e o mais recente de quem ja invocou. Atinge 16 das 100. */}
                  {(() => {
                    const atualMorto = !!fichaAberta?.isDead;
                    const nomeAtual = fichaAberta?.name ?? aberta.dono;
                    const passados = [...(aberta.pastOwners ?? []), ...(atualMorto ? [nomeAtual] : [])];
                    // `dono` e `originalOwner` são os dois o nome completo desde 15/09/2026; a
                    // comparação continua contra o nome da ficha quando ela existe, porque é ela
                    // que manda se o cadastro divergir.
                    const mostraOriginal = aberta.originalOwner && aberta.originalOwner !== nomeAtual;

                    type Celula = { rotulo: string; cor: string; valor: React.ReactNode };

                    const invocadores: Celula[] = [
                      {
                        rotulo: 'Invocador Atual',
                        cor: 'text-tech-primary/60',
                        valor: !aberta.dono || atualMorto
                          ? <span className="text-slate-500 italic">sem invocador</span>
                          : fichaAberta
                            ? <button
                                onClick={() => onOpenCharacter(fichaAberta)}
                                title={`Abrir a ficha de ${fichaAberta.name}`}
                                className="text-tech-primary hover:underline decoration-dotted underline-offset-4 text-left"
                              >{fichaAberta.name}</button>
                            : <span title="Este invocador ainda não tem ficha">{aberta.dono}</span>,
                      },
                      ...(passados.length ? [{
                        rotulo: 'Invocadores Passados',
                        cor: 'text-yellow-500/80',
                        valor: <span className="text-yellow-200/90">{passados.join(' · ')}</span>,
                      }] : []),
                      ...(mostraOriginal ? [{
                        rotulo: 'Invocador Original',
                        cor: 'text-sky-400/80',
                        valor: <span className="text-sky-300">{aberta.originalOwner}</span>,
                      }] : []),
                    ];

                    const dados: Celula[] = [
                      ...(aberta.familia ? [{ rotulo: 'Família', cor: 'text-tech-primary/50', valor: aberta.familia }] : []),
                      ...(aberta.nature ? [{ rotulo: 'Natureza', cor: 'text-tech-primary/50', valor: aberta.nature }] : []),
                      ...(aberta.village ? [{ rotulo: 'Vila', cor: 'text-tech-primary/50', valor: aberta.village }] : []),
                    ];

                    // O Tailwind le o codigo como texto: a classe tem que estar escrita, nao
                    // montada por interpolacao.
                    const colunas = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3'];
                    const grade = (itens: Celula[]) => (
                      <div className={`grid gap-px bg-tech-border/60 border border-tech-border/60 ${colunas[itens.length]}`}>
                        {itens.map(c => (
                          // o rotulo CRESCE dentro da celula, entao os valores alinham na base
                          // mesmo quando um rotulo quebra em duas linhas e o outro nao
                          <div key={c.rotulo} className="bg-tech-panel/40 px-3 py-2.5 flex flex-col gap-1.5 min-w-0">
                            <span className={`text-[9px] uppercase tracking-[0.16em] leading-[1.35] grow ${c.cor}`}>{c.rotulo}</span>
                            <span className="text-[13px] text-slate-200 leading-snug break-words">{c.valor}</span>
                          </div>
                        ))}
                      </div>
                    );

                    return (
                      <div className="flex flex-col gap-2">
                        {grade(invocadores)}
                        {dados.length > 0 && grade(dados)}
                        {!temTexto && (
                          <p className="text-[9px] uppercase tracking-[0.18em] text-tech-primary/25 text-center pt-1.5">
                            descrição e habilidades ainda não escritas
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* ================= descricao e habilidades ================= */}
                {temTexto && (
                  <div className="flex-1 min-w-0 px-5 pb-5 pt-0 lg:pt-5 lg:pl-0 flex flex-col gap-4">
                    {aberta.descricao && (
                      <div className="flex flex-col gap-2">
                        <span className="text-[9px] uppercase tracking-[0.22em] text-tech-primary/50">Descrição</span>
                        <p className="text-[14px] text-slate-300 leading-[1.75] whitespace-pre-line">{aberta.descricao}</p>
                      </div>
                    )}

                    {/* As 131 habilidades do banco vem, todas, como "Nome: texto" — entao o nome
                        vira titulo do bloco. O limite de 40 caracteres no prefixo e a saida se um
                        dia entrar uma que nao siga o formato: sem casar, o texto inteiro vai para
                        o corpo e o titulo cai no numero. O maior prefixo real tem 35. */}
                    {(aberta.habilidades ?? []).map((h, k) => {
                      const m = /^([^:]{1,40}):\s+([\s\S]+)$/.exec(h);
                      return (
                        <div key={k} className="border border-tech-border/70 bg-tech-panel/25">
                          <div className="flex items-center gap-2.5 border-b border-tech-border/70 bg-tech-primary/[0.07] px-3.5 py-2">
                            <span className="text-[10px] font-black text-black bg-tech-primary/70 px-1.5 py-0.5 leading-none">{String(k + 1).padStart(2, '0')}</span>
                            <span className="text-[12px] uppercase tracking-[0.14em] text-tech-primary truncate">{m ? m[1] : `Habilidade ${k + 1}`}</span>
                          </div>
                          <p className="px-3.5 py-3 text-[13.5px] text-slate-300 leading-[1.7] whitespace-pre-line">{m ? m[2] : h}</p>
                        </div>
                      );
                    })}

                    {/* A Suprema e uma so por invocacao, e o ambar e o que diz isso. */}
                    {aberta.habilidadeSuprema && (() => {
                      const m = /^([^:]{1,40}):\s+([\s\S]+)$/.exec(aberta.habilidadeSuprema);
                      return (
                        <div className="border border-tech-accent/35 bg-tech-accent/[0.05]">
                          <div className="flex items-center gap-2.5 border-b border-tech-accent/35 bg-tech-accent/[0.12] px-3.5 py-2">
                            <span className="text-[10px] font-black text-black bg-tech-accent px-1.5 py-0.5 leading-none uppercase tracking-wider">Suprema</span>
                            {m && <span className="text-[12px] uppercase tracking-[0.14em] text-tech-accent truncate">{m[1]}</span>}
                          </div>
                          <p className="px-3.5 py-3 text-[13.5px] text-slate-200 leading-[1.7] whitespace-pre-line">{m ? m[2] : aberta.habilidadeSuprema}</p>
                        </div>
                      );
                    })()}
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
