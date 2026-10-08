export interface Equipment {
  docId?: string; // ID do documento no Firestore (slug do nome)
  id: number;
  name: string;
  classification: string;
  nature: string;
  origin: string;
  description: string;
  image: string;
  originalOwner: string;
  /** Donos intermediários, entre o original e o atual, na ordem em que passaram pela arma.
   * O portador original NÃO entra aqui — ele já é mostrado separado como "Portador original". */
  pastOwners?: string[];
  /** Nomes (dentre originalOwner/pastOwners) de quem morreu em posse desta arma — na ficha
   * desse personagem, ela aparece numa seção própria ("Morreu em posse"), separada de quem
   * só teve a arma e passou adiante antes de morrer. */
  diedHolding?: string[];
  /** Campo legado, digitado à mão. O "Portador atual" exibido pro usuário é calculado
   * automaticamente a partir de `character.arsenal` (ver `resolveCurrentOwner` em Arsenal) —
   * esse campo só serve de fallback quando nenhum personagem cadastrado lista essa arma. */
  currentOwner: string;
  /** Outras variações da mesma arma/jutsu, cada uma manifestada por um portador diferente
   * (ex: Sōen no Kage do Nishinoya, Guren no Kage do Kaito, Shiden no Kage da Naomi — a
   * mesma arma-base, com nome e efeito diferentes conforme quem a manifesta). Cada variação
   * tem seu próprio nome e portador; a imagem é opcional (some entra na busca também). */
  variants?: { name: string; owner: string; image?: string; description?: string }[];
}

export type ClassificationLevel = 'Z' | 'S++' | 'S+' | 'S' | 'A+' | 'A' | 'B' | 'F';

export const classificationColors: Record<string, { bg: string; text: string; glow: string; border: string }> = {
  'Z':   { bg: 'bg-red-600',    text: 'text-red-500',    glow: 'shadow-[0_0_20px_rgba(220,38,38,0.6)]',    border: 'border-red-500' },
  'S++': { bg: 'bg-orange-500', text: 'text-orange-400', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.6)]',   border: 'border-orange-500' },
  'S+':  { bg: 'bg-amber-500',  text: 'text-amber-400',  glow: 'shadow-[0_0_20px_rgba(245,158,11,0.6)]',   border: 'border-amber-500' },
  'S':   { bg: 'bg-yellow-500', text: 'text-yellow-400', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.5)]',    border: 'border-yellow-500' },
  'A+':  { bg: 'bg-purple-500', text: 'text-purple-400', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.5)]',   border: 'border-purple-500' },
  'A':   { bg: 'bg-sky-500',    text: 'text-sky-400',    glow: 'shadow-[0_0_20px_rgba(14,165,233,0.5)]',   border: 'border-sky-500' },
  'B':   { bg: 'bg-emerald-500',text: 'text-emerald-400',glow: 'shadow-[0_0_20px_rgba(16,185,129,0.5)]',   border: 'border-emerald-500' },
  'F':   { bg: 'bg-zinc-600',   text: 'text-zinc-400',   glow: 'shadow-[0_0_10px_rgba(161,161,170,0.2)]',  border: 'border-zinc-600' },
};
