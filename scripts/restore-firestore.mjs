// Restaura uma coleção do Firestore a partir do backup em docs/backup/.
//
// É o par do backup-firestore.mjs. Backup sem restauração testada não é backup.
//
//   node scripts/restore-firestore.mjs --colecao=imageChecklist            mostra o que faria
//   node scripts/restore-firestore.mjs --colecao=imageChecklist --apply    grava
//
// Por segurança: uma coleção por vez, e por padrão só CRIA o que falta e ATUALIZA o que difere.
// Para apagar do Firestore o que não está no backup, passar --apagar-sobras explicitamente.
import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';
import admin from 'firebase-admin';

const APPLY = process.argv.includes('--apply');
const APAGAR = process.argv.includes('--apagar-sobras');
const arg = process.argv.find(a => a.startsWith('--colecao='));
if (!arg) { console.error('uso: --colecao=<nome> [--apply] [--apagar-sobras]'); process.exit(1); }
const COL = arg.slice('--colecao='.length);
const ARQ = join(process.cwd(), 'docs', 'backup', `${COL}.json`);
if (!existsSync(ARQ)) { console.error(`sem backup para "${COL}" em docs/backup/`); process.exit(1); }

const d = join(os.homedir(), 'Downloads');
const key = readdirSync(d).filter(f => /firebase-adminsdk.*\.json$/i.test(f))
  .map(f => ({ full: join(d, f), m: statSync(join(d, f)).mtimeMs, s: statSync(join(d, f)).size }))
  .filter(f => f.s > 0).sort((a, b) => b.m - a.m)[0].full;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(key, 'utf8'))) });
const db = admin.firestore();

const backup = JSON.parse(readFileSync(ARQ, 'utf8'));
const atual = new Map((await db.collection(COL).get()).docs.map(x => [x.id, x.data()]));

const criar = [], atualizar = [], iguais = [];
for (const doc of backup) {
  const { __docId, ...dados } = doc;
  if (!atual.has(__docId)) criar.push({ id: __docId, dados });
  else if (JSON.stringify(atual.get(__docId)) !== JSON.stringify(dados)) atualizar.push({ id: __docId, dados });
  else iguais.push(__docId);
}
const sobras = [...atual.keys()].filter(id => !backup.some(b => b.__docId === id));

console.log(`modo: ${APPLY ? 'APLICAR' : 'DRY-RUN'}   coleção "${COL}"\n`);
console.log(`  backup tem   ${backup.length} documentos`);
console.log(`  Firestore    ${atual.size} documentos`);
console.log(`  iguais       ${iguais.length}`);
console.log(`  a criar      ${criar.length}${criar.length ? ': ' + criar.slice(0, 6).map(x => x.id).join(', ') : ''}`);
console.log(`  a atualizar  ${atualizar.length}${atualizar.length ? ': ' + atualizar.slice(0, 6).map(x => x.id).join(', ') : ''}`);
console.log(`  sobrando no Firestore, fora do backup: ${sobras.length}${sobras.length ? ': ' + sobras.slice(0, 6).join(', ') : ''}`);
if (sobras.length && !APAGAR) console.log(`     (não serão apagados — passe --apagar-sobras se for isso que você quer)`);

if (!APPLY) { console.log('\n(dry-run — nada gravado)'); process.exit(0); }

let n = 0;
for (let i = 0; i < criar.length + atualizar.length; i += 400) {
  const fatia = [...criar, ...atualizar].slice(i, i + 400);
  const lote = db.batch();
  fatia.forEach(x => lote.set(db.collection(COL).doc(x.id), x.dados));
  await lote.commit();
  n += fatia.length;
}
if (APAGAR && sobras.length) {
  const lote = db.batch();
  sobras.forEach(id => lote.delete(db.collection(COL).doc(id)));
  await lote.commit();
  console.log(`${sobras.length} documento(s) apagado(s)`);
}
console.log(`${n} documento(s) gravado(s) em "${COL}"`);
process.exit(0);
