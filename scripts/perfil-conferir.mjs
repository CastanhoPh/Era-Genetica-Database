// Confere o perfil de combate gravado contra a ficha, personagem por personagem.
//
//   npm run perfil:conferir            resumo + só quem está errado
//   npm run perfil:conferir -- --todos todas as 86, inclusive as certas
//   npm run perfil:conferir -- --tsv   saída para colar em planilha
//
// A pergunta é uma só: se eu aplicar o perfil gravado nesta ficha, no NC que ela tem hoje, saem os
// mesmos sete atributos? Se não saem, o perfil está errado — porque aplicá-lo na próxima subida de
// NC mudaria a ficha em silêncio.
import { readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import os from 'os';
import esbuild from 'esbuild';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TODOS = process.argv.includes('--todos');
const TSV = process.argv.includes('--tsv');

const src = readFileSync(join(ROOT, 'data/atributos.ts'), 'utf8').replace(/^import .*$/gm, '');
const { code } = await esbuild.transform(src, { loader: 'ts', format: 'esm', target: 'node20' });
const tmp = join(os.tmpdir(), `conf-${process.pid}.mjs`);
writeFileSync(tmp, code, 'utf8');
const { distribuirAtributos, MIN_POR_NC, LIVRES, formataPct } = await import(pathToFileURL(tmp).href);
unlinkSync(tmp);

const key = { full: achaChave() };
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(key.full, 'utf8'))) });

const ORDEM = ['strength', 'dexterity', 'agility', 'intelligence', 'spirit', 'vigor', 'perception'];
const SIGLA = ['For', 'Des', 'Agi', 'Int', 'Esp', 'Vig', 'Per'];
const vetor = s => ORDEM.map(k => Number(s?.[k]) || 0);
const curto = k => LIVRES.find(l => l.key === k).curto;

const rotuloPerfil = c => {
  if (!c.combatStyle) return 'sem perfil';
  if (!Array.isArray(c.focosAtributo)) return `${c.combatStyle} · sem foco`;
  const f = c.focosAtributo.length ? c.focosAtributo.map(curto).join('+') : 'nenhum';
  const div = c.divisaoAtributo && Object.values(c.divisaoAtributo).some(v => v > 0)
    ? Object.entries(c.divisaoAtributo).map(([k, v]) => `${curto(k)} ${formataPct(v)}`).join(' ')
    : 'iguais';
  return `${c.combatStyle} · foco ${f} · ${div}`;
};

/**
 * Por que o perfil não reproduz a ficha. São causas diferentes e pedem decisões diferentes, então
 * vale separar em vez de despejar 20 linhas de "errado".
 *
 *   estilo    — nenhum par inteiro no teto. Build mista: um de cada par, nenhum estilo reproduz.
 *   foco      — o foco gravado não é o que a ficha mostra (quais livres estão no teto).
 *   excesso   — o par oposto está acima do mínimo, então o orçamento dos livres é menor.
 *   proporção — estilo e foco certos; só a repartição do resto difere.
 */
function causas(c) {
  const nc = c.nc, minimo = MIN_POR_NC[nc], st = c.stats;
  const fora = [];
  const noTeto = (a, b) => Number(st[a]) === nc && Number(st[b]) === nc;
  const corpo = noTeto('strength', 'agility');
  const dist = noTeto('dexterity', 'perception');
  if (corpo === dist) return ['estilo'];

  const estiloCerto = corpo ? 'Corporal' : 'Distância';
  if (c.combatStyle !== estiloCerto) fora.push(`estilo trocado, ficha diz ${estiloCerto}`);

  const opostos = corpo ? ['dexterity', 'perception'] : ['strength', 'agility'];
  const excesso = opostos.reduce((t, k) => t + (Number(st[k]) - minimo), 0);
  if (excesso > 0) fora.push(`par oposto ${excesso} acima do mínimo`);

  const CAMPO = { inteligencia: 'intelligence', vigor: 'vigor', espirito: 'spirit' };
  const focoCerto = LIVRES.map(l => l.key).filter(k => Number(st[CAMPO[k]]) === nc);
  const focoDado = [...(c.focosAtributo ?? [])].sort();
  if (focoCerto.slice().sort().join() !== focoDado.join()) {
    fora.push(`foco: ficha diz ${focoCerto.length ? focoCerto.map(curto).join('+') : 'nenhum'}`);
  } else if (!fora.length) {
    fora.push('proporção');
  }
  return fora;
}

const snap = await admin.firestore().collection('characters').get();
const chars = snap.docs.map(x => ({ __docId: x.id, ...x.data() })).sort((a, b) => (a.id || 0) - (b.id || 0));

const linhas = chars.map(c => {
  const ficha = vetor(c.stats);
  const temPerfil = !!c.combatStyle && Array.isArray(c.focosAtributo);
  const semNC = !c.nc || MIN_POR_NC[c.nc] === undefined;
  const emBranco = ficha.every(v => v === 0);

  let perfil = null;
  if (temPerfil && !semNC) {
    const r = distribuirAtributos(c.nc, c.combatStyle, c.focosAtributo, c.divisaoAtributo);
    perfil = r ? vetor(r.stats) : null;
  }
  const bate = !!perfil && perfil.every((v, i) => v === ficha[i]);

  let status;
  if (semNC) status = temPerfil ? 'PERFIL SEM NC' : 'sem NC';
  else if (emBranco) status = temPerfil ? 'FICHA EM BRANCO' : 'em branco';
  else if (!c.combatStyle) status = 'sem perfil';
  else if (!temPerfil) status = 'só estilo';
  else if (bate) status = 'ok';
  else status = 'ERRADO';

  const dif = perfil && !bate
    ? SIGLA.map((s, i) => (perfil[i] !== ficha[i] ? `${s} ${ficha[i]}→${perfil[i]}` : null)).filter(Boolean)
    : [];
  const motivo = status === 'ERRADO' ? causas(c) : [];
  return { c, ficha, perfil, status, dif, motivo, soma: ficha.reduce((a, b) => a + b, 0) };
});

if (TSV) {
  console.log(['Personagem', 'NC', 'Status', 'Perfil gravado', ...SIGLA.map(s => 'ficha ' + s),
    ...SIGLA.map(s => 'perfil ' + s), 'Diferença', 'Causa'].join('\t'));
  for (const l of linhas) {
    console.log([l.c.name, l.c.nc || '', l.status, rotuloPerfil(l.c), ...l.ficha,
      ...(l.perfil ?? Array(7).fill('')), l.dif.join(' '), l.motivo.join(' · ')].join('\t'));
  }
  process.exit(0);
}

/** Causa dominante, para o resumo no fim: a que precisa ser resolvida primeiro. */
const principal = l => {
  if (l.motivo.some(m => m.startsWith('estilo'))) return 'estilo';
  if (l.motivo.some(m => m.startsWith('foco'))) return 'foco';
  if (l.motivo.some(m => m.startsWith('par oposto'))) return 'excesso';
  return 'proporção';
};
const ORDEM_STATUS = ['ERRADO', 'PERFIL SEM NC', 'FICHA EM BRANCO', 'só estilo', 'sem perfil', 'em branco', 'sem NC', 'ok'];
const grupos = new Map(ORDEM_STATUS.map(s => [s, []]));
linhas.forEach(l => grupos.get(l.status).push(l));

const TITULO = {
  'ERRADO': 'ERRADO — o perfil gravado não reproduz a ficha',
  'PERFIL SEM NC': 'PERFIL GRAVADO EM FICHA SEM NC — não dá para conferir, e não deveria existir',
  'FICHA EM BRANCO': 'PERFIL GRAVADO EM FICHA EM BRANCO — a prévia mostra o que preencher',
  'só estilo': 'SÓ O ESTILO — falta foco e proporção',
  'sem perfil': 'SEM PERFIL NENHUM',
  'em branco': 'FICHA EM BRANCO, sem perfil',
  'sem NC': 'SEM NC',
  'ok': 'OK — o perfil reproduz a ficha exata',
};

const larg = Math.max(...linhas.map(l => l.c.name.length));
for (const st of ORDEM_STATUS) {
  const g = grupos.get(st);
  if (!g.length) continue;
  if (st === 'ok' && !TODOS) { console.log(`\n=== ${TITULO[st]} (${g.length}) ===  (use --todos para listar)`); continue; }
  console.log(`\n=== ${TITULO[st]} (${g.length}) ===`);
  if (st === 'ERRADO' || st === 'ok' || st === 'FICHA EM BRANCO' || st === 'PERFIL SEM NC') {
    console.log(`  ${'personagem'.padEnd(larg)}  NC   ${SIGLA.join(' ')}   perfil gravado`);
  }
  for (const l of g) {
    const nc = String(l.c.nc || '-').padStart(2);
    const f = l.ficha.map(v => String(v).padStart(3)).join(' ');
    console.log(`  ${l.c.name.padEnd(larg)}  ${nc}  ${f}   ${rotuloPerfil(l.c)}`);
    if (l.perfil && !l.perfil.every((v, i) => v === l.ficha[i])) {
      console.log(`  ${' '.repeat(larg)}      ${l.perfil.map(v => String(v).padStart(3)).join(' ')}   ← o perfil daria:  ${l.dif.join('  ')}`);
      if (l.motivo.length) console.log(`  ${' '.repeat(larg)}      causa: ${l.motivo.join(' · ')}`);
    }
  }
}

const errados = grupos.get('ERRADO');
if (errados.length) {
  console.log('\n--- causa de cada ERRADO ---');
  for (const causa of ['estilo', 'foco', 'excesso', 'proporção']) {
    const g = errados.filter(l => principal(l) === causa);
    if (g.length) console.log(`  ${String(g.length).padStart(2)}  ${causa.padEnd(10)} ${g.map(l => l.c.name.replace(/ \(.*\)/, '')).join(', ')}`);
  }
}

console.log('\n---');
for (const st of ORDEM_STATUS) {
  const n = grupos.get(st).length;
  if (n) console.log(`  ${String(n).padStart(2)}  ${st}`);
}
console.log(`  ${chars.length} fichas no total`);
