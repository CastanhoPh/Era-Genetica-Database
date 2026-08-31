// Compara data/characters.ts e data/arsenal.ts (local) com o Firestore (ao vivo),
// campo a campo, sem gravar nada. Útil para conferir o que vai mudar antes de
// rodar `npm run sync:push:apply`.
import { readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import os from 'os';
import esbuild from 'esbuild';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const findServiceAccountKey = () => achaChave();

async function loadTsExport(relPath, exportName) {
  const absPath = join(ROOT, relPath);
  const src = readFileSync(absPath, 'utf8');
  const { code } = await esbuild.transform(src, { loader: 'ts', format: 'esm', target: 'node20' });
  const tmpFile = join(os.tmpdir(), `sync-diff-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(tmpFile, code, 'utf8');
  try {
    const mod = await import(pathToFileURL(tmpFile).href);
    return mod[exportName];
  } finally {
    unlinkSync(tmpFile);
  }
}

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
    return { docId, data: JSON.parse(JSON.stringify(item)) };
  });
}

function diffValues(a, b, path = '') {
  if (a === b) return [];
  const aIsObj = a && typeof a === 'object';
  const bIsObj = b && typeof b === 'object';
  if (!aIsObj || !bIsObj) {
    if (a === undefined && b === undefined) return [];
    return [{ path, local: a, remote: b }];
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return [{ path, local: a, remote: b }];
    }
    return a.flatMap((v, i) => diffValues(v, b[i], `${path}[${i}]`));
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diffs = [];
  for (const k of keys) diffs.push(...diffValues(a[k], b[k], path ? `${path}.${k}` : k));
  return diffs;
}

function fmt(v) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (s === undefined) return 'undefined';
  return s.length > 90 ? s.slice(0, 90) + '…' : s;
}

async function diffCollection(db, collectionName, items) {
  const entries = withDocIds(items);
  const snap = await db.collection(collectionName).get();
  const remoteById = new Map(snap.docs.map(d => [d.id, d.data()]));
  const localIds = new Set(entries.map(e => e.docId));

  const onlyRemote = [...remoteById.keys()].filter(id => !localIds.has(id));
  let changedCount = 0;

  console.log(`\n=== ${collectionName} (${entries.length} local / ${remoteById.size} remoto) ===`);

  for (const { docId, data } of entries) {
    if (!remoteById.has(docId)) {
      console.log(`  [SÓ LOCAL] ${docId} (não existe no Firestore ainda)`);
      changedCount++;
      continue;
    }
    const diffs = diffValues(data, remoteById.get(docId));
    if (diffs.length) {
      changedCount++;
      console.log(`  [DIFERENTE] ${data.name} (${docId}) — ${diffs.length} campo(s):`);
      for (const d of diffs) {
        console.log(`      ${d.path}:`);
        console.log(`        local : ${fmt(d.local)}`);
        console.log(`        remoto: ${fmt(d.remote)}`);
      }
    }
  }

  if (onlyRemote.length) {
    console.log(`  [SÓ NO FIRESTORE] ${onlyRemote.join(', ')}`);
  }

  if (!changedCount && !onlyRemote.length) {
    console.log('  Tudo igual.');
  }
  return { changedCount, onlyRemote };
}

async function main() {
  const keyPath = findServiceAccountKey();
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const [characters, arsenal] = await Promise.all([
    loadTsExport('data/characters.ts', 'initialData'),
    loadTsExport('data/arsenal.ts', 'arsenalData'),
  ]);

  const rc = await diffCollection(db, 'characters', characters);
  const ra = await diffCollection(db, 'arsenal', arsenal);

  console.log(`\nResumo: ${rc.changedCount} personagem(ns) diferente(s), ${ra.changedCount} item(ns) de arsenal diferente(s).`);
  process.exit(0);
}

main().catch(e => { console.error('Sync diff falhou:', e); process.exit(1); });
