// Compara um projeto do Canva com a lista do Painel, posição por posição, pela IMAGEM.
//
//   node scripts/canva-analisar.mjs --tipo=capaInvocacao --design=DAH...
//   ...                                                  --out=<pasta>   onde deixar o material
//
// A API do Canva não devolve o nome da página, só a miniatura. Então a identificação é feita pela
// PRÓPRIA IMAGEM: baixo a miniatura de cada página e a arte de cada item do banco, reduzo as duas a
// uma assinatura pequena e procuro o par mais próximo.
//
// A assinatura mistura cor (8x12 RGB) e forma (24x36 em cinza), as duas normalizadas para média
// zero. A normalização existe porque quase toda arte aqui é uma figura sobre fundo branco — sem
// ela, o branco domina o quadro e tudo fica parecido com tudo.
//
// A escala de distância, medida em 56 páginas de Modos e Transformações:
//   ~0,3 a 0,7   a MESMA imagem (a miniatura é uma redução da arte, então nunca dá zero)
//   acima de 12  imagens diferentes
// Não existe meio-termo na prática, e é isso que torna o método confiável para dizer "esta página é
// aquele item" sem depender do nome.
//
// Escreve um manifesto e as duas pastas de imagens; quem conclui é o script Python irmão, que é
// onde a conta de assinatura acontece.
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { readFileSync } from 'fs';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';
import { api } from './lib/canva.mjs';

const TIPO = process.argv.find(a => a.startsWith('--tipo='))?.slice('--tipo='.length);
const DESIGN = process.argv.find(a => a.startsWith('--design='))?.slice('--design='.length);
const OUT = process.argv.find(a => a.startsWith('--out='))?.slice('--out='.length);
const SO_HIST = process.argv.includes('--historicos');
if (!TIPO || !DESIGN || !OUT) { console.error('uso: --tipo= --design= --out= [--historicos]'); process.exit(1); }

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'pag'), { recursive: true });
mkdirSync(join(OUT, 'esperado'), { recursive: true });

const baixa = async (u, d) => { const r = await fetch(u); if (!r.ok) return false; writeFileSync(d, Buffer.from(await r.arrayBuffer())); return true; };

const paginas = [];
for (let o = 1; ; o += 100) {
  const r = await api(`/designs/${DESIGN}/pages?offset=${o}&limit=100`);
  paginas.push(...(r.items ?? []));
  if ((r.items ?? []).length < 100) break;
}
for (const p of paginas) await baixa(p.thumbnail.url, join(OUT, 'pag', String(p.page_number).padStart(3, '0') + '.png'));

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(achaChave(), 'utf8'))) });
const db = admin.firestore();
const historicos = new Set(
  (await db.collection('characters').get()).docs.map(d => d.data())
    .filter(c => c.registro === 'historico').map(c => c.name),
);
const ehHist = i => historicos.has(TIPO === 'capa' ? i.name : i.temporada);
const cl = (await db.collection('imageChecklist').get()).docs.map(d => d.data());
const itens = cl
  .filter(c => (c.type ?? 'evento') === TIPO && (SO_HIST ? ehHist(c) : !ehHist(c)))
  .sort((a, b) => a.order - b.order);

const rot = [];
for (const [i, t] of itens.entries()) {
  const pos = i + 1;
  const nome = TIPO === 'capa' ? t.name : (TIPO === 'capaInvocacao' || TIPO === 'invocacao' || TIPO === 'arsenal' ? t.name : `${t.temporada} - ${t.name}`);
  rot.push({ pos, nome, temArte: !!t.imageUrl });
  if (t.imageUrl) await baixa(t.imageUrl, join(OUT, 'esperado', String(pos).padStart(3, '0') + '.png'));
}
writeFileSync(join(OUT, 'rot.json'), JSON.stringify(rot, null, 2));

console.log(`${TIPO}${SO_HIST ? ' (históricos)' : ''}`);
console.log(`  Canva : ${paginas.length} páginas`);
console.log(`  Painel: ${itens.length} itens  (${rot.filter(r => r.temArte).length} com arte)`);
console.log(`  material em ${OUT}`);
process.exit(0);
