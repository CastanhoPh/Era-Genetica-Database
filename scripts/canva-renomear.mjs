// Renomeia as páginas de um projeto do Canva para bater com a lista do Painel.
//
//   node scripts/canva-renomear.mjs             lê e mostra o que mudaria, não escreve
//   node scripts/canva-renomear.mjs --apply     escreve
//
// A Connect API NÃO renomeia página — esse endpoint não existe. Então isto vai pela interface, por
// um Chrome que o Pedro deixou logado e que eu dirijo por CDP na porta 9222.
//
// COMO ACHAR O INPUT DA PÁGINA CERTA, e por que a primeira versão errou feio
//
// A primeira tentativa subia pela árvore do DOM a partir de cada input, procurando um ancestral que
// contivesse o rótulo "Página N". Alguns níveis acima TODOS os inputs dividem o mesmo ancestral, a
// condição virava verdadeira para qualquer um, e o `.find()` devolvia o primeiro da lista — o da
// página mais alta visível. Resultado: 16 páginas renomeadas erradas, cinco posições acima do alvo.
// O teste que eu tinha feito rodou com a lista no topo, onde a primeira visível É a página 1; foi o
// único caso em que o defeito não aparecia.
//
// Agora o pareamento é por GEOMETRIA: o input do título fica 27px acima do rótulo da página, com
// folga constante. Pego o retângulo do rótulo "Página N" e escolho o input mais próximo acima dele,
// até 40px. Não depende da estrutura da árvore, que é justamente a parte que eu não controlo.
//
// E TEM UMA TRAVA: antes de escrever, confiro que o valor atual do input é exatamente o que eu
// espero encontrar naquela página. Se não for, pulo e reporto. Com isso, escrever na página errada
// deixa de ser possível — no pior caso não escrevo em lugar nenhum.
import { readFileSync } from 'fs';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';
import { chromium } from 'playwright-core';

const APPLY = process.argv.includes('--apply');
const TIPO = process.argv.find(a => a.startsWith('--tipo='))?.slice('--tipo='.length) ?? 'transformacao';
const CDP = 'http://127.0.0.1:9222';
const ALTURA = 521;   // altura de uma página na lista lateral, medida no próprio DOM

const b = await chromium.connectOverCDP(CDP).catch(() => null);
if (!b) {
  console.error(`Não achei o Chrome em ${CDP}.`);
  console.error('Abra assim, faça login no Canva e deixe o projeto aberto:');
  console.error('  chrome.exe --remote-debugging-port=9222 --user-data-dir=<pasta própria>');
  process.exit(1);
}
const p = b.contexts()[0].pages().find(x => x.url().includes('/design/'));
if (!p) { console.error('nenhuma aba com um design do Canva aberto'); process.exit(1); }

const rola = y => p.evaluate(t => {
  const el = [...document.querySelectorAll('*')].find(e => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > 20000);
  if (el) el.scrollTop = t;
}, Math.max(0, y));

/** Os nomes de todas as páginas, varrendo a lista de cima a baixo. */
async function nomesAtuais(quantas) {
  const m = new Map();
  for (let y = 0; y <= quantas * ALTURA + 800 && m.size < quantas; y += 260) {
    const achou = await p.evaluate(t => {
      const el = [...document.querySelectorAll('*')].find(e => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > 20000);
      if (el) el.scrollTop = t;
      return [...document.querySelectorAll('[aria-label]')]
        .map(e => e.getAttribute('aria-label')).filter(x => /^P.gina \d+/.test(x || ''));
    }, y);
    for (const a of achou) {
      const g = /^P.gina (\d+)(?:,\s*(.+))?$/.exec(a);
      if (g) m.set(Number(g[1]), g[2] ? g[2].trim() : '');
    }
    await p.waitForTimeout(210);
  }
  return m;
}

/** O input do título da página N, pela posição na tela. */
const achaInput = pag => p.evaluateHandle(n => {
  const lbl = [...document.querySelectorAll('[aria-label]')]
    .find(e => new RegExp('^P.gina ' + n + '(,|$)').test(e.getAttribute('aria-label') || ''));
  if (!lbl) return null;
  const topo = lbl.getBoundingClientRect().top;
  let melhor = null, dist = 1e9;
  document.querySelectorAll('input[aria-label="Título da página"]').forEach(inp => {
    const d = topo - inp.getBoundingClientRect().top;
    if (d >= 0 && d < 40 && d < dist) { dist = d; melhor = inp; }
  });
  return melhor;
}, pag);

// ---------------------------------------------------------------- o alvo, do banco
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(achaChave(), 'utf8'))) });
const cl = (await admin.firestore().collection('imageChecklist').get()).docs.map(d => d.data());
const itens = cl.filter(c => (c.type ?? 'evento') === TIPO).sort((a, b) => a.order - b.order);
const alvoDe = i => `${itens[i - 1].temporada} - ${itens[i - 1].name}`;

console.log(`itens no Painel: ${itens.length}`);
const atuais = await nomesAtuais(itens.length);
console.log(`nomes lidos no Canva: ${atuais.size}\n`);

const plano = [];
for (let pos = 1; pos <= itens.length; pos++) {
  const atual = (atuais.get(pos) ?? '').trim();
  const alvo = alvoDe(pos);
  if (atual !== alvo) plano.push({ pos, atual, alvo });
}

console.log(`${plano.length} a renomear:`);
for (const x of plano) console.log(`  ${String(x.pos).padStart(2)}  ${(x.atual || '(sem nome)').padEnd(44)} → ${x.alvo}`);

if (!APPLY) { console.log('\n(modo seco — nada escrito)'); await b.close(); process.exit(0); }

// ---------------------------------------------------------------- escrita
console.log('\nescrevendo…\n');
let ok = 0;
const pulou = [];

for (const x of plano) {
  let el = null;
  for (const y of [(x.pos - 1) * ALTURA - 300, (x.pos - 1) * ALTURA - 100, (x.pos - 1) * ALTURA - 550]) {
    await rola(y);
    await p.waitForTimeout(1100);
    el = (await achaInput(x.pos)).asElement();
    if (el) break;
  }
  if (!el) { pulou.push(`${x.pos} (não renderizou)`); console.log(`  --  ${x.pos}  não consegui achar o input`); continue; }

  // A TRAVA: só escrevo se o que está lá é o que eu esperava encontrar.
  const valor = (await el.inputValue()).trim();
  const esperado = x.atual || 'Adicionar título à página';
  if (valor !== esperado && valor !== x.atual) {
    pulou.push(`${x.pos} (achei "${valor}", esperava "${esperado}")`);
    console.log(`  --  ${x.pos}  TRAVA: input diz "${valor}", eu esperava "${esperado}" — não escrevi`);
    continue;
  }

  await el.fill(x.alvo);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1200);

  const conf = await p.evaluate(n => {
    const e = [...document.querySelectorAll('[aria-label]')].find(z => new RegExp('^P.gina ' + n + ',').test(z.getAttribute('aria-label') || ''));
    return e ? e.getAttribute('aria-label') : null;
  }, x.pos);

  if (conf === `Página ${x.pos}, ${x.alvo}`) { ok++; console.log(`  ok  ${String(x.pos).padStart(2)}  ${x.alvo}`); }
  else { pulou.push(`${x.pos} (ficou "${conf}")`); console.log(`  !!  ${x.pos}  esperava "${x.alvo}", ficou "${conf}"`); }
}

console.log(`\nrenomeadas: ${ok} de ${plano.length}`);
if (pulou.length) console.log(`não resolvidas: ${pulou.join(' | ')}`);
await b.close();
process.exit(0);
