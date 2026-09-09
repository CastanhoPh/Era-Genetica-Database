// Backup completo do Firestore para JSON versionado no repositório.
//
// Motivo: `characters` e `arsenal` têm o data/*.ts como rede de proteção, mas `imageChecklist`,
// `familyTrees` e `prototypeEntries` existiam SÓ no Firestore — um batch errado ou a perda do
// projeto levaria meses de produção. Agora as seis coleções ficam no git.
//
// `familyTrees` continua na lista mesmo depois de a aba Árvore sair do site em 09/09/2026, e
// justamente POR ISSO: desde então este script é a única coisa que toca a coleção, e o JSON aqui é
// o único lugar onde a genealogia de 73 pessoas fica legível.
//
//   npm run backup            grava em docs/backup/<colecao>.json
//   npm run backup -- --check compara com o que está gravado e só relata a diferença
//
// Para restaurar, use scripts/restore-firestore.mjs.
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';

const CHECK = process.argv.includes('--check');
const DESTINO = join(process.cwd(), 'docs', 'backup');
const COLECOES = ['characters', 'arsenal', 'imageChecklist', 'familyTrees', 'prototypeEntries', 'aFazer'];

const key = achaChave();
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(key, 'utf8'))) });
const db = admin.firestore();

if (!existsSync(DESTINO)) mkdirSync(DESTINO, { recursive: true });

// docId junto, e ordenado por ele: sem isso o JSON muda de ordem a cada backup e o diff do git
// fica ilegível.
let totalDocs = 0, diferentes = 0;
for (const col of COLECOES) {
  const snap = await db.collection(col).get();
  const docs = snap.docs
    .map(x => ({ __docId: x.id, ...x.data() }))
    .sort((a, b) => a.__docId.localeCompare(b.__docId));
  const json = JSON.stringify(docs, null, 2) + '\n';
  const arq = join(DESTINO, `${col}.json`);
  totalDocs += docs.length;

  if (CHECK) {
    const antes = existsSync(arq) ? readFileSync(arq, 'utf8') : null;
    if (antes === null) { console.log(`  ${col.padEnd(17)} ${String(docs.length).padStart(4)} docs   SEM BACKUP AINDA`); diferentes++; }
    else if (antes !== json) {
      const a = JSON.parse(antes);
      console.log(`  ${col.padEnd(17)} ${String(docs.length).padStart(4)} docs   DIFERENTE do backup (backup tem ${a.length})`);
      diferentes++;
    } else console.log(`  ${col.padEnd(17)} ${String(docs.length).padStart(4)} docs   igual ao backup`);
    continue;
  }

  writeFileSync(arq, json, 'utf8');
  console.log(`  ${col.padEnd(17)} ${String(docs.length).padStart(4)} docs   ${(json.length / 1024).toFixed(0).padStart(5)} KB`);
}

console.log(`\n${totalDocs} documentos em ${COLECOES.length} coleções`);
if (CHECK) {
  console.log(diferentes ? `\n${diferentes} coleção(ões) fora de sincronia — rode "npm run backup" para atualizar.` : '\nBackup em dia.');
  process.exit(diferentes ? 1 : 0);
}
console.log(`gravado em docs/backup/ — commite para o backup existir de verdade`);
process.exit(0);
