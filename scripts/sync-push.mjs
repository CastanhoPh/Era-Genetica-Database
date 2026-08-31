// Sincroniza data/characters.ts e data/arsenal.ts (fonte editada localmente)
// para o Firestore (fonte lida pelo site). Roda em modo "dry run" por padrão;
// use --apply para gravar de verdade.
//
// Autenticação: Admin SDK com uma chave de serviço. Por padrão procura o
// arquivo mais recente "*firebase-adminsdk*.json" na pasta Downloads do
// usuário; pode ser sobrescrito com a env var SERVICE_ACCOUNT_KEY_PATH.
import { readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import os from 'os';
import esbuild from 'esbuild';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const ONLY_ARG = process.argv.find(a => a.startsWith('--only='));
const ONLY = ONLY_ARG ? new Set(ONLY_ARG.slice('--only='.length).split(',').map(s => s.trim())) : null;

const findServiceAccountKey = () => achaChave();

// Compila um .ts com esbuild e importa o export nomeado, sem deixar arquivo temporário.
async function loadTsExport(relPath, exportName) {
  const absPath = join(ROOT, relPath);
  const src = readFileSync(absPath, 'utf8');
  const { code } = await esbuild.transform(src, { loader: 'ts', format: 'esm', target: 'node20' });
  const tmpFile = join(os.tmpdir(), `sync-push-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(tmpFile, code, 'utf8');
  try {
    const mod = await import(pathToFileURL(tmpFile).href);
    return mod[exportName];
  } finally {
    unlinkSync(tmpFile);
  }
}

// Mesma lógica de data/firestore.ts (slugify + resolução de colisão), para os
// IDs de documento ficarem idênticos aos que o app geraria via UI.
function slugify(name) {
  return String(name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function withDocIds(items) {
  const used = new Set();
  return items.map(item => {
    let docId = slugify(item.name) || `item-${item.id}`;
    if (used.has(docId)) docId = `${docId}-${item.id}`;
    used.add(docId);
    return { docId, data: JSON.parse(JSON.stringify(item)) }; // limpa undefined
  });
}

// existingDocs: Map<docId, dadosAtuaisNoFirestore> — precisamos do conteúdo
// completo (não só a lista de ids) pra detectar os dois riscos abaixo.
async function pushCollection(db, collectionName, items, existingDocs) {
  let entries = withDocIds(items);
  const localDocIds = new Set(entries.map(e => e.docId));
  const existingDocIds = [...existingDocs.keys()];
  const orphans = existingDocIds.filter(id => !localDocIds.has(id));

  if (ONLY) {
    entries = entries.filter(e => ONLY.has(e.docId));
  }

  console.log(`\n${collectionName}: ${entries.length} itens selecionados para push (de ${localDocIds.size} no arquivo local, ${existingDocIds.length} no Firestore).`);
  if (orphans.length) {
    console.log(`  Presentes no Firestore mas ausentes no arquivo local (NÃO serão apagados): ${orphans.join(', ')}`);
  }

  // Risco 1: docId novo (ainda não existe no Firestore) cujo `id` numérico já
  // pertence a outro doc existente. NÃO é uma checagem de rename (o `id` não
  // costuma sobreviver a um rename feito pelo Painel — confirmado em
  // 2026-08-03: "Alpha" tinha id 41, "Katakana Yotsuki (Alpha)" tem id 70).
  // É uma checagem de reuso acidental de id entre personagens SEM relação
  // nenhuma, que já aconteceu neste projeto (ex: "Asami Hyuga" e "Ryuta
  // Hyuga" com id 20 os dois).
  const idCollisions = [];
  for (const { docId, data } of entries) {
    if (existingDocs.has(docId)) continue;
    for (const [otherDocId, otherData] of existingDocs) {
      if (otherData.id === data.id) {
        idCollisions.push({ docId, name: data.name, collidesWith: otherDocId, otherName: otherData.name });
      }
    }
  }

  // Risco 3: docId novo cujo nome é EXATAMENTE o codinome entre parênteses no
  // nome de outro doc já existente (ex: doc novo "Alpha" vs doc existente
  // "Katakana Yotsuki (Alpha)") — esse sim é o padrão real de rename ao vivo
  // que causou a duplicata do Alpha/Gama/Delta/Theta/Togo Kage em 2026-08-03.
  const renameDuplicates = [];
  for (const { docId, data } of entries) {
    if (existingDocs.has(docId)) continue;
    if (!data.name) continue;
    for (const [otherDocId, otherData] of existingDocs) {
      const m = String(otherData.name || '').match(/\(([^)]+)\)\s*$/);
      if (m && m[1].trim() === data.name.trim()) {
        renameDuplicates.push({ docId, name: data.name, collidesWith: otherDocId, otherName: otherData.name });
      }
    }
  }

  // Campos que vivem SÓ no Firestore por natureza: derivados por script ou denormalizados a
  // partir do checklist. O arquivo local nunca os teve e nunca vai ter, então avisar sobre eles
  // não protege nada — só faz o guard gritar em toda ficha e o aviso perder o sentido.
  //
  // Sem esta lista o push abortava com 315 avisos falsos, e os 15 casos de divergência real
  // (combatStyle em 13 fichas, techniques em 2) ficavam invisíveis no meio.
  const SO_NO_FIRESTORE = new Set([
    'vila',            // migrado de categories, etapa 1 do modelo de organização
    'organizacao',     // idem
    'focosAtributo',   // perfil de combate, gravado por perfil:derivar
    'divisaoAtributo', // idem
    'invocacoes',      // denormalizado do checklist por invocacoes:fix
    'cargo',           // cargos de vila, da lista validada pelo Pedro
    'patente',         // patente de organização, separada do position
  ]);

  // Risco 2: doc já existe no Firestore e tem um campo preenchido que o
  // arquivo local não tem — provável edição feita direto no Painel (ex:
  // isDead/killedBy) que um push completo apagaria silenciosamente.
  const fieldDrops = [];
  // Aviso informativo (não bloqueia): campos que existem nos dois lados mas
  // com VALOR diferente. Não dá pra saber se é a mudança que eu quis fazer
  // ou se estou sobrescrevendo uma edição ao vivo — só deixa visível.
  const fieldChanges = [];
  // Firestore devolve os campos de um mapa em ordem alfabética; o objeto literal do
  // arquivo local vem na ordem em que foi escrito. Um JSON.stringify cru trata isso como
  // valor diferente — era o que fazia `stats` aparecer como alterado em 40 fichas sem que
  // um único atributo tivesse mudado. Ordena as chaves de todo mapa antes de comparar.
  // A ordem dos ARRAYS não é normalizada de propósito: reordenar a gallery muda a ordem
  // de exibição na ficha, então isso é divergência real e tem que continuar aparecendo.
  const canonico = v => JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.keys(x).sort().reduce((a, k) => ((a[k] = x[k]), a), {})
      : x);
  for (const { docId, data } of entries) {
    const existing = existingDocs.get(docId);
    if (!existing) continue;
    for (const key of Object.keys(existing)) {
      if (existing[key] === undefined || existing[key] === null) continue;
      if (!(key in data)) {
        if (!SO_NO_FIRESTORE.has(key)) fieldDrops.push({ docId, field: key, oldValue: existing[key] });
        continue;
      }
      if (canonico(existing[key]) !== canonico(data[key])) {
        fieldChanges.push({ docId, field: key });
      }
    }
  }

  if (idCollisions.length || renameDuplicates.length || fieldDrops.length) {
    console.log(`\n  ⚠ RISCOS DETECTADOS em ${collectionName}:`);
    if (renameDuplicates.length) {
      console.log(`  Possível duplicata de rename (nome bate com o codinome entre parênteses de outro doc):`);
      for (const c of renameDuplicates) {
        console.log(`    "${c.docId}" (${c.name}) é provavelmente a versão antiga de "${c.collidesWith}" (${c.otherName}), antes de renomear.`);
      }
    }
    if (idCollisions.length) {
      console.log(`  Reuso acidental de id numérico (personagens sem relação, id em comum):`);
      for (const c of idCollisions) {
        console.log(`    "${c.docId}" (${c.name}) tem o mesmo id de "${c.collidesWith}" (${c.otherName}).`);
      }
    }
    if (fieldDrops.length) {
      console.log(`  Campos que existem no Firestore e sumiriam com esse push (arquivo local não tem):`);
      for (const d of fieldDrops) {
        const v = JSON.stringify(d.oldValue);
        console.log(`    ${d.docId}.${d.field} = ${v.length > 120 ? v.slice(0, 117) + '...' : v}`);
      }
    }
    if (!FORCE) {
      console.log(`\n  Push de ${collectionName} ABORTADO por segurança — nada foi gravado nesta coleção.`);
      console.log(`  Revise os avisos acima. Se for intencional, rode de novo com --force.`);
      return { aborted: true };
    }
    console.log('  --force informado: prosseguindo mesmo assim.');
  }

  if (fieldChanges.length) {
    console.log(`\n  ℹ campos com valor diferente do Firestore atual (só aviso, não bloqueia):`);
    const byDoc = new Map();
    for (const c of fieldChanges) (byDoc.get(c.docId) ?? byDoc.set(c.docId, []).get(c.docId)).push(c.field);
    for (const [docId, fields] of byDoc) console.log(`    ${docId}: ${fields.join(', ')}`);
  }

  if (!APPLY) {
    console.log(`  [dry run] ${entries.length} documentos seriam gravados: ${entries.map(e => e.docId).join(', ')}`);
    return { aborted: false };
  }

  // `merge: true` é a proteção estrutural de verdade contra o caso do Oddy/Shinrin no
  // Kanmuri (2026-08-03): um campo (pastOwners) editado direto no Firestore e nunca
  // espelhado no arquivo local. Sem merge, um `.set()` puro sobrescreve o documento
  // inteiro e apaga qualquer campo que o arquivo local não conheça. Com merge, campos
  // ausentes no payload local simplesmente não são tocados. Isso NÃO cobre o caso mais
  // sutil de um array com menos itens localmente (merge substitui o array inteiro) — é
  // por isso que o aviso de `fieldChanges` acima continua existindo, só não bloqueia.
  const BATCH_LIMIT = 400;
  for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const { docId, data } of entries.slice(i, i + BATCH_LIMIT)) {
      batch.set(db.collection(collectionName).doc(docId), data, { merge: true });
    }
    await batch.commit();
  }
  console.log(`  ✓ ${entries.length} documentos gravados no Firestore.`);
  return { aborted: false };
}

async function main() {
  const keyPath = findServiceAccountKey();
  console.log(`Usando chave de serviço: ${keyPath}`);
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const [characters, arsenal] = await Promise.all([
    loadTsExport('data/characters.ts', 'initialData'),
    loadTsExport('data/arsenal.ts', 'arsenalData'),
  ]);

  const [charSnap, arsenalSnap] = await Promise.all([
    db.collection('characters').get(),
    db.collection('arsenal').get(),
  ]);
  const charDocs = new Map(charSnap.docs.map(d => [d.id, d.data()]));
  const arsenalDocs = new Map(arsenalSnap.docs.map(d => [d.id, d.data()]));

  const charResult = await pushCollection(db, 'characters', characters, charDocs);
  const arsenalResult = await pushCollection(db, 'arsenal', arsenal, arsenalDocs);

  if (!APPLY) {
    console.log('\nModo dry run — nada foi gravado. Rode com --apply para sincronizar de verdade.');
  }
  if (charResult?.aborted || arsenalResult?.aborted) {
    console.log('\nUma ou mais coleções foram abortadas por segurança (veja os avisos acima).');
    process.exit(1);
  }
  process.exit(0);
}

main().catch(e => { console.error('Sync push falhou:', e); process.exit(1); });
