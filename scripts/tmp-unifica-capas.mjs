// Unifica a capa: o item do checklist passa a apontar para o proprio retrato da ficha, e a copia em
// Galeria/Capas/ e apagada.
//
//   node scripts/tmp-unifica-capas.mjs            confere
//   node scripts/tmp-unifica-capas.mjs --apply    grava
//
// So mexe em item cuja copia e md5-identica ao retrato. Se alguma divergir, ela fica de fora e sai
// listada -- ali a copia seria arte propria, nao duplicata, e apagar perderia imagem.
//
// A ordem importa: reaponta o Firestore primeiro, confere a leitura, e so entao apaga o arquivo.
// Ao contrario, uma falha no meio deixaria o checklist apontando para arquivo inexistente.
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import os from 'os';
import admin from 'firebase-admin';

const APPLY = process.argv.includes('--apply');
const PREFIXO = 'Galeria/Capas/';

const d = join(os.homedir(), 'Downloads');
const chave = readdirSync(d).filter(f => /firebase-adminsdk.*\.json$/i.test(f))
  .map(f => ({ full: join(d, f), m: statSync(join(d, f)).mtimeMs, s: statSync(join(d, f)).size }))
  .filter(f => f.s > 0).sort((a, b) => b.m - a.m)[0];
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(chave.full, 'utf8'))), storageBucket: 'era-genetica-db.firebasestorage.app' });
const db = admin.firestore();
const bucket = admin.storage().bucket();

const chars = (await db.collection('characters').get()).docs.map(x => x.data());
const capasSnap = (await db.collection('imageChecklist').get()).docs.filter(x => x.data().type === 'capa');
const [objs] = await bucket.getFiles();
const md5 = new Map(objs.map(o => [o.name, o.metadata.md5Hash]));
const cam = u => { const m = u?.split('/o/')[1]; return m ? decodeURIComponent(m.split('?')[0]) : null; };

const plano = [], fora = [];
for (const dc of capasSnap) {
  const item = dc.data();
  if (!item.imageUrl) continue;
  const pCapa = cam(item.imageUrl);
  if (!pCapa?.startsWith(PREFIXO)) continue;           // ja unificado
  const ficha = chars.find(c => c.name === item.temporada);
  if (!ficha) { fora.push({ nome: item.temporada, motivo: 'sem ficha correspondente' }); continue; }
  const pFicha = cam(ficha.image);
  if (!pFicha) { fora.push({ nome: item.temporada, motivo: 'ficha sem retrato' }); continue; }
  if (!md5.has(pCapa) || !md5.has(pFicha)) { fora.push({ nome: item.temporada, motivo: 'arquivo ausente no Storage' }); continue; }
  if (md5.get(pCapa) !== md5.get(pFicha)) { fora.push({ nome: item.temporada, motivo: 'arte DIFERENTE do retrato — nao e duplicata' }); continue; }
  plano.push({ ref: dc.ref, nome: item.temporada, pCapa, urlFicha: ficha.image });
}

const kb = p => Math.round(Number(objs.find(o => o.name === p).metadata.size) / 1024);
console.log(`itens de capa apontando para ${PREFIXO}: ${plano.length + fora.length}`);
console.log(`   a unificar : ${plano.length} · ${(plano.reduce((a, x) => a + kb(x.pCapa), 0) / 1024).toFixed(1)} MB a liberar`);
console.log(`   de fora    : ${fora.length}`);
fora.forEach(f => console.log(`      ${f.nome} — ${f.motivo}`));
if (!APPLY) {
  console.log('\nprimeiros 3:');
  plano.slice(0, 3).forEach(x => console.log(`   ${x.nome}\n      de : ${x.pCapa}\n      para: ${cam(x.urlFicha)}`));
  console.log('\nDry run. Rode com --apply para gravar.');
  process.exit(0);
}

let n = 0;
for (const x of plano) {
  await x.ref.set({ imageUrl: x.urlFicha }, { merge: true });
  const conf = (await x.ref.get()).data();
  if (conf.imageUrl !== x.urlFicha) throw new Error(`${x.nome}: nao reapontou`);
  await bucket.file(x.pCapa).delete();
  n++;
}
console.log(`\n${n} item(ns) reapontados e ${n} cópia(s) apagadas.`);

// ---------- conferencia ----------
const [depois] = await bucket.getFiles();
const sobrou = depois.filter(o => o.name.startsWith(PREFIXO) && !o.name.endsWith('/'));
console.log(`objetos em ${PREFIXO}: ${sobrou.length}`);
sobrou.forEach(o => console.log(`   ${o.name}`));

const existe = new Set(depois.map(o => o.name));
const COLS = ['characters', 'arsenal', 'imageChecklist', 'familyTrees', 'prototypeEntries', 'aFazer'];
const dados = {};
for (const c of COLS) dados[c] = (await db.collection(c).get()).docs.map(x => x.data());
const refs = new Set();
for (const m of JSON.stringify(dados).matchAll(/\/o\/([^"?]+)\?/g)) {
  try { refs.add(decodeURIComponent(m[1])); } catch { /* url torta */ }
}
const quebradas = [...refs].filter(p => !existe.has(p));
console.log(`\nreferencias no banco: ${refs.size} · quebradas: ${quebradas.length}`);
quebradas.forEach(q => console.log('   QUEBRADA ' + q));

const capasDepois = (await db.collection('imageChecklist').get()).docs.map(x => x.data()).filter(i => i.type === 'capa');
console.log(`\ncapas: ${capasDepois.length} itens · ${capasDepois.filter(i => i.imageUrl).length} com arte apontada`);
const aindaCapas = capasDepois.filter(i => cam(i.imageUrl)?.startsWith(PREFIXO)).length;
console.log(`ainda apontando para ${PREFIXO}: ${aindaCapas}`);
process.exit(quebradas.length ? 1 : 0);
