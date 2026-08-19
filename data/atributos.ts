// A distribuição de atributos quando um personagem sobe de NC.
//
// Duas escolhas por ficha resolvem os sete atributos:
//
//   combatStyle     Corporal  -> Força e Agilidade no teto (= NC), Destreza e Percepção no mínimo
//                   Distância -> Destreza e Percepção no teto, Força e Agilidade no mínimo
//   focosAtributo   quais dos três livres (Inteligência, Vigor, Espírito) recebem primeiro.
//                   Nenhum = os três dividem por igual. Um = ele enche antes. Dois = os dois
//                   enchem juntos, e o terceiro fica com o resto.
//
// Regras obedecidas, todas em docs/Regras/regras_do_universo.md:
//   soma dos sete = 6 × NC − 12   ·   nenhum atributo acima do NC   ·   nenhum abaixo do mínimo
import { Stats } from '../types';

export const MIN_POR_NC: Record<number, number> = {
  4: 0, 5: 1, 6: 1, 7: 2, 8: 2, 9: 3, 10: 3, 11: 4, 12: 4, 13: 5, 14: 5, 15: 6, 16: 6, 17: 7, 18: 7,
  19: 8, 20: 8, 21: 8, 22: 8, 23: 9, 24: 9, 25: 10, 26: 10, 27: 11, 28: 11, 29: 12, 30: 12,
};

export type EstiloCombate = 'Corporal' | 'Distância';
export type AtributoLivre = 'inteligencia' | 'vigor' | 'espirito';

/** Ordem fixa de desempate, para o resultado ser sempre o mesmo. */
export const LIVRES: { key: AtributoLivre; label: string }[] = [
  { key: 'inteligencia', label: 'Inteligência' },
  { key: 'vigor', label: 'Vigor' },
  { key: 'espirito', label: 'Espírito' },
];

export const MAX_FOCOS = 2;
export const somaMaxima = (nc: number) => 6 * nc - 12;
/** Teto de poder: o poder mais alto tem que ser exatamente isto. */
export const tetoDePoder = (nc: number) => Math.floor(nc / 2);

/**
 * Distribui os sete atributos de um NC, dado o estilo e até dois focos.
 *
 * Os três livres começam no mínimo e sobem de um em um, em rodadas: primeiro só os focados, em
 * ciclo, até baterem no teto; depois os outros. Isso vale para 0, 1 ou 2 focos sem caso especial,
 * e nunca falha — quando dois focos não cabem no teto (NC 13 ou menos), eles simplesmente repartem
 * o que existe em vez de estourar a soma.
 *
 * Devolve null em NC fora da tabela.
 */
export function distribuirAtributos(
  nc: number,
  estilo: EstiloCombate,
  focos: AtributoLivre[] = [],
): { stats: Stats; teto: number; minimo: number; soma: number } | null {
  const minimo = MIN_POR_NC[nc];
  if (minimo === undefined) return null;
  const teto = nc;

  const valor: Record<AtributoLivre, number> = { inteligencia: minimo, vigor: minimo, espirito: minimo };
  const ordem = LIVRES.map(l => l.key);
  const focados = ordem.filter(k => focos.includes(k));
  const resto = ordem.filter(k => !focos.includes(k));
  // sem foco, todo mundo sobe junto; com foco, os focados primeiro
  const rodadas = focados.length ? [focados, resto] : [ordem];

  let sobra = somaMaxima(nc) - 2 * teto - 2 * minimo - 3 * minimo;
  for (const grupo of rodadas) {
    let mudou = true;
    while (sobra > 0 && mudou) {
      mudou = false;
      for (const k of grupo) {
        if (sobra > 0 && valor[k] < teto) { valor[k]++; sobra--; mudou = true; }
      }
    }
  }

  const corporal = estilo === 'Corporal';
  const stats: Stats = {
    strength: corporal ? teto : minimo,
    agility: corporal ? teto : minimo,
    dexterity: corporal ? minimo : teto,
    perception: corporal ? minimo : teto,
    intelligence: valor.inteligencia,
    vigor: valor.vigor,
    spirit: valor.espirito,
  };
  return { stats, teto, minimo, soma: Object.values(stats).reduce((s, v) => s + Number(v), 0) };
}
