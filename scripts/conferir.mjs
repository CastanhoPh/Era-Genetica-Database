// Retrato de consistência do projeto, de graça.
//
//   npm run conferir              lê o retrato local (public/dados/*.json) — 0 leituras
//   npm run conferir -- --deploy  confere também se o publicado bate com o Firestore
//
// POR QUE ISSO EXISTE
//
// A pergunta "está tudo 100%?" aparece várias vezes por dia, e responder custava ~1.500 leituras de
// Firestore por vez, porque cada script de verificação lia as quatro coleções inteiras. Mas quase
// toda a resposta — quantas páginas sem arte, quais fichas incompletas, arma sem dono, soma de
// atributo errada — sai do MESMO retrato que o deploy já gerou e que está em disco. Só a pergunta
// "o publicado está em dia com o banco?" precisa falar com o Firestore, e é o que `--deploy` faz.
//
// O retrato vem de public/dados/, que é o que foi ao ar no último `npm run dados`. Se ele estiver
// velho, é justamente o que o --deploy detecta.
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DADOS = join(ROOT, 'public', 'dados');
const CANVA = 'C:/Users/PedroCastanho/OneDrive - Teddy Open Finance/Área de Trabalho/Canva';
const COM_FIRESTORE = process.argv.includes('--deploy');

// Os nomes com hash saem do módulo que o gerador escreve, o mesmo que o app importa.
const versao = readFileSync(join(ROOT, 'data', 'dados-versao.ts'), 'utf8');
const nomes = Object.fromEntries([...versao.matchAll(/(\w+): "(.+?)"/g)].map(m => [m[1], m[2]]));
if (!Object.keys(nomes).length) { console.error('data/dados-versao.ts sem nomes — rode `npm run dados`'); process.exit(1); }

const le = chave => {
  const caminho = join(DADOS, nomes[chave]);
  if (!existsSync(caminho)) {
    console.error(`${nomes[chave]} não está em public/dados/ — rode \`npm run dados\``);
    process.exit(1);
  }
  return JSON.parse(readFileSync(caminho, 'utf8'));
};

const chars = le('personagens');
const ars = le('arsenal');
const chk = le('checklist');
console.log(`retrato: ${chars.length} fichas · ${ars.length} armas · ${chk.length} páginas\n`);

// ---------------------------------------------------------------- checklist
console.log('=== checklist ===');
let semArte = 0;
for (const t of [...new Set(chk.map(i => i.type ?? 'evento'))].sort()) {
  const l = chk.filter(i => (i.type ?? 'evento') === t);
  const s = l.filter(i => !i.imageUrl).length;
  semArte += s;
  console.log(`  ${t.padEnd(14)} ${String(l.length).padStart(4)} pág · ${String(l.length - s).padStart(4)} com arte · ${String(s).padStart(3)} sem`);
}
const feitaSemArte = chk.filter(i => i.done && !i.imageUrl);
const arteSemMarcar = chk.filter(i => !i.done && i.imageUrl);
console.log(`  ${chk.length} páginas · ${semArte} sem arte`);
console.log(`  incoerências: ${feitaSemArte.length} marcada como feita sem arte · ${arteSemMarcar.length} com arte sem marcar`);
[...feitaSemArte, ...arteSemMarcar].slice(0, 5).forEach(i => console.log(`     ${i.temporada ?? ''} / ${i.arco ?? ''} / ${i.name}`));

// ---------------------------------------------------------------- fichas
console.log('\n=== fichas ===');
const ATRIBS = ['strength', 'dexterity', 'agility', 'intelligence', 'spirit', 'vigor', 'perception'];
const somaErrada = chars.filter(c => c.nc && c.stats
  && ATRIBS.reduce((s, k) => s + (c.stats[k] ?? 0), 0) !== 6 * c.nc - 12);
const acimaDoNC = chars.filter(c => c.nc && c.stats && ATRIBS.some(k => (c.stats[k] ?? 0) > c.nc));
const tetoErrado = chars.filter(c => c.nc && (c.powers ?? []).length
  && Math.max(...c.powers.map(p => p.level ?? 0)) !== Math.floor(c.nc / 2));
console.log(`  ${chars.length} fichas · ${chars.filter(c => !c.description?.trim()).length} sem descrição · ${chars.filter(c => !c.image).length} sem capa · ${chars.filter(c => !c.role || !c.combatStyle).length} sem perfil de combate`);
console.log(`  ${somaErrada.length} com soma de atributo fora de 6×NC−12 · ${acimaDoNC.length} com atributo acima do NC · ${tetoErrado.length} com poder máximo fora do teto`);
somaErrada.forEach(c => {
  const soma = ATRIBS.reduce((s, k) => s + (c.stats[k] ?? 0), 0);
  console.log(`     ${c.name} (NC ${c.nc}): soma ${soma}, esperado ${6 * c.nc - 12}`);
});
tetoErrado.forEach(c => console.log(`     ${c.name} (NC ${c.nc}): poder máximo ${Math.max(...c.powers.map(p => p.level ?? 0))}, teto ${Math.floor(c.nc / 2)}`));

// ---------------------------------------------------------------- arsenal
console.log('\n=== arsenal ===');
const semDono = ars.filter(a => !a.originalOwner?.trim());
const nomesFicha = new Set(chars.map(c => c.name));
const donoSemFicha = [...new Set(ars.filter(a => a.originalOwner?.trim() && !nomesFicha.has(a.originalOwner.trim())).map(a => a.originalOwner))];
console.log(`  ${ars.length} armas · ${semDono.length} sem portador original · ${ars.filter(a => !a.description?.trim()).length} sem descrição`);
console.log(`  ${donoSemFicha.length} portador(es) que não são nome de ficha: ${donoSemFicha.join(', ') || '—'}`);
semDono.forEach(a => console.log(`     sem dono: id ${a.id} ${a.name}`));

// ---------------------------------------------------------------- pasta do Canva
console.log('\n=== pasta do Canva ===');
if (!existsSync(CANVA)) console.log('  pasta não encontrada nesta máquina');
else {
  let total = 0, brancos = 0;
  const porProj = {};
  for (const proj of readdirSync(CANVA).filter(d => statSync(join(CANVA, d)).isDirectory())) {
    for (const n of readdirSync(join(CANVA, proj)).filter(x => /\.(png|jpe?g)$/i.test(x))) {
      total++;
      if (statSync(join(CANVA, proj, n)).size < 50_000) { brancos++; porProj[proj] = (porProj[proj] ?? 0) + 1; }
    }
  }
  console.log(`  ${total} arquivos · ${brancos} em branco (<50 KB)`);
  Object.entries(porProj).sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.log(`     ${String(n).padStart(3)}  ${p}`));
}

// ---------------------------------------------------------------- só com --deploy
if (!COM_FIRESTORE) {
  console.log('\n(0 leituras de Firestore. Use `-- --deploy` para conferir se o publicado está em dia.)');
  process.exit(0);
}

console.log('\n=== publicado vs Firestore ===');
const admin = (await import('firebase-admin')).default;
const { achaChave } = await import('./lib/chave.mjs');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(achaChave(), 'utf8'))) });
const db = admin.firestore();
const COLECOES = [
  { colecao: 'characters', arquivo: 'personagens', ordena: (a, b) => a.id - b.id },
  { colecao: 'arsenal', arquivo: 'arsenal', ordena: (a, b) => a.id - b.id },
  { colecao: 'imageChecklist', arquivo: 'checklist', ordena: (a, b) => a.order - b.order },
];
let emDia = true;
for (const { colecao, arquivo, ordena } of COLECOES) {
  const snap = await db.collection(colecao).get();
  const dados = snap.docs.map(d => ({ ...d.data(), docId: d.id })).sort(ordena);
  const hash = createHash('sha256').update(JSON.stringify(dados)).digest('hex').slice(0, 8);
  const publicado = nomes[arquivo]?.match(/-([0-9a-f]{8})\.json$/)?.[1];
  const bate = publicado === hash;
  if (!bate) emDia = false;
  console.log(`  ${arquivo.padEnd(12)} firestore ${hash} · publicado ${publicado ?? '?'} · ${bate ? 'em dia' : 'DESATUALIZADO'}`);
}
console.log(emDia
  ? '  o público vê o estado atual do banco'
  : '  FALTA `npm run deploy` para o público ver o estado atual');
process.exit(emDia ? 0 : 1);
