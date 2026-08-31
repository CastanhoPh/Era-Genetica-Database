// Acrescenta um conjunto de pessoas a um conjunto de páginas de evento, por UNIÃO — quem já está
// marcado continua. Serve para os coletivos: "Os 7 de Konoha", "Equipe Stronkk", "a KONK".
//
//   npm run eventos:lote -- --paginas=211-223,230 --nomes="Katsumi Hyuga|Kaito Senju"
//   npm run eventos:lote -- --paginas=211-223 --nomes="..." --apply
//
// Sem --apply é dry-run. A página é a do projeto Eventos (a mesma da aba Canva e do run sheet),
// contada pela posição na faixa, não pelo `order` cru.
//
// A Galeria da ficha só recebe evento com elenco FECHADO e com arte — a mesma regra do Painel. Se
// uma escrita se cruzar com um clique seu, o `npm run eventos:fix` converge depois.
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import os from 'os';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';

const APLICAR = process.argv.includes('--apply');
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');

// "211-223,230" -> [211..223, 230]
const PAGINAS = arg('paginas').split(',').filter(Boolean).flatMap(p => {
  const m = p.trim().match(/^(\d+)-(\d+)$/);
  if (!m) return [Number(p.trim())];
  const [a, b] = [Number(m[1]), Number(m[2])];
  return Array.from({ length: b - a + 1 }, (_, k) => a + k);
});
const NOMES = arg('nomes').split('|').map(s => s.trim()).filter(Boolean);
if (!PAGINAS.length || !NOMES.length || PAGINAS.some(Number.isNaN)) {
  console.error('uso: --paginas=211-223,230 --nomes="Nome Completo|Outro Nome" [--apply]');
  process.exit(1);
}

const chave = { full: achaChave() };
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(chave.full, 'utf8'))) });
const db = admin.firestore();

// nome tem que existir em algum lugar: ficha, protótipo ou lista de cadastro
const charDocs = (await db.collection('characters').get()).docs;
const nomesFicha = new Set(charDocs.map(x => x.data().name));
const protos = new Set((await db.collection('prototypeEntries').get()).docs.map(x => x.data().title));
const tipos = readFileSync('types.ts', 'utf8');
const pendentes = new Set([...tipos.slice(tipos.indexOf('export const PENDING_CHARACTERS'))
  .matchAll(/\{\s*name:\s*'([^']+)'/g)].map(m => m[1]));
const desconhecidos = NOMES.filter(n => !nomesFicha.has(n) && !protos.has(n) && !pendentes.has(n));
if (desconhecidos.length) {
  console.error(`nome que não existe em ficha, protótipo nem pendentes: ${desconhecidos.join(', ')}`);
  console.error('use o nome COMPLETO — com os três grupos juntos, 18 primeiros nomes se repetem.');
  process.exit(1);
}

const eventos = (await db.collection('imageChecklist').get()).docs
  .filter(x => (x.data().type ?? 'evento') === 'evento')
  .sort((a, b) => a.data().order - b.data().order);

const plano = [];
for (const pag of PAGINAS) {
  const doc = eventos[pag - 1];
  if (!doc) { console.error(`página ${pag} não existe — o projeto tem ${eventos.length}`); process.exit(1); }
  const dd = doc.data();
  const antes = dd.personagens ?? [];
  plano.push({ pag, doc, dd, antes, novos: [...antes, ...NOMES.filter(n => !antes.includes(n))] });
}

console.log(`${NOMES.length} nome(s) em ${plano.length} página(s)\n`);
plano.forEach(p => console.log(
  `${String(p.pag).padStart(4)}  ${[p.dd.arco, p.dd.subarco, p.dd.name].filter(Boolean).join(' · ')}\n` +
  `      ${p.antes.length} -> ${p.novos.length} (+${p.novos.length - p.antes.length})   ` +
  `${p.dd.elencoFechado ? 'FECHADO' : 'aberto '}   ${p.dd.imageUrl ? 'com arte' : 'sem arte'}`));

const publicaveis = plano.filter(p => p.dd.elencoFechado && p.dd.imageUrl);
console.log(`\n${publicaveis.length} de ${plano.length} publicam na ficha (elenco fechado + com arte)`);

const idsLote = new Set(plano.map(p => p.doc.id));
const galFinal = new Map();
for (const x of charDocs) {
  const nome = x.data().name;
  const antes = x.data().gallery ?? [];
  const base = antes.filter(g => !(g.category === 'evento' && g.eventId && idsLote.has(g.eventId)));
  const novas = publicaveis.filter(p => p.novos.includes(nome)).map(p => ({
    url: p.dd.imageUrl,
    caption: [p.dd.arco, p.dd.subarco, p.dd.name].filter(Boolean).join(' - '),
    category: 'evento', season: p.dd.temporada, eventId: p.doc.id,
  }));
  const depois = [...base, ...novas];
  if (JSON.stringify(depois) !== JSON.stringify(antes)) galFinal.set(x.id, { nome, antes: antes.length, depois });
}
console.log(`${galFinal.size} ficha(s) mudam de Galeria: ${[...galFinal.values()].map(v => `${v.nome.split(' ')[0]} ${v.antes}→${v.depois.length}`).join(' · ') || '(nenhuma)'}`);

if (!APLICAR) { console.log('\nDry-run. Rode de novo com --apply para gravar.'); process.exit(0); }

const ops = [
  ...plano.map(p => ({ ref: p.doc.ref, data: { personagens: p.novos } })),
  ...[...galFinal.entries()].map(([id, v]) => ({ ref: db.collection('characters').doc(id), data: { gallery: v.depois } })),
];
for (let k = 0; k < ops.length; k += 400) {
  const lote = db.batch();
  ops.slice(k, k + 400).forEach(o => lote.update(o.ref, o.data));
  await lote.commit();
}
console.log(`\ngravado: ${plano.length} itens + ${galFinal.size} fichas`);
process.exit(0);
