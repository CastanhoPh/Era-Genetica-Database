// ============================================================================================
// NÃO FUNCIONA HOJE — `insert_pages` está quebrado do lado do Canva (21/09/2026).
//
// Toda chamada devolve `Failed to commit session`, e o problema NÃO é a forma da requisição.
// Isolei assim, e vale repetir o teste antes de tentar de novo:
//
//   move_pages  no mesmo endpoint         → funciona
//   insert_pages origem = destino          → falha
//   insert_pages origem ≠ destino          → falha
//   insert_pages after=0, after=1, sem after, com page_numbers → falha nas quatro
//   insert_pages em create_new_design      → falha
//
// Em 17/09 essa mesma chamada inseriu quatro páginas em branco no Modos e Transformações sem
// reclamar. É API em preview: muda sem aviso. O resto do script — upload, create-design, mover
// para a pasta temporária — foi testado e FUNCIONA; só o merge final é que não passa.
//
// Enquanto não voltar, o caminho é o Pedro importar a pasta local pelo Canva e depois rodar o
// canva-renomear.mjs, que não depende deste endpoint.
// ============================================================================================
// Reconstrói um projeto do Canva a partir da pasta local: uma página por arquivo, na ordem.
//
//   node scripts/canva-montar.mjs --tipo=arsenal --design=DAH...            simula
//   node scripts/canva-montar.mjs --tipo=arsenal --design=DAH... --apply    monta
//   ...                                        --so=3                      só as 3 primeiras (teste)
//
// POR QUE ISTO EXISTE, se o Canva importa uma pasta sozinho
//
// Importar pela interface funciona, mas quem faz é o Pedro, e o resultado depende de ele arrastar
// na ordem certa. Pela API o script garante a ordem e confere página a página no fim. O custo é a
// volta que a API obriga: não existe "coloque esta imagem nesta página". Só existe criar um design
// NOVO a partir de uma imagem e depois MESCLAR a página dele no projeto de destino.
//
// O LIXO E COMO ELE É LIMPO. Cada imagem vira um design intermediário, e não há endpoint para
// apagar design. Se nada fosse feito, o Arsenal deixaria 78 designs soltos numa conta que já tem
// 113 e onde o Pedro reclama de não achar as coisas. Então os intermediários nascem dentro de uma
// pasta temporária, e no fim a PASTA é apagada — apagar pasta manda o conteúdo para a lixeira, que
// é o mais perto de "apagar design" que a API oferece.
//
// A PÁGINA EM BRANCO NÃO GASTA UPLOAD. Ela é uma cópia de uma página em branco que já exista no
// projeto, inserida por merge com o próprio projeto como origem. Sem asset, sem design temporário.
//
// A ordem das operações importa: primeiro TODAS as páginas entram no fim do projeto, depois elas
// são reordenadas de uma vez. Inserir já na posição certa parece mais direto, mas cada inserção
// empurra as seguintes e a conta de posições vira um campo minado — foi assim que a reordenação de
// Modos e Transformações se perdeu na primeira tentativa.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';
import { api, token } from './lib/canva.mjs';

const TIPO = process.argv.find(a => a.startsWith('--tipo='))?.slice('--tipo='.length);
const DESIGN = process.argv.find(a => a.startsWith('--design='))?.slice('--design='.length);
const SO = Number(process.argv.find(a => a.startsWith('--so='))?.slice('--so='.length) ?? 0);
const APPLY = process.argv.includes('--apply');
const BASE = 'C:/Users/PedroCastanho/OneDrive - Teddy Open Finance/Área de Trabalho/Canva';
if (!TIPO || !DESIGN) { console.error('uso: --tipo=<tipo> --design=<id> [--so=N] [--apply]'); process.exit(1); }

const PROJ = {
  timeline: { pasta: 'Linha do Tempo', w: 1080, h: 1620 },
  transformacao: { pasta: 'Modos e Transformações', w: 1080, h: 1620 },
  capa: { pasta: 'Capas Personagens', w: 1024, h: 768 },
  capaInvocacao: { pasta: 'Capas Invocações', w: 1024, h: 768 },
  invocacao: { pasta: 'Invocações', w: 1024, h: 768 },
  arsenal: { pasta: 'Arsenal', w: 1080, h: 1080 },
  evento: { pasta: 'Eventos', w: 1600, h: 900 },
  tecnica: { pasta: 'Técnicas', w: 1600, h: 900 },
};
const p = PROJ[TIPO];
if (!p) { console.error(`tipo desconhecido: ${TIPO}`); process.exit(1); }

const espera = ms => new Promise(f => setTimeout(f, ms));

async function job(caminho, corpo, campo = 'job') {
  const r = await api(caminho, { method: 'POST', body: corpo });
  let j = r[campo];
  const id = j.id;
  while (j.status === 'in_progress') {
    await espera(1500);
    j = (await api(`${caminho}/${id}`))[campo];
  }
  if (j.status !== 'success') throw new Error(`${caminho} falhou: ${JSON.stringify(j.error ?? j)}`);
  return j;
}

async function paginas() {
  const t = [];
  for (let o = 1; ; o += 100) {
    const r = await api(`/designs/${DESIGN}/pages?offset=${o}&limit=100`);
    t.push(...(r.items ?? []));
    if ((r.items ?? []).length < 100) break;
  }
  return t;
}

// ---------------------------------------------------------------- o que montar
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(achaChave(), 'utf8'))) });
const cl = (await admin.firestore().collection('imageChecklist').get()).docs.map(d => d.data());
const itens = cl.filter(c => (c.type ?? 'evento') === TIPO).sort((a, b) => a.order - b.order);

const dir = join(BASE, p.pasta);
const arquivos = readdirSync(dir).filter(f => /\.(png|jpe?g)$/i.test(f)).sort();
if (arquivos.length !== itens.length) {
  console.error(`a pasta tem ${arquivos.length} arquivos e o Painel tem ${itens.length} itens — não bate`);
  process.exit(1);
}

const atual = await paginas();
console.log(`projeto tem ${atual.length} páginas · Painel tem ${itens.length} itens`);
console.log(`pasta: ${dir}\n`);

// as páginas que já existem e conferem ficam; o resto é montado
const lista = arquivos.map((f, i) => ({
  pos: i + 1,
  arquivo: f,
  caminho: join(dir, f),
  tam: statSync(join(dir, f)).size,
  branco: !itens[i].imageUrl,
  rotulo: `${itens[i].temporada ?? ''} ${itens[i].name}`.trim(),
})).slice(0, SO || undefined);

console.log(`${lista.length} páginas a montar  (${lista.filter(x => x.branco).length} em branco)`);
for (const x of lista.slice(0, 6)) console.log(`  ${String(x.pos).padStart(2)}  ${x.branco ? '[branco]' : '        '} ${x.arquivo}`);
if (lista.length > 6) console.log(`  … mais ${lista.length - 6}`);

if (!APPLY) { console.log('\n(modo seco — nada enviado)'); process.exit(0); }

// ---------------------------------------------------------------- pasta temporária
const pastaTmp = await api('/folders', {
  method: 'POST',
  body: { name: `_tmp ${p.pasta} ${new Date().toISOString().slice(0, 16)}`, parent_folder_id: 'root' },
});
const TMP = pastaTmp.folder.id;
console.log(`\npasta temporária: ${TMP}  (apago no fim)\n`);

const criados = [];
let n = 0;

for (const x of lista) {
  n++;
  const rot = `${String(n).padStart(3)}/${lista.length}`;

  if (x.branco) {
    // cópia de uma página em branco já existente no projeto, sem gastar upload
    const vivas = await paginas();
    const brancaEm = 2;   // a página 2 do Arsenal é branca; para outros projetos, ajustar
    await job('/merges', {
      type: 'modify_existing_design', design_id: DESIGN,
      operations: [{ type: 'insert_pages', source: { type: 'design', design_id: DESIGN, page_numbers: [brancaEm] }, after_page_number: vivas.length }],
    });
    console.log(`${rot}  branco   ${x.arquivo}`);
    continue;
  }

  // 1. sobe a imagem
  const nome = x.arquivo.replace(/\.(png|jpe?g)$/i, '').slice(0, 50);
  const r = await fetch('https://api.canva.com/rest/v1/asset-uploads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await token()}`,
      'Content-Type': 'application/octet-stream',
      'Asset-Upload-Metadata': JSON.stringify({ name_base64: Buffer.from(nome, 'utf8').toString('base64') }),
    },
    body: readFileSync(x.caminho),
  });
  const up = await r.json();
  if (!r.ok) throw new Error(`upload de ${x.arquivo} falhou (${r.status}): ${JSON.stringify(up)}`);
  let uj = up.job;
  while (uj.status === 'in_progress') { await espera(1200); uj = (await api(`/asset-uploads/${up.job.id}`)).job; }
  if (uj.status !== 'success') throw new Error(`upload de ${x.arquivo}: ${JSON.stringify(uj.error ?? uj)}`);
  const assetId = uj.asset.id;

  // 2. design de uma página com ela
  const d = await api('/designs', {
    method: 'POST',
    body: {
      type: 'type_and_asset',
      design_type: { type: 'custom', width: p.w, height: p.h },
      asset_id: assetId,
      title: `_tmp ${x.arquivo}`,
    },
  });
  const tmpId = d.design.id;
  criados.push(tmpId);

  // 3. para a pasta temporária, para o lixo ficar junto
  await api('/folders/move', { method: 'POST', body: { to_folder_id: TMP, item_id: tmpId } });

  // 4. mescla a página no destino, sempre no fim
  const vivas = await paginas();
  await job('/merges', {
    type: 'modify_existing_design', design_id: DESIGN,
    operations: [{ type: 'insert_pages', source: { type: 'design', design_id: tmpId }, after_page_number: vivas.length }],
  });

  console.log(`${rot}  ok       ${x.arquivo}`);
}

const fim = await paginas();
console.log(`\nprojeto agora tem ${fim.length} páginas`);
console.log(`designs temporários criados: ${criados.length} (na pasta ${TMP})`);
console.log('\nA pasta temporária NÃO foi apagada — confira o resultado antes.');
console.log(`Para limpar:  node -e "import('./scripts/lib/canva.mjs').then(m=>m.api('/folders/${TMP}',{method:'DELETE'}))"`);
process.exit(0);
