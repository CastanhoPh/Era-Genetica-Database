// Reconstrói o campo `invocacoes` de cada ficha a partir do checklist.
//
//   npm run invocacoes:check   só relata a diferença
//   npm run invocacoes:fix     grava
//
// A ficha é pública e não pode ler as 741 linhas do `imageChecklist` para achar as suas invocações,
// então a lista vive desnormalizada no documento do personagem — mesma escolha já feita para a
// `gallery`. O preço da cópia é este script: a fonte da verdade continua sendo o checklist.
//
// O vínculo é pelo `temporada` do item de invocação, que guarda o PRIMEIRO nome do dono ("Kaito",
// "Nagi", "Borashi"). Isso funciona porque nenhuma das 86 fichas repete primeiro nome — o script
// confere isso e para se deixar de ser verdade.
//
// Dono sem ficha não é erro: a invocação fica guardada no checklist e passa a aparecer no dia em que
// a ficha existir, igual ao elenco dos eventos.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import os from 'os';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';

const APPLY = process.argv.includes('--apply');

const key = { full: achaChave() };
if (!key) throw new Error('Nenhuma chave firebase-adminsdk*.json em Downloads.');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(key.full, 'utf8'))) });
const db = admin.firestore();

const [snapChars, snapItens] = await Promise.all([
  db.collection('characters').get(),
  db.collection('imageChecklist').get(),
]);

// ---- o primeiro nome tem que ser único, senão o vínculo é ambíguo ----
const porPrimeiro = new Map();
for (const doc of snapChars.docs) {
  const nome = doc.data().name || '';
  const p = nome.split(' ')[0];
  if (!porPrimeiro.has(p)) porPrimeiro.set(p, []);
  porPrimeiro.get(p).push({ id: doc.id, nome, dados: doc.data() });
}
const ambiguos = [...porPrimeiro.entries()].filter(([, v]) => v.length > 1);
if (ambiguos.length) {
  console.log('PARE: primeiro nome repetido entre fichas, o vínculo por primeiro nome deixou de servir:');
  ambiguos.forEach(([p, v]) => console.log(`   ${p}: ${v.map(x => x.nome).join(' | ')}`));
  process.exit(1);
}

// ---- monta a lista de cada dono, na ordem das páginas ----
const itens = snapItens.docs.map(x => x.data());
const arte = itens.filter(i => i.type === 'invocacao').sort((a, b) => a.order - b.order);
const capaPorNome = new Map(itens.filter(i => i.type === 'capaInvocacao').map(i => [i.name, i]));

const planoPorDono = new Map();
const semFicha = new Map();
for (const i of arte) {
  const capa = capaPorNome.get(i.name);
  const inv = {
    nome: i.name,
    ...(capa?.imageUrl ? { capaUrl: capa.imageUrl } : {}),
    ...(i.imageUrl ? { arteUrl: i.imageUrl } : {}),
    ...(i.rank ? { rank: i.rank } : {}),
    ...(i.nature ? { nature: i.nature } : {}),
    ...(i.village ? { village: i.village } : {}),
    ...(i.originalOwner ? { originalOwner: i.originalOwner } : {}),
    ...(i.pastOwners?.length ? { pastOwners: i.pastOwners } : {}),
    ...(i.nomeAntigo ? { nomeAntigo: i.nomeAntigo } : {}),
    ...(i.descricao ? { descricao: i.descricao } : {}),
    ...(i.habilidade ? { habilidade: i.habilidade } : {}),
    ...(i.habilidadeSuprema ? { habilidadeSuprema: i.habilidadeSuprema } : {}),
    ...(i.placeholder || capa?.placeholder ? { placeholder: true } : {}),
  };
  const alvo = porPrimeiro.get(i.temporada);
  if (!alvo) {
    if (!semFicha.has(i.temporada)) semFicha.set(i.temporada, []);
    semFicha.get(i.temporada).push(i.name);
    continue;
  }
  const docId = alvo[0].id;
  if (!planoPorDono.has(docId)) planoPorDono.set(docId, []);
  planoPorDono.get(docId).push(inv);
}

// ---- compara conteúdo, não ordem de serialização ----
const chave = lista => JSON.stringify((lista || []).map(x => [x.nome, x.capaUrl ?? '', x.arteUrl ?? '', x.rank ?? '', x.nature ?? '', x.village ?? '', !!x.placeholder,
  x.originalOwner ?? '', (x.pastOwners ?? []).join('|'), x.nomeAntigo ?? '',
  x.descricao ?? '', x.habilidade ?? '', x.habilidadeSuprema ?? '']));

const mudam = [];
for (const doc of snapChars.docs) {
  const atual = doc.data().invocacoes;
  const novo = planoPorDono.get(doc.id) ?? null;
  // ficha sem invocação e sem campo: nada a fazer
  if (!novo && !atual) continue;
  if (chave(atual) === chave(novo)) continue;
  mudam.push({ id: doc.id, nome: doc.data().name, de: (atual || []).length, para: (novo || []).length, novo });
}

console.log(`${arte.length} invocações no checklist · ${planoPorDono.size} donos com ficha`);
if (semFicha.size) {
  console.log(`\ndono sem ficha (a invocação fica guardada até a ficha existir):`);
  for (const [dono, nomes] of semFicha)
    console.log(`   ${dono || '(sem invocador)'}: ${nomes.join(', ')}`);
}

if (!mudam.length) {
  console.log('\nNada a fazer: toda ficha já tem exatamente as invocações do checklist.');
  process.exit(0);
}

console.log(`\n${mudam.length} ficha(s) a atualizar:`);
mudam.forEach(m => console.log(`   ${m.nome.padEnd(26)} ${m.de} → ${m.para}${m.para ? '   ' + m.novo.map(x => x.nome).join(', ') : ''}`));

if (!APPLY) {
  console.log('\nDry run. Rode com --apply (npm run invocacoes:fix) para gravar.');
  process.exit(0);
}

let lote = db.batch(), n = 0;
for (const m of mudam) {
  lote.set(db.collection('characters').doc(m.id), { invocacoes: m.novo ?? [] }, { merge: true });
  if (++n % 400 === 0) { await lote.commit(); lote = db.batch(); }
}
await lote.commit();
console.log(`\n${mudam.length} ficha(s) gravada(s).`);
