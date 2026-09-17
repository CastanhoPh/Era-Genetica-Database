// Sobe arte de Modos e Transformações de uma pasta local para os QUATRO lugares onde ela vive.
//
//   node scripts/subir-transformacoes.mjs --pasta="<caminho>"            confere, não grava
//   node scripts/subir-transformacoes.mjs --pasta="<caminho>" --apply    grava
//
// O nome do arquivo é o contrato: "<personagem> - <transformação>.png". O personagem pode vir em
// nome curto ("Nishinoya"), porque é assim que a página do Canva chama — o script resolve para o
// nome completo da ficha antes de montar o caminho.
//
// OS QUATRO LUGARES, e por que nenhum pode ficar de fora:
//
//   1. Storage                Galeria/Modos e Transformações/<Nome completo>/<Transformação>.png
//   2. imageChecklist         imageUrl + done + doneBy — é o que o Painel mostra
//   3. characters (Firestore) gallery[] com category 'transformacao' — é o que a FICHA mostra
//   4. data/characters.ts     o mesmo gallery[], porque `gallery` NÃO está no SO_NO_FIRESTORE do
//                             sync-push: um push completo sobrescreveria o Firestore com o arquivo
//                             local e a arte sumiria da ficha sem ninguém entender por quê.
//
// Este script cuida de 1, 2 e 3. O 4 sai num relatório no fim, para ser aplicado no arquivo — é
// texto versionado e merece diff revisado, não escrita automática no meio de um lote.
//
// A URL leva ?alt=media&v=<generation>. O `v` é a geração do objeto no GCS e existe como
// cache-buster: sem ele, trocar a arte de um caminho que já existia deixaria a versão antiga no ar
// por até 24h no cache do navegador. Como duas destas sete são SUBSTITUIÇÕES, isso não é detalhe.
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';

const PASTA = process.argv.find(a => a.startsWith('--pasta='))?.slice('--pasta='.length);
const APPLY = process.argv.includes('--apply');
const AUTOR = process.argv.find(a => a.startsWith('--autor='))?.slice('--autor='.length) ?? 'Pedro';
const BUCKET = 'era-genetica-db.firebasestorage.app';
if (!PASTA) { console.error('faltou --pasta='); process.exit(1); }

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(achaChave(), 'utf8'))),
  storageBucket: BUCKET,
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

const chars = (await db.collection('characters').get()).docs.map(d => ({ ref: d.ref, ...d.data() }));
const snap = await db.collection('imageChecklist').get();
const checklist = snap.docs.map(d => ({ ref: d.ref, ...d.data() }));
const transf = checklist.filter(c => c.type === 'transformacao').sort((a, b) => a.order - b.order);

/** Acha a ficha por nome completo ou pelo primeiro nome, como a página do Canva escreve. */
const achaFicha = nome => {
  const n = nome.trim().toLowerCase();
  return chars.find(c => c.name.toLowerCase() === n)
    ?? chars.find(c => c.name.split(' ')[0].toLowerCase() === n);
};

const arquivos = readdirSync(PASTA).filter(f => /\.png$/i.test(f));
console.log(`${arquivos.length} arquivos em ${PASTA}\n`);

const plano = [];
const problemas = [];

for (const f of arquivos) {
  const base = basename(f, '.png');
  const corte = base.indexOf(' - ');
  if (corte < 0) { problemas.push(`${f}: nome não tem " - " separando personagem e transformação`); continue; }
  const quem = base.slice(0, corte).trim();
  const modo = base.slice(corte + 3).trim();

  const ficha = achaFicha(quem);
  if (!ficha) { problemas.push(`${f}: não achei ficha para "${quem}"`); continue; }

  const item = transf.find(t => t.temporada === ficha.name && t.name === modo);
  if (!item) { problemas.push(`${f}: não achei item de checklist "${ficha.name} / ${modo}"`); continue; }

  const caminho = `Galeria/Modos e Transformações/${ficha.name}/${modo}.png`;
  const jaTinha = !!item.imageUrl;
  const naGaleria = (ficha.gallery ?? []).some(g => g.category === 'transformacao' && g.caption === modo);

  plano.push({ f, ficha, modo, item, caminho, jaTinha, naGaleria });
}

if (problemas.length) {
  console.log('PROBLEMAS — nada será gravado enquanto existirem:\n');
  for (const p of problemas) console.log('  ' + p);
  process.exit(1);
}

console.log('pos  o que acontece   personagem / transformação');
console.log('-'.repeat(78));
for (const p of plano.sort((a, b) => a.item.order - b.item.order)) {
  const pos = transf.findIndex(t => t.order === p.item.order) + 1;
  const acao = p.jaTinha ? 'SUBSTITUI arte' : 'ADICIONA arte ';
  console.log(`${String(pos).padStart(3)}  ${acao}   ${p.ficha.name} / ${p.modo}`);
  console.log(`     storage: ${p.caminho}`);
  console.log(`     ficha  : ${p.naGaleria ? 'troca a entrada da galeria' : 'cria entrada na galeria'}`);
}

if (!APPLY) {
  console.log('\n(modo seco — nada gravado; rode com --apply)');
  process.exit(0);
}

console.log('\ngravando…\n');
const paraArquivoLocal = [];

for (const p of plano) {
  // 1. Storage
  await bucket.upload(join(PASTA, p.f), { destination: p.caminho, metadata: { contentType: 'image/png' } });
  const [meta] = await bucket.file(p.caminho).getMetadata();
  const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(p.caminho)}?alt=media&v=${meta.generation}`;

  // 2. checklist
  await p.item.ref.update({ imageUrl: url, done: true, doneBy: AUTOR });

  // 3. gallery da ficha
  const g = [...(p.ficha.gallery ?? [])];
  const i = g.findIndex(x => x.category === 'transformacao' && x.caption === p.modo);
  const entrada = { url, caption: p.modo, category: 'transformacao' };
  if (i >= 0) g[i] = entrada; else g.push(entrada);
  await p.ficha.ref.update({ gallery: g });
  p.ficha.gallery = g;

  console.log(`  ok  ${p.ficha.name} / ${p.modo}`);
  paraArquivoLocal.push({ nome: p.ficha.name, modo: p.modo, url, novo: i < 0 });
}

console.log('\n' + '='.repeat(78));
console.log('FALTA O 4º LUGAR: data/characters.ts');
console.log('Sem isso, o próximo `npm run sync:push` devolve a galeria antiga por cima.');
console.log('='.repeat(78));
for (const x of paraArquivoLocal) {
  console.log(`\n${x.nome} — ${x.novo ? 'ADICIONAR linha' : 'TROCAR a url da linha existente'}:`);
  console.log(`      { url: "${x.url}", caption: "${x.modo}", category: "transformacao" },`);
}
process.exit(0);
