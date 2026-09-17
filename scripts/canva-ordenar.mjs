// Põe as páginas de um projeto do Canva na ordem da lista do Painel.
//
//   node scripts/canva-ordenar.mjs            simula e imprime as operações, não envia nada
//   node scripts/canva-ordenar.mjs --apply    executa
//
// ============================================================================================
// ATENÇÃO — DOIS DEFEITOS CONHECIDOS. NÃO RODE EM OUTRO PROJETO ANTES DE CONSERTAR.
//
// Rodou uma vez, em Modos e Transformações (17/09/2026), e os dois apareceram:
//
// 1. PÁGINA EM BRANCO NÃO É INTERCAMBIÁVEL. Este script trata os brancos como um estoque
//    genérico e distribui na ordem em que aparecem. Mas no Canva cada branco carrega um TÍTULO
//    ("Kaito Senju - Modo Sábio", "Naomi Uzumaki - Manto Kurama") — é um marcador identificado,
//    não um vazio qualquer. Distribuir por ordem embaralhou três rótulos. A imagem ficou certa e
//    o nome ficou errado, que é o pior tipo de erro: a conferência por pixel passa.
//
// 2. `to_after_page_number` USA A NUMERAÇÃO DE ANTES DA REMOÇÃO. Movendo para TRÁS (origem maior
//    que destino) a remoção não mexe nas posições abaixo e `destino - 1` acerta. Movendo para a
//    FRENTE a remoção puxa tudo uma casa e é preciso pedir `destino`. Os 44 movimentos da
//    primeira rodada funcionaram por sorte: eram todos para trás. A regra certa é
//    `de < destino ? destino : destino - 1`.
//
// O que salvou as duas vezes foi a conferência por `id` depois de cada movimento — ela parou o
// lote no primeiro desencontro em vez de empilhar erro em cima de erro. Ela fica.
// ============================================================================================
//
// COMO ISTO NÃO SE PERDE NO MEIO DO CAMINHO
//
// Mover uma página muda o NÚMERO de todas as outras: quem estava em 38 vai para 4 e tudo entre as
// duas anda uma casa. O `id` da página, não — ele é estável e é por ele que o script se orienta.
// Depois de CADA movimento o projeto é relido pela API e a sequência de ids é comparada com a
// simulação local. Divergiu numa única posição, para na hora e imprime onde. Sem essa conferência
// um erro no quinto passo se propagaria silenciosamente pelos quarenta seguintes.
//
// NENHUMA PÁGINA É APAGADA. Só existem duas operações aqui, `move_pages` e `insert_pages`; a
// palavra `delete_pages` não aparece em requisição nenhuma. O projeto só cresce: as páginas em
// branco que faltam são criadas copiando uma que já existe, e as páginas cuja arte não tem par no
// banco vão para o FIM em vez de sumir.
//
// A ordem alvo vem do checklist, e a regra é do Pedro: item sem arte também ocupa posição, como
// página em branco. Por isso o alvo tem 53 lugares e não 46.
//
// O algoritmo é seleção, o mais bobo que existe: resolve a posição 1, depois a 2, e assim por
// diante. Daria para mover blocos inteiros e gastar 8 chamadas em vez de 46, mas bloco errado
// desarruma mais do que arruma — aqui vale o passo previsível.
import { readFileSync } from 'fs';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';
import { api } from './lib/canva.mjs';

const DESIGN = process.argv.find(a => a.startsWith('--design='))?.slice('--design='.length) ?? 'DAHSq1CDC2o';
const APPLY = process.argv.includes('--apply');

/** Todas as páginas do projeto, em ordem. A paginação aqui é por offset, não por continuation. */
async function paginas() {
  const todas = [];
  for (let off = 1; ; off += 100) {
    const r = await api(`/designs/${DESIGN}/pages?offset=${off}&limit=100`);
    todas.push(...(r.items ?? []));
    if ((r.items ?? []).length < 100) break;
  }
  return todas;
}

/** Dispara um merge e espera terminar. */
async function merge(operacao) {
  const r = await api('/merges', {
    method: 'POST',
    body: { type: 'modify_existing_design', design_id: DESIGN, operations: [operacao] },
  });
  let j = r.job;
  while (j.status === 'in_progress') {
    await new Promise(f => setTimeout(f, 1500));
    j = (await api(`/merges/${r.job.id}`)).job;
  }
  if (j.status !== 'success') throw new Error(`merge falhou: ${JSON.stringify(j.error ?? j)}`);
  return j;
}

// ================================================================ o alvo, vindo do banco
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(achaChave(), 'utf8'))) });
const cl = (await admin.firestore().collection('imageChecklist').get()).docs.map(d => d.data());
const itens = cl.filter(c => c.type === 'transformacao').sort((a, b) => a.order - b.order);

// pagina (do retrato de 17/09) -> posicao do item na lista. Veio do casamento por imagem, todas
// com distancia < 0.8, que e imagem identica e nao parecida.
const CASOU = {
  1: 1, 2: 2, 3: 3, 4: 25, 6: 27, 7: 38, 8: 39, 9: 40, 10: 37, 11: 41,
  12: 42, 13: 43, 14: 36, 15: 44, 16: 45, 18: 7, 19: 8, 20: 9, 21: 10,
  22: 12, 23: 14, 24: 13, 25: 11, 26: 15, 27: 21, 28: 16, 29: 23, 30: 24,
  31: 31, 32: 30, 33: 32, 34: 22, 35: 28, 36: 29, 37: 6, 38: 5, 39: 17,
  40: 18, 41: 19, 45: 46, 46: 47, 47: 48, 48: 49, 49: 33, 50: 34, 51: 35,
};
const BRANCO = [5, 17, 52];          // paginas em branco que ja existem
const ORFA = [42, 43, 44];           // arte sem par no banco — vao para o fim
const IDS_ESPERADOS = JSON.parse(readFileSync(new URL('./canva-ordenar-retrato.json', import.meta.url), 'utf8'));

// ================================================================ confere que o projeto nao mudou
const atual = await paginas();
const idsAgora = atual.map(p => p.id);
if (JSON.stringify(idsAgora) !== JSON.stringify(IDS_ESPERADOS)) {
  console.error('O projeto MUDOU desde o retrato que gerou o mapa de páginas.');
  console.error(`  retrato: ${IDS_ESPERADOS.length} páginas`);
  console.error(`  agora  : ${idsAgora.length} páginas`);
  const faltam = IDS_ESPERADOS.filter(i => !idsAgora.includes(i));
  const novas = idsAgora.filter(i => !IDS_ESPERADOS.includes(i));
  if (faltam.length) console.error(`  sumiram: ${faltam.join(', ')}`);
  if (novas.length) console.error(`  novas  : ${novas.join(', ')}`);
  if (!faltam.length && !novas.length) console.error('  mesmas páginas, ordem diferente — alguém reordenou no Canva.');
  console.error('\nNão vou mover nada em cima de um mapa velho. Rode o casamento de novo.');
  process.exit(1);
}
console.log(`projeto confere com o retrato: ${atual.length} páginas\n`);

const idDaPagina = n => IDS_ESPERADOS[n - 1];

// ================================================================ quantos brancos faltam
const posSemArte = itens.map((t, i) => (t.imageUrl ? null : i + 1)).filter(Boolean);
const faltamBrancos = posSemArte.length - BRANCO.length;
console.log(`posições que devem ficar em branco: ${posSemArte.length}  (${posSemArte.join(', ')})`);
console.log(`páginas em branco existentes      : ${BRANCO.length}`);
console.log(`a criar                           : ${faltamBrancos}\n`);

// ================================================================ simulacao
let ordem = [...IDS_ESPERADOS];
const operacoes = [];

// 1. inserir os brancos que faltam, no fim, copiando o primeiro branco existente
const modelo = BRANCO[0];
for (let k = 0; k < faltamBrancos; k++) {
  operacoes.push({
    rotulo: `inserir página em branco (cópia da pág ${modelo}) no fim`,
    corpo: {
      type: 'insert_pages',
      source: { type: 'design', design_id: DESIGN, page_numbers: [modelo] },
      after_page_number: ordem.length,
    },
    insere: true,
  });
  ordem.push(`NOVO_BRANCO_${k + 1}`);   // id de verdade só se sabe depois de reler
}

// 2. a ordem alvo, por id
const item2pag = Object.fromEntries(Object.entries(CASOU).map(([p, i]) => [i, Number(p)]));
const brancosDisponiveis = [...BRANCO.map(idDaPagina), ...Array.from({ length: faltamBrancos }, (_, k) => `NOVO_BRANCO_${k + 1}`)];
let proximoBranco = 0;

const alvo = [];
const rotuloDe = new Map();
for (const [i, t] of itens.entries()) {
  const pos = i + 1;
  if (t.imageUrl) {
    const id = idDaPagina(item2pag[pos]);
    alvo.push(id);
    rotuloDe.set(id, `${t.temporada} - ${t.name}`);
  } else {
    const id = brancosDisponiveis[proximoBranco++];
    alvo.push(id);
    rotuloDe.set(id, `— em branco —  (${t.temporada} - ${t.name})`);
  }
}
for (const p of ORFA) {
  const id = idDaPagina(p);
  alvo.push(id);
  rotuloDe.set(id, `??? arte sem par no banco (era a pág ${p})`);
}

console.log(`alvo: ${alvo.length} posições  (${itens.length} itens + ${ORFA.length} órfãs no fim)\n`);

// 3. seleção: resolve posição 1, depois 2...
const simulado = [...ordem];
for (let destino = 1; destino <= alvo.length; destino++) {
  const querido = alvo[destino - 1];
  const onde = simulado.indexOf(querido) + 1;
  if (onde === 0) throw new Error(`id ${querido} sumiu da simulação`);
  if (onde === destino) continue;
  operacoes.push({
    rotulo: `mover pág ${String(onde).padStart(2)} → posição ${String(destino).padStart(2)}   ${rotuloDe.get(querido)}`,
    corpo: { type: 'move_pages', from_page_numbers: [onde], to_after_page_number: destino - 1 },
    destino,
    querido,
  });
  const [x] = simulado.splice(onde - 1, 1);
  simulado.splice(destino - 1, 0, x);
}

console.log('='.repeat(84));
console.log(`${operacoes.length} OPERAÇÕES`);
console.log('='.repeat(84));
operacoes.forEach((o, i) => console.log(`${String(i + 1).padStart(3)}/${operacoes.length}  ${o.rotulo}`));

if (!APPLY) {
  console.log('\n(modo seco — nada enviado; rode com --apply)');
  process.exit(0);
}

// ================================================================ execução
console.log('\nexecutando…\n');
let vivo = [...IDS_ESPERADOS];
const novosIds = [];

for (const [i, op] of operacoes.entries()) {
  const n = `${String(i + 1).padStart(3)}/${operacoes.length}`;
  await merge(op.corpo);

  const depois = (await paginas()).map(p => p.id);

  if (op.insere) {
    // a pagina nova e a que apareceu; descobre o id de verdade e substitui o marcador
    const nova = depois.find(id => !vivo.includes(id));
    if (!nova) { console.error(`${n}  inseri mas não achei a página nova`); process.exit(1); }
    novosIds.push(nova);
    vivo = depois;
    console.log(`${n}  ${op.rotulo}  → id ${nova}`);
    continue;
  }

  const [x] = vivo.splice(vivo.indexOf(op.querido), 1);
  vivo.splice(op.destino - 1, 0, x);

  if (JSON.stringify(depois) !== JSON.stringify(vivo)) {
    console.error(`\n${n}  DIVERGIU — parando aqui, nada mais será enviado.`);
    for (let k = 0; k < Math.max(depois.length, vivo.length); k++) {
      if (depois[k] !== vivo[k]) {
        console.error(`   posição ${k + 1}: o Canva tem ${depois[k] ?? '(vazio)'}, eu esperava ${vivo[k] ?? '(vazio)'}`);
        break;
      }
    }
    process.exit(1);
  }
  console.log(`${n}  ${op.rotulo}`);
}

// ================================================================ conferência final
const fim = (await paginas()).map(p => p.id);
const esperado = alvo.map(a => (String(a).startsWith('NOVO_BRANCO_') ? novosIds[Number(String(a).split('_')[2]) - 1] : a));
console.log('\n' + '='.repeat(84));
if (JSON.stringify(fim) === JSON.stringify(esperado)) {
  console.log(`PRONTO — ${fim.length} páginas, todas na posição da lista do Painel.`);
} else {
  console.log('A ordem final NÃO bate com o alvo. Posições erradas:');
  for (let k = 0; k < Math.max(fim.length, esperado.length); k++) {
    if (fim[k] !== esperado[k]) console.log(`   posição ${k + 1}: tem ${fim[k] ?? '(vazio)'}, esperava ${esperado[k] ?? '(vazio)'}`);
  }
}
process.exit(0);
