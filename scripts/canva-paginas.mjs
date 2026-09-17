// Lista os projetos do Canva e as páginas de um deles.
//
//   npm run canva:paginas                      lista os projetos, com o id de cada um
//   npm run canva:paginas -- --design=DAF...    lista as páginas daquele projeto
//
// Este é o script que decide se o resto do plano existe. A API NÃO devolve o nome da página — só
// número, id, dimensões e miniatura — então o casamento página↔item do checklist tem que se apoiar
// no `id`. A documentação avisa que ele "pode ser omitido em alguns designs", e é exatamente isso
// que este script mede antes de qualquer linha ser escrita em cima dessa suposição.
//
// Se o id vier em todas as páginas, o vínculo é permanente e reordenar vira um comando. Se vier
// vazio, sobra casar por posição, que quebra no primeiro arrasto de página — e aí o plano muda.
//
// A paginação das páginas é por offset/limit, não por continuation como a de projetos.
import { api, tudo } from './lib/canva.mjs';

const design = process.argv.find(a => a.startsWith('--design='))?.slice('--design='.length);

if (!design) {
  const itens = await tudo('/designs', 'items');
  console.log(`\n${itens.length} projetos na conta:\n`);
  for (const d of itens) {
    const n = d.page_count ?? '?';
    console.log(`  ${d.id}  ${String(n).padStart(4)} pág  ${d.title ?? '(sem título)'}`);
  }
  console.log('\nPara ver as páginas de um: npm run canva:paginas -- --design=<id>');
  process.exit(0);
}

const d = await api(`/designs/${design}`);
console.log(`\nprojeto: ${d.design?.title ?? d.title ?? '(sem título)'}`);
console.log(`     id: ${design}`);

const paginas = [];
const LIMITE = 100;
for (let offset = 1; ; offset += LIMITE) {
  const r = await api(`/designs/${design}/pages?offset=${offset}&limit=${LIMITE}`);
  const itens = r.items ?? [];
  paginas.push(...itens);
  if (itens.length < LIMITE) break;
}

console.log(`páginas: ${paginas.length}\n`);

const semId = paginas.filter(p => !p.id);
const semThumb = paginas.filter(p => !p.thumbnail?.url);

console.log('--- as 10 primeiras ---');
for (const p of paginas.slice(0, 10)) {
  const dim = p.dimensions ? `${p.dimensions.width}x${p.dimensions.height}` : '(sem dimensão)';
  console.log(`  pág ${String(p.page_number).padStart(3)}  id=${p.id ?? '(VAZIO)'}  ${dim}  thumb=${p.thumbnail?.url ? 'sim' : 'NÃO'}`);
}

console.log('\n=== veredito ===');
console.log(`  páginas SEM id       : ${semId.length} de ${paginas.length}`);
console.log(`  páginas SEM miniatura: ${semThumb.length} de ${paginas.length}`);
console.log(semId.length === 0
  ? '\n  Os ids vieram em todas. O vínculo permanente é possível — dá pra seguir com o casamento e o reordenar.'
  : '\n  Faltou id em alguma página. O vínculo permanente NÃO dá em pé neste projeto; o plano precisa mudar.');
