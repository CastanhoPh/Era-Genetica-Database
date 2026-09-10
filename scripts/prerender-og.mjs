// Gera páginas estáticas <slug>.html em dist/ com meta tags Open Graph,
// para que links compartilhados (WhatsApp/Discord) mostrem nome + imagem.
// Roda após o build, lendo os dados públicos do Firestore (API REST).
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const PROJECT = 'era-genetica-db';
const API_KEY = 'AIzaSyD5mgExupTw0hRMPNBDTd2Lzk0frx_lp1o';
const BASE = 'https://era-genetica-db.web.app';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/\n/g, ' ').trim();

// A REST do Firestore devolve o valor etiquetado pelo tipo. Sem o booleanValue aqui, um campo
// booleano virava '' — e foi assim que o filtro de `oculto` passou batido e o stub do Hashirama
// foi pro ar mesmo com a ficha escondida.
// `titles` é uma lista (arrayValue) — sem tratar esse tipo aqui ela virava '' e o título
// nunca aparecia no preview, mesmo com a ficha preenchida.
const fieldStr = (f) => {
  if (!f) return '';
  if ('booleanValue' in f) return f.booleanValue;
  if ('arrayValue' in f) return (f.arrayValue.values || []).map(v => v.stringValue ?? '').filter(Boolean);
  return f.stringValue ?? f.integerValue ?? '';
};

async function fetchCollection(name) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${name}?pageSize=300&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firestore ${name}: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.documents || []).map(doc => {
    const slug = doc.name.split('/').pop();
    const f = doc.fields || {};
    const out = { slug };
    for (const k of Object.keys(f)) out[k] = fieldStr(f[k]);
    return out;
  });
}

function ogTags({ title, description, image, url }) {
  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Era Genética">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    image ? `<meta property="og:image" content="${esc(image)}">` : '',
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    image ? `<meta name="twitter:image" content="${esc(image)}">` : '',
  ].filter(Boolean).join('\n    ');
}

const template = readFileSync(join(DIST, 'index.html'), 'utf8');

/**
 * `caminho` pode ter subpasta — "fukasaku" vira dist/fukasaku.html e "invocacoes/fukasaku" vira
 * dist/invocacoes/fukasaku.html, que o cleanUrls serve em /invocacoes/fukasaku. Arquivo estatico
 * ganha do rewrite de SPA, entao o crawler pega o <head> certo e o navegador segue abrindo o app.
 */
function writeStub(caminho, title, tags) {
  let html = template.replace('</head>', `    ${tags}\n  </head>`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  const destino = join(DIST, `${caminho}.html`);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, html, 'utf8');
}

/** O mesmo slugify do data/firestore.ts, que e o que a aba usa para montar a rota. */
const slugify = (nome) => String(nome)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

/**
 * As invocacoes NAO tem colecao propria: vivem no imageChecklist, uma pagina para a arte e uma
 * para a capa. Leio do retrato publicado em dist/dados em vez da REST — o fetchCollection usa
 * pageSize=300 e o imageChecklist passa de 1300 documentos, entao ele traria a lista truncada sem
 * avisar. E o retrato ja esta pronto quando este script roda.
 */
function leInvocacoes() {
  const versao = readFileSync(join(__dirname, '..', 'data', 'dados-versao.ts'), 'utf8');
  const arquivo = versao.match(/checklist: "(.+?)"/)?.[1];
  if (!arquivo) throw new Error('data/dados-versao.ts sem o nome do checklist');
  const checklist = JSON.parse(readFileSync(join(DIST, 'dados', arquivo), 'utf8'));
  const capas = new Map(checklist.filter(i => i.type === 'capaInvocacao').map(i => [i.name, i]));
  return checklist
    .filter(i => i.type === 'invocacao')
    .sort((a, b) => a.order - b.order)
    .map(i => ({ ...i, capaUrl: capas.get(i.name)?.imageUrl ?? null }));
}

const main = async () => {
  // Ficha `oculto` NAO ganha stub: o /<slug>.html e' URL publica de verdade (cleanUrls), e o
  // <head> entregaria nome, titulo, descricao e capa mesmo com o SPA se recusando a abrir a ficha.
  // Sem este filtro o `oculto` seria so cosmetico contra quem digita o link ou passa um crawler.
  const characters = (await fetchCollection('characters')).filter(c => !c.oculto);
  for (const c of characters) {
    const titulo = Array.isArray(c.titles) ? c.titles[0] : '';
    const descTexto = (c.description || '').slice(0, 170);
    // Só entra o "—" quando tem descrição de verdade depois — senão sobrava um traço solto
    // sem nada atrás (ex.: "Canhão dos Uchiha —").
    const desc = descTexto ? (titulo ? `${titulo} — ${descTexto}` : descTexto) : titulo;
    writeStub(c.slug, `${c.name} | Era Genética`,
      ogTags({ title: c.name, description: desc, image: c.image, url: `${BASE}/${c.slug}` }));
  }

  const arsenal = await fetchCollection('arsenal');
  for (const a of arsenal) {
    const arsenalDescTexto = (a.description || '').slice(0, 170);
    const desc = a.classification ? `[${a.classification}]${arsenalDescTexto ? ` ${arsenalDescTexto}` : ''}` : arsenalDescTexto;
    writeStub(a.slug, `${a.name} | Arsenal — Era Genética`,
      ogTags({ title: a.name, description: desc, image: a.image, url: `${BASE}/${a.slug}` }));
  }

  // A query string nao entra aqui de proposito: o crawler resolve o CAMINHO, entao
  // /invocacoes/fukasaku?familia=Sapos+Sabios cai neste mesmo stub e o preview sai certo com
  // filtro ou sem filtro.
  const invocacoes = leInvocacoes();
  for (const inv of invocacoes) {
    const partes = [
      inv.rank ? `[${inv.rank}]` : '',
      inv.familia || '',
      inv.temporada ? `invocação de ${inv.temporada}` : 'sem invocador',
    ].filter(Boolean);
    const texto = (inv.descricao || '').slice(0, 170);
    const desc = texto ? `${partes.join(' · ')} — ${texto}` : partes.join(' · ');
    // A capa e o retrato 4:3 que o card mostra, e e ela que faz sentido no preview. Pagina em
    // branco nao entra: preview com imagem vazia e pior que preview sem imagem.
    const imagem = inv.placeholder ? '' : (inv.capaUrl || inv.imageUrl || '');
    const rota = `invocacoes/${slugify(inv.name)}`;
    writeStub(rota, `${inv.name} | Invocações — Era Genética`,
      ogTags({ title: inv.name, description: desc, image: imagem, url: `${BASE}/${rota}` }));
  }

  console.log(`Prerender OG: ${characters.length} personagens + ${arsenal.length} armas`
    + ` + ${invocacoes.length} invocações geradas em dist/`);
};

main().catch(e => { console.error('Prerender OG falhou:', e.message); process.exit(1); });
