// Gera as versões leves das imagens do site, em WebP, e as guarda em `_web/` no Storage.
//
//   npm run imagens          confere o que falta, não grava nada
//   npm run imagens:apply    gera e sobe
//
// O `npm run deploy` roda a versão que grava, logo depois de gerar o retrato dos dados.
//
// POR QUE ISSO EXISTE
//
// O site entregava o arquivo original do Canva em todo lugar: PNG de 1 a 4 MB, mesmo num card de
// 200 px. A lista de personagens baixava cerca de 130 MB. Medido em 08/10/2026 numa amostra de 12
// imagens por pasta:
//
//   Capas Personagens   988 KB  ->  cheia  66 KB  ·  mini 17 KB
//   Linha do Tempo     1536 KB  ->  cheia  91 KB  ·  mini 23 KB
//   Eventos            2783 KB  ->  cheia 188 KB  ·  mini 39 KB
//
// O QUE ELE FAZ
//
// Para cada imagem que o site usa, duas versões:
//
//   mini    cabe em 640×640, para card e miniatura
//   cheia   tamanho original, para a imagem aberta
//
// O original NÃO é tocado no conteúdo — continua sendo o que o Painel sobe, o que o `canva:export`
// baixa e o que o site usa quando a versão leve ainda não existe.
//
// DE ONDE VEM A LISTA: do retrato em public/dados/, não do Firestore. O retrato é exatamente o que o
// site publicado vai mostrar, e lê-lo custa zero leitura. Por isso o `npm run dados` roda antes.
//
// O NOME DA VERSÃO LEVE carrega o `v` da URL original (ver src/utils/imagemWeb.ts, que monta o
// mesmo nome do lado do site — mudou lá, muda aqui):
//
//   _web/<tamanho>/<caminho original>~<v>.webp
//
// É o que permite cache de um ano sem risco: arte trocada ganha `v` novo, que é nome novo, que não
// existe até este script rodar — e nome que não existe cai no original. As versões de um `v` que
// saiu do banco são apagadas aqui mesmo, então `_web/` nunca acumula lixo.
//
// CACHE DOS ORIGINAIS: sobe para um ano também. Toda URL do banco tem `v=`, então o endereço muda
// quando a imagem muda. Antes era um dia, e 107 arquivos não tinham cache nenhum.
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import sharp from 'sharp';
import { achaChave } from './lib/chave.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const BUCKET = 'era-genetica-db.firebasestorage.app';
const CACHE = 'public, max-age=31536000, immutable';
const TAMANHOS = {
  mini: img => img.resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }),
  cheia: img => img.webp({ quality: 86 }),
};

// ---- a lista do que o site usa, tirada do retrato ----
const versao = readFileSync(join(ROOT, 'src', 'data', 'dados-versao.ts'), 'utf8');
const nomes = Object.fromEntries([...versao.matchAll(/(\w+): "(.+?)"/g)].map(m => [m[1], m[2]]));
const le = chave => {
  const caminho = join(ROOT, 'public', 'dados', nomes[chave] ?? '');
  if (!nomes[chave] || !existsSync(caminho)) { console.error(`retrato de ${chave} não está em public/dados/ — rode \`npm run dados\``); process.exit(1); }
  return JSON.parse(readFileSync(caminho, 'utf8'));
};

const usadas = new Map();   // caminho original -> v
const anota = url => {
  if (typeof url !== 'string' || !url.includes(`/b/${BUCKET}/o/`)) return;
  const [codificado, query = ''] = url.split('/o/')[1].split('?');
  const v = new URLSearchParams(query).get('v');
  if (!v || !/^[\w-]+$/.test(v)) return;
  usadas.set(decodeURIComponent(codificado), v);
};
for (const c of le('personagens')) {
  anota(c.image);
  (c.techniques ?? []).forEach(t => anota(t.image));
  (c.gallery ?? []).forEach(g => anota(g.url));
  (c.invocacoes ?? []).forEach(i => { anota(i.capaUrl); anota(i.arteUrl); });
}
for (const a of le('arsenal')) { anota(a.image); (a.variants ?? []).forEach(v => anota(v.image)); }
for (const i of le('checklist')) anota(i.imageUrl);

// ---- o que já existe no Storage ----
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(achaChave(), 'utf8'))), storageBucket: BUCKET });
const bucket = admin.storage().bucket();
const [objetos] = await bucket.getFiles();
const noStorage = new Map(objetos.map(o => [o.name, o]));

const leveDe = (tamanho, caminho, v) => `_web/${tamanho}/${caminho}~${v}.webp`;
const queridas = new Set();
const gerar = [], semOriginal = [], cacheVelho = [];
for (const [caminho, v] of usadas) {
  const original = noStorage.get(caminho);
  if (!original) { semOriginal.push(caminho); continue; }
  if (original.metadata.cacheControl !== CACHE) cacheVelho.push(original);
  const faltam = Object.keys(TAMANHOS).filter(t => { const n = leveDe(t, caminho, v); queridas.add(n); return !noStorage.has(n); });
  if (faltam.length) gerar.push({ caminho, v, original, faltam });
}
const sobrando = objetos.filter(o => o.name.startsWith('_web/') && !queridas.has(o.name));

console.log(`${usadas.size} imagens em uso no site`);
console.log(`   ${usadas.size - gerar.length - semOriginal.length} já com as duas versões leves`);
console.log(`   ${gerar.length} a gerar`);
console.log(`   ${sobrando.length} versão(ões) leve(s) de arte que saiu do site, a apagar`);
console.log(`   ${cacheVelho.length} original(is) com cache curto, a ajustar para um ano`);
if (semOriginal.length) {
  console.log(`\n${semOriginal.length} no banco mas não no Storage:`);
  semOriginal.slice(0, 10).forEach(c => console.log(`   ${c}`));
}

if (!APPLY) { console.log('\nSimulação. Rode `npm run imagens:apply` para gerar.'); process.exit(0); }

// ---- gera e sobe ----
// Seis de cada vez: cada imagem é baixar 1 a 4 MB, comprimir duas vezes e subir duas vezes. Mais
// que isso não acelera e o sharp passa a disputar CPU consigo mesmo.
const emParalelo = async (lista, n, fn) => {
  const fila = [...lista];
  await Promise.all(Array.from({ length: n }, async () => { while (fila.length) await fn(fila.shift()); }));
};

let feitas = 0, bytesOriginal = 0;
const bytesLeve = { mini: 0, cheia: 0 };
const falhas = [];
await emParalelo(gerar, 6, async g => {
  try {
    const [dados] = await g.original.download();
    bytesOriginal += dados.length;
    for (const t of g.faltam) {
      const saida = await TAMANHOS[t](sharp(dados)).toBuffer();
      bytesLeve[t] += saida.length;
      await bucket.file(leveDe(t, g.caminho, g.v)).save(saida, {
        resumable: false,
        metadata: { contentType: 'image/webp', cacheControl: CACHE, metadata: { origem: g.caminho } },
      });
    }
  } catch (e) {
    falhas.push(`${g.caminho}: ${e.message}`);
  }
  if (++feitas % 50 === 0) console.log(`   ${feitas}/${gerar.length}`);
});

await emParalelo(sobrando, 8, o => o.delete());
await emParalelo(cacheVelho, 8, o => o.setMetadata({ cacheControl: CACHE }));

const mb = b => `${(b / 1e6).toFixed(0)} MB`;
console.log(`\n${gerar.length - falhas.length} imagem(ns) processada(s)`);
if (gerar.length) console.log(`   originais ${mb(bytesOriginal)}  ->  cheia ${mb(bytesLeve.cheia)}  ·  mini ${mb(bytesLeve.mini)}`);
if (sobrando.length) console.log(`${sobrando.length} versão(ões) leve(s) antiga(s) apagada(s)`);
if (cacheVelho.length) console.log(`${cacheVelho.length} original(is) com cache ajustado para um ano`);
if (falhas.length) {
  console.log(`\nATENÇÃO: ${falhas.length} falha(s) — o site usa o original nessas:`);
  falhas.slice(0, 10).forEach(f => console.log(`   ${f}`));
  // Sai com 0 mesmo assim: este script roda no meio do deploy, e uma imagem que não comprimiu
  // não é motivo para o site não ir ao ar — ela só continua pesada até a próxima rodada.
}
process.exit(0);
