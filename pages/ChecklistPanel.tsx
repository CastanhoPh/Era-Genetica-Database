import React, { useState, useEffect, useMemo } from 'react';
import { ListChecks, CheckSquare, Square, Clock, ChevronDown, Search, Radio, Pencil, X, Trash2, ChevronUp, Plus, Check, Lock, LayoutGrid, Image as ImageIcon, Sparkles } from 'lucide-react';
import { subscribeChecklist, setChecklistItemDone, updateChecklistItem, addChecklistItem, deleteChecklistItem, renameChecklistItem, CHECKLIST_BLOCOS } from '../data/firestore';
import { groupItems } from '../data/checklistGrouping';
import { ChecklistItem } from '../types';
import ImageUploadButton from '../components/ImageUploadButton';

const countable = (items: ChecklistItem[]) => items.filter(i => !i.placeholder);
const doneCount = (items: ChecklistItem[]) => countable(items).filter(i => i.done).length;
const maxOrder = (items: ChecklistItem[]) => items.reduce((m, i) => Math.max(m, i.order), 0);

const ProgressBar: React.FC<{ pct: number; className?: string }> = ({ pct, className }) => (
  <div className={`h-1.5 bg-black border border-tech-border overflow-hidden ${className ?? ''}`}>
    <div className="h-full bg-tech-primary transition-all duration-500" style={{ width: `${pct}%` }} />
  </div>
);

interface ChecklistPanelProps {
  canEdit: boolean;
  displayName: string | null;
  onRequestLogin: () => void;
}

const ChecklistPanel: React.FC<ChecklistPanelProps> = ({ canEdit, displayName, onRequestLogin }) => {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTemporadas, setExpandedTemporadas] = useState<Set<string>>(new Set());
  const [expandedArcos, setExpandedArcos] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'none' | 'pendentes' | 'sem-galeria'>('none');
  const [activeType, setActiveType] = useState<'evento' | 'timeline' | 'capa' | 'transformacao' | 'invocacao' | 'capaInvocacao' | 'geral'>('geral');

  // formulários de "adicionar" abertos (chave = temporada, temporada::arco, ou temporada::arco::subarco)
  const [addingTemporada, setAddingTemporada] = useState(false);
  const [newTemporadaFields, setNewTemporadaFields] = useState({ temporada: '', arco: '', item: '' });
  const [addingArcoFor, setAddingArcoFor] = useState<string | null>(null);
  const [newArcoFields, setNewArcoFields] = useState({ arco: '', subarco: '', item: '' });
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeChecklist(
      data => { setItems(data); setLoading(false); setError(null); },
      err => { console.error('Erro ao escutar checklist:', err); setError('Não foi possível carregar a checklist.'); setLoading(false); },
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!canEdit) setEditMode(false);
  }, [canEdit]);

  // Trocar de aba fecha formulários/expansões abertos da aba anterior, pra não misturar estado.
  // Busca e filtro (Feitas/Pendentes/sem-galeria) continuam iguais — trocar de Eventos pra
  // Linha do Tempo não deve apagar o que já foi digitado nem desmarcar o filtro ativo.
  useEffect(() => {
    setExpandedTemporadas(new Set());
    setExpandedArcos(new Set());
    setAddingTemporada(false);
    setAddingArcoFor(null);
    setAddingItemFor(null);
  }, [activeType]);

  const isTimeline = activeType === 'timeline';
  const isCapa = activeType === 'capa';
  const isTransformacao = activeType === 'transformacao';
  const isInvocacao = activeType === 'invocacao';
  const isCapaInvocacao = activeType === 'capaInvocacao';
  const isGeral = activeType === 'geral';
  // Tipo usado ao criar um item novo — a aba "Geral" mistura os outros tipos, então criar
  // por lá sempre cai em "evento" (comportamento já existente, só nomeado agora).
  const currentType: ChecklistItem['type'] = isTimeline ? 'timeline'
    : isCapa ? 'capa'
      : isCapaInvocacao ? 'capaInvocacao'
        : isInvocacao ? 'invocacao'
          : isTransformacao ? 'transformacao' : 'evento';
  const labels = isTransformacao
    ? {
      subtitle: 'Marque aqui os modos e transformações já finalizados de cada personagem',
      temporadaLabel: 'Personagem',
      arcoLabel: 'Modo',
      newTemporadaBtn: 'Novo Personagem',
      temporadaPlaceholder: 'Nome do personagem',
      firstArcoPlaceholder: 'Nome do primeiro modo',
      arcoPlaceholder: 'Nome do modo',
      addArcoTitle: 'Adicionar modo',
      emptyChecklist: 'Nenhum modo ou transformação cadastrado ainda.',
    }
    : isTimeline
    ? {
      subtitle: 'Marque aqui as imagens já finalizadas da linha do tempo de cada personagem',
      temporadaLabel: 'Personagem',
      arcoLabel: 'Fase',
      newTemporadaBtn: 'Novo Personagem',
      temporadaPlaceholder: 'Nome do personagem',
      firstArcoPlaceholder: 'Nome da primeira fase',
      arcoPlaceholder: 'Nome da imagem',
      addArcoTitle: 'Adicionar fase',
      emptyChecklist: 'Nenhum item na linha do tempo ainda.',
    }
    : isInvocacao
    ? {
      subtitle: 'Marque aqui as artes de invocação já finalizadas, agrupadas pelo dono',
      temporadaLabel: 'Dono',
      arcoLabel: 'Invocação',
      newTemporadaBtn: 'Novo Dono',
      temporadaPlaceholder: 'Primeiro nome do dono',
      firstArcoPlaceholder: 'Nome da primeira invocação',
      arcoPlaceholder: 'Nome da invocação',
      addArcoTitle: 'Adicionar invocação',
      emptyChecklist: 'Nenhuma invocação cadastrada ainda.',
    }
    : isCapa
      ? {
        subtitle: 'Marque aqui quais personagens já têm a capa (imagem de perfil) atualizada',
        temporadaLabel: 'Personagem',
        arcoLabel: '',
        newTemporadaBtn: 'Novo Personagem',
        temporadaPlaceholder: 'Nome do personagem',
        firstArcoPlaceholder: '',
        arcoPlaceholder: '',
        addArcoTitle: '',
        emptyChecklist: 'Nenhuma capa cadastrada ainda.',
      }
      : isCapaInvocacao
      ? {
        subtitle: 'Marque aqui quais invocações já têm capa, agrupadas pelo dono',
        temporadaLabel: 'Dono',
        arcoLabel: 'Invocação',
        newTemporadaBtn: 'Novo Dono',
        temporadaPlaceholder: 'Primeiro nome do dono',
        firstArcoPlaceholder: 'Nome da primeira invocação',
        arcoPlaceholder: 'Nome da invocação',
        addArcoTitle: 'Adicionar capa de invocação',
        emptyChecklist: 'Nenhuma capa de invocação cadastrada ainda.',
      }
      : isGeral
        ? {
          subtitle: 'Todas as imagens de Eventos, Linha do Tempo, Modos, Invocações e Capas, juntas',
          temporadaLabel: '',
          arcoLabel: '',
          newTemporadaBtn: '',
          temporadaPlaceholder: '',
          firstArcoPlaceholder: '',
          arcoPlaceholder: '',
          addArcoTitle: '',
          emptyChecklist: 'Nenhum item na checklist ainda.',
        }
        : {
          subtitle: 'Marque aqui as imagens já finalizadas de cada temporada/arco',
          temporadaLabel: 'Temporada',
          arcoLabel: 'Arco',
          newTemporadaBtn: 'Nova Temporada',
          temporadaPlaceholder: 'Nome da temporada',
          firstArcoPlaceholder: 'Nome do primeiro arco',
          arcoPlaceholder: 'Nome do arco',
          addArcoTitle: 'Adicionar arco',
          emptyChecklist: 'Nenhum item na checklist ainda. Envie a lista (temporada, arco, subarco e nomes) para que ela seja adicionada aqui.',
        };

  const typedItems = useMemo(
    () => isGeral ? items : items.filter(i => (i.type ?? 'evento') === activeType),
    [items, activeType, isGeral],
  );
  const groups = useMemo(() => groupItems(typedItems), [typedItems]);

  const matchesActiveFilter = (item: ChecklistItem): boolean => {
    if (item.placeholder) return false;
    if (activeFilter === 'pendentes') return !item.done;
    if (activeFilter === 'sem-galeria') return item.done && !item.imageUrl;
    return true;
  };

  // Na Linha do Tempo o "nome" do item é só a fase (Prólogo, Clássico...), que se repete
  // em todo mundo — sem olhar `temporada` (o personagem) também, buscar pelo nome de
  // alguém nunca acha nada.
  const matchesSearch = (item: ChecklistItem, term: string) =>
    item.name.toLowerCase().includes(term) || item.temporada.toLowerCase().includes(term);

  const filteredGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term && activeFilter === 'none') return groups;
    return groups
      .map(g => ({
        ...g,
        arcos: g.arcos
          .map(a => ({
            ...a,
            subarcos: a.subarcos
              .map(s => ({
                ...s,
                items: s.items.filter(i => (!term || matchesSearch(i, term)) && matchesActiveFilter(i)),
              }))
              .filter(s => s.items.length > 0),
          }))
          .filter(a => a.subarcos.length > 0),
      }))
      .filter(g => g.arcos.length > 0);
  }, [groups, searchTerm, activeFilter]);

  const totalItems = countable(typedItems).length;
  const totalDone = doneCount(typedItems);
  const overallPct = totalItems ? (totalDone / totalItems) * 100 : 0;
  const totalInGallery = countable(typedItems).filter(i => i.done && i.imageUrl).length;
  const galleryPct = totalItems ? (totalInGallery / totalItems) * 100 : 0;

  const doneByCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of typedItems) {
      if (item.done && item.doneBy) counts.set(item.doneBy, (counts.get(item.doneBy) ?? 0) + 1);
    }
    return counts;
  }, [typedItems]);
  const PEOPLE_ORDER = ['Pedro', 'Liu', 'Zeck'];

  const toggleArcKey = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  };

  const withPending = async (docId: string, fn: () => Promise<void>) => {
    if (pending.has(docId)) return;
    setPending(prev => new Set(prev).add(docId));
    try {
      await fn();
    } catch (e) {
      console.error('Erro ao atualizar checklist:', e);
    } finally {
      setPending(prev => { const next = new Set(prev); next.delete(docId); return next; });
    }
  };

  const toggleItem = (item: ChecklistItem) => {
    if (!item.docId || item.placeholder || !canEdit) return;
    withPending(item.docId, () => setChecklistItemDone(item.docId!, !item.done, displayName));
  };

  const handleRename = (item: ChecklistItem, newName: string) => {
    const trimmed = newName.trim();
    if (!item.docId || !trimmed || trimmed === item.name) return;
    // renameChecklistItem e nao updateChecklistItem: em evento ele arrasta a legenda gravada na
    // Galeria de cada participante junto, senao a ficha fica com o nome antigo da cena.
    withPending(item.docId, () => renameChecklistItem(item, trimmed));
  };

  const handleTogglePlaceholder = (item: ChecklistItem) => {
    if (!item.docId) return;
    const nextPlaceholder = !item.placeholder;
    withPending(item.docId, () => updateChecklistItem(item.docId!, { placeholder: nextPlaceholder, done: nextPlaceholder ? false : item.done }));
  };

  const handleDelete = (item: ChecklistItem) => {
    if (!item.docId) return;
    if (!window.confirm(`Remover "${item.name}" da checklist?`)) return;
    withPending(item.docId, () => deleteChecklistItem(item.docId!));
  };

  const handleMove = (itemsInGroup: ChecklistItem[], item: ChecklistItem, direction: -1 | 1) => {
    const idx = itemsInGroup.findIndex(i => i.docId === item.docId);
    const neighbor = itemsInGroup[idx + direction];
    if (!item.docId || !neighbor?.docId) return;
    withPending(item.docId, async () => {
      await updateChecklistItem(item.docId!, { order: neighbor.order });
      await updateChecklistItem(neighbor.docId!, { order: item.order });
    });
  };

  const handleSetImage = (item: ChecklistItem, url: string) => {
    if (!item.docId) return;
    withPending(item.docId, () => updateChecklistItem(item.docId!, { imageUrl: url }));
  };

  const handleRemoveImage = (item: ChecklistItem) => {
    if (!item.docId) return;
    withPending(item.docId, () => updateChecklistItem(item.docId!, { imageUrl: null }));
  };

  const openAddItem = (key: string) => {
    setAddingItemFor(key);
    setNewItemText('');
  };
  const confirmAddItem = async (temporada: string, arco: string, subarco: string | null, scopeItems: ChecklistItem[]) => {
    const name = newItemText.trim();
    if (!name) return;
    // +0.5 (não +1): com order sequencial sem lacunas, +1 colidiria exatamente com o
    // primeiro item do próximo arco, embaralhando a visão "Geral" (que não agrupa por temporada).
    const order = maxOrder(scopeItems) + 0.5;
    await addChecklistItem({ type: currentType, temporada, arco, subarco: subarco ?? undefined, name, order, done: false, placeholder: false });
    setAddingItemFor(null);
    setNewItemText('');
  };

  const openAddArco = (temporada: string) => {
    setAddingArcoFor(temporada);
    setNewArcoFields({ arco: '', subarco: '', item: '' });
  };
  const confirmAddArco = async (temporada: string, scopeItems: ChecklistItem[]) => {
    const arco = newArcoFields.arco.trim();
    if (!arco) return;
    // +0.5: mesma razão do confirmAddItem — evita colidir com o 1º item da próxima temporada.
    const order = maxOrder(scopeItems) + 0.5;
    if (isTimeline) {
      // Na Linha do Tempo não existe subarco/item separado: a "fase" já é o item (name = arco).
      await addChecklistItem({ type: currentType, temporada, arco, name: arco, order, done: false, placeholder: false });
      setAddingArcoFor(null);
      return;
    }
    const name = newArcoFields.item.trim();
    if (!name) return;
    await addChecklistItem({ type: currentType, temporada, arco, subarco: newArcoFields.subarco.trim() || undefined, name, order, done: false, placeholder: false });
    setAddingArcoFor(null);
  };

  const confirmAddTemporada = async () => {
    const temporada = newTemporadaFields.temporada.trim();
    // Na capa de PERSONAGEM não existe fase separada: o personagem já É o item. A capa de invocação
    // não entra aqui — ela agrupa por dono, como a invocação.
    const arco = isCapa ? temporada : newTemporadaFields.arco.trim();
    const name = isCapa ? temporada : newTemporadaFields.item.trim();
    if (!temporada || !arco || !name) return;
    // Faixa do tipo como piso: sem isso um personagem novo na Linha do Tempo pegaria o order
    // máximo GLOBAL (hoje na faixa de Eventos, a última) e cairia no projeto errado. O piso
    // também resolve o caso da faixa vazia, em que não há máximo nenhum para somar.
    const base = CHECKLIST_BLOCOS[currentType ?? 'evento'];
    const order = Math.max(base - 1, maxOrder(typedItems)) + 1;
    await addChecklistItem({ type: currentType, temporada, arco, name, order, done: false, placeholder: false });
    setAddingTemporada(false);
    setNewTemporadaFields({ temporada: '', arco: '', item: '' });
  };

  const renderItemRow = (item: ChecklistItem, itemsInGroup: ChecklistItem[]) => (
    editMode && canEdit ? (
      <div key={item.docId} className={`flex items-center gap-1.5 px-2 py-1.5 border text-sm ${item.placeholder ? 'border-dashed border-tech-border' : 'border-tech-border'}`}>
        <div className="flex flex-col shrink-0">
          <button type="button" onClick={() => handleMove(itemsInGroup, item, -1)} disabled={itemsInGroup[0]?.docId === item.docId} className="text-tech-primary/50 hover:text-tech-primary disabled:opacity-20">
            <ChevronUp size={13} />
          </button>
          <button type="button" onClick={() => handleMove(itemsInGroup, item, 1)} disabled={itemsInGroup[itemsInGroup.length - 1]?.docId === item.docId} className="text-tech-primary/50 hover:text-tech-primary disabled:opacity-20">
            <ChevronDown size={13} />
          </button>
        </div>
        <button type="button" onClick={() => handleTogglePlaceholder(item)} title="Alternar placeholder" className="shrink-0">
          {item.placeholder ? <Clock size={15} className="text-tech-primary/40" /> : item.done ? <CheckSquare size={15} className="text-tech-primary" /> : <Square size={15} className="text-tech-dim" />}
        </button>
        <input
          key={item.docId + item.name}
          type="text"
          defaultValue={item.name}
          onBlur={e => handleRename(item, e.target.value)}
          className="bg-black border border-tech-border/60 text-white text-sm px-2 py-1 flex-1 min-w-0 outline-none focus:border-tech-primary"
        />
        {item.imageUrl ? (
          <div className="shrink-0 relative group/thumb">
            <a href={item.imageUrl} target="_blank" rel="noopener noreferrer">
              <img src={item.imageUrl} alt={item.name} className="w-8 h-8 object-cover border border-tech-primary/40" />
            </a>
            <button
              type="button"
              onClick={() => handleRemoveImage(item)}
              title="Remover imagem"
              className="absolute -top-1.5 -right-1.5 bg-black border border-red-500/60 text-red-500 rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
            >
              <X size={9} />
            </button>
          </div>
        ) : (
          <ImageUploadButton
            pathPrefix={
              item.type === 'timeline' ? `Galeria/Linha do Tempo/${item.temporada}`
                : item.type === 'transformacao' ? `Galeria/Modos e Transformações/${item.temporada}`
                  : item.type === 'capa' ? `Galeria/Capas/${item.temporada}`
                    : item.type === 'invocacao' ? `Galeria/Invocações/${item.temporada}`
                      : item.type === 'capaInvocacao' ? 'Galeria/Capas Invocações'
                        : `Galeria/${item.temporada}/${item.arco}${item.subarco ? `/${item.subarco}` : ''}`}
            fileName={item.name}
            onUploaded={url => handleSetImage(item, url)}
            iconOnly
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 border border-tech-border text-tech-primary/50 hover:border-tech-primary hover:text-tech-primary transition-colors"
          />
        )}
        <button type="button" onClick={() => handleDelete(item)} className="shrink-0 text-red-500/70 hover:text-red-400">
          <Trash2 size={14} />
        </button>
      </div>
    ) : (
      <button
        key={item.docId}
        type="button"
        onClick={() => toggleItem(item)}
        disabled={!item.docId || item.placeholder || !canEdit || pending.has(item.docId)}
        className={`flex items-center gap-2 px-3 py-2 border text-left text-sm transition-all disabled:opacity-60 ${item.placeholder
            ? 'border-dashed border-tech-border text-tech-primary/30 italic cursor-default'
            : item.done
              ? 'border-tech-primary/40 bg-tech-primary/10 text-tech-primary/70'
              : `border-tech-border text-white ${canEdit ? 'hover:border-tech-primary/50' : 'cursor-default'}`
          }`}
      >
        {item.placeholder ? (
          <Clock size={15} className="shrink-0 text-tech-primary/30" />
        ) : item.done ? (
          <CheckSquare size={16} className="shrink-0 text-tech-primary" />
        ) : (
          <Square size={16} className="shrink-0 text-tech-dim" />
        )}
        <span className={`truncate ${item.done && !item.placeholder ? 'line-through decoration-tech-primary/50' : ''}`}>{item.name}</span>
        {item.imageUrl && (
          <img src={item.imageUrl} alt="" title="Já está na Galeria" className="ml-auto w-6 h-6 object-cover border border-tech-primary/40 shrink-0" />
        )}
        {item.done && item.doneBy && (
          <span className={`shrink-0 text-[10px] text-tech-primary/40 uppercase tracking-wide normal-case italic ${!item.imageUrl ? 'ml-auto' : ''}`}>Feito por: {item.doneBy}</span>
        )}
      </button>
    )
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <header className="mb-4 pl-6 py-2 relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-tech-primary"></div>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-2 tracking-tighter uppercase relative inline-block">
            CHECKLIST<span className="text-tech-primary">_DE_PRODUÇÃO</span>
          </h1>
          <p className="text-tech-primary/80 text-sm flex items-center gap-2">
            <Radio size={13} className="animate-pulse" />
            <span className="uppercase tracking-widest">{labels.subtitle}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {PEOPLE_ORDER.map(name => (
            <div key={name} className="border border-tech-border bg-tech-panel/30 px-3 py-1.5 text-center">
              <div className="text-lg font-black text-tech-primary text-glow leading-none">{doneByCounts.get(name) ?? 0}</div>
              <div className="text-[9px] text-tech-primary/50 uppercase tracking-widest">{name}</div>
            </div>
          ))}
        </div>
      </header>

      {!loading && !error && totalItems > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setActiveFilter(f => f === 'pendentes' ? 'none' : 'pendentes')}
            title="Mostrar só as imagens que faltam ser feitas"
            className={`text-left border p-4 transition-all ${activeFilter === 'pendentes' ? 'border-tech-primary bg-tech-primary/10' : 'border-tech-border bg-tech-panel/30 hover:border-tech-primary/50'}`}
          >
            <div className="flex items-end justify-between mb-2">
              <span className="text-2xl font-black text-white text-glow">{totalDone} / {totalItems}</span>
              <span className="text-tech-primary text-sm font-bold">{overallPct.toFixed(0)}%</span>
            </div>
            <ProgressBar pct={overallPct} className="h-2" />
            <div className="mt-1.5 text-[9px] text-tech-primary/40 uppercase tracking-widest">
              Imagens feitas {activeFilter === 'pendentes' && '· mostrando pendentes'}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter(f => f === 'sem-galeria' ? 'none' : 'sem-galeria')}
            title="Mostrar imagens feitas mas ainda não anexadas na Galeria"
            className={`text-left border p-4 transition-all ${activeFilter === 'sem-galeria' ? 'border-tech-primary bg-tech-primary/10' : 'border-tech-border bg-tech-panel/30 hover:border-tech-primary/50'}`}
          >
            <div className="flex items-end justify-between mb-2">
              <span className="text-2xl font-black text-white text-glow">{totalInGallery} / {totalItems}</span>
              <span className="text-tech-primary text-sm font-bold">{galleryPct.toFixed(0)}%</span>
            </div>
            <ProgressBar pct={galleryPct} className="h-2" />
            <div className="mt-1.5 text-[9px] text-tech-primary/40 uppercase tracking-widest">
              Imagens na Galeria {activeFilter === 'sem-galeria' && '· mostrando feitas sem galeria'}
            </div>
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full md:w-80 bg-black border border-tech-border flex items-center px-3 h-10 group focus-within:border-tech-primary focus-within:shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all">
          <Search size={14} className="text-tech-dim group-focus-within:text-tech-primary transition-colors" />
          <input
            type="text"
            placeholder="BUSCAR_IMAGEM..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-tech-primary w-full ml-2 placeholder:text-tech-dim uppercase text-xs"
          />
        </div>

        {/* Sete filtros de tipo agora. Sem o scroll eles se comprimiam no celular e rótulos como
            "Linha do Tempo" e "Capas de Personagens" quebravam dentro do próprio botão. */}
        <div className="flex border border-tech-border max-w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveType('geral')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 h-10 px-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeType === 'geral' ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
          >
            <LayoutGrid size={12} /> Geral
          </button>
          <button
            type="button"
            onClick={() => setActiveType('evento')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 h-10 px-3 text-[10px] font-black uppercase tracking-widest transition-all border-l border-tech-border ${activeType === 'evento' ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
          >
            <ListChecks size={12} /> Eventos
          </button>
          <button
            type="button"
            onClick={() => setActiveType('timeline')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 h-10 px-3 text-[10px] font-black uppercase tracking-widest transition-all border-l border-tech-border ${activeType === 'timeline' ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
          >
            <Clock size={12} /> Linha do Tempo
          </button>
          <button
            type="button"
            onClick={() => setActiveType('transformacao')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 h-10 px-3 text-[10px] font-black uppercase tracking-widest transition-all border-l border-tech-border ${activeType === 'transformacao' ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
          >
            <Sparkles size={12} /> Modos
          </button>
          <button
            type="button"
            onClick={() => setActiveType('capa')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 h-10 px-3 text-[10px] font-black uppercase tracking-widest transition-all border-l border-tech-border ${activeType === 'capa' ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
          >
            <ImageIcon size={12} /> Capas de Personagens
          </button>
          <button
            type="button"
            onClick={() => setActiveType('invocacao')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 h-10 px-3 text-[10px] font-black uppercase tracking-widest transition-all border-l border-tech-border ${activeType === 'invocacao' ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
          >
            <Sparkles size={12} /> Invocações
          </button>
          <button
            type="button"
            onClick={() => setActiveType('capaInvocacao')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 h-10 px-3 text-[10px] font-black uppercase tracking-widest transition-all border-l border-tech-border ${activeType === 'capaInvocacao' ? 'bg-tech-primary text-black' : 'text-tech-primary hover:bg-tech-primary/10'}`}
          >
            <ImageIcon size={12} /> Capas de Invocações
          </button>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => setEditMode(v => !v)}
            className={`flex items-center gap-1.5 h-10 px-3 border text-[10px] font-black uppercase tracking-widest transition-all ${editMode
                ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                : 'border-tech-primary/40 text-tech-primary hover:bg-tech-primary/10'
              }`}
          >
            <Pencil size={12} /> {editMode ? 'Editando' : 'Editar'}
          </button>
        )}

        {canEdit && editMode && !isGeral && (
          <button
            type="button"
            onClick={() => setAddingTemporada(v => !v)}
            className="flex items-center gap-1.5 h-10 px-3 border border-tech-accent/50 text-tech-accent text-[10px] font-black uppercase tracking-widest hover:bg-tech-accent/10 transition-all"
          >
            <Plus size={12} /> {labels.newTemporadaBtn}
          </button>
        )}

        {!canEdit && (
          <button
            type="button"
            onClick={onRequestLogin}
            className="flex items-center gap-1.5 h-10 px-3 border border-tech-border text-tech-primary/60 text-[10px] font-black uppercase tracking-widest hover:border-tech-primary hover:text-tech-primary transition-all"
          >
            <Lock size={12} /> Login para marcar itens
          </button>
        )}
      </div>

      {canEdit && editMode && addingTemporada && (
        <div className="border border-tech-accent/40 bg-tech-accent/5 p-3 flex flex-col sm:flex-row gap-2">
          <input
            type="text" placeholder={labels.temporadaPlaceholder} value={newTemporadaFields.temporada}
            onChange={e => setNewTemporadaFields(f => ({ ...f, temporada: e.target.value }))}
            className="bg-black border border-tech-border text-white text-sm px-2 py-1.5 flex-1 outline-none focus:border-tech-accent"
          />
          {!isCapa && (
            <input
              type="text" placeholder={labels.firstArcoPlaceholder} value={newTemporadaFields.arco}
              onChange={e => setNewTemporadaFields(f => ({ ...f, arco: e.target.value }))}
              className="bg-black border border-tech-border text-white text-sm px-2 py-1.5 flex-1 outline-none focus:border-tech-accent"
            />
          )}
          {!isCapa && (
            <input
              type="text" placeholder="Nome do primeiro item" value={newTemporadaFields.item}
              onChange={e => setNewTemporadaFields(f => ({ ...f, item: e.target.value }))}
              className="bg-black border border-tech-border text-white text-sm px-2 py-1.5 flex-1 outline-none focus:border-tech-accent"
            />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={confirmAddTemporada} className="px-3 border border-tech-primary text-tech-primary hover:bg-tech-primary hover:text-black transition-all"><Check size={14} /></button>
            <button type="button" onClick={() => setAddingTemporada(false)} className="px-3 border border-tech-border text-tech-primary/50 hover:text-white transition-all"><X size={14} /></button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-tech-primary/40 text-xs uppercase tracking-widest">
          <ListChecks size={13} className="animate-pulse" /> Carregando checklist...
        </div>
      ) : error ? (
        <div className="text-red-400 text-xs">{error}</div>
      ) : totalItems === 0 && typedItems.length === 0 ? (
        <div className="border border-tech-border bg-tech-panel/30 p-8 text-center text-tech-primary/50 text-xs uppercase tracking-widest">
          {labels.emptyChecklist}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="border border-tech-border bg-tech-panel/30 p-8 text-center text-tech-primary/50 text-xs uppercase tracking-widest">
          {activeFilter === 'pendentes'
            ? 'Nenhuma imagem pendente — tudo feito!'
            : activeFilter === 'sem-galeria'
              ? 'Nenhuma imagem feita sem estar na Galeria — tudo sincronizado!'
              : 'Nenhum item encontrado para essa busca.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map(group => {
            const isSearching = searchTerm.trim().length > 0 || activeFilter !== 'none';
            const temporadaOpen = isSearching || expandedTemporadas.has(group.temporada);
            const tDone = doneCount(group.items);
            const tTotal = countable(group.items).length;
            const tPct = tTotal ? (tDone / tTotal) * 100 : 0;
            // Cada grupo é 100% de um tipo só (evento, timeline ou capa) — decide pelo item, não
            // pela aba ativa, porque na aba "Geral" os tipos aparecem juntos, grupo a grupo.
            // Timeline e Capa não têm subarco: cada "fase"/personagem já É o item, então mostramos
            // tudo direto sob o personagem, sem o nível extra de arco (menos cliques, menos redundância).
            const groupIsFlat = group.items[0]?.type === 'timeline' || group.items[0]?.type === 'capa';
            const flatItems = groupIsFlat ? group.arcos.flatMap(a => a.subarcos.flatMap(s => s.items)) : [];
            return (
              <div key={group.temporada} className="border border-tech-border bg-tech-panel/20">
                <div className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-tech-primary/5 transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleArcKey(expandedTemporadas, setExpandedTemporadas, group.temporada)}
                    className="flex items-center gap-3 min-w-0 flex-1"
                  >
                    <ChevronDown size={16} className={`text-tech-primary shrink-0 transition-transform ${temporadaOpen ? '' : '-rotate-90'}`} />
                    <span className="text-white font-black uppercase tracking-wide truncate text-lg">{group.temporada}</span>
                  </button>
                  <div className="flex items-center gap-3 shrink-0">
                    {canEdit && editMode && !isGeral && !isCapa && (
                      <button type="button" onClick={() => openAddArco(group.temporada)} title={labels.addArcoTitle} className="p-1 border border-tech-accent/40 text-tech-accent hover:bg-tech-accent/10">
                        <Plus size={13} />
                      </button>
                    )}
                    <ProgressBar pct={tPct} className="hidden sm:block w-36" />
                    <span className="text-[10px] text-tech-primary/60 font-bold uppercase tracking-widest">{tDone}/{tTotal}</span>
                  </div>
                </div>

                {canEdit && editMode && addingArcoFor === group.temporada && (
                  <div className="border-t border-tech-accent/40 bg-tech-accent/5 p-3 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text" placeholder={labels.arcoPlaceholder} value={newArcoFields.arco}
                      onChange={e => setNewArcoFields(f => ({ ...f, arco: e.target.value }))}
                      className="bg-black border border-tech-border text-white text-sm px-2 py-1.5 flex-1 outline-none focus:border-tech-accent"
                    />
                    {!isTimeline && (
                      <input
                        type="text" placeholder="Subarco (opcional)" value={newArcoFields.subarco}
                        onChange={e => setNewArcoFields(f => ({ ...f, subarco: e.target.value }))}
                        className="bg-black border border-tech-border text-white text-sm px-2 py-1.5 flex-1 outline-none focus:border-tech-accent"
                      />
                    )}
                    {!isTimeline && (
                      <input
                        type="text" placeholder="Nome do primeiro item" value={newArcoFields.item}
                        onChange={e => setNewArcoFields(f => ({ ...f, item: e.target.value }))}
                        className="bg-black border border-tech-border text-white text-sm px-2 py-1.5 flex-1 outline-none focus:border-tech-accent"
                      />
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => confirmAddArco(group.temporada, group.items)} className="px-3 border border-tech-primary text-tech-primary hover:bg-tech-primary hover:text-black transition-all"><Check size={14} /></button>
                      <button type="button" onClick={() => setAddingArcoFor(null)} className="px-3 border border-tech-border text-tech-primary/50 hover:text-white transition-all"><X size={14} /></button>
                    </div>
                  </div>
                )}

                {temporadaOpen && (
                  <div className="border-t border-tech-border px-3 py-3 space-y-2">
                    {groupIsFlat ? (
                      <div className="flex flex-col gap-1.5">
                        {flatItems.map(item => renderItemRow(item, flatItems))}
                      </div>
                    ) : group.arcos.map(arco => {
                      const arcoKey = `${group.temporada}::${arco.arco}`;
                      const arcoOpen = isSearching || expandedArcos.has(arcoKey);
                      const aDone = doneCount(arco.items);
                      const aTotal = countable(arco.items).length;
                      const aPct = aTotal ? (aDone / aTotal) * 100 : 0;
                      return (
                        <div key={arco.arco} className="border border-tech-border/60 bg-black/30">
                          <button
                            type="button"
                            onClick={() => toggleArcKey(expandedArcos, setExpandedArcos, arcoKey)}
                            className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-tech-primary/5 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <ChevronDown size={13} className={`text-tech-accent shrink-0 transition-transform ${arcoOpen ? '' : '-rotate-90'}`} />
                              <span className="text-tech-accent font-bold uppercase tracking-wide text-sm truncate">{arco.arco}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <ProgressBar pct={aPct} className="hidden sm:block w-24" />
                              <span className="text-[10px] text-tech-primary/50 font-bold uppercase">{aDone}/{aTotal}</span>
                            </div>
                          </button>

                          {arcoOpen && (
                            <div className="border-t border-tech-border/60 px-3 py-3 space-y-3">
                              {arco.subarcos.map((sub, idx) => {
                                const groupKey = `${arcoKey}::${sub.subarco ?? '_flat_' + idx}`;
                                return (
                                  <div key={sub.subarco ?? `_flat_${idx}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                      {sub.subarco ? (
                                        <div className="text-xs font-black text-tech-primary/50 uppercase tracking-widest">{sub.subarco}</div>
                                      ) : <div />}
                                      {canEdit && editMode && !isGeral && (
                                        <button type="button" onClick={() => openAddItem(groupKey)} className="flex items-center gap-1 px-1.5 py-0.5 border border-tech-primary/30 text-tech-primary/70 text-[10px] font-bold uppercase tracking-wide hover:bg-tech-primary/10">
                                          <Plus size={11} /> Adicionar item
                                        </button>
                                      )}
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                      {sub.items.map(item => renderItemRow(item, sub.items))}
                                    </div>

                                    {canEdit && editMode && addingItemFor === groupKey && (
                                      <div className="flex gap-2 mt-1.5">
                                        <input
                                          type="text" autoFocus placeholder="Nome do item" value={newItemText}
                                          onChange={e => setNewItemText(e.target.value)}
                                          onKeyDown={e => { if (e.key === 'Enter') confirmAddItem(group.temporada, arco.arco, sub.subarco, arco.items); }}
                                          className="bg-black border border-tech-border text-white text-sm px-2 py-1.5 flex-1 outline-none focus:border-tech-primary"
                                        />
                                        <button type="button" onClick={() => confirmAddItem(group.temporada, arco.arco, sub.subarco, arco.items)} className="px-3 border border-tech-primary text-tech-primary hover:bg-tech-primary hover:text-black transition-all"><Check size={14} /></button>
                                        <button type="button" onClick={() => setAddingItemFor(null)} className="px-3 border border-tech-border text-tech-primary/50 hover:text-white transition-all"><X size={14} /></button>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChecklistPanel;
