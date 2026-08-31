// Baixa a arte do Storage para as pastas locais dos projetos do Canva.
//
//   npm run canva:export             confere (não escreve nada)
//   npm run canva:export:apply       baixa o que falta
//   ... --rebaixar                   troca também os que existem com tamanho diferente
//
// Uma pasta por projeto, e dentro dela um arquivo por página, com prefixo numérico — é só o prefixo
// que garante a ordem no import do Canva. O nome é o mesmo do checklist, então a página do Canva e a
// linha do painel se reconhecem.
//
// Só baixa o que FALTA. Arquivo que já existe fica como está mesmo se o tamanho diferir do Storage:
// o arquivo local é o export do Canva e a cópia no Storage é derivada dele, então diferença de
// alguns bytes entre dois exports do mesmo design é normal, não é arquivo velho. As diferenças saem
// no relatório, e --rebaixar força a troca.
//
// O nome desejado é calculado para TODA página, com arte no site ou sem. Página sem arte publicada
// pode muito bem ter export local, e não pode virar "arquivo sobrando" por causa disso.
//
// Sobrando é o arquivo que não corresponde a página nenhuma — item renomeado ou reordenado, que
// viraria página duplicada no import. Esse vai para _antigos/ em vez de ser apagado.
import { readdirSync, statSync, readFileSync, existsSync, mkdirSync, renameSync, rmdirSync } from 'fs';
import { join } from 'path';
import os from 'os';
import admin from 'firebase-admin';

// Quantos itens listar nas amostras do relatório. Seis basta no dia a dia; CANVA_LISTA=999
// solta a lista inteira, que é o que serve quando há dezenas de divergências para conferir.
const LISTA = Number(process.env.CANVA_LISTA ?? 6);
const APPLY = process.argv.includes('--apply');
const REBAIXAR = process.argv.includes('--rebaixar');
const BUCKET = 'era-genetica-db.firebasestorage.app';
const BASE = process.argv.find(a => a.startsWith('--base='))?.slice('--base='.length)
  ?? 'C:/Users/PedroCastanho/OneDrive - Teddy Open Finance/Área de Trabalho/Canva';

// A ordem é a dos projetos no Canva. `pasta` é o nome em disco, que não segue o rótulo da interface:
// a pasta é "Capas Personagens" e o filtro do painel diz "Capas de Personagens".
const PROJ = [
  { tipo: 'timeline', pasta: 'Linha do Tempo', tam: '1080x1620' },
  { tipo: 'transformacao', pasta: 'Modos e Transformações', tam: '1080x1620' },
  { tipo: 'capa', pasta: 'Capas Personagens', tam: '1024x768' },
  { tipo: 'capaInvocacao', pasta: 'Capas Invocações', tam: '1024x768' },
  { tipo: 'invocacao', pasta: 'Invocações', tam: '1024x768' },
  { tipo: 'arsenal', pasta: 'Arsenal', tam: '1080x1080' },
  { tipo: 'evento', pasta: 'Eventos', tam: '1600x900' },
];

const d = join(os.homedir(), 'Downloads');
const chave = readdirSync(d).filter(f => /firebase-adminsdk.*\.json$/i.test(f))
  .map(f => ({ full: join(d, f), m: statSync(join(d, f)).mtimeMs, s: statSync(join(d, f)).size }))
  .filter(f => f.s > 0).sort((a, b) => b.m - a.m)[0];
if (!chave) { console.error('não achei a chave de serviço em ~/Downloads'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(chave.full, 'utf8'))), storageBucket: BUCKET });
const db = admin.firestore();
const bucket = admin.storage().bucket();

if (!existsSync(BASE)) { console.error(`pasta não encontrada: ${BASE}`); process.exit(1); }

const cl = (await db.collection('imageChecklist').get()).docs.map(x => x.data());

// Um listing só, em vez de getMetadata por item: dá o tamanho de tudo de uma vez.
const [objetos] = await bucket.getFiles();
const tamanhoRemoto = new Map(objetos.map(o => [o.name, Number(o.metadata.size)]));

const limpa = s => s.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
const caminhoDe = url => {
  const m = url.split('/o/')[1];
  return m ? decodeURIComponent(m.split('?')[0]) : null;
};
const tituloDe = (tipo, i) => tipo === 'capa' ? i.temporada
  : tipo === 'evento' ? [i.temporada, i.arco, i.subarco, i.name].filter(Boolean).join(' - ')
    : (tipo === 'invocacao' || tipo === 'capaInvocacao' || tipo === 'arsenal') ? i.name
      : `${i.temporada} - ${i.arco}`;

const baixar = [], sumidos = [], mover = [], renomear = [], difere = [];
let jaOk = 0, semArte = 0;

for (const p of PROJ) {
  const itens = cl.filter(i => (i.type ?? 'evento') === p.tipo).sort((a, b) => a.order - b.order);
  const largura = String(itens.length).length;
  const dir = join(BASE, p.pasta);
  const querem = new Set();
  let comArte = 0, faltando = 0, trocar = 0;

  itens.forEach((i, k) => {
    const caminho = i.imageUrl ? caminhoDe(i.imageUrl) : null;
    if (i.imageUrl && !caminho) sumidos.push(`${p.pasta}: URL ilegível em "${tituloDe(p.tipo, i)}"`);
    if (caminho && !tamanhoRemoto.has(caminho)) sumidos.push(`${p.pasta}: no Firestore mas não no Storage — ${caminho}`);
    const remoto = caminho ? tamanhoRemoto.get(caminho) : undefined;

    // O nome é reservado mesmo sem arte publicada. A extensão vem do Storage quando existe; png é o
    // padrão dos sete projetos.
    const ext = caminho?.match(/\.(\w+)$/)?.[1].toLowerCase() ?? 'png';
    const arquivo = `${String(k + 1).padStart(largura, '0')} - ${limpa(tituloDe(p.tipo, i))}.${ext}`;
    querem.add(arquivo);

    if (remoto === undefined) { semArte++; return; }
    comArte++;
    const destino = join(dir, arquivo);
    const local = existsSync(destino) ? statSync(destino).size : -1;
    if (local === -1) { faltando++; baixar.push({ caminho, destino, dir, arquivo, pasta: p.pasta }); return; }
    if (local === remoto) { jaOk++; return; }
    // Existe com outro tamanho: divergência, não lacuna. Só troca se pedirem.
    difere.push({ pasta: p.pasta, arquivo, local, remoto });
    if (REBAIXAR) { trocar++; baixar.push({ caminho, destino, dir, arquivo, pasta: p.pasta }); }
  });

  const tem = existsSync(dir)
    ? readdirSync(dir).filter(f => statSync(join(dir, f)).isFile())
    : [];
  const sobrando = tem.filter(f => !querem.has(f));

  // Um evento novo no meio empurra o prefixo de todos os seguintes, e aí 170 arquivos certos
  // apareceriam como sobrando. Se o nome depois do prefixo é o mesmo, é renumeração: renomeia.
  //
  // O destino pode estar ocupado pelo arquivo que TAMBÉM vai ser renomeado — numa renumeração em
  // cadeia isso vale para todos. Então o critério não é "destino vago em disco", é "ninguém mais
  // reivindicou": quem já está com o nome certo reivindica o seu, e o resto disputa o que sobrou.
  // A execução passa por uma pasta temporária, senão a cadeia se sobrescreve.
  //
  // A extensão entra no nome comparado de propósito: se a arte no site é jpeg e o export local é
  // png, o certo é baixar, não renomear um png para .jpeg.
  const semPrefixo = f => f.replace(/^\d+ - /, '');
  const porTitulo = new Map();
  querem.forEach(q => porTitulo.set(semPrefixo(q), q));
  const reivindicado = new Set(tem.filter(f => querem.has(f)));
  const renomeia = [];
  for (const f of sobrando) {
    const alvo = porTitulo.get(semPrefixo(f));
    if (alvo && !reivindicado.has(alvo)) {
      reivindicado.add(alvo);
      renomeia.push({ dir, de: f, para: alvo, pasta: p.pasta });
    } else {
      mover.push({ dir, arquivo: f, pasta: p.pasta });
    }
  }
  renomear.push(...renomeia);

  // Renomear tapa a lacuna: o que ia ser baixado com esse nome já vai existir.
  const tapados = new Set(renomeia.map(r => r.para));
  for (let x = baixar.length - 1; x >= 0; x--) {
    if (baixar[x].dir === dir && tapados.has(baixar[x].arquivo)) { baixar.splice(x, 1); faltando--; }
  }

  const nota = [
    faltando ? `${faltando} a baixar` : null,
    trocar ? `${trocar} a trocar` : null,
    renomeia.length ? `${renomeia.length} a renumerar` : null,
    sobrando.length - renomeia.length ? `${sobrando.length - renomeia.length} sobrando` : null,
  ].filter(Boolean).join(' · ') || 'em dia';
  console.log(`${p.pasta.padEnd(24)} ${String(itens.length).padStart(3)} pág · ${String(comArte).padStart(3)} com arte · ${p.tam.padEnd(9)} ${nota}`);
}

console.log(`\n${jaOk} arquivo(s) já iguais ao Storage · ${baixar.length} a baixar · ${mover.length} a mover para _antigos`);
console.log(`${semArte} página(s) sem arte publicada — nome reservado, nada a baixar`);
if (difere.length) {
  // Abaixo de 0,1% é o mesmo design exportado duas vezes pelo Canva — ruído de compressão. Acima
  // disso o arquivo local e a arte publicada são imagens diferentes de verdade, e aí só o Pedro sabe
  // qual das duas vale.
  const ruido = difere.filter(x => Math.abs(x.local - x.remoto) / x.remoto < 0.001);
  console.log(`\n${difere.length} arquivo(s) com tamanho diferente do Storage (mantidos; --rebaixar troca)`);
  console.log(`   ${ruido.length} com diferença abaixo de 0,1% — mesmo design, outro export`);
  console.log(`   ${difere.length - ruido.length} com diferença real — arquivo local e arte do site divergem`);
  difere.filter(x => !ruido.includes(x)).slice(0, LISTA)
    .forEach(x => console.log(`      ${x.pasta}/${x.arquivo} — local ${x.local} vs storage ${x.remoto}`));
}
if (sumidos.length) {
  console.log(`\n${sumidos.length} problema(s):`);
  sumidos.slice(0, Math.max(10, LISTA)).forEach(x => console.log(`   ${x}`));
}

if (!APPLY) {
  if (baixar.length) {
    console.log('\nexemplos do que baixaria:');
    baixar.slice(0, LISTA).forEach(b => console.log(`   ${b.pasta}/${b.arquivo}`));
  }
  // Estes saem inteiros, não por amostra: é o único grupo que perde o lugar, e cada um merece olhada.
  if (mover.length) {
    console.log(`\ntodos os ${mover.length} que iriam para _antigos:`);
    mover.forEach(b => console.log(`   ${b.pasta}/${b.arquivo}`));
  }
  console.log('\nDry run. Rode com --apply para escrever.');
  process.exit(0);
}

// A ordem aqui importa. Primeiro sai o que sobrou, depois a renumeração passa por uma pasta
// temporária, e só então o download preenche as lacunas. Baixar antes sobrescreveria arte que ainda
// ia ser renomeada.
for (const m of mover) {
  const velho = join(m.dir, '_antigos');
  mkdirSync(velho, { recursive: true });
  renameSync(join(m.dir, m.arquivo), join(velho, m.arquivo));
}
if (mover.length) console.log(`${mover.length} arquivo(s) movidos para _antigos/`);

// Duas etapas: todos para a pasta de passagem já com o nome novo, e só depois de volta. Numa cadeia
// (037 vira 038, 038 vira 039...) renomear no lugar sobrescreveria o vizinho.
const dirsRen = [...new Set(renomear.map(r => r.dir))];
for (const dir of dirsRen) {
  const passagem = join(dir, '_renumerando');
  mkdirSync(passagem, { recursive: true });
  for (const r of renomear.filter(x => x.dir === dir)) {
    renameSync(join(dir, r.de), join(passagem, r.para));
  }
  for (const r of renomear.filter(x => x.dir === dir)) {
    if (existsSync(join(dir, r.para))) throw new Error(`destino ocupado ao renumerar: ${r.para}`);
    renameSync(join(passagem, r.para), join(dir, r.para));
  }
  rmdirSync(passagem);
}
if (renomear.length) console.log(`${renomear.length} arquivo(s) renumerados.`);

let n = 0;
const fila = [...baixar];
const trabalhador = async () => {
  while (fila.length) {
    const b = fila.pop();
    mkdirSync(b.dir, { recursive: true });
    await bucket.file(b.caminho).download({ destination: b.destino });
    if (++n % 25 === 0) console.log(`   ${n}/${baixar.length}`);
  }
};
await Promise.all(Array.from({ length: 8 }, trabalhador));
console.log(`\n${n} arquivo(s) baixados.`);

// Confere: cada arquivo baixado tem de ter o tamanho do objeto remoto.
const ruins = baixar.filter(b => !existsSync(b.destino) || statSync(b.destino).size !== tamanhoRemoto.get(b.caminho));
console.log(ruins.length ? `ATENÇÃO: ${ruins.length} arquivo(s) com tamanho errado` : 'todos com o tamanho do original.');
for (const p of PROJ) {
  const dir = join(BASE, p.pasta);
  const q = existsSync(dir) ? readdirSync(dir).filter(f => statSync(join(dir, f)).isFile()).length : 0;
  console.log(`${p.pasta.padEnd(24)} ${String(q).padStart(3)} arquivo(s)`);
}
process.exit(ruins.length ? 1 : 0);
