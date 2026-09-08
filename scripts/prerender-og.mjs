// Gera páginas estáticas <slug>.html em dist/ com meta tags Open Graph,
// para que links compartilhados (WhatsApp/Discord) mostrem nome + imagem.
// Roda após o build, lendo os dados públicos do Firestore (API REST).
import { readFileSync, writeFileSync } from 'fs';
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

function writeStub(slug, title, tags) {
  let html = template.replace('</head>', `    ${tags}\n  </head>`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  writeFileSync(join(DIST, `${slug}.html`), html, 'utf8');
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

  console.log(`Prerender OG: ${characters.length} personagens + ${arsenal.length} armas geradas em dist/`);
};

main().catch(e => { console.error('Prerender OG falhou:', e.message); process.exit(1); });
