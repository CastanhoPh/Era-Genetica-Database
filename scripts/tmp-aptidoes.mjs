// Substitui as aptidoes de uma ficha pelas da ficha de jogo (lidas da imagem).
//
//   node scripts/tmp-aptidoes.mjs <docId>            confere
//   node scripts/tmp-aptidoes.mjs <docId> --apply    grava
//
// A lista vem de LOTE, indexada pelo docId. Reutilizavel: o Pedro esta mandando uma imagem por
// personagem, e cada uma e uma substituicao completa -- as da ficha de jogo sao as certas.
//
// Reporta o que SAI, porque a substituicao limpa: no Nishinoya sairam "Deus Shinobi" e "Relampago
// Azul", que eram titulos dele indevidamente gravados como aptidao.
//
// Tambem aponta divergencia de grafia contra as outras fichas -- ex. "Lutar as Cegas" x "Lutar as
// Cegas" com acento -- para nao criarmos duas grafias da mesma aptidao.
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import os from 'os';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';

const DOC = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!DOC) { console.error('uso: node scripts/tmp-aptidoes.mjs <docId> [--apply]'); process.exit(1); }

const LOTE = {
  'kaito-senju': [
    'Acuidade', 'Intuição', 'Hiraishin',
    'Regeneração', 'Potencializar', 'Hiraishin: Deus do Trovão',
    'Maestria: CD', 'Maestria: CC', 'Chakra Expandido: Uzumaki',
    'Lutar às Cegas', 'Perito: Rastrear',
    'Ponto Cego', 'Técnica Poderosa',
  ],
  'takeshi-hatake': [
    'Acuidade', 'Shiroki Kaminari', 'Lutar às Cegas', 'Potencializar',
    'Ambidestria', 'Usar Arma: Katana', 'Maestria: CD', 'Réplica Enganadora',
    'Domínio da Água', 'Usar Arma: Espada', 'Perito: Prestidigitação', 'Técnica Poderosa',
    'Domínio do Raio', 'Maestria: CC', 'Perito: Mecanismos',
    'Kaminari', 'Instinto de Batalha: LM, CD', 'Ponto Cego',
  ],
  'kazuki-hoshigaki': [
    'Ambidestria', 'Ataque Poderoso', 'Bloqueio Ambidestro', 'Crítico Aprimorado (CC)',
    'Lutar às Cegas', 'Maestria: CC', 'Potencializar', 'Rasteira', 'Reflexos', 'Velocista',
  ],
  'kenma-soryo': [
    'Ambidestria', 'Dano Extra', 'Usar Arma: Martelo',
    'Arremessar', 'Domínio da Terra', 'Usar Arma: Lança',
    'Ataque em Movimento', 'Maestria: CC',
    'Contragolpe', 'Reflexos',
    'Crítico Aprimorado', 'Seguir Sombra',
  ],
  // "Shoei Barou" e "Shoei Sarutobi" sao a mesma pessoa, confirmado pelo Pedro.
  // O Chakra Expandido: Son Goku voltou: era omissao da lista, nao perda pela historia.
  'shoei-sarutobi': [
    'Chakra Expandido: Son Goku',
    'Acuidade', 'Ataque em Movimento', 'Duro de Matar', 'Intuição',
    'Lutar às Cegas', 'Maestria: CD', 'Ponto Cego', 'Potencializar',
  ],
  'nagare-uzumaki': [
    'Domínio do Raio', 'Kagura Shingan', 'Maximizar',
    'Kaminari', 'Kongou Fuusa', 'Punho de Ferro',
    'Shiroki Kaminari', 'Maestria: CC', 'Reflexos',
    'Ataque em Movimento', 'Mestre dos Selos', 'Velocista',
    'Chakra Expandido: Uzumaki', 'Potencializar',
  ],
  'furyuzan-chinoike': [
    'Acuidade', 'Ketsuryugan', 'Técnica Poderosa',
    'Atirador', 'Maestria: CD', 'Usar Arma: Garras',
    'Diligente', 'Ponto Cego', 'Velocista',
    'Duro de Matar', 'Regeneração', 'Chakra Expandido: Aokiba',
    'Intuição', 'Réplica Enganadora',
  ],
  'katsumi-hyuga': [
    'Acuidade', 'Contragolpe', 'Fujogan', 'Tenketsu Byakugan',
    'Ataque Giratório', 'Crítico Aprimorado', 'Intuição', 'Chakra Expandido: Profano',
    'Ataque Múltiplo', 'Dano Extra', 'Lutador',
    'Byakugan', 'Duro de Matar', 'Rasteira',
    'Chute Giratório', 'Maestria: CC', 'Soco em Gancho',
  ],
  // 20/20: primeiro no teto de aptidoes da ficha de jogo.
  'najin-hatake': [
    'Arremessar', 'Chute Giratório', 'Maestria: CC', 'Sharingan',
    'Ataque em Movimento', 'Crítico Aprimorado', 'Ponto Cego', 'Nidan Sharingan',
    'Ataque Giratório', 'Dano Extra', 'Punho de Ferro', 'Sandan Sharingan',
    'Ataque Múltiplo', 'De Pé', 'Reflexos', 'Mangekyou Sharingan',
    'Ataque Progressivo', 'Lutador', 'Seguir Sombra', 'Eternal Mangekyou Sharingan',
  ],
};

const chave = { full: achaChave() };
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(chave.full, 'utf8'))) });
const db = admin.firestore();

const NOVAS = LOTE[DOC];
if (!NOVAS) throw new Error(`sem lista para "${DOC}". Adicione em LOTE.`);
const dup = NOVAS.filter((x, i) => NOVAS.indexOf(x) !== i);
if (dup.length) throw new Error(`aptidao repetida na lista: ${dup.join(', ')}`);

const ref = db.collection('characters').doc(DOC);
const snap = await ref.get();
if (!snap.exists) throw new Error(`ficha "${DOC}" nao existe`);
const c = snap.data();
const antes = c.aptitudes || [];

// vocabulario do resto do projeto, para detectar grafia divergente
const todas = (await db.collection('characters').get()).docs
  .filter(x => x.id !== DOC).flatMap(x => x.data().aptitudes || []);
const vocab = new Map();
todas.forEach(a => vocab.set(a, (vocab.get(a) || 0) + 1));
const sem = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const porSem = new Map();
[...vocab.keys()].forEach(a => { if (!porSem.has(sem(a))) porSem.set(sem(a), []); porSem.get(sem(a)).push(a); });

console.log(`=== ${c.name} ===`);
console.log(`aptidões: ${antes.length} -> ${NOVAS.length}\n`);
const saem = antes.filter(x => !NOVAS.includes(x));
const entram = NOVAS.filter(x => !antes.includes(x));
const ficam = NOVAS.filter(x => antes.includes(x));
console.log(`ficam  (${ficam.length}): ${ficam.join(' · ') || '—'}`);
console.log(`\nsaem   (${saem.length}): ${saem.join(' · ') || '—'}`);
console.log(`entram (${entram.length}): ${entram.join(' · ') || '—'}`);

// grafia: existe no projeto com acento/caixa diferente?
const conflito = [];
for (const a of NOVAS) {
  if (vocab.has(a)) continue;
  const parecidas = (porSem.get(sem(a)) || []).filter(x => x !== a);
  if (parecidas.length) conflito.push({ nova: a, existentes: parecidas.map(x => `"${x}" (${vocab.get(x)} ficha${vocab.get(x) > 1 ? 's' : ''})`) });
}
if (conflito.length) {
  console.log(`\nGRAFIA DIVERGENTE — a mesma aptidão já existe escrita de outro jeito:`);
  conflito.forEach(x => console.log(`   "${x.nova}"  vs  ${x.existentes.join(', ')}`));
}
const inedita = NOVAS.filter(a => !vocab.has(a) && !(porSem.get(sem(a)) || []).length);
if (inedita.length) console.log(`\ninéditas no projeto (${inedita.length}): ${inedita.join(' · ')}`);

if (!APPLY) { console.log('\nDry run. Rode com --apply para gravar.'); process.exit(0); }

await ref.set({ aptitudes: NOVAS }, { merge: true });
const v = (await ref.get()).data();
console.log(`\ngravado: ${v.aptitudes.length} aptidões.`);
if (JSON.stringify(v.aptitudes) !== JSON.stringify(NOVAS)) throw new Error('a leitura de volta nao bateu');
