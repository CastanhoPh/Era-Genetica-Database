// Põe as páginas de um projeto do Canva na ordem da lista do Painel.
//
//   node scripts/canva-reordenar.mjs --design=DAH... --mapa=<pasta>            simula
//   node scripts/canva-reordenar.mjs --design=DAH... --mapa=<pasta> --apply    executa
//
// Substitui o canva-ordenar.mjs, que tinha dois defeitos descobertos em 17/09 e que estão
// corrigidos aqui:
//
// 1. PÁGINA EM BRANCO NÃO É INTERCAMBIÁVEL. Aquele script tratava os brancos como estoque genérico
//    e distribuía na ordem em que apareciam. Mas cada branco carrega um TÍTULO no Canva — é um
//    marcador identificado, não um vazio qualquer — e distribuir por ordem embaralhou três rótulos.
//    A imagem ficava certa e o nome errado, que é o pior tipo de erro: a conferência por pixel
//    passa. Aqui os brancos NÃO são realocados: eles vão para o fim, na ordem em que já estavam, e
//    quem decide o que fazer com eles é o Pedro.
//
// 2. `to_after_page_number` USA A NUMERAÇÃO DE ANTES DA REMOÇÃO. Movendo para TRÁS (origem maior
//    que destino) a remoção não mexe nas posições abaixo e `destino - 1` acerta. Movendo para a
//    FRENTE a remoção puxa tudo uma casa e é preciso pedir `destino`. Os 44 movimentos da primeira
//    rodada funcionaram por sorte: eram todos para trás.
//
// O mapa página→item vem do casamento por IMAGEM (an/mapa.json), porque a API do Canva não devolve
// o nome da página. Distância ~0,4 é imagem idêntica; acima de 12 é outra imagem. Não há
// meio-termo, e é isso que torna o mapa confiável.
//
// Depois de CADA movimento o projeto é relido e a sequência de ids é comparada com a simulação.
// Divergiu numa posição, para na hora. Foi essa conferência que evitou estrago nas duas vezes em
// que eu errei a conta.
import { readFileSync } from 'fs';
import { join } from 'path';
import { api } from './lib/canva.mjs';

const DESIGN = process.argv.find(a => a.startsWith('--design='))?.slice('--design='.length);
const MAPA = process.argv.find(a => a.startsWith('--mapa='))?.slice('--mapa='.length);
const APPLY = process.argv.includes('--apply');
if (!DESIGN || !MAPA) { console.error('uso: --design=<id> --mapa=<pasta> [--apply]'); process.exit(1); }

const { casou, brancas, orfas } = JSON.parse(readFileSync(join(MAPA, 'mapa.json'), 'utf8'));
const rot = JSON.parse(readFileSync(join(MAPA, 'rot.json'), 'utf8'));
const nomeDe = Object.fromEntries(rot.map(r => [r.pos, r.nome]));

async function paginas() {
  const t = [];
  for (let o = 1; ; o += 100) {
    const r = await api(`/designs/${DESIGN}/pages?offset=${o}&limit=100`);
    t.push(...(r.items ?? []));
    if ((r.items ?? []).length < 100) break;
  }
  return t;
}

// A regra do endpoint, descoberta na prática: `to_after_page_number` é contado na numeração de
// ANTES da remoção da página movida.
const paraDepoisDe = (de, destino) => (de < destino ? destino : destino - 1);

const atual = (await paginas()).map(p => p.id);
const total = Number(Object.keys(casou).length) + brancas.length + orfas.length;
if (atual.length !== total) {
  console.error(`o projeto tem ${atual.length} páginas e o mapa cobre ${total} — o mapa está velho, refaça o casamento`);
  process.exit(1);
}

// ---------------------------------------------------------------- a ordem alvo
// Cada item do Painel na sua posição; o que sobra (brancas e órfãs) vai para o fim, na ordem atual.
const idDaPagina = n => atual[n - 1];
const itemDaPagina = Object.fromEntries(Object.entries(casou).map(([pag, it]) => [Number(pag), it]));
const paginaDoItem = Object.fromEntries(Object.entries(casou).map(([pag, it]) => [it, Number(pag)]));

// ITEM SEM ARTE OCUPA POSIÇÃO, como página em branco. É a regra do Pedro: o Canva espelha o
// Painel 1 para 1, então a posição N do Canva é sempre o item N da lista. Sem isso, o primeiro
// item sem capa puxaria todos os seguintes uma casa para cima e o projeto inteiro sairia
// desalinhado a partir dali.
const semArte = new Set(rot.filter(r => !r.temArte).map(r => r.pos));
const posicoes = rot.map(r => r.pos).sort((a, b) => a - b);
const poolBrancas = [...brancas].sort((a, b) => a - b);
const alvo = [];
const rotuloDe = new Map();
for (const pos of posicoes) {
  const pag = paginaDoItem[pos];
  if (pag) {
    const id = idDaPagina(pag);
    alvo.push(id);
    rotuloDe.set(id, nomeDe[pos]);
  } else if (semArte.has(pos) && poolBrancas.length) {
    const id = idDaPagina(poolBrancas.shift());
    alvo.push(id);
    rotuloDe.set(id, `— em branco —  (${nomeDe[pos]})`);
  }
  // item com arte que eu não achei em página nenhuma: não ocupa, e sai no relatório do casamento
}
// o que sobrou — brancas a mais e páginas sem par no banco — vai para o fim, na ordem atual
for (const pag of [...poolBrancas, ...orfas].sort((a, b) => a - b)) {
  const id = idDaPagina(pag);
  alvo.push(id);
  rotuloDe.set(id, brancas.includes(pag) ? '— em branco —  (sobrando)' : `??? sem par no banco (era a pág ${pag})`);
}

if (alvo.length !== atual.length) {
  console.error(`alvo tem ${alvo.length} posições e o projeto tem ${atual.length} páginas`);
  process.exit(1);
}

// ---------------------------------------------------------------- simulação
let sim = [...atual];
const ops = [];
for (let destino = 1; destino <= alvo.length; destino++) {
  const querido = alvo[destino - 1];
  const de = sim.indexOf(querido) + 1;
  if (de === destino) continue;
  ops.push({ id: querido, destino });
  const [x] = sim.splice(de - 1, 1);
  sim.splice(destino - 1, 0, x);
}
console.log(`${atual.length} páginas · ${ops.length} movimentos · simulação bate com o alvo? ${JSON.stringify(sim) === JSON.stringify(alvo) ? 'SIM' : 'NÃO'}`);
if (JSON.stringify(sim) !== JSON.stringify(alvo)) process.exit(1);
console.log(`já no lugar: ${atual.length - ops.length}\n`);
for (const o of ops.slice(0, 8)) console.log(`  → posição ${String(o.destino).padStart(3)}   ${rotuloDe.get(o.id)}`);
if (ops.length > 8) console.log(`  … mais ${ops.length - 8}`);

if (!APPLY) { console.log('\n(modo seco — nada enviado)'); process.exit(0); }

// ---------------------------------------------------------------- execução
console.log('\nexecutando…');
let vivo = [...atual];
for (const [i, o] of ops.entries()) {
  const de = vivo.indexOf(o.id) + 1;
  const after = paraDepoisDe(de, o.destino);
  const r = await api('/merges', {
    method: 'POST',
    body: { type: 'modify_existing_design', design_id: DESIGN, operations: [{ type: 'move_pages', from_page_numbers: [de], to_after_page_number: after }] },
  });
  let j = r.job;
  while (j.status === 'in_progress') { await new Promise(f => setTimeout(f, 1200)); j = (await api(`/merges/${r.job.id}`)).job; }
  if (j.status !== 'success') { console.error(`\n${i + 1}/${ops.length} falhou: ${JSON.stringify(j.error ?? j)}`); process.exit(1); }

  const [x] = vivo.splice(de - 1, 1);
  vivo.splice(o.destino - 1, 0, x);
  const depois = (await paginas()).map(q => q.id);
  if (JSON.stringify(depois) !== JSON.stringify(vivo)) {
    console.error(`\n${i + 1}/${ops.length} DIVERGIU — parando, nada mais será enviado.`);
    for (let z = 0; z < depois.length; z++) {
      if (depois[z] !== vivo[z]) { console.error(`   posição ${z + 1}: Canva ${depois[z]}, eu esperava ${vivo[z]}`); break; }
    }
    process.exit(1);
  }
  if ((i + 1) % 10 === 0 || i === ops.length - 1) console.log(`  ${i + 1}/${ops.length}`);
}

const fim = (await paginas()).map(p => p.id);
console.log(JSON.stringify(fim) === JSON.stringify(alvo)
  ? `\nPRONTO — ${fim.length} páginas na ordem do Painel.`
  : '\nA ordem final NÃO bate com o alvo.');
process.exit(0);
