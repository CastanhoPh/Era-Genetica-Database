import React, { useState, useEffect } from 'react';
import {
  X, Globe, Zap, Binary, Lock, Crosshair, Shield, Hexagon, Scan, History, ExternalLink, Share2, Pencil, Trash2
} from 'lucide-react';
import { Equipment, classificationColors } from '../types/Equipment';
import { Character } from '../types';
import { slugify } from '../data/firestore';
import { formatImageUrl } from '../utils/formatters';

interface EquipmentModalProps {
  item: Equipment | null;
  onClose: () => void;
  characters?: Character[];
  onOpenCharacter?: (char: Character) => void;
  isAdmin?: boolean;
  onEdit?: (item: Equipment) => void;
  onDelete?: (item: Equipment) => Promise<void> | void;
}

const EquipmentModal: React.FC<EquipmentModalProps> = ({ item, onClose, characters = [], onOpenCharacter, isAdmin, onEdit, onDelete }) => {
  const [imgError, setImgError] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // null = mostrando a arma-base; um índice = mostrando aquela variação em tela cheia
  // (nome, foto e descrição trocam; classificação/natureza/origem continuam as da base,
  // já que é a mesma arma por baixo).
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);

  const copyLink = () => {
    if (!item) return;
    const url = `${window.location.origin}/${slugify(item.name)}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Resolve um nome de portador para o personagem correspondente (se existir).
  const resolveCharByName = (name?: string): Character | undefined => {
    if (!name) return undefined;
    const n = name.trim().toLowerCase();
    return characters.find(c => c.name.trim().toLowerCase() === n);
  };

  const goToCharacter = (c: Character) => {
    onClose();
    onOpenCharacter?.(c);
  };

  useEffect(() => {
    setImgError(false);
    setSelectedVariant(null);
  }, [item]);

  useEffect(() => {
    setImgError(false);
  }, [selectedVariant]);

  // Prevent scroll on body when modal is open
  useEffect(() => {
    if (item) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [item]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!item) return null;

  const classStyle = classificationColors[item.classification] || classificationColors['F'];
  const activeVariant = selectedVariant !== null ? item.variants?.[selectedVariant] : undefined;
  const displayName = activeVariant?.name ?? item.name;
  const displayImage = activeVariant?.image ?? item.image;
  const displayDescription = activeVariant?.description ?? (activeVariant ? undefined : item.description);
  const displayOwnerChar = activeVariant ? resolveCharByName(activeVariant.owner) : undefined;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6 bg-black/95 backdrop-blur-sm animate-in fade-in duration-300">
      {/* Radial glow background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,65,0.05),transparent)] pointer-events-none" />
      
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-5xl h-full md:h-[85vh] bg-tech-bg border-2 border-tech-primary/50 shadow-[0_0_40px_rgba(0,255,65,0.15)] flex flex-col overflow-hidden clip-corner animate-in zoom-in-95 duration-300">
        
        {/* Decorative corner brackets */}
        <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-tech-primary z-50 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-tech-primary z-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-tech-primary/30 z-50 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-tech-primary/30 z-50 pointer-events-none" />

        {/* Barra de topo: variações à esquerda, ações à direita — em fluxo normal (não mais
            flutuando por cima da imagem/dados), pra nunca tampar informação embaixo. */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 pl-20 border-b border-tech-border bg-black/60 shrink-0 relative z-40">
          {/* Trocar entre a arma-base e cada variação — muda nome/foto/descrição/portador
              da tela toda, em vez de só listar as variações num cantinho apertado. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {item.variants && item.variants.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedVariant(null)}
                  className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide border transition-colors clip-corner-sm ${selectedVariant === null
                      ? 'bg-tech-primary text-black border-tech-primary'
                      : 'bg-black/60 text-tech-primary/70 border-tech-border hover:border-tech-primary/50'
                    }`}
                >
                  {item.name}
                </button>
                {item.variants.map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedVariant(i)}
                    className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide border transition-colors clip-corner-sm ${selectedVariant === i
                        ? 'bg-tech-accent text-black border-tech-accent'
                        : 'bg-black/60 text-tech-accent/70 border-tech-border hover:border-tech-accent/50'
                      }`}
                  >
                    {v.name}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {isAdmin && onEdit && (
              <button
                onClick={() => onEdit(item)}
                title="Editar arma"
                className="bg-tech-primary/10 hover:bg-tech-primary text-tech-primary hover:text-black border border-tech-primary p-2 transition-colors uppercase text-xs font-bold tracking-widest flex items-center clip-corner-sm"
              >
                <Pencil size={16} />
              </button>
            )}
            {isAdmin && onDelete && (
              <button
                onClick={async () => {
                  if (confirm(`Excluir "${item.name}" do banco? Esta ação não pode ser desfeita.`)) {
                    await onDelete(item);
                  }
                }}
                title="Excluir arma"
                className="bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-black border border-red-600 p-2 transition-colors uppercase text-xs font-bold tracking-widest flex items-center clip-corner-sm"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              onClick={copyLink}
              title="Copiar link da arma"
              className="bg-tech-primary/10 hover:bg-tech-primary text-tech-primary hover:text-black border border-tech-primary p-2 transition-colors uppercase text-xs font-bold tracking-widest flex items-center clip-corner-sm"
            >
              {linkCopied ? <span className="text-[10px]">Copiado!</span> : <Share2 size={16} />}
            </button>
            <button
              onClick={onClose}
              className="bg-red-900/20 hover:bg-red-500 text-red-500 hover:text-black border border-red-500 p-2 transition-colors uppercase text-xs font-bold tracking-widest flex items-center clip-corner-sm"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Top System Bar */}
        <div className="h-8 bg-black/90 border-b border-tech-border flex items-center justify-between px-4 text-[10px] text-tech-primary/60 uppercase shrink-0">
          <span className="flex items-center gap-2">
            <Shield size={10} /> ARSENAL_DB // REGISTRO #{item.id.toString().padStart(4, '0')}
          </span>
          <span className="flex items-center gap-2">
            <Scan size={10} className="animate-pulse" /> SECURE_CHANNEL
          </span>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto lg:overflow-hidden scrollbar-custom">
          <div className="flex flex-col lg:flex-row min-h-full lg:h-full">

            {/* Left: Image Panel — fica parado; só o painel da direita rola (telas grandes) */}
            <div className="lg:w-[45%] border-r border-tech-border flex flex-col bg-tech-panel/20 relative shrink-0">
              <div className="p-2 border-b border-tech-border text-[10px] flex justify-between text-tech-primary/50">
                <span>VISUAL_DATA_BLOCK</span>
                <span>RES: HD</span>
              </div>

              {/* Proporção fixa 1:1 (padrão 1080x1080 de todo o arsenal) */}
              <div className="relative w-full aspect-square bg-black overflow-hidden group">
                {/* Grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.08)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none z-20" />

                {/* Scanline */}
                <div className="absolute top-0 left-0 w-full h-1 bg-tech-primary/50 shadow-[0_0_10px_#00ff41] animate-[scanline_3s_linear_infinite] pointer-events-none z-30 opacity-50" />

                {/* LIVE badge */}
                <div className="absolute top-3 right-3 text-[10px] bg-red-600 text-black px-1.5 font-bold z-20 animate-pulse">LIVE</div>

                {/* Corner targets */}
                <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-tech-primary z-20 opacity-60" />
                <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-tech-primary z-20 opacity-60" />

                {displayImage && !imgError ? (
                  <img
                    src={formatImageUrl(displayImage)}
                    alt={displayName}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-tech-dim">
                    <Lock size={48} className="mb-2 animate-pulse" />
                    <span className="text-xs">NO_SIGNAL</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Data Panel — rola sozinho em telas grandes, sem mexer na imagem */}
            <div className="lg:w-[55%] flex flex-col bg-tech-bg relative lg:h-full lg:overflow-y-auto scrollbar-custom">
              {/* HUD Scanlines */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.015)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none opacity-60 z-0" />

              <div className="p-6 md:p-8 space-y-6 relative z-10">
                
                {/* Identification Block */}
                <div className="border border-tech-border bg-black p-5 relative">
                  <div className="absolute -top-3 left-4 bg-tech-bg px-2 text-tech-primary text-xs font-bold flex items-center gap-1.5">
                    <Hexagon size={10} /> IDENTIFICAÇÃO
                  </div>

                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <span className="text-[9px] font-black text-tech-primary/50 uppercase tracking-widest flex items-center gap-2">
                        <Binary size={10} /> Registro Único
                      </span>
                      <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-tight text-glow">
                        {displayName}
                      </h2>
                    </div>

                    {/* Classification Badge */}
                    <div className="flex flex-col items-start md:items-end shrink-0">
                      <span className="text-[8px] text-tech-primary/40 font-bold uppercase mb-1.5 tracking-wider">Classificação</span>
                      <div className={`relative ${classStyle.bg} text-black px-6 py-2 text-xl font-black uppercase ${classStyle.glow} clip-corner-sm border-r-4 border-black/20 flex items-center justify-center min-w-[70px]`}>
                        {item.classification}
                        {/* Glitch flicker */}
                        <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity duration-100 pointer-events-none animate-flicker" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technical Specs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Origin */}
                  <div className="space-y-2 p-4 bg-white/5 border-l-2 border-tech-primary/40 group/spec hover:bg-white/[0.07] transition-colors">
                    <span className="text-[10px] text-tech-primary font-black uppercase flex items-center gap-2 tracking-wider">
                      <Globe size={14} /> Origem
                    </span>
                    <p className="text-sm text-slate-200 font-mono leading-relaxed pl-5">
                      {item.origin}
                    </p>
                  </div>

                  {/* Nature */}
                  <div className="space-y-2 p-4 bg-white/5 border-l-2 border-tech-accent/40 group/spec hover:bg-white/[0.07] transition-colors">
                    <span className="text-[10px] text-tech-accent font-black uppercase flex items-center gap-2 tracking-wider">
                      <Zap size={14} /> Natureza & Composição
                    </span>
                    <p className="text-sm text-slate-200 font-mono leading-relaxed pl-5">
                      {item.nature}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="relative group/desc">
                  <div className="absolute -top-2 left-4 bg-black px-2 text-[9px] font-black text-tech-accent/60 border border-tech-accent/20 z-20">
                    ESPECIFICAÇÕES_TÉCNICAS.LOG
                  </div>
                  <div className="bg-tech-panel/60 border border-tech-accent/10 p-5 pt-6 group-hover/desc:border-tech-accent/30 transition-colors relative overflow-hidden">
                    {/* Subtle animated scan */}
                    <div className="absolute inset-0 bg-gradient-to-b from-tech-primary/[0.02] to-transparent animate-[scanline_6s_linear_infinite] pointer-events-none" />
                    
                    <div className="flex items-start gap-3">
                      <Crosshair size={14} className="text-tech-accent/40 shrink-0 mt-1" />
                      <p className="text-[12px] text-slate-300 font-mono leading-relaxed text-justify first-letter:text-lg first-letter:font-black first-letter:text-tech-accent first-letter:mr-1">
                        {displayDescription || "ARQUIVO CORROMPIDO OU INEXISTENTE. DADOS NÃO DISPONÍVEIS PARA LEITURA."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Posse. Numa variação selecionada, é só "quem manifesta essa forma" (não
                    é uma cadeia de posse sequencial) — mostra um bloco único e simples.
                    Na arma-base, mantém Original / Antigos / Atual (o "Atual" calculado
                    automaticamente a partir de quem lista essa arma no `character.arsenal`,
                    não do texto digitado — assim nunca fica desatualizado). */}
                {activeVariant ? (
                  <div className="space-y-2 p-4 bg-black/40 border border-tech-border">
                    <span className="text-[10px] text-tech-accent font-black uppercase flex items-center gap-2 tracking-wider">
                      <Crosshair size={14} /> Portador desta variação
                    </span>
                    <div className="pl-5 flex flex-wrap gap-2">
                      {displayOwnerChar ? (
                        <button onClick={() => goToCharacter(displayOwnerChar)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-tech-accent border border-tech-accent/40 bg-tech-accent/5 hover:bg-tech-accent hover:text-black transition-colors">
                          {displayOwnerChar.name} <ExternalLink size={11} />
                        </button>
                      ) : (
                        <p className="text-sm text-slate-300 font-mono">{activeVariant.owner || '—'}</p>
                      )}
                    </div>
                  </div>
                ) : (() => {
                  const currentHolders = characters.filter(c => (c.arsenal || []).includes(item.id));
                  const currentFallback = currentHolders.length === 0 ? resolveCharByName(item.currentOwner) : null;
                  const currentList = currentHolders.length > 0 ? currentHolders : (currentFallback ? [currentFallback] : []);
                  const currentNameSet = new Set(currentList.map(c => c.name.trim().toLowerCase()));
                  if (currentList.length === 0 && item.currentOwner) currentNameSet.add(item.currentOwner.trim().toLowerCase());

                  // O portador original já conta como "antigo" automaticamente, contanto que
                  // não seja também quem tem a arma hoje — não precisa registrar duas vezes.
                  const pastNames = [
                    ...(item.originalOwner && !currentNameSet.has(item.originalOwner.trim().toLowerCase()) ? [item.originalOwner] : []),
                    ...(item.pastOwners ?? []),
                  ];

                  const renderName = (name: string, key: React.Key, colorClass: string, borderClass: string, bgClass: string) => {
                    const c = resolveCharByName(name);
                    return c ? (
                      <button key={key} onClick={() => goToCharacter(c)}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-mono ${colorClass} border ${borderClass} ${bgClass} hover:bg-current hover:text-black transition-colors`}>
                        {c.name} <ExternalLink size={11} />
                      </button>
                    ) : (
                      <span key={key} className="px-2 py-1 text-xs font-mono text-slate-300 border border-tech-border">{name}</span>
                    );
                  };

                  return (
                    <div className="grid grid-cols-1 gap-3">
                      {/* Portador Original */}
                      <div className="space-y-2 p-4 bg-black/40 border border-tech-border group/spec hover:border-sky-500/30 transition-colors">
                        <span className="text-[10px] text-sky-400 font-black uppercase flex items-center gap-2 tracking-wider">
                          <Hexagon size={14} /> Portador Original
                        </span>
                        <div className="pl-5 flex flex-wrap gap-2">
                          {item.originalOwner
                            ? renderName(item.originalOwner, 'original', 'text-sky-400', 'border-sky-500/40', 'bg-sky-500/5')
                            : <p className="text-sm text-slate-300 font-mono">—</p>}
                        </div>
                      </div>

                      {/* Portadores Antigos */}
                      <div className="space-y-2 p-4 bg-black/40 border border-tech-border group/spec hover:border-yellow-500/30 transition-colors">
                        <span className="text-[10px] text-yellow-500 font-black uppercase flex items-center gap-2 tracking-wider">
                          <History size={14} /> Portadores Antigos
                        </span>
                        <div className="pl-5 flex flex-wrap gap-2">
                          {pastNames.length > 0
                            ? pastNames.map((name, i) => renderName(name, i, 'text-yellow-400', 'border-yellow-500/40', 'bg-yellow-500/5'))
                            : <p className="text-sm text-slate-300 font-mono">—</p>}
                        </div>
                      </div>

                      {/* Portador Atual (automático) */}
                      <div className="space-y-2 p-4 bg-black/40 border border-tech-border group/spec hover:border-tech-primary/30 transition-colors">
                        <span className="text-[10px] text-tech-primary font-black uppercase flex items-center gap-2 tracking-wider">
                          <Crosshair size={14} /> Portador Atual
                        </span>
                        <div className="pl-5 flex flex-wrap gap-2">
                          {currentList.length > 0 ? (
                            currentList.map(c => (
                              <button key={c.docId ?? c.id} onClick={() => goToCharacter(c)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-tech-primary border border-tech-primary/40 bg-tech-primary/5 hover:bg-tech-primary hover:text-black transition-colors">
                                {c.name} <ExternalLink size={11} />
                              </button>
                            ))
                          ) : (
                            <p className="text-sm text-slate-300 font-mono">{item.currentOwner || '—'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Bottom status */}
                <div className="flex items-center justify-between text-[9px] text-tech-primary/30 uppercase pt-2 border-t border-tech-border/30">
                  <span className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-tech-primary rounded-full animate-pulse" />
                    DADOS VERIFICADOS
                  </span>
                  <span>ARSENAL_DB v2.0.5</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EquipmentModal;
