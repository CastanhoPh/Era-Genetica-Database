import { ChecklistItem } from '../types';

export interface SubarcoGroup { subarco: string | null; items: ChecklistItem[] }
export interface ArcoGroup {
  arco: string;
  subarcos: SubarcoGroup[];
  items: ChecklistItem[]; // flat, para contagem
}
export interface TemporadaGroup {
  temporada: string;
  arcos: ArcoGroup[];
  items: ChecklistItem[];
}

// Agrupa itens preservando a ordem de primeira aparição ao percorrer a lista já
// ordenada por `order` (temporada > arco > subarco).
export function groupItems(items: ChecklistItem[]): TemporadaGroup[] {
  const byTemporada = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const list = byTemporada.get(item.temporada) ?? [];
    list.push(item);
    byTemporada.set(item.temporada, list);
  }
  return Array.from(byTemporada.entries()).map(([temporada, temporadaItems]) => {
    const byArco = new Map<string, ChecklistItem[]>();
    for (const item of temporadaItems) {
      const list = byArco.get(item.arco) ?? [];
      list.push(item);
      byArco.set(item.arco, list);
    }
    const arcos: ArcoGroup[] = Array.from(byArco.entries()).map(([arco, arcoItems]) => {
      const bySubarco = new Map<string | null, ChecklistItem[]>();
      for (const item of arcoItems) {
        const key = item.subarco ?? null;
        const list = bySubarco.get(key) ?? [];
        list.push(item);
        bySubarco.set(key, list);
      }
      return {
        arco,
        items: arcoItems,
        subarcos: Array.from(bySubarco.entries()).map(([subarco, subItems]) => ({ subarco, items: subItems })),
      };
    });
    return { temporada, arcos, items: temporadaItems };
  });
}
