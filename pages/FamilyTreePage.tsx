import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GitBranch, Skull, LayoutList, ListTree, LayoutGrid } from 'lucide-react';
import { subscribeFamilyTrees, slugify } from '../data/firestore';
import { carregaFamilias, fonteEstatica } from '../data/dados-publicos';
import { Character, FamilyTree, FamilyTreeMember } from '../types';
import { formatImageUrl } from '../utils/formatters';

interface FamilyTreePageProps {
  characters: Character[];
  onOpenCharacter: (c: Character) => void;
}

type ViewMode = 'blocos' | 'organograma' | 'geracao';

const VIEW_MODES: { key: ViewMode; label: string; icon: React.ElementType }[] = [
  { key: 'blocos', label: 'Blocos', icon: LayoutList },
  { key: 'organograma', label: 'Organograma', icon: ListTree },
  { key: 'geracao', label: 'Por Geração', icon: LayoutGrid },
];

function computeGenerations(members: FamilyTreeMember[]): Map<string, number> {
  const byName = new Map(members.map(m => [m.name, m]));
  const genCache = new Map<string, number>();
  const genOf = (name: string, seen: Set<string> = new Set()): number => {
    if (genCache.has(name)) return genCache.get(name)!;
    if (seen.has(name)) return 0;
    seen.add(name);
    const m = byName.get(name);
    const parents = m?.parents?.filter(p => byName.has(p)) ?? [];
    const gen = parents.length === 0 ? 0 : Math.max(...parents.map(p => genOf(p, seen))) + 1;
    genCache.set(name, gen);
    return gen;
  };
  members.forEach(m => genOf(m.name));
  return genCache;
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && new Set(a).size === new Set(b).size && a.every(x => b.includes(x));

interface FamilyUnit {
  key: string;
  partners: string[];
  gen: number;
  children: string[];
}

// Uma "unidade familiar" por casal (ou pessoa solteira) que tem filho(s) registrado(s).
function buildUnits(members: FamilyTreeMember[]): FamilyUnit[] {
  const byName = new Map(members.map(m => [m.name, m]));
  const genCache = computeGenerations(members);
  const handled = new Set<string>();
  const units: FamilyUnit[] = [];
  for (const m of members) {
    if (handled.has(m.name)) continue;
    const partners = m.spouse && byName.has(m.spouse) ? [m.name, m.spouse] : [m.name];
    partners.forEach(p => handled.add(p));
    const gen = Math.max(...partners.map(p => genCache.get(p) ?? 0));
    const children = members
      .filter(c => c.parents && c.parents.length > 0 && sameSet(c.parents.filter(p => byName.has(p)), partners))
      .map(c => c.name);
    units.push({ key: partners.join(' & '), partners, gen, children });
  }
  return units;
}

// Modo "Blocos": um bloco por unidade familiar com filho(s), soltos em sequência
// (ordenados por geração) — sem indentação entre gerações, cada um lê sozinho.
function buildBlocks(members: FamilyTreeMember[]): FamilyUnit[] {
  return buildUnits(members).filter(u => u.children.length > 0).sort((a, b) => a.gen - b.gen);
}

interface TreeRow {
  key: string;
  prefix: string;
  names: string[];
  note?: string;
}

// Modo "Organograma": igual ao comando `tree`, cada pessoa aparece EXATAMENTE UMA VEZ,
// pendurada nos próprios pais. Quem casa pra dentro de outro ramo (ex: Naomi, nascida
// Uzumaki, casada com um Senju) vira uma nota "(casado(a) com X)" onde nasceu — a família
// que formou é expandida de verdade só do lado de quem tem o campo `spouse` nos dados.
function buildOutline(members: FamilyTreeMember[]): TreeRow[] {
  const byName = new Map(members.map(m => [m.name, m]));
  const ownerOfSpouse = new Map<string, string>();
  members.forEach(m => { if (m.spouse && byName.has(m.spouse)) ownerOfSpouse.set(m.spouse, m.name); });
  const childrenOf = (names: string[]) =>
    members.filter(c => c.parents && c.parents.length > 0 && sameSet(c.parents.filter(p => byName.has(p)), names));

  const rows: TreeRow[] = [];
  const seen = new Set<string>();

  function visit(name: string, prefix: string, connector: string) {
    if (seen.has(name)) return;
    seen.add(name);
    const m = byName.get(name)!;
    const spouseName = m.spouse && byName.has(m.spouse) ? m.spouse : null;
    if (spouseName) seen.add(spouseName);
    const names = spouseName ? [name, spouseName] : [name];

    rows.push({ key: name, prefix: prefix + connector, names });

    const kids = childrenOf(names);
    const childPrefix = prefix + (connector === '└── ' ? '    ' : connector === '├── ' ? '│   ' : '');
    kids.forEach((kid, i) => {
      const isLast = i === kids.length - 1;
      const kidConnector = isLast ? '└── ' : '├── ';
      const marriedOwner = ownerOfSpouse.get(kid.name);
      if (marriedOwner) {
        seen.add(kid.name);
        rows.push({ key: kid.name, prefix: childPrefix + kidConnector, names: [kid.name], note: `casado(a) com ${marriedOwner}` });
      } else {
        visit(kid.name, childPrefix, kidConnector);
      }
    });
  }

  const roots = members.filter(m => !m.parents || m.parents.length === 0);
  roots.forEach(r => { if (!seen.has(r.name)) visit(r.name, '', ''); });

  return rows;
}

// Modo "Por Geração": grid de colunas, uma por geração — mesma regra de "cada pessoa uma
// vez só" do organograma, só que agrupado lado a lado em vez de indentado.
function buildColumns(members: FamilyTreeMember[]): FamilyUnit[][] {
  const units = buildUnits(members);
  const maxGen = units.reduce((m, u) => Math.max(m, u.gen), 0);
  const columns: FamilyUnit[][] = [];
  for (let g = 0; g <= maxGen; g++) columns.push(units.filter(u => u.gen === g));
  return columns;
}

const Avatar: React.FC<{ character?: Character; isDead?: boolean; size?: number }> = ({ character, isDead, size = 24 }) => {
  if (!character?.image) return null;
  return (
    <img
      src={formatImageUrl(character.image)}
      alt=""
      loading="lazy"
      style={{ width: size, height: size }}
      className={`object-cover shrink-0 border ${isDead ? 'grayscale border-red-900/40' : 'border-tech-border'}`}
    />
  );
};

const NameLabel: React.FC<{
  name: string;
  member?: FamilyTreeMember;
  character?: Character;
  /** Personagem cuja foto emprestar (twist de identidade secreta) — só a imagem, o
   * nome exibido e o clique continuam sendo os do `character` normal. */
  avatarCharacter?: Character;
  onOpen?: () => void;
  avatarSize?: number;
}> = ({ name, member, character, avatarCharacter, onOpen, avatarSize = 24 }) => {
  const isDead = member?.isDead || character?.isDead;
  const clickable = !!character;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!clickable}
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wide ${isDead ? 'text-neutral-500' : 'text-white'
        } ${clickable ? 'hover:text-tech-primary hover:underline decoration-dotted underline-offset-4 cursor-pointer' : 'cursor-default'}`}
    >
      <Avatar character={avatarCharacter ?? character} isDead={isDead} size={avatarSize} />
      {isDead && <Skull size={12} className="text-red-500/70 shrink-0" />}
      <span className={isDead ? 'line-through decoration-red-900/60' : ''}>{name}</span>
    </button>
  );
};

const FamilyTreePage: React.FC<FamilyTreePageProps> = ({ characters, onOpenCharacter }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const segments = location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const familySlugFromUrl = segments[1] ? decodeURIComponent(segments[1]) : '';

  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('blocos');

  useEffect(() => {
    // São só 8 documentos, mas a tela é pública: ao vivo seriam 8 leituras por visita, e pelo
    // retrato são zero. Entra no mesmo arquivo que as outras três coleções.
    const unsubscribe = fonteEstatica(
      carregaFamilias,
      subscribeFamilyTrees,
      data => { setTrees(data); setLoading(false); setError(null); },
      err => { console.error('Erro ao carregar as árvores genealógicas:', err); setError('Não foi possível carregar as árvores.'); setLoading(false); },
    );
    return () => unsubscribe();
  }, []);

  const activeTree = trees.find(t => slugify(t.family) === familySlugFromUrl) ?? null;

  const charByName = useMemo(() => {
    const map = new Map<string, Character>();
    characters.forEach(c => map.set(c.name.trim().toLowerCase(), c));
    return map;
  }, [characters]);

  const memberByName = useMemo(
    () => new Map((activeTree?.members ?? []).map(m => [m.name, m])),
    [activeTree],
  );
  // Quando o membro tem `secretImageFrom`, a ficha/foto/clique usados são os do
  // personagem secreto — só o nome exibido na árvore continua sendo o "de fachada".
  const getCharacter = (name: string) => {
    const secret = memberByName.get(name)?.secretImageFrom;
    if (secret) return charByName.get(secret.trim().toLowerCase());
    return charByName.get(name.trim().toLowerCase());
  };
  const getAvatarCharacter = getCharacter;
  const openByName = (name: string) => {
    const c = getCharacter(name);
    if (c) onOpenCharacter(c);
  };

  const blocks = useMemo(() => (activeTree ? buildBlocks(activeTree.members) : []), [activeTree]);
  const outlineRows = useMemo(() => (activeTree ? buildOutline(activeTree.members) : []), [activeTree]);
  const columns = useMemo(() => (activeTree ? buildColumns(activeTree.members) : []), [activeTree]);

  const openFamily = (family: string) => navigate(`/arvore/${encodeURIComponent(slugify(family))}`);

  if (loading) {
    return <div className="text-tech-primary/40 text-xs uppercase tracking-widest py-12 text-center">Carregando árvores...</div>;
  }
  if (error) {
    return <div className="text-red-400 text-xs uppercase tracking-widest py-12 text-center">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="text-[10px] font-black text-tech-primary/60 uppercase tracking-widest mb-1 flex items-center gap-2">
        <GitBranch size={12} />
        <span>Árvore Genealógica</span>
        <span className="flex-1 h-px bg-tech-border"></span>
      </div>

      {trees.length === 0 ? (
        <div className="text-tech-primary/40 text-xs uppercase tracking-widest text-center py-12">
          Nenhuma família cadastrada ainda.
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {trees.map(t => (
            <button
              key={t.docId}
              type="button"
              onClick={() => openFamily(t.family)}
              className={`px-3 py-1 border text-[10px] font-bold uppercase tracking-wide transition-all ${activeTree?.docId === t.docId
                  ? 'bg-tech-primary text-black border-tech-primary'
                  : 'border-tech-border text-tech-primary/70 hover:border-tech-primary/50'
                }`}
            >
              {t.family}
            </button>
          ))}
        </div>
      )}

      {activeTree && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {VIEW_MODES.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => setViewMode(v.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 border text-[9px] font-bold uppercase tracking-wide transition-all ${viewMode === v.key
                    ? 'bg-tech-primary/20 border-tech-primary text-tech-primary'
                    : 'border-tech-border/60 text-tech-primary/50 hover:border-tech-primary/40'
                  }`}
              >
                <v.icon size={11} /> {v.label}
              </button>
            ))}
          </div>

          <div className="border border-tech-border bg-tech-panel/20 p-4 sm:p-6 overflow-x-auto">
            {viewMode === 'blocos' && (
              <div className="space-y-5 font-mono text-xs sm:text-sm min-w-max">
                {blocks.map(b => (
                  <div key={b.key}>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {b.partners.map((name, pi) => (
                        <React.Fragment key={name}>
                          {pi > 0 && <span className="text-tech-primary/40 font-black">&amp;</span>}
                          <NameLabel name={name} member={memberByName.get(name)} character={getCharacter(name)} avatarCharacter={getAvatarCharacter(name)} onOpen={() => openByName(name)} />
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="pl-1 space-y-1">
                      {b.children.map((child, ci) => (
                        <div key={child} className="flex items-center gap-1.5">
                          <span className="text-tech-primary/30">{ci === b.children.length - 1 ? '└── ' : '├── '}</span>
                          <NameLabel name={child} member={memberByName.get(child)} character={getCharacter(child)} avatarCharacter={getAvatarCharacter(child)} onOpen={() => openByName(child)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {viewMode === 'organograma' && (
              <div className="font-mono text-xs sm:text-sm space-y-1 min-w-max">
                {outlineRows.map(row => (
                  <div key={row.key} className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-tech-primary/30">{row.prefix}</span>
                    {row.names.map((name, ni) => (
                      <React.Fragment key={name}>
                        {ni > 0 && <span className="text-tech-primary/40 font-black">&amp;</span>}
                        <NameLabel name={name} member={memberByName.get(name)} character={getCharacter(name)} avatarCharacter={getAvatarCharacter(name)} onOpen={() => openByName(name)} />
                      </React.Fragment>
                    ))}
                    {row.note && <span className="text-tech-primary/30 text-[10px] normal-case italic">({row.note})</span>}
                  </div>
                ))}
              </div>
            )}

            {viewMode === 'geracao' && (
              <div className="grid gap-3 sm:gap-4 min-w-max" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(160px, 1fr))` }}>
                {columns.map((column, gi) => (
                  <div key={gi} className="flex flex-col gap-3 min-w-0">
                    <div className="text-center text-[9px] font-black text-tech-primary/40 uppercase tracking-widest border-b border-tech-border pb-1.5">
                      Geração {gi + 1}
                    </div>
                    {column.map(unit => (
                      <div key={unit.key} className="flex flex-col items-stretch gap-2 border border-tech-border/60 bg-black/20 p-2">
                        {unit.partners.map((name, pi) => (
                          <React.Fragment key={name}>
                            {pi > 0 && <div className="text-center text-tech-primary/40 text-[10px] font-black">&amp;</div>}
                            <NameLabel name={name} member={memberByName.get(name)} character={getCharacter(name)} avatarCharacter={getAvatarCharacter(name)} onOpen={() => openByName(name)} avatarSize={28} />
                          </React.Fragment>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FamilyTreePage;
