// Cria as páginas EM BRANCO que faltam na pasta local de um projeto do Canva.
//
//   node scripts/canva-brancos.mjs --tipo=arsenal            confere, não escreve
//   node scripts/canva-brancos.mjs --tipo=arsenal --apply    cria os arquivos
//
// Regra do Pedro: o Canva espelha o Painel 1 para 1. Item que ainda não tem arte ocupa posição,
// como página em branco — assim a posição N do Canva é sempre o item N da lista, e quando a arte
// ficar pronta ela substitui o branco sem empurrar ninguém.
//
// O `canva-export.mjs` já calcula o nome desejado de TODA página, inclusive das sem arte ("nome
// reservado, nada a baixar"). Este script preenche justamente esses buracos, com o mesmo nome que
// o export reservou — então o arquivo criado aqui não vira "sobrando" na próxima conferência.
//
// O branco é PNG branco opaco, não transparente. Transparência no Canva aparece como xadrez na
// miniatura e confunde quem olha a lista procurando o que falta desenhar.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { deflateSync } from 'zlib';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';

const TIPO = process.argv.find(a => a.startsWith('--tipo='))?.slice('--tipo='.length);
const APPLY = process.argv.includes('--apply');
const BASE = process.argv.find(a => a.startsWith('--base='))?.slice('--base='.length)
  ?? 'C:/Users/PedroCastanho/OneDrive - Teddy Open Finance/Área de Trabalho/Canva';
if (!TIPO) { console.error('faltou --tipo='); process.exit(1); }

// mesma tabela do canva-export.mjs
const PROJ = {
  timeline:      { pasta: 'Linha do Tempo', w: 1080, h: 1620 },
  historico:     { pasta: 'Personagens Históricos', w: 1080, h: 1620, tipo: 'timeline', so: 'historico' },
  capaHistorico: { pasta: 'Capas Personagens Históricos', w: 1024, h: 768, tipo: 'capa', so: 'historico' },
  transformacao: { pasta: 'Modos e Transformações', w: 1080, h: 1620 },
  capa:          { pasta: 'Capas Personagens', w: 1024, h: 768 },
  capaInvocacao: { pasta: 'Capas Invocações', w: 1024, h: 768 },
  invocacao:     { pasta: 'Invocações', w: 1024, h: 768 },
  arsenal:       { pasta: 'Arsenal', w: 1080, h: 1080 },
  evento:        { pasta: 'Eventos', w: 1600, h: 900 },
  tecnica:       { pasta: 'Técnicas', w: 1600, h: 900 },
};
const p = PROJ[TIPO];
if (!p) { console.error(`tipo desconhecido: ${TIPO}`); process.exit(1); }
// `historico` e `capaHistorico` não são tipos do checklist: são recortes de `timeline` e `capa`.
// `p.tipo` diz qual tipo ler e `p.so === 'historico'` diz qual metade ficar.
const TIPO_REAL = p.tipo ?? TIPO;

/** PNG branco, escrito na mão — evita depender de biblioteca de imagem só para isto. */
function pngBranco(w, h) {
  const crcTab = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTab[n] = c >>> 0; }
  const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTab[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const bloco = (tipo, dados) => {
    const t = Buffer.from(tipo, 'ascii');
    const tam = Buffer.alloc(4); tam.writeUInt32BE(dados.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, dados])));
    return Buffer.concat([tam, t, dados, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8 bits, RGB
  // uma linha = 1 byte de filtro + w*3 bytes brancos
  const linha = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0xff)]);
  const cru = Buffer.concat(Array.from({ length: h }, () => linha));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr), bloco('IDAT', deflateSync(cru, { level: 9 })), bloco('IEND', Buffer.alloc(0)),
  ]);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(achaChave(), 'utf8'))) });
const db = admin.firestore();
const cl = (await db.collection('imageChecklist').get()).docs.map(d => d.data());
const fichas = (await db.collection('characters').get()).docs.map(d => d.data());
const historicos = new Set(fichas.filter(c => c.registro === 'historico').map(c => c.name));
const ehHistorico = i => historicos.has(TIPO_REAL === 'capa' ? i.name : i.temporada);
const itens = cl
  .filter(c => (c.type ?? 'evento') === TIPO_REAL && (p.so === 'historico' ? ehHistorico(c) : !ehHistorico(c)))
  .sort((a, b) => a.order - b.order);

// mesma sanitização de nome de arquivo do canva-export.mjs
const limpa = s => s.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();

/**
 * O título do arquivo. É CÓPIA LITERAL do `tituloDe` do canva-export.mjs, e tem que continuar
 * sendo: se as duas regras divergirem, o branco criado aqui não casa com o nome que o export
 * reserva, e ele vira "sobrando" na próxima conferência — ou pior, duplica a página.
 *
 * Foi exatamente o que aconteceu na primeira versão: eu usei `temporada - name` para tudo. Em
 * transformação coincide, porque ali `name` e `arco` são o mesmo. Em EVENTO não: o nome leva
 * temporada, arco, subarco e name, e eu criei 176 arquivos com nome errado que viraram páginas
 * duplicadas na pasta.
 */
const tituloDe = i => TIPO_REAL === 'capa' ? i.temporada
  : TIPO_REAL === 'evento' ? [i.temporada, i.arco, i.subarco, i.name].filter(Boolean).join(' - ')
    : (TIPO_REAL === 'invocacao' || TIPO_REAL === 'capaInvocacao' || TIPO_REAL === 'arsenal') ? i.name
      : `${i.temporada} - ${i.arco}`;
const rotulo = tituloDe;

const pasta = join(BASE, p.pasta);
if (!existsSync(pasta)) { console.error(`pasta não existe: ${pasta}`); process.exit(1); }

const largura = String(itens.length).length;
const faltam = [];
itens.forEach((t, i) => {
  if (t.imageUrl) return;
  const arquivo = `${String(i + 1).padStart(largura, "0")} - ${limpa(rotulo(t))}.png`;
  const caminho = join(pasta, arquivo);
  faltam.push({ pos: i + 1, arquivo, caminho, existe: existsSync(caminho) });
});

console.log(`${p.pasta}  ·  ${itens.length} itens  ·  ${itens.filter(t => t.imageUrl).length} com arte`);
console.log(`brancos necessários: ${faltam.length}   já no disco: ${faltam.filter(f => f.existe).length}\n`);
for (const f of faltam) console.log(`  ${f.existe ? 'ok  ' : 'criar'}  ${f.arquivo}`);

const criar = faltam.filter(f => !f.existe);
if (!criar.length) { console.log('\nnada a fazer'); process.exit(0); }
if (!APPLY) { console.log(`\n(modo seco — ${criar.length} a criar; rode com --apply)`); process.exit(0); }

const png = pngBranco(p.w, p.h);
for (const f of criar) { writeFileSync(f.caminho, png); console.log(`  criado  ${f.arquivo}`); }
console.log(`\n${criar.length} arquivos brancos de ${p.w}x${p.h} criados em ${pasta}`);
process.exit(0);
