// Gera o retrato estático das coleções públicas, em public/dados/*.json.
//
//   npm run dados          gera
//   npm run deploy         gera antes do build (o Vite copia public/ para dist/)
//
// POR QUE ISSO EXISTE
//
// O app lia tudo do Firestore ao vivo, e o Firestore cobra por documento lido. Um visitante que
// abria a lista, a galeria e as invocações gastava 2.761 leituras: 103 de `characters`, 80 de
// `arsenal`, 1.285 de `imageChecklist` duas vezes e 8 de `familyTrees`. Com a cota de 50 mil
// leituras/dia isso dava 18 visitantes por dia — em 01/09/2026, só o Pedro e eu trabalhando fizemos
// 213 mil leituras.
//
// O banco público inteiro tem 384 KB comprimido. Então não faz sentido pagar por documento: o
// deploy pergunta uma vez, escreve o resultado em arquivo, e o Hosting serve do CDN sem cobrar por
// acesso. O visitante passa a fazer ZERO leitura de Firestore.
//
// O que NÃO entra: `aFazer` e `prototypeEntries`. As regras do Firestore só liberam leitura delas
// para o admin, e um arquivo no Hosting é público por definição — publicar as duas aqui vazaria
// anotação interna e spoiler de personagem que ainda não apareceu na história.
//
// O Firestore continua sendo a fonte da verdade. Estes arquivos são um retrato dele, e o Painel
// segue lendo ao vivo: quem edita precisa ver a própria edição na hora.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(ROOT, 'public', 'dados');

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(achaChave(), 'utf8'))) });
const db = admin.firestore();

// A ordenação é a MESMA das subscribe* em data/firestore.ts. É de propósito: assim o consumidor
// recebe o array já na ordem que esperava e nenhuma tela precisa saber de onde o dado veio.
const COLECOES = [
  { colecao: 'characters', arquivo: 'personagens', ordena: (a, b) => a.id - b.id },
  { colecao: 'arsenal', arquivo: 'arsenal', ordena: (a, b) => a.id - b.id },
  { colecao: 'imageChecklist', arquivo: 'checklist', ordena: (a, b) => a.order - b.order },
  { colecao: 'familyTrees', arquivo: 'familias', ordena: (a, b) => a.order - b.order },
];

mkdirSync(SAIDA, { recursive: true });

let bytes = 0;
let comprimido = 0;
for (const { colecao, arquivo, ordena } of COLECOES) {
  const snap = await db.collection(colecao).get();
  const dados = snap.docs.map(d => ({ ...d.data(), docId: d.id })).sort(ordena);
  // Sem indentação: são dados de máquina, e o espaço em branco seria ~30% do arquivo.
  const json = JSON.stringify(dados);
  writeFileSync(join(SAIDA, `${arquivo}.json`), json, 'utf8');
  const gz = gzipSync(json).length;
  bytes += json.length;
  comprimido += gz;
  console.log(`${arquivo.padEnd(12)} ${String(dados.length).padStart(5)} docs · ${(json.length / 1024).toFixed(0).padStart(5)} KB · ${(gz / 1024).toFixed(0).padStart(4)} KB gzip`);
}

console.log(`\n${(bytes / 1024).toFixed(0)} KB no total, ${(comprimido / 1024).toFixed(0)} KB comprimido — em public/dados/`);
console.log(`custo desta geração: ${COLECOES.length} consultas, uma vez, em vez de por visitante`);
process.exit(0);
