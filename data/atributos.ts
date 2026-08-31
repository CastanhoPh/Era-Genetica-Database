// A distribuição de atributos quando um personagem sobe de NC.
//
// Três escolhas por ficha resolvem os sete atributos:
//
//   combatStyle       Corporal  -> Força e Agilidade no teto (= NC), Destreza e Percepção no mínimo
//                     Distância -> Destreza e Percepção no teto, Força e Agilidade no mínimo
//   focosAtributo     quais dos três livres (Inteligência, Vigor, Espírito) vão ao teto. Até dois.
//   divisaoAtributo   como os livres que NÃO são foco repartem o que sobrou, em passos de 5%.
//                     Ausente = partes iguais.
//
// Regras obedecidas, todas em docs/Regras/regras_do_universo.md:
//   soma dos sete = 6 × NC − 12   ·   nenhum atributo acima do NC   ·   nenhum abaixo do mínimo
import { Stats } from '../types';

/**
 * A escada de rank de ninja, definida pelo Pedro em 27/08/2026. É função pura do NC, e por isso
 * NÃO é campo gravado: guardar significaria duas verdades, e ela ficaria velha na primeira ficha
 * que subisse de NC — foi exatamente o que aconteceu com o `position`, que ainda tem 59 valores
 * desatualizados no banco.
 *
 * Abaixo de NC 4 não existe rank. Hoje só o Beta e o Hades caem aí, os dois com NC 0 de propósito.
 */
export const ESCADA_DE_RANK: { rank: string; de: number; ate: number }[] = [
  { rank: 'Genin',           de: 4,  ate: 7 },
  { rank: 'Chunin',          de: 8,  ate: 11 },
  { rank: 'Jonin',           de: 12, ate: 15 },
  { rank: 'Jonin de Elite',  de: 16, ate: 19 },
  { rank: 'Sannin',          de: 20, ate: 23 },
  { rank: 'Sannin Lendário', de: 24, ate: 27 },
  { rank: 'Kage',            de: 28, ate: 29 },
  { rank: 'Lenda Shinobi',   de: 30, ate: 30 },
];

/** O rank de ninja de um NC, ou string vazia quando o NC está fora da escada. */
export const rankDeNC = (nc: number): string =>
  ESCADA_DE_RANK.find(x => nc >= x.de && nc <= x.ate)?.rank ?? '';

export const MIN_POR_NC: Record<number, number> = {
  4: 0, 5: 1, 6: 1, 7: 2, 8: 2, 9: 3, 10: 3, 11: 4, 12: 4, 13: 5, 14: 5, 15: 6, 16: 6, 17: 7, 18: 7,
  19: 8, 20: 8, 21: 8, 22: 8, 23: 9, 24: 9, 25: 10, 26: 10, 27: 11, 28: 11, 29: 12, 30: 12,
};

export type EstiloCombate = 'Corporal' | 'Distância';
export type AtributoLivre = 'inteligencia' | 'vigor' | 'espirito';
export type Divisao = Partial<Record<AtributoLivre, number>>;

/** Ordem fixa, usada para desempatar arredondamento — o resultado é sempre o mesmo. */
export const LIVRES: { key: AtributoLivre; label: string; curto: string }[] = [
  { key: 'inteligencia', label: 'Inteligência', curto: 'Int' },
  { key: 'vigor', label: 'Vigor', curto: 'Vig' },
  { key: 'espirito', label: 'Espírito', curto: 'Esp' },
];

export const MAX_FOCOS = 2;
/**
 * Granularidade da proporção. Era 5, e desceu para 2,5 porque duas fichas certas não caberiam:
 * o Najin quer Int 37,5 / Esp 62,5 e o Yasuo Int 52,5 / Vig 47,5. Nada do que já existia mudou —
 * 60/40 e 55/45 do Kaito e do Takeshi seguem sendo múltiplos de 2,5.
 */
export const PASSO_DIVISAO = 2.5;

/** Percentual para leitura: 37.5 vira "37,5%" e 60 vira "60%", sem casa decimal sobrando. */
export const formataPct = (v: number): string =>
  `${(Math.round(v * 10) / 10).toString().replace('.', ',')}%`;
export const somaMaxima = (nc: number) => 6 * nc - 12;
/** Teto de poder: o poder mais alto tem que ser exatamente isto. */
export const tetoDePoder = (nc: number) => Math.floor(nc / 2);

/**
 * Percentuais dos divididos, normalizados para somar 100. Ausente ou tudo zero devolve `null`, que
 * significa "partes iguais" — e partes iguais NÃO é 33/33/33: com três divididos, 100 não é
 * divisível por 3 nem por 5, então o valor é repartido direto, não via porcentagem.
 */
export function divisaoNormalizada(divididos: AtributoLivre[], divisao?: Divisao): Record<string, number> | null {
  if (!divididos.length) return {};
  const bruto = divididos.map(k => Math.max(0, divisao?.[k] ?? 0));
  const total = bruto.reduce((s, v) => s + v, 0);
  if (!total) return null;
  const out: Record<string, number> = {};
  divididos.forEach((k, i) => { out[k] = Math.round(bruto[i] / total * 100); });
  let dif = 100 - divididos.reduce((s, k) => s + out[k], 0);
  for (const k of divididos) { if (!dif) break; out[k] += dif; dif = 0; }
  return out;
}

/** Quantos degraus de 5% cabem em 100. A proporção é guardada e mexida sempre em degraus inteiros. */
export const DEGRAUS = 100 / PASSO_DIVISAO;

/** Degraus por dividido quando ainda não há proporção explícita: 10/10 para dois, 7/7/6 para três. */
function degrausIniciais(n: number): number[] {
  const base = Math.floor(DEGRAUS / n);
  const d = Array(n).fill(base);
  let resto = DEGRAUS - base * n;
  for (let i = 0; i < n && resto > 0; i++, resto--) d[i]++;
  return d;
}

/** Percentuais → degraus, corrigindo o arredondamento para somar exatamente DEGRAUS. */
function emDegraus(divididos: AtributoLivre[], pct: Record<string, number>): number[] {
  const d = divididos.map(k => Math.max(0, Math.round((pct[k] ?? 0) / PASSO_DIVISAO)));
  let dif = DEGRAUS - d.reduce((s, v) => s + v, 0);
  for (let volta = 0; dif !== 0 && volta < DEGRAUS; volta++) {
    for (let i = 0; i < d.length && dif !== 0; i++) {
      if (dif > 0) { d[i]++; dif--; }
      else if (d[i] > 0) { d[i]--; dif++; }
    }
  }
  return d;
}

const emPercentual = (divididos: AtributoLivre[], d: number[]): Divisao => {
  const out: Divisao = {};
  divididos.forEach((k, i) => { out[k] = d[i] * PASSO_DIVISAO; });
  return out;
};

/** A proporção de partida quando ainda não há nenhuma gravada — o que o botão "definir" grava. */
export const divisaoInicial = (divididos: AtributoLivre[]): Divisao =>
  emPercentual(divididos, degrausIniciais(divididos.length));

/**
 * Move um degrau de 5% para dentro ou para fora de um dos divididos, devolvendo a proporção nova.
 *
 * O que entra sai de alguém: subir tira do dividido com mais degraus, descer devolve ao com menos —
 * empate resolvido pela ordem fixa de LIVRES, então a mesma sequência de cliques dá sempre o mesmo
 * resultado. Nos extremos (0% ou 100%) devolve a proporção intacta em vez de estourar.
 */
export function ajustaDivisao(
  divididos: AtributoLivre[],
  divisao: Divisao | undefined,
  key: AtributoLivre,
  passo: 1 | -1,
): Divisao {
  const n = divididos.length;
  const alvo = divididos.indexOf(key);
  if (n < 2 || alvo < 0) return {};
  const pct = divisaoNormalizada(divididos, divisao);
  const d = pct ? emDegraus(divididos, pct) : degrausIniciais(n);
  const outros = divididos.map((_, i) => i).filter(i => i !== alvo);
  if (passo > 0) {
    const doador = outros.reduce((a, b) => (d[b] > d[a] ? b : a));
    if (d[doador] > 0) { d[alvo]++; d[doador]--; }
  } else if (d[alvo] > 0) {
    const recebe = outros.reduce((a, b) => (d[b] < d[a] ? b : a));
    d[alvo]--; d[recebe]++;
  }
  return emPercentual(divididos, d);
}

/**
 * Distribui os sete atributos de um NC.
 *
 * O par do estilo vai ao teto e o par oposto ao mínimo. Dos três livres, os focados vão ao teto e o
 * que sobra é repartido entre os demais pela proporção — sobre o valor TOTAL que sobrou, não sobre o
 * excedente do mínimo, que é como o Kaito (60/40 → 17/11) e o Takeshi (55/45 → 15/13) funcionam.
 *
 * Cada resultado é preso em [mínimo, teto], e a diferença de arredondamento é acertada na ordem
 * Inteligência, Vigor, Espírito para a soma fechar exata.
 *
 * Devolve null em NC fora da tabela.
 */
export function distribuirAtributos(
  nc: number,
  estilo: EstiloCombate,
  focos: AtributoLivre[] = [],
  divisao?: Divisao,
): { stats: Stats; teto: number; minimo: number; soma: number; pct: Record<string, number> | null } | null {
  const minimo = MIN_POR_NC[nc];
  if (minimo === undefined) return null;
  const teto = nc;
  const ordem = LIVRES.map(l => l.key);
  const focados = ordem.filter(k => focos.includes(k));
  const divididos = ordem.filter(k => !focos.includes(k));

  const valor: Record<AtributoLivre, number> = { inteligencia: minimo, vigor: minimo, espirito: minimo };
  // sobra dos três livres, depois de fixar os dois pares do estilo
  let sobra = somaMaxima(nc) - 2 * teto - 2 * minimo;

  // Focado vai ao teto — mas nunca tomando o que os ainda-não-atribuídos precisam para chegar ao
  // mínimo. Sem esse limite, dois focos estouravam a soma nos NCs baixos.
  focados.forEach((k, i) => {
    const aindaFalta = (focados.length - 1 - i) + divididos.length;
    const dá = Math.max(minimo, Math.min(teto, sobra - minimo * aindaFalta));
    valor[k] = dá;
    sobra -= dá;
  });

  const pct = divisaoNormalizada(divididos, divisao);
  if (divididos.length) {
    const restante = sobra;
    if (pct === null) {
      // partes iguais: reparte o VALOR, não a porcentagem — com três divididos, 100 não divide por 3
      const base = Math.floor(restante / divididos.length);
      divididos.forEach(k => { valor[k] = Math.max(minimo, Math.min(teto, base)); });
    } else {
      divididos.forEach(k => {
        valor[k] = Math.max(minimo, Math.min(teto, Math.round(restante * (pct[k] ?? 0) / 100)));
      });
    }
    // acerta arredondamento e clamp na ordem fixa, sem estourar teto nem mínimo
    let dif = restante - divididos.reduce((s, k) => s + valor[k], 0);
    while (dif !== 0) {
      const antes = dif;
      for (const k of divididos) {
        if (dif > 0 && valor[k] < teto) { valor[k]++; dif--; }
        else if (dif < 0 && valor[k] > minimo) { valor[k]--; dif++; }
      }
      if (dif === antes) break;   // não há mais folga: sai em vez de girar para sempre
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
  return { stats, teto, minimo, soma: Object.values(stats).reduce((s, v) => s + Number(v), 0), pct };
}
