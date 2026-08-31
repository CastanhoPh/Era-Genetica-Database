// Reconstrói as entradas de evento na Galeria de cada ficha a partir do checklist.
//
//   npm run eventos:check    mostra o que está fora de lugar
//   npm run eventos:fix      corrige
//
// A regra: a imagem de um evento aparece na ficha de alguém quando as três coisas valem — o evento
// tem arte, o elenco está FECHADO, e a pessoa está no `personagens`. O Painel já mantém isso a cada
// clique; este script existe para convergir quando duas escritas se cruzam (o Pedro fechando um
// elenco no Painel enquanto um script em lote grava os participantes, por exemplo), e como
// conferência antes de um backup.
//
// Só toca em entradas de `category: "evento"`. Fase da linha do tempo e modo/transformação ficam
// intactos, e a ordem deles é preservada — os eventos são reescritos no fim da lista.
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import os from 'os';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';

const APLICAR = process.argv.includes('--apply');

const chave = { full: achaChave() };
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(chave.full, 'utf8'))) });
const db = admin.firestore();

const eventos = (await db.collection('imageChecklist').get()).docs
  .filter(x => (x.data().type ?? 'evento') === 'evento')
  .map(x => ({ id: x.id, ...x.data() }))
  .sort((a, b) => a.order - b.order);
const publicaveis = eventos.filter(e => e.elencoFechado && e.imageUrl);

console.log(`${eventos.length} eventos`);
console.log(`   com participantes  ${eventos.filter(e => (e.personagens ?? []).length).length}`);
console.log(`   elenco fechado     ${eventos.filter(e => e.elencoFechado).length}`);
console.log(`   fechado + com arte ${publicaveis.length}  (só estes aparecem em ficha)`);
console.log(`   fechado sem arte   ${eventos.filter(e => e.elencoFechado && !e.imageUrl).length}  (esperando a imagem)`);

const charDocs = (await db.collection('characters').get()).docs;
const plano = [];
for (const x of charDocs) {
  const nome = x.data().name;
  const antes = x.data().gallery ?? [];
  const naoEvento = antes.filter(g => g.category !== 'evento');
  const eventosDele = publicaveis
    .filter(e => (e.personagens ?? []).includes(nome))
    .map(e => ({
      url: e.imageUrl,
      caption: [e.arco, e.subarco, e.name].filter(Boolean).join(' - '),
      category: 'evento',
      season: e.temporada,
      eventId: e.id,
    }));
  // Compara CONTEÚDO, não ordem: o Painel acrescenta a entrada no fim da lista inteira, este
  // script agrupa os eventos no fim — as duas formas são equivalentes, e comparar o JSON cru
  // faria o script acusar diferença para sempre nas mesmas fichas.
  const chaveDe = g => `${g.eventId}|${g.url}|${g.caption ?? ''}|${g.season ?? ''}`;
  const eventosAntes = antes.filter(g => g.category === 'evento');
  const igual = eventosAntes.length === eventosDele.length
    && new Set(eventosAntes.map(chaveDe)).size === new Set([...eventosAntes, ...eventosDele].map(chaveDe)).size;
  if (!igual) {
    plano.push({ ref: x.ref, nome, depois: [...naoEvento, ...eventosDele], evAntes: eventosAntes.length, evDepois: eventosDele.length });
  }
}

if (!plano.length) {
  console.log('\nTudo em ordem — nenhuma ficha fora de lugar.');
  process.exit(0);
}
console.log(`\n${plano.length} ficha(s) fora de lugar:`);
plano.sort((a, b) => (b.evDepois - b.evAntes) - (a.evDepois - a.evAntes))
  .forEach(p => console.log(`   ${p.nome.padEnd(22)} eventos ${p.evAntes} -> ${p.evDepois}`));

if (!APLICAR) { console.log('\nRode com --apply para corrigir.'); process.exit(1); }
for (let k = 0; k < plano.length; k += 400) {
  const lote = db.batch();
  plano.slice(k, k + 400).forEach(p => lote.update(p.ref, { gallery: p.depois }));
  await lote.commit();
}
console.log(`\n${plano.length} ficha(s) corrigida(s)`);
process.exit(0);
