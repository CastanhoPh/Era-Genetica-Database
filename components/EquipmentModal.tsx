import React, { useState, useEffect } from 'react';
import { X, Lock, Shield, Skull, ExternalLink, Share2, Pencil, Trash2 } from 'lucide-react';
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

  // Quem morreu em posse desta arma. O campo existe em 16 das 87 e o painel nunca mostrou.
  const morreuComEla = new Set((item.diedHolding ?? []).map(n => n.trim().toLowerCase()));

  // Quem manifesta uma FORMA desta arma, e qual. Sai de `variants[].owner`, então a Naomi entra na
  // cadeia da Sōen no Kage sem ninguém digitar o nome dela em `pastOwners` — o dado já está na
  // variação.
  const formaDe = new Map(
    (item.variants ?? []).filter(v => v.owner).map(v => [v.owner.trim().toLowerCase(), v.name] as const),
  );

  // O chip de um portador. Vira botao quando existe ficha; ganha caveira quando a pessoa morreu
  // com a arma na mao.
  const chip = (nome: string, chave: React.Key, cor: string, borda: string, fundo: string) => {
    const c = resolveCharByName(nome);
    const morreu = morreuComEla.has(nome.trim().toLowerCase());
    const dentro = (
      <>
        <span className="break-words text-left">{c?.name ?? nome}</span>
        {morreu && <Skull size={10} className="shrink-0 text-red-400" />}
        {c && <ExternalLink size={10} className="shrink-0 opacity-50" />}
      </>
    );
    const forma = formaDe.get(nome.trim().toLowerCase());
    // o título é a resposta para "por que este nome está aqui"
    const titulo = [
      forma ? `Manifesta a ${forma}` : null,
      morreu ? 'Morreu em posse desta arma' : null,
      c ? `Abrir a ficha de ${c.name}` : null,
    ].filter(Boolean).join(' · ') || undefined;
    return c ? (
      <button
        key={chave}
        onClick={() => goToCharacter(c)}
        title={titulo}
        className={`max-w-full inline-flex items-center gap-1.5 px-2 py-1 text-[12px] ${cor} border ${borda} ${fundo} hover:bg-white/10 transition-colors`}
      >{dentro}</button>
    ) : (
      <span key={chave} title={titulo} className="max-w-full inline-flex items-center gap-1.5 px-2 py-1 text-[12px] text-slate-300 border border-tech-border">{dentro}</span>
    );
  };

  // A grade de fios de 1px, a mesma do painel das invocações. O Tailwind lê o código como texto,
  // então a classe de colunas tem que estar escrita, não montada por interpolação.
  const colunas = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3'];
  const grade = (itens: { rotulo: string; cor: string; valor: React.ReactNode }[]) => (
    <div className={`grid gap-px bg-tech-border/60 border border-tech-border/60 ${colunas[itens.length]}`}>
      {itens.map(c => (
        // o rótulo CRESCE dentro da célula, então os valores alinham na base mesmo quando um
        // rótulo quebra em duas linhas e o vizinho não
        <div key={c.rotulo} className="bg-tech-panel/40 px-3.5 py-3 flex flex-col gap-2 min-w-0">
          <span className={`text-[9px] uppercase tracking-[0.16em] leading-[1.35] grow ${c.cor}`}>{c.rotulo}</span>
          <div className="text-[13px] text-slate-200 leading-snug break-words">{c.valor}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6 bg-black/95 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,65,0.05),transparent)] pointer-events-none" />
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-5xl h-full md:h-auto md:max-h-[90vh] bg-tech-bg border-2 border-tech-primary/50 shadow-[0_0_60px_-15px_rgba(0,255,65,0.3)] flex flex-col clip-corner animate-in zoom-in-95 duration-300">
        <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-tech-primary z-40 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-tech-primary z-40 pointer-events-none" />

        {/* UMA faixa só. Antes eram duas — a das ações e a do ARSENAL_DB — mais um rodapé de
            "DADOS VERIFICADOS": três linhas de cromo em volta do registro. */}
        <div className="shrink-0 border-b border-tech-border bg-tech-panel/40 pl-6 pr-3 py-2 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 min-w-0 text-[10px] tracking-[0.16em] text-tech-primary/50">
            <Shield size={10} className="shrink-0" />
            <span className="truncate">ARSENAL_DB · REGISTRO #{item.id.toString().padStart(4, '0')}</span>
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && onEdit && (
              <button
                onClick={() => onEdit(item)}
                title="Editar arma"
                className="bg-tech-primary/10 hover:bg-tech-primary text-tech-primary hover:text-black border border-tech-primary/60 p-1.5 transition-colors clip-corner-sm"
              >
                <Pencil size={14} />
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
                className="bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-black border border-red-600/60 p-1.5 transition-colors clip-corner-sm"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={copyLink}
              title="Copiar link da arma"
              className="bg-tech-primary/10 hover:bg-tech-primary text-tech-primary hover:text-black border border-tech-primary/60 p-1.5 transition-colors clip-corner-sm"
            >
              {linkCopied ? <span className="text-[10px] px-0.5">Copiado!</span> : <Share2 size={14} />}
            </button>
            <button
              onClick={onClose}
              title="Fechar"
              className="bg-red-900/20 hover:bg-red-500 text-red-500 hover:text-black border border-red-500/60 p-1.5 transition-colors clip-corner-sm"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* É ESTE div que rola, e a coluna da esquerda é `sticky` dentro dele. Sticky não estica, e
            `items-start` impede que qualquer coluna seja alongada — que era a raiz do retângulo
            preto embaixo da arte: a coluna crescia até a altura da direita e a arte 1:1 não. */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-custom">
          <div className="flex flex-col lg:flex-row lg:items-start">

            {/* ================= a arte, o nome e as formas ================= */}
            <div className="lg:w-[420px] shrink-0 lg:sticky lg:top-0 p-5 lg:pr-6 flex flex-col gap-3">
              <div className="border border-tech-border bg-black">
                {/* 1:1 é o padrão 1080x1080 de todo o arsenal, então `cover` preenche exato: sem
                    faixa preta e sem recortar desenho. */}
                <div className="relative aspect-square overflow-hidden group">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.08)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none z-20" />
                  <div className="absolute top-0 left-0 w-full h-px bg-tech-primary/60 shadow-[0_0_10px_#00ff41] animate-[scanline_4s_linear_infinite] pointer-events-none z-20 opacity-60" />
                  <div className="absolute top-2.5 left-2.5 w-4 h-4 border-t border-l border-tech-primary/60 z-20" />
                  <div className="absolute top-2.5 right-2.5 w-4 h-4 border-t border-r border-tech-primary/60 z-20" />
                  <div className="absolute bottom-2.5 left-2.5 w-4 h-4 border-b border-l border-tech-primary/60 z-20" />
                  <div className="absolute bottom-2.5 right-2.5 w-4 h-4 border-b border-r border-tech-primary/60 z-20" />

                  {displayImage && !imgError ? (
                    <img
                      src={formatImageUrl(displayImage)}
                      alt={displayName}
                      onError={() => setImgError(true)}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-striped-pattern opacity-50">
                      <Lock size={36} className="text-tech-dim animate-pulse" />
                      <span className="text-[9px] uppercase tracking-[0.2em] text-tech-primary/30">arte pendente</span>
                    </div>
                  )}
                </div>

                {/* a placa fica DENTRO do mesmo quadro da arte, como legenda de pôster */}
                <div className="border-t border-tech-border bg-tech-panel/60 px-4 py-3 flex items-start gap-3">
                  <span className={`w-1 self-stretch shrink-0 ${classStyle.bg}`} />
                  <h2 className="flex-1 min-w-0 text-[23px] leading-[1.05] font-black text-white uppercase tracking-wide break-words">
                    {displayName}
                  </h2>
                  <span className={`shrink-0 text-black text-[13px] font-black px-2.5 py-1 leading-none clip-corner-sm ${classStyle.bg}`}>
                    {item.classification}
                  </span>
                </div>
              </div>

              {/* As formas trocam nome, arte e descrição da tela toda. Só 2 das 87 armas têm, e
                  antes elas ocupavam uma linha da barra de topo nas outras 85 — aqui ficam ao lado
                  do que mudam. */}
              {item.variants && item.variants.length > 0 && (
                <div className="border border-tech-border/60 bg-tech-panel/30 p-3 flex flex-col gap-2">
                  <span className="text-[9px] uppercase tracking-[0.16em] text-tech-primary/50">Formas desta arma</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedVariant(null)}
                      className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide border transition-colors clip-corner-sm ${selectedVariant === null
                        ? 'bg-tech-primary text-black border-tech-primary'
                        : 'bg-black/60 text-tech-primary/70 border-tech-border hover:border-tech-primary/50'}`}
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
                          : 'bg-black/60 text-tech-accent/70 border-tech-border hover:border-tech-accent/50'}`}
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ================= os dados ================= */}
            <div className="flex-1 min-w-0 px-5 pb-5 pt-0 lg:pt-5 lg:pl-0 flex flex-col gap-4">
              {grade([
                { rotulo: 'Origem', cor: 'text-tech-primary/50', valor: item.origin || '—' },
                ...(item.nature ? [{ rotulo: 'Natureza & Composição', cor: 'text-tech-accent/70', valor: item.nature }] : []),
              ])}

              <div className="flex flex-col gap-2">
                <span className="text-[9px] uppercase tracking-[0.22em] text-tech-primary/50">Especificações Técnicas</span>
                {/* alinhada à esquerda: justificar fonte monoespaçada abre buracos entre as
                    palavras, que era o que se via no texto da Sōen no Kage */}
                <p className="text-[14px] text-slate-300 leading-[1.75] whitespace-pre-line">
                  {displayDescription || (
                    <span className="text-[11px] uppercase tracking-[0.18em] text-tech-primary/25">descrição ainda não escrita</span>
                  )}
                </p>
              </div>

              {/* Numa forma selecionada é só "quem manifesta esta forma" — não é cadeia de posse.
                  Na arma-base, a mesma regra das invocações: Atual, Passados, Original. O atual é
                  calculado de quem lista a arma no `character.arsenal`, não do campo digitado,
                  então nunca fica desatualizado. */}
              {activeVariant ? (
                grade([{
                  rotulo: 'Portador desta forma',
                  cor: 'text-tech-accent/70',
                  valor: displayOwnerChar
                    ? <div className="flex flex-wrap gap-1.5">{chip(displayOwnerChar.name, 'forma', 'text-tech-accent', 'border-tech-accent/40', 'bg-tech-accent/5')}</div>
                    : (activeVariant.owner || '—'),
                }])
              ) : (() => {
                const currentHolders = characters.filter(c => (c.arsenal || []).includes(item.id));
                const currentFallback = currentHolders.length === 0 ? resolveCharByName(item.currentOwner) : null;
                const currentList = currentHolders.length > 0 ? currentHolders : (currentFallback ? [currentFallback] : []);
                const currentNameSet = new Set(currentList.map(c => c.name.trim().toLowerCase()));
                if (currentList.length === 0 && item.currentOwner) currentNameSet.add(item.currentOwner.trim().toLowerCase());

                // Passados = quem está gravado em `pastOwners` MAIS quem manifesta uma forma e
                // não tem a arma hoje (a Naomi, com a Shiden no Kage). O portador original NÃO é
                // repetido aqui: a célula ao lado já é dele, e com as três vizinhas a duplicata
                // ficava escancarada — o Nishinoya aparecia duas vezes na Sōen no Kage.
                const original = (item.originalOwner ?? '').trim().toLowerCase();
                const vistos = new Set([...currentNameSet, original].filter(Boolean));
                const pastNames: string[] = [];
                for (const n of [...(item.pastOwners ?? []), ...(item.variants ?? []).map(v => v.owner)]) {
                  const k = (n ?? '').trim().toLowerCase();
                  if (!k || vistos.has(k)) continue;
                  vistos.add(k);
                  pastNames.push(n);
                }

                const linha = (itens: React.ReactNode[]) => (
                  itens.length ? <div className="flex flex-wrap gap-1.5">{itens}</div> : <span className="text-slate-500 italic">—</span>
                );

                return grade([
                  {
                    rotulo: 'Portador Atual',
                    cor: 'text-tech-primary/60',
                    valor: currentList.length
                      ? linha(currentList.map(c => chip(c.name, c.docId ?? c.id, 'text-tech-primary', 'border-tech-primary/40', 'bg-tech-primary/5')))
                      : (item.currentOwner
                        ? linha([chip(item.currentOwner, 'atual', 'text-tech-primary', 'border-tech-primary/40', 'bg-tech-primary/5')])
                        : <span className="text-slate-500 italic">sem portador</span>),
                  },
                  // Sem o original duplicado, 72 das 87 nao teriam nenhum passado — a celula sai
                  // em vez de ficar um traco no meio das outras duas, e a grade vira de 2 colunas.
                  ...(pastNames.length ? [{
                    rotulo: 'Portadores Passados',
                    cor: 'text-yellow-500/80',
                    valor: linha(pastNames.map((n, i) => chip(n, i, 'text-yellow-400', 'border-yellow-500/40', 'bg-yellow-500/5'))),
                  }] : []),
                  {
                    rotulo: 'Portador Original',
                    cor: 'text-sky-400/80',
                    valor: item.originalOwner
                      ? linha([chip(item.originalOwner, 'original', 'text-sky-400', 'border-sky-500/40', 'bg-sky-500/5')])
                      : <span className="text-slate-500 italic">—</span>,
                  },
                ]);
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EquipmentModal;
