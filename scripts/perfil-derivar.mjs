// Deduz o perfil de combate (estilo, foco, proporção) a partir dos atributos que a ficha já tem.
//
// A distribuição é determinística: dado NC + estilo + foco + proporção, os sete atributos saem
// únicos (data/atributos.ts). Então o caminho de volta também existe — e para quem já está com os
// atributos certos é melhor deduzir do que perguntar.
//
//   npm run perfil:derivar             só relata
//   npm run perfil:derivar -- --apply  grava
//
// Só grava o que ele consegue PROVAR: cada palpite é rodado de volta pelo distribuirAtributos e
// tem que reproduzir os sete atributos exatos. Quem não fecha é listado e não é tocado.
//
// A lista SOBEM_DE_NC fica de fora: os atributos dessas fichas são do NC antigo, e o Pedro ainda
// vai decidir os novos. O relatório mostra o que daria, sem gravar.
import { readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import os from 'os';
import esbuild from 'esbuild';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const APPLY = process.argv.includes('--apply');

// Fichas cujo NC muda na 5ª Temporada: atributos ainda são do NC antigo. Casado por prefixo,
// porque no Firestore vários carregam sufixo — 'Shikatsu Nara' é 'Shikatsu Nara (Togo Kage)'.
const SOBEM_DE_NC = new Set([
  'Rock Gunma', 'Hiroshi Hanzo', 'Hisoka Senju', 'Katsuo Uzumaki', 'Shikatsu Nara',
  'Shikure Chinoike', 'Genei', 'Naoki Uchiha', 'Yuji Yotsuki', 'Akira Dokuhana',
  'Akairo', 'Yoru Kurogami',
]);

const sobeDeNC = nome => [...SOBEM_DE_NC].some(n => nome === n || nome.startsWith(n + ' '));

async function carregaAtributos() {
  const src = readFileSync(join(ROOT, 'data', 'atributos.ts'), 'utf8')
    .replace(/^import .*$/gm, '');   // o único import é o tipo Stats, que não existe em runtime
  const { code } = await esbuild.transform(src, { loader: 'ts', format: 'esm', target: 'node20' });
  const tmp = join(os.tmpdir(), `perfil-${process.pid}.mjs`);
  writeFileSync(tmp, code, 'utf8');
  try { return await import(pathToFileURL(tmp).href); } finally { unlinkSync(tmp); }
}

function conecta() {
  const key = { full: achaChave() };
  if (!key) throw new Error('Nenhuma chave firebase-adminsdk*.json em Downloads.');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(key.full, 'utf8'))) });
  return admin.firestore();
}

const A = await carregaAtributos();
const { distribuirAtributos, MIN_POR_NC, LIVRES, PASSO_DIVISAO, DEGRAUS } = A;
const CHAVES = LIVRES.map(l => l.key);
const ORDEM = ['strength', 'dexterity', 'agility', 'intelligence', 'spirit', 'vigor', 'perception'];
const vetor = s => ORDEM.map(k => Number(s?.[k]) || 0);
const curto = k => LIVRES.find(l => l.key === k).curto;

/** Todas as reparticões de 100 em degraus de 5 entre n divididos. */
function proporcoes(n) {
  const saida = [];
  const anda = (i, resta, atual) => {
    if (i === n - 1) { saida.push([...atual, resta]); return; }
    for (let d = resta; d >= 0; d--) anda(i + 1, resta - d, [...atual, d]);
  };
  anda(0, DEGRAUS, []);
  return saida.map(d => d.map(x => x * PASSO_DIVISAO));
}
const CACHE_PROP = { 2: proporcoes(2), 3: proporcoes(3) };

/**
 * Deduz o perfil de uma ficha. Devolve { estilo, focos, divisao } só quando o palpite reproduz os
 * sete atributos de volta; senão devolve { erro }.
 */
function deduz(c) {
  const nc = Number(c.nc) || 0;
  const minimo = MIN_POR_NC[nc];
  if (!nc) return { erro: 'sem NC' };
  if (minimo === undefined) return { erro: `NC ${nc} fora da tabela` };
  const alvo = vetor(c.stats);
  if (alvo.every(v => v === 0)) return { erro: 'ficha em branco' };

  const s = c.stats;
  const par = `For ${s.strength} Agi ${s.agility} · Des ${s.dexterity} Per ${s.perception}`;
  // Qual par está no teto decide o estilo, e isso é inequívoco mesmo quando o par oposto carrega
  // pontos acima do mínimo — é o caso do Oddy e de mais sete. Só é ambíguo quando os dois pares
  // têm um no teto e um no mínimo: aí é build mista de verdade e só o Pedro resolve.
  const noTeto = (a, b) => Number(s[a]) === nc && Number(s[b]) === nc;
  const corpo = noTeto('strength', 'agility');
  const dist = noTeto('dexterity', 'perception');
  if (corpo === dist) return { erro: `build mista, nenhum par inteiro no teto ${nc}: ${par}` };
  const estilo = corpo ? 'Corporal' : 'Distância';

  // Par oposto acima do mínimo: o orçamento dos livres não é o da fórmula, então o perfil completo
  // não consegue reproduzir a ficha. O estilo continua valendo.
  const opostos = corpo ? ['dexterity', 'perception'] : ['strength', 'agility'];
  const excesso = opostos.reduce((t, k) => t + (Number(s[k]) - minimo), 0);
  if (excesso > 0) {
    return { estilo, parcial: true, motivo: `par oposto ${excesso} acima do mínimo ${minimo}: ${par}` };
  }

  const focos = CHAVES.filter(k => {
    const campo = k === 'inteligencia' ? 'intelligence' : k === 'espirito' ? 'spirit' : 'vigor';
    return Number(s[campo]) === nc;
  });
  if (focos.length === 3) return { erro: 'os três livres no teto — nada a repartir, mas o padrão prevê foco' };

  const divididos = CHAVES.filter(k => !focos.includes(k));

  // partes iguais primeiro: se fecha sem proporção, é a resposta mais simples
  const bate = (divisao) => {
    const r = distribuirAtributos(nc, estilo, focos, divisao);
    return r && vetor(r.stats).every((v, i) => v === alvo[i]);
  };
  if (bate(undefined)) return { estilo, focos, divisao: {}, iguais: true };
  if (divididos.length < 2) return { erro: 'um só dividido e ainda assim não fecha' };

  // procura a proporção que reproduz, preferindo a mais próxima da razão bruta dos valores
  const restante = divididos.reduce((t, k) => {
    const campo = k === 'inteligencia' ? 'intelligence' : k === 'espirito' ? 'spirit' : 'vigor';
    return t + Number(s[campo]);
  }, 0);
  const bruto = divididos.map(k => {
    const campo = k === 'inteligencia' ? 'intelligence' : k === 'espirito' ? 'spirit' : 'vigor';
    return restante ? Number(s[campo]) / restante * 100 : 0;
  });
  const candidatas = CACHE_PROP[divididos.length]
    .map(pcts => ({ pcts, dist: pcts.reduce((t, p, i) => t + Math.abs(p - bruto[i]), 0) }))
    .sort((a, b) => a.dist - b.dist);
  for (const { pcts } of candidatas) {
    const divisao = {};
    divididos.forEach((k, i) => { divisao[k] = pcts[i]; });
    if (bate(divisao)) return { estilo, focos, divisao };
  }
  // A razão bruta não cai num múltiplo de 5. Mostra a mais próxima e o que ela mudaria, para o
  // Pedro escolher entre mexer 1 ponto no atributo ou baixar o passo da proporção.
  const perto = {};
  divididos.forEach((k, i) => { perto[k] = candidatas[0].pcts[i]; });
  const r = distribuirAtributos(nc, estilo, focos, perto);
  const dif = ORDEM.map((campo, i) => [campo, vetor(r.stats)[i] - alvo[i]]).filter(([, v]) => v !== 0)
    .map(([campo, v]) => `${campo} ${v > 0 ? '+' : ''}${v}`).join(' ');
  const razao = divididos.map((k, i) => `${curto(k)} ${bruto[i].toFixed(1)}%`).join(' ');
  return {
    estilo, focos, parcial: true,
    motivo: `razão ${razao} não é múltipla de ${PASSO_DIVISAO}; a mais próxima (${Object.entries(perto).map(([k, v]) => `${curto(k)} ${v}%`).join(' ')}) daria ${dif}`,
  };
}

const db = conecta();
const snap = await db.collection('characters').get();
const chars = snap.docs.map(d => ({ __docId: d.id, ...d.data() })).sort((a, b) => (a.id || 0) - (b.id || 0));

const rotulo = ({ focos, divisao, iguais }) => {
  const f = focos.length ? focos.map(curto).join('+') : '—';
  const d = iguais || !Object.keys(divisao).length
    ? 'iguais'
    : Object.entries(divisao).map(([k, v]) => `${curto(k)} ${v}%`).join(' ');
  return `${f.padEnd(9)} ${d}`;
};

/** Perfil já gravado que não reproduz os sete atributos. Quase sempre é clique errado na aba. */
function conferido(c) {
  if (!c.combatStyle || !Array.isArray(c.focosAtributo)) return null;
  const r = distribuirAtributos(c.nc, c.combatStyle, c.focosAtributo, c.divisaoAtributo);
  const alvo = vetor(c.stats);
  if (r && vetor(r.stats).every((v, i) => v === alvo[i])) return null;
  return { atual: r ? vetor(r.stats) : null, alvo };
}

const gravar = [], soEstilo = [], adiados = [], falhos = [];
for (const c of chars) {
  const r = deduz(c);
  if (r.erro) { falhos.push({ c, ...r }); continue; }
  if (sobeDeNC(c.name)) { adiados.push({ c, ...r }); continue; }
  (r.parcial ? soEstilo : gravar).push({ c, ...r });
}

const linha = ({ c, estilo, focos, divisao, iguais }) =>
  `  ${String(c.nc).padStart(2)}  ${c.name.padEnd(20)} ${estilo.padEnd(10)} ${rotulo({ focos, divisao, iguais })}`;

console.log(`\n=== DEDUZIDO E CONFERIDO (${gravar.length}) ===`);
console.log('  NC  personagem           estilo     foco      proporção do resto');
gravar.forEach(x => console.log(linha(x)));

if (soEstilo.length) {
  console.log(`\n=== SÓ O ESTILO (${soEstilo.length}) — foco e proporção não reproduzem a ficha ===`);
  soEstilo.forEach(({ c, estilo, motivo }) =>
    console.log(`  ${String(c.nc).padStart(2)}  ${c.name.padEnd(20)} ${estilo.padEnd(10)} ${motivo}`));
}

if (adiados.length) {
  console.log(`\n=== SOBEM DE NC — deduzido do NC atual, NÃO gravado (${adiados.length}) ===`);
  adiados.forEach(x => console.log(x.parcial
    ? `  ${String(x.c.nc).padStart(2)}  ${x.c.name.padEnd(20)} ${x.estilo.padEnd(10)} ${x.motivo}`
    : linha(x)));
}

if (falhos.length) {
  console.log(`\n=== NÃO DEU PARA DEDUZIR (${falhos.length}) ===`);
  falhos.forEach(({ c, erro }) => console.log(`  ${String(c.nc || '-').padStart(2)}  ${c.name.padEnd(20)} ${erro}`));
}

// Roda DEPOIS da gravação hipotética: o que este script vai escrever já foi conferido, então o que
// sobra aqui é perfil que alguém escolheu na mão e não fecha.
const vaiSerEscrito = new Set(gravar.map(x => x.c.__docId));
const errados = chars.filter(c => !vaiSerEscrito.has(c.__docId) && conferido(c));
if (errados.length) {
  console.log(`\n=== PERFIL GRAVADO QUE NÃO REPRODUZ A FICHA (${errados.length}) ===`);
  console.log('  For/Des/Agi/Int/Esp/Vig/Per — não vou mexer nesses, mas aplicá-los mudaria a ficha');
  for (const c of errados) {
    const { atual, alvo } = conferido(c);
    const d = deduz(c);
    const diz = d.erro ? d.erro : `atributos dizem ${d.estilo}${d.focos ? ' · ' + (d.focos.length ? d.focos.map(curto).join('+') : 'sem foco') : ''}`;
    console.log(`  ${String(c.nc || '-').padStart(2)}  ${c.name.padEnd(24)} perfil daria ${(atual ? atual.join('/') : 'null').padEnd(24)} ficha tem ${alvo.join('/').padEnd(24)} ${diz}`);
  }
}

// quantos ganham informação nova, para o Pedro saber o tamanho da mudança
const novos = gravar.filter(({ c }) => !Array.isArray(c.focosAtributo)).length;
const trocaEstilo = [...gravar, ...soEstilo].filter(({ c, estilo }) => c.combatStyle && c.combatStyle !== estilo);
// Foco gravado que não bate com o deduzido: alguém escolheu à mão na aba Perfil e o resultado não
// reproduz a ficha. Sobrescrever é o certo — os atributos são a verdade — mas em silêncio, não.
const trocaFoco = gravar.filter(({ c, focos }) => Array.isArray(c.focosAtributo)
  && (c.focosAtributo.length !== focos.length || c.focosAtributo.some((k, i) => k !== focos[i])));
console.log(`\n${gravar.length} perfil completo · ${soEstilo.length} só o estilo · ${novos} sem foco até agora · ${trocaEstilo.length} com estilo diferente do gravado`);
trocaEstilo.forEach(({ c, estilo }) => console.log(`  ! ${c.name}: estilo gravado ${c.combatStyle}, atributos dizem ${estilo}`));
trocaFoco.forEach(({ c, focos }) => console.log(`  ! ${c.name}: foco gravado [${c.focosAtributo.map(curto).join('+')}], atributos dizem [${focos.map(curto).join('+')}]`));

if (!APPLY) {
  console.log('\nDry run. Rode com --apply para gravar.');
  process.exit(0);
}

let lote = db.batch(), n = 0;
for (const { c, estilo, focos, divisao } of gravar) {
  lote.set(db.collection('characters').doc(c.__docId),
    { combatStyle: estilo, focosAtributo: focos, divisaoAtributo: divisao }, { merge: true });
  if (++n % 400 === 0) { await lote.commit(); lote = db.batch(); }
}
// Nos parciais só o estilo está provado. Gravar um foco que não reproduz a ficha seria pior que
// deixar em branco: na próxima subida de NC ele aplicaria atributos errados em silêncio.
for (const { c, estilo } of soEstilo) {
  lote.set(db.collection('characters').doc(c.__docId), { combatStyle: estilo }, { merge: true });
  if (++n % 400 === 0) { await lote.commit(); lote = db.batch(); }
}
await lote.commit();
console.log(`\nGravado: ${gravar.length} perfil completo, ${soEstilo.length} só o estilo.`);
