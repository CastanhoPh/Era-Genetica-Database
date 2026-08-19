import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Search, ChevronDown, Loader, AlertTriangle, X, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { subscribeChecklist, slugify } from '../data/firestore';
import { Character, ChecklistItem, CLASSIFICATION_PRIORITY } from '../types';
import { formatImageUrl } from '../utils/formatters';

interface InvocacoesProps {
  characters: Character[];
  onOpenCharacter: (char: Character) => void;
}

/** Uma invocação montada dos dois projetos: a capa é o card, a arte é o que abre. */
interface Inv {
  nome: string;
  dono: string;
  capaUrl?: string;
  arteUrl?: string;
  rank?: string;
  placeholder: boolean;
  pagina: number;
}

const Invocacoes: React.FC<InvocacoesProps> = ({ characters, onOpenCharacter }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [dono, setDono] = useState('Todos');
  const [rank, setRank] = useState('Todos');

  // Mesma fonte da Galeria: a lista de verdade é o checklist. A ficha carrega uma cópia
  // desnormalizada, mas ela só tem as invocações de quem TEM ficha — aqui a página é sobre
  // invocação, não sobre personagem, então nenhuma pode faltar.
  useEffect(() => {
    const unsubscribe = subscribeChecklist(
      data => { setItems(data); setLoading(false); },
      e => { console.error('Erro ao escutar o checklist:', e); setErro('Não foi possível carregar as invocações.'); setLoading(false); },
    );
    return () => unsubscribe();
  }, []);

  const invocacoes = useMemo<Inv[]>(() => {
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
          placeholder: !!(i.placeholder || capa?.placeholder),
          pagina: k + 1,
        };
      });
  }, [items]);

  const donos = useMemo(
    () => Array.from(new Set(invocacoes.map(i => i.dono))).sort((a, b) => a.localeCompare(b)),
    [invocacoes],
  );
  // O rank ainda não foi definido para nenhuma. Um filtro vazio só ocuparia espaço, então ele
  // aparece no dia em que a primeira invocação tiver rank.
  const ranks = useMemo(() => {
    const set = new Set(invocacoes.map(i => i.rank).filter((r): r is string => !!r));
    return Array.from(set).sort((a, b) =>
      (CLASSIFICATION_PRIORITY[b] ?? 0) - (CLASSIFICATION_PRIORITY[a] ?? 0));
  }, [invocacoes]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return invocacoes.filter(i =>
      (dono === 'Todos' || i.dono === dono)
      && (rank === 'Todos' || i.rank === rank)
      && (!termo || i.nome.toLowerCase().includes(termo) || i.dono.toLowerCase().includes(termo)));
  }, [invocacoes, busca, dono, rank]);

  // /invocacoes/<nome> abre a arte. Fica na URL para o link ser compartilhável, como no resto do site.
  const slugAberto = location.pathname.replace(/^\/+|\/+$/g, '').split('/')[1];
  const aberta = slugAberto ? filtradas.find(i => slugify(i.nome) === decodeURIComponent(slugAberto)) : undefined;
  const idxAberta = aberta ? filtradas.indexOf(aberta) : -1;
  const abre = (i: Inv) => navigate(`/invocacoes/${encodeURIComponent(slugify(i.nome))}`);
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

  const prontas = invocacoes.filter(i => !i.placeholder).length;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <div className="flex items-end justify-between gap-4 flex-wrap border-l-4 border-tech-primary pl-4">
          <div>
            <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-wider flex items-center gap-3">
              <Sparkles className="text-tech-primary" size={26} />
              Invocações
            </h2>
            <p className="text-[10px] text-tech-primary/50 uppercase tracking-widest mt-1">
              {invocacoes.length} invocações · {donos.length} donos
              {prontas < invocacoes.length && ` · ${invocacoes.length - prontas} com arte pendente`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tech-primary/40" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar invocação ou dono"
            className="w-full bg-black border border-tech-border pl-9 pr-3 py-2 text-[12px] text-tech-primary placeholder:text-tech-primary/25 outline-none focus:border-tech-primary"
          />
        </div>
        <div className="relative">
          <select
            value={dono}
            onChange={e => setDono(e.target.value)}
            className="appearance-none bg-black border border-tech-border pl-3 pr-9 py-2 text-[12px] text-tech-primary outline-none focus:border-tech-primary cursor-pointer"
          >
            <option value="Todos">Todos os donos</option>
            {donos.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-tech-primary/40 pointer-events-none" />
        </div>
        {ranks.length > 0 && (
          <div className="relative">
            <select
              value={rank}
              onChange={e => setRank(e.target.value)}
              className="appearance-none bg-black border border-tech-border pl-3 pr-9 py-2 text-[12px] text-tech-primary outline-none focus:border-tech-primary cursor-pointer"
            >
              <option value="Todos">Todos os ranks</option>
              {ranks.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-tech-primary/40 pointer-events-none" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <Loader size={22} className="animate-spin text-tech-primary" />
          <span className="text-[10px] uppercase tracking-widest text-tech-primary/40">carregando invocações</span>
        </div>
      ) : erro ? (
        <div className="border border-orange-400/50 bg-orange-400/5 p-5 flex items-center gap-3">
          <AlertTriangle size={16} className="text-orange-400" />
          <span className="text-[12px] text-orange-400">{erro}</span>
        </div>
      ) : (
        <>
          {/* 4:3 é o formato real das artes; quadrado cortaria um quarto do desenho */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtradas.map(inv => {
              const ficha = fichaDo(inv.dono);
              return (
                <div key={inv.nome} className="group relative">
                  <button
                    onClick={() => abre(inv)}
                    className="relative w-full aspect-[4/3] border border-tech-border bg-tech-panel/40 overflow-hidden hover:border-tech-accent transition-all duration-300 text-left"
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
                        className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"
                      />
                    ) : (
                      /* placeholder é página em branco — mostrar seria fingir que a arte existe */
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-tech-dim">
                        <Sparkles size={26} className="opacity-20" />
                        <span className="text-[8px] uppercase tracking-widest text-tech-primary/25">arte pendente</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent pointer-events-none z-20" />
                    <span className="absolute bottom-1 left-1.5 right-1.5 text-[11px] text-white leading-tight line-clamp-2 pointer-events-none z-20">{inv.nome}</span>
                  </button>

                  {/* o dono fica FORA do botão: ele é um link próprio para a ficha, e um botão
                      dentro de outro botão não é clicável nem navegável por teclado */}
                  {ficha ? (
                    <button
                      onClick={() => onOpenCharacter(ficha)}
                      title={`Abrir a ficha de ${ficha.name}`}
                      className="mt-1 flex items-center gap-1 text-[9px] uppercase tracking-widest text-tech-primary/40 hover:text-tech-primary transition-colors"
                    >
                      <User size={9} /> {inv.dono}
                    </button>
                  ) : (
                    <span
                      title="Este dono ainda não tem ficha"
                      className="mt-1 flex items-center gap-1 text-[9px] uppercase tracking-widest text-tech-primary/25"
                    >
                      <User size={9} /> {inv.dono}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {filtradas.length === 0 && (
            <div className="border border-tech-border bg-tech-panel/20 py-14 text-center">
              <Sparkles size={22} className="mx-auto text-tech-primary/20 mb-2" />
              <p className="text-[10px] uppercase tracking-widest text-tech-primary/30">Nenhuma invocação com esse filtro.</p>
            </div>
          )}
        </>
      )}

      {/* ---- a arte cheia ---- */}
      {aberta && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={fecha}>
          <button
            onClick={fecha}
            title="Fechar"
            className="absolute top-4 right-4 text-tech-primary/60 hover:text-tech-primary transition-colors z-10"
          >
            <X size={22} />
          </button>
          {filtradas.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); anda(-1); }}
                title="Anterior"
                className="absolute left-3 sm:left-6 text-tech-primary/40 hover:text-tech-primary transition-colors z-10"
              >
                <ChevronLeft size={30} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); anda(1); }}
                title="Próxima"
                className="absolute right-3 sm:right-6 text-tech-primary/40 hover:text-tech-primary transition-colors z-10"
              >
                <ChevronRight size={30} />
              </button>
            </>
          )}
          <div className="max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-baseline gap-3 flex-wrap mb-3">
              <h3 className="text-xl font-black text-white uppercase tracking-wide">{aberta.nome}</h3>
              {aberta.rank && <span className="bg-tech-accent text-black text-[9px] font-black px-2 py-0.5 clip-corner-sm">{aberta.rank}</span>}
              <span className="text-[10px] uppercase tracking-widest text-tech-primary/40">de {aberta.dono}</span>
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
    </div>
  );
};

export default Invocacoes;
