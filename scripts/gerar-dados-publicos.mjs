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
// O banco público inteiro tem 364 KB comprimido. Então não faz sentido pagar por documento: o
// deploy pergunta uma vez, escreve o resultado em arquivo, e o Hosting serve do CDN sem cobrar por
// acesso. O visitante passa a fazer ZERO leitura de Firestore.
//
// POR QUE O NOME TEM HASH
//
// A primeira versão gravava `personagens.json` e confiava no `Cache-Control: no-cache` do
// firebase.json, no entendimento de que "no-cache" significa "revalide" e o navegador receberia 304
// sem corpo. Medido em produção, não é o que acontece: com `no-cache` o Hosting responde 200 com o
// corpo inteiro mesmo recebendo `If-None-Match`, e cada recarga rebaixava 269 KB. O `/assets/**`, que
// é `immutable`, devolve 304 com 0 bytes — ou seja, o 304 existe, o `no-cache` é que o desliga.
//
// Então o nome carrega o hash do conteúdo, como o Vite faz com o JS: arquivo novo tem nome novo, o
// antigo pode ser cacheado para sempre, e recarregar a página não baixa nada. Os nomes vão para
// `data/dados-versao.ts`, que entra no bundle — e o bundle também tem hash, então a cadeia toda se
// invalida sozinha quando os dados mudam.
//
// O que NÃO entra: `aFazer` e `prototypeEntries`. As regras do Firestore só liberam leitura delas
// para o admin, e um arquivo no Hosting é público por definição — publicar as duas aqui vazaria
// anotação interna e spoiler de personagem que ainda não apareceu na história.
//
// O Firestore continua sendo a fonte da verdade. Estes arquivos são um retrato dele, e o Painel
// segue lendo ao vivo: quem edita precisa ver a própria edição na hora.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash, } from 'crypto';
import { gzipSync } from 'zlib';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(ROOT, 'public', 'dados');
const VERSAO = join(ROOT, 'data', 'dados-versao.ts');

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(achaChave(), 'utf8'))) });
const db = admin.firestore();

// A ordenação é a MESMA das subscribe* em data/firestore.ts. É de propósito: assim o consumidor
// recebe o array já na ordem que esperava e nenhuma tela precisa saber de onde o dado veio.
const COLECOES = [
  { colecao: 'characters', arquivo: 'personagens', ordena: (a, b) => a.id - b.id },
  { colecao: 'arsenal', arquivo: 'arsenal', ordena: (a, b) => a.id - b.id },
  { colecao: 'imageChecklist', arquivo: 'checklist', ordena: (a, b) => a.order - b.order },
];

mkdirSync(SAIDA, { recursive: true });

const nomes = {};
let bytes = 0;
let comprimido = 0;
for (const { colecao, arquivo, ordena } of COLECOES) {
  const snap = await db.collection(colecao).get();
  const dados = snap.docs.map(d => ({ ...d.data(), docId: d.id })).sort(ordena);
  // Sem indentação: são dados de máquina, e o espaço em branco seria ~30% do arquivo.
  const json = JSON.stringify(dados);
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 8);
  const nome = `${arquivo}-${hash}.json`;
  writeFileSync(join(SAIDA, nome), json, 'utf8');
  nomes[arquivo] = nome;
  const gz = gzipSync(json).length;
  bytes += json.length;
  comprimido += gz;
  console.log(`${nome.padEnd(26)} ${String(dados.length).padStart(5)} docs · ${(json.length / 1024).toFixed(0).padStart(5)} KB · ${(gz / 1024).toFixed(0).padStart(4)} KB gzip`);
}

// Geração anterior fora: com nome por hash, os antigos ficariam acumulando na pasta e subindo no
// deploy para sempre. Quem ainda tiver o nome velho em cache não é afetado — ele está no cache dele.
const atuais = new Set(Object.values(nomes));
const velhos = readdirSync(SAIDA).filter(f => f.endsWith('.json') && !atuais.has(f));
velhos.forEach(f => unlinkSync(join(SAIDA, f)));
if (velhos.length) console.log(`\n${velhos.length} arquivo(s) da geração anterior removidos`);

const ts = `// GERADO por scripts/gerar-dados-publicos.mjs — não editar à mão.
//
// O nome de cada arquivo carrega o hash do conteúdo, então ele pode ser cacheado para sempre
// (firebase.json marca /dados/** como immutable) e este módulo é o que aponta para a versão atual.
// Como o bundle também tem hash no nome, dado novo gera JSON novo, que gera bundle novo — a cadeia
// de cache se invalida inteira sozinha.
export const ARQUIVOS_DE_DADOS = ${JSON.stringify(nomes, null, 2).replace(/"([a-z]+)":/g, '$1:')} as const;
`;
writeFileSync(VERSAO, ts, 'utf8');

console.log(`\n${(bytes / 1024).toFixed(0)} KB no total, ${(comprimido / 1024).toFixed(0)} KB comprimido — em public/dados/`);
console.log('data/dados-versao.ts atualizado');
console.log(`custo desta geração: ${COLECOES.length} consultas, uma vez, em vez de por visitante`);
process.exit(0);
