// Mostra o que existe dentro de uma pasta do Canva.
//
//   npm run canva:pasta                    o que está na raiz (projects/root)
//   npm run canva:pasta -- --id=FAF...     o conteúdo daquela pasta
//   npm run canva:pasta -- --fundo         desce recursivamente pelas subpastas
//
// A PASTA É QUEM DIZ QUAL PROJETO É O OFICIAL, e esse é o motivo deste script existir. A conta tem
// 113 designs soltos, com três chamados "Linha do Tempo" e quatro chamados "Eventos" — pelo nome é
// impossível saber qual vale. Os oito que estão dentro de "Era Genética" são os que valem.
//
// A raiz tem o id especial `root`.
import { api } from './lib/canva.mjs';

const alvo = process.argv.find(a => a.startsWith('--id='))?.slice('--id='.length) ?? 'root';
const FUNDO = process.argv.includes('--fundo');

/** Uma pasta inteira, já paginada. */
async function itens(id) {
  const saida = [];
  let cont;
  do {
    const r = await api(`/folders/${id}/items?limit=100` + (cont ? `&continuation=${encodeURIComponent(cont)}` : ''));
    saida.push(...(r.items ?? []));
    cont = r.continuation;
  } while (cont);
  return saida;
}

async function mostra(id, nome, nivel) {
  const pad = '  '.repeat(nivel);
  const lista = await itens(id);
  const pastas = lista.filter(i => i.type === 'folder');
  const designs = lista.filter(i => i.type === 'design');
  const outros = lista.filter(i => i.type !== 'folder' && i.type !== 'design');

  console.log(`${pad}[pasta] ${nome}  (${id})  — ${pastas.length} pastas, ${designs.length} designs` +
    (outros.length ? `, ${outros.length} outros` : ''));

  for (const d of designs.sort((a, b) => (b.design?.page_count ?? 0) - (a.design?.page_count ?? 0))) {
    const x = d.design ?? d;
    console.log(`${pad}   ${x.id}  ${String(x.page_count ?? '?').padStart(4)} pág  ${x.title ?? '(sem título)'}`);
  }

  for (const f of pastas) {
    const x = f.folder ?? f;
    if (FUNDO) await mostra(x.id, x.name ?? '(sem nome)', nivel + 1);
    else console.log(`${pad}   [pasta] ${x.id}  ${x.name ?? '(sem nome)'}`);
  }
}

await mostra(alvo, alvo === 'root' ? 'raiz' : alvo, 0);
