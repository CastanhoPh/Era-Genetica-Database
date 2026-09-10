import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Database, ChevronDown, Shield, Terminal, AlertTriangle, Loader, Plus } from 'lucide-react';
import { Equipment } from '../types/Equipment';
import { CLASSIFICATION_PRIORITY } from '../types';
import ArsenalCard from '../components/ArsenalCard';
import BotaoDeCores, { useCapasColoridas } from '../components/BotaoDeCores';
import BotaoDeLink from '../components/BotaoDeLink';

interface ArsenalProps {
  arsenalItems: Equipment[];
  loading: boolean;
  onOpenItem: (item: Equipment) => void;
  isAdmin?: boolean;
  onAddNew?: () => void;
  /** Controlado por fora (App.tsx) pra ficar em sincronia com a URL (/arsenal/<origem>). */
  selectedOrigin: string;
  onSelectOrigin: (origin: string) => void;
}

const Arsenal: React.FC<ArsenalProps> = ({ arsenalItems, loading, onOpenItem, isAdmin, onAddNew, selectedOrigin, onSelectOrigin }) => {
  const arsenalData = arsenalItems;
  // Os três filtros locais vivem na URL, para o link levar a tela. A ORIGEM não entra aqui: ela
  // vem por prop do App e já mora no caminho, /arsenal/<origem>.
  const [params, setParams] = useSearchParams();
  const leia = (chave: string, padrao: string) => params.get(chave) ?? padrao;
  const escreva = (chave: string, valor: string, padrao: string, substitui = false) => {
    const p = new URLSearchParams(params);
    if (valor === padrao) p.delete(chave); else p.set(chave, valor);
    setParams(p, { replace: substitui });
  };

  const selectedClassification = leia('classificacao', 'Todos');
  const setSelectedClassification = (v: string) => escreva('classificacao', v, 'Todos');
  const selectedNature = leia('natureza', 'Todos');
  const setSelectedNature = (v: string) => escreva('natureza', v, 'Todos');
  const sortBy = leia('ordem', 'id');
  const setSortBy = (v: string) => escreva('ordem', v, 'id');
  // `replace` na busca, mesmo motivo das outras telas: não empilhar uma entrada por tecla.
  const searchTerm = leia('busca', '');
  const setSearchTerm = (v: string) => escreva('busca', v, '', true);
  const [colorido, setColorido] = useCapasColoridas();

  // a tabela vive em types.ts, compartilhada com o anel de chakra do CharacterModal
  const classificationPriority = CLASSIFICATION_PRIORITY;

  // Extract unique values for filters
  const uniqueClassifications = useMemo(() => {
    const set = new Set(arsenalData.map(i => i.classification).filter(Boolean));
    return Array.from(set).sort();
  }, [arsenalData]);

  const uniqueOrigins = useMemo(() => {
    const set = new Set(arsenalData.map(i => i.origin).filter(Boolean));
    return Array.from(set).sort();
  }, [arsenalData]);

  const uniqueNatures = useMemo(() => {
    const natures = new Set<string>();
    arsenalData.forEach(i => {
      if (i.nature) {
        i.nature.split('+').forEach(n => natures.add(n.trim()));
      }
    });
    return Array.from(natures).sort();
  }, [arsenalData]);

  // Filter logic
  const filteredItems = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();

    // Busca só por nome do arsenal (incluindo nome de variação) e por usuários (donos, em
    // qualquer papel) — nature/origem/classificação continuam como filtros à parte, não
    // entram mais na busca por texto.
    const matchesName = (item: Equipment) =>
      item.name.toLowerCase().includes(searchLower) ||
      (item.variants || []).some(v => v.name.toLowerCase().includes(searchLower));
    const matchesOwner = (item: Equipment) =>
      (item.originalOwner || '').toLowerCase().includes(searchLower) ||
      (item.currentOwner || '').toLowerCase().includes(searchLower) ||
      (item.pastOwners || []).some(o => o.toLowerCase().includes(searchLower)) ||
      (item.variants || []).some(v => v.owner.toLowerCase().includes(searchLower));

    const filtered = arsenalData.filter(item => {
      const matchesSearch = !searchLower || matchesName(item) || matchesOwner(item);

      const matchesClassification =
        selectedClassification === 'Todos' || item.classification === selectedClassification;

      const matchesOrigin =
        selectedOrigin === 'Todos' || item.origin === selectedOrigin;

      const matchesNature =
        selectedNature === 'Todos' || item.nature.toLowerCase().includes(selectedNature.toLowerCase());

      return matchesSearch && matchesClassification && matchesOrigin && matchesNature;
    });

    // Apply Sorting
    return [...filtered].sort((a, b) => {
      // Com busca ativa, resultado por nome sempre vem antes de resultado só por usuário —
      // dentro de cada grupo, mantém o critério de ordenação escolhido.
      if (searchLower) {
        const rankA = matchesName(a) ? 0 : 1;
        const rankB = matchesName(b) ? 0 : 1;
        if (rankA !== rankB) return rankA - rankB;
      }
      if (sortBy === 'classificacao') {
        const priorityA = classificationPriority[a.classification || 'F'] || 0;
        const priorityB = classificationPriority[b.classification || 'F'] || 0;
        return priorityB - priorityA;
      }
      if (sortBy === 'alfabetico') {
        return a.name.localeCompare(b.name);
      }
      // Default: ID
      return a.id - b.id;
    });
  }, [arsenalData, searchTerm, selectedClassification, selectedOrigin, selectedNature, sortBy]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedClassification('Todos');
    onSelectOrigin('Todos');
    setSelectedNature('Todos');
    setSortBy('id');
  };

  const hasActiveFilters =
    selectedClassification !== 'Todos' ||
    selectedOrigin !== 'Todos' ||
    selectedNature !== 'Todos' ||
    searchTerm !== '';

  return (
    <>
      <div className="animate-fade-in-up">

      {/* Page Header */}
      <header className="mb-8 pl-6 py-2 relative group cursor-default">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-tech-primary group-hover:h-full transition-all duration-500 h-1/2" />
        
        <div className="flex items-center gap-3 mb-2">
          <Shield size={28} className="text-tech-primary" />
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase group-hover:animate-glitch relative inline-block">
            ARSENAL<span className="text-tech-primary">_DB</span>
          </h1>
        </div>
        <p className="text-tech-primary/80 text-base flex items-center gap-2">
          <Terminal size={14} />
          <span className="typing-animation border-r-2 border-tech-primary pr-1 animate-pulse">BANCO DE DADOS DE ARMAMENTOS E ARTEFATOS</span>
        </p>
      </header>

      {/* Controls Bar */}
      <div className="bg-tech-panel/80 backdrop-blur-sm border border-tech-border p-4 mb-8 flex flex-col gap-4 clip-corner shadow-[0_0_20px_rgba(0,255,65,0.05)] animate-fade-in-up" style={{ animationDelay: '100ms' }}>

        {/* Top Row: Origin Tabs & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {/* Filter Tabs */}
          <div className="flex flex-nowrap gap-1.5 min-w-0 overflow-x-auto">
            {['Todos', ...uniqueOrigins].map(origin => (
              <button
                key={origin}
                onClick={() => onSelectOrigin(origin)}
                className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 border uppercase text-[11px] font-bold tracking-wider transition-all duration-300 clip-corner-sm
                  ${selectedOrigin === origin
                    ? 'bg-tech-primary text-black border-tech-primary shadow-[0_0_15px_rgba(0,255,65,0.4)] translate-y-[-2px]'
                    : 'bg-transparent text-tech-primary border-tech-border hover:border-tech-primary hover:text-white hover:bg-tech-primary/10'}`}
              >
                {origin}
              </button>
            ))}
          </div>

          <div className="flex gap-4 w-full md:w-auto">
            <BotaoDeCores colorido={colorido} onToggle={() => setColorido(v => !v)} oQue="as artes" />
            <BotaoDeLink oQue="do arsenal" />
            <div className="flex-1 md:w-80 bg-black border border-tech-border flex items-center px-3 h-10 group focus-within:border-tech-primary focus-within:shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all">
              <Search size={14} className="text-tech-dim group-focus-within:text-tech-primary transition-colors" />
              <input
                type="text"
                placeholder="BUSCAR_ARMAMENTO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-tech-primary w-full ml-2 placeholder:text-tech-dim uppercase text-xs"
              />
            </div>
            {isAdmin && (
              <button
                onClick={onAddNew}
                className="h-10 px-4 bg-tech-dim border border-tech-border text-tech-primary hover:bg-tech-primary hover:text-black transition-all hover:shadow-[0_0_15px_rgba(0,255,65,0.4)] uppercase text-xs font-bold flex items-center gap-2 whitespace-nowrap clip-corner-sm"
              >
                <Plus size={14} /> NOVO
              </button>
            )}
          </div>
        </div>

        {/* Bottom Row: Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-tech-border/50 pt-4 mt-2">
          {[
            { label: 'CLASSIFICAÇÃO', icon: Shield, value: selectedClassification, setter: setSelectedClassification, options: uniqueClassifications },
            { label: 'NATUREZA', icon: Database, value: selectedNature, setter: setSelectedNature, options: uniqueNatures },
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
              <Database size={10} /> CLASSIFICAR
            </label>
            <div className="relative group">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="w-full bg-black border border-tech-accent/30 text-tech-accent text-xs py-2 pl-2 pr-8 outline-none focus:border-tech-accent appearance-none uppercase cursor-pointer hover:bg-tech-accent/5 transition-all"
              >
                <option value="id" className="bg-black">ID (PADRÃO)</option>
                <option value="classificacao" className="bg-black">CLASS. (Z &gt; F)</option>
                <option value="alfabetico" className="bg-black">ALFABÉTICO (A-Z)</option>
              </select>
              <ChevronDown className="absolute right-2 top-2.5 text-tech-accent/60 group-hover:text-tech-accent transition-colors pointer-events-none" size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* Results Info */}
      <div className="mb-4 text-xs text-tech-dim flex items-center gap-2 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <Database size={12} />
        <span>ARMAMENTOS ENCONTRADOS: {filteredItems.length}</span>
        <div className="h-px bg-tech-border flex-1" />
        {hasActiveFilters && (
          <button onClick={resetFilters} className="text-[10px] text-red-500 hover:text-red-400 uppercase font-bold tracking-wider border border-transparent hover:border-red-900/50 px-2 transition-colors">
            [Limpar Filtros]
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-tech-primary animate-pulse">
          <Loader size={32} className="animate-spin mb-4" />
          <span className="text-xs uppercase tracking-widest">Carregando arsenal...</span>
          <div className="w-48 h-1 bg-tech-dim mt-4 overflow-hidden relative">
            <div className="absolute inset-0 bg-tech-primary animate-[scanline_1.5s_ease-in-out_infinite]" />
          </div>
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item, index) => (
              <ArsenalCard
                key={item.docId ?? item.id}
                item={item}
                index={index}
                onClick={() => onOpenItem(item)}
                colorido={colorido}
              />
            ))}
          </div>

          {/* Empty State */}
          {filteredItems.length === 0 && (
            <div className="border border-red-900/50 bg-red-900/10 p-12 text-center text-red-500 font-mono animate-pulse">
              <AlertTriangle size={32} className="mx-auto mb-4 opacity-60" />
              <h3 className="text-xl font-bold mb-2">ERRO 404: ARMAMENTO NÃO ENCONTRADO</h3>
              <p className="text-sm opacity-70 mb-1">NENHUM REGISTRO CORRESPONDE AOS PARÂMETROS DE BUSCA.</p>
              <p className="text-[10px] opacity-40 mb-4">{'>'} REFINAR PARÂMETROS OU RESETAR FILTROS DO SISTEMA.</p>
              <button onClick={resetFilters} className="border border-red-500 px-4 py-2 hover:bg-red-500 hover:text-black transition-colors uppercase text-xs">
                Resetar Sistema
              </button>
            </div>
          )}
        </>
      )}

      </div>
    </>
  );
};

export default Arsenal;
