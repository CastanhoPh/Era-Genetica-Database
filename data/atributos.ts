// A distribuição de atributos quando um personagem sobe de NC.
//
// Duas escolhas por ficha resolvem os sete atributos:
//
//   combatStyle    Corporal  -> Força e Agilidade no teto (= NC), Destreza e Percepção no mínimo
//                  Distância -> Destreza e Percepção no teto, Força e Agilidade no mínimo
//   focoAtributo   qual dos três livres (Inteligência, Vigor, Espírito) puxa a sobra primeiro
//
// Regras que isto obedece, todas em docs/Regras/regras_do_universo.md:
//   soma dos sete = 6 × NC − 12   ·   nenhum atributo acima do NC   ·   nenhum abaixo do mínimo
import { Stats } from '../types';

export const MIN_POR_NC: Record<number, number> = {
  4: 0, 5: 1, 6: 1, 7: 2, 8: 2, 9: 3, 10: 3, 11: 4, 12: 4, 13: 5, 14: 5, 15: 6, 16: 6, 17: 7, 18: 7,
  19: 8, 20: 8, 21: 8, 22: 8, 23: 9, 24: 9, 25: 10, 26: 10, 27: 11, 28: 11, 29: 12, 30: 12,
};

export type EstiloCombate = 'Corporal' | 'Distância';
export type FocoAtributo = 'inteligencia' | 'vigor' | 'espirito' | 'dividido';

export const FOCOS: { key: FocoAtributo; label: string }[] = [
  { key: 'inteligencia', label: 'Inteligência' },
  { key: 'vigor', label: 'Vigor' },
  { key: 'espirito', label: 'Espírito' },
  { key: 'dividido', label: 'Dividido' },
];

export const somaMaxima = (nc: number) => 6 * nc - 12;

/**
 * Distribui os sete atributos para um NC, dado o estilo e o foco.
 *
 * O par do estilo vai ao teto e o par oposto ao mínimo; a sobra fica com Inteligência, Vigor e
 * Espírito. O foco recebe o quanto puder (até o teto), e o que ainda restar é dividido entre os
 * outros dois — em "dividido" os três repartem por igual. Sobra de divisão inexata vai para o
 * primeiro na ordem Inteligência, Vigor, Espírito, para o resultado ser sempre o mesmo.
 *
 * Devolve null em NC fora da tabela.
 */
export function distribuirAtributos(
  nc: number,
  estilo: EstiloCombate,
  foco: FocoAtributo,
): { stats: Stats; teto: number; minimo: number; soma: number } | null {
  const minimo = MIN_POR_NC[nc];
  if (minimo === undefined) return null;
  const teto = nc;
  const total = somaMaxima(nc);

  // sobra para os três livres, depois de fixar os dois pares
  let sobra = total - 2 * teto - 2 * minimo;

  const livres: FocoAtributo[] = foco === 'dividido'
    ? ['inteligencia', 'vigor', 'espirito']
    : [foco, ...(['inteligencia', 'vigor', 'espirito'] as FocoAtributo[]).filter(k => k !== foco)];

  const valor: Record<string, number> = { inteligencia: minimo, vigor: minimo, espirito: minimo };
  sobra -= 3 * minimo;   // cada um já começa no mínimo

  // enche na ordem: o foco primeiro até o teto, depois os outros dois em paralelo.
  // em "dividido" a ordem é a natural, então os três sobem juntos.
  if (foco === 'dividido') {
    const cada = Math.floor(sobra / 3);
    livres.forEach(k => { valor[k] = Math.min(teto, minimo + cada); });
    let resto = total - 2 * teto - 2 * minimo - livres.reduce((s, k) => s + valor[k], 0);
    for (const k of livres) {
      while (resto > 0 && valor[k] < teto) { valor[k]++; resto--; }
    }
  } else {
    const podeNoFoco = Math.min(teto - minimo, sobra);
    valor[livres[0]] = minimo + podeNoFoco;
    let resto = sobra - podeNoFoco;
    const outros = livres.slice(1);
    const cada = Math.floor(resto / outros.length);
    outros.forEach(k => { valor[k] = Math.min(teto, minimo + cada); });
    resto -= outros.reduce((s, k) => s + (valor[k] - minimo), 0);
    for (const k of outros) {
      while (resto > 0 && valor[k] < teto) { valor[k]++; resto--; }
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
  const soma = Object.values(stats).reduce((s, v) => s + Number(v), 0);
  return { stats, teto, minimo, soma };
}

/** Teto de poder: o poder mais alto tem que ser exatamente isto. */
export const tetoDePoder = (nc: number) => Math.floor(nc / 2);
