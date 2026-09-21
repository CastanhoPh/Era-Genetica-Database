// Autoriza a integração do Canva e guarda o token. Roda uma vez.
//
//   npm run canva:login                      passo 1 — imprime o endereço para abrir no navegador
//   npm run canva:login -- "<url colada>"    passo 2 — troca o código pelo token
//
// SÃO DOIS PASSOS, E NÃO UM SERVIDOR LOCAL, de propósito. A primeira versão subia um servidor em
// 127.0.0.1:3001 para receber o redirecionamento sozinho — o jeito clássico. Não funciona aqui: os
// comandos rodam num ambiente isolado, com rede própria, e a porta aberta lá dentro não existe para
// o navegador do Pedro. O browser dava ERR_CONNECTION_REFUSED com o servidor vivo e escutando.
//
// Então o navegador continua batendo em 127.0.0.1:3001 e continua dando erro — e TUDO BEM. O que
// importa é a barra de endereços: o Canva já colocou lá o `code` e o `state`. Copiar essa URL e
// colar aqui faz o mesmo papel que o servidor faria.
//
// O `code_verifier` do PKCE é sorteado no passo 1 e precisa sobreviver até o passo 2, que é outro
// processo. Por isso ele é gravado no arquivo de configuração e apagado assim que o token chega:
// ele não tem valor depois da troca, e código de autorização vence em minutos.
import { randomBytes, createHash } from 'crypto';
import { leConfig, gravaConfig, basic } from './lib/canva.mjs';

const AUTORIZA = 'https://www.canva.com/api/oauth/authorize';
const TOKEN = 'https://api.canva.com/rest/v1/oauth/token';
// `folder:read` entrou depois dos outros três: o Pedro organiza os oito projetos oficiais dentro de
// uma pasta chamada "Era Genética", e sem esse escopo eu só consigo listar os 113 designs soltos da
// conta — onde existem três "Linha do Tempo" e quatro "Eventos" com nomes idênticos. A pasta é o
// que diz qual é o oficial.
// `asset:write` e `folder:write` entraram em 21/09/2026, para reconstruir o projeto Arsenal: subir
// cada arte como asset, criar um design de uma página com ela e mesclar no projeto. Os designs
// intermediários vão para uma pasta temporária que é apagada no fim — apagar pasta manda o
// conteúdo para a lixeira, e é isso que impede 78 designs de lixo de ficarem soltos na conta.
const ESCOPOS = ['design:meta:read', 'design:content:read', 'design:content:write',
  'folder:read', 'folder:write', 'asset:read', 'asset:write'];

// base64url = base64 sem padding e com os dois caracteres trocados; é o que o PKCE pede.
const b64url = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const c = leConfig();
const colada = process.argv.slice(2).find(a => a.includes('code='));

// ---------------------------------------------------------------- passo 1
if (!colada) {
  const verifier = b64url(randomBytes(64));          // 86 caracteres, dentro dos 43-128 da spec
  const state = b64url(randomBytes(16));
  gravaConfig({ ...c, pkce: { verifier, state } });

  const url = `${AUTORIZA}?` + new URLSearchParams({
    client_id: c.client_id,
    response_type: 'code',
    redirect_uri: c.redirect_uri,
    scope: ESCOPOS.join(' '),
    code_challenge: b64url(createHash('sha256').update(verifier).digest()),
    code_challenge_method: 's256',
    state,
  });

  console.log('\n1. Abra este endereço no navegador, logado na conta do Canva:\n');
  console.log(url);
  console.log('\n2. Autorize. O navegador vai dar erro de conexão em 127.0.0.1 — isso é esperado.');
  console.log('3. Copie a URL INTEIRA da barra de endereços e rode:\n');
  console.log('   npm run canva:login -- "<url colada>"\n');
  process.exit(0);
}

// ---------------------------------------------------------------- passo 2
if (!c.pkce?.verifier) {
  console.error('\nNão achei o code_verifier guardado. Rode `npm run canva:login` sem argumento primeiro.');
  process.exit(1);
}

const veio = new URL(colada);
const erro = veio.searchParams.get('error');
if (erro) {
  console.error(`\nO Canva recusou: ${erro} ${veio.searchParams.get('error_description') ?? ''}`);
  process.exit(1);
}

// O `state` é conferido porque sem isso um redirecionamento de outra conta, colado por engano,
// gravaria o token errado sem nenhum aviso.
if (veio.searchParams.get('state') !== c.pkce.state) {
  console.error('\nO `state` da URL não é o que eu sorteei. Refaça o passo 1 — não gravei nada.');
  process.exit(1);
}

const r = await fetch(TOKEN, {
  method: 'POST',
  headers: { Authorization: basic(c), 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: veio.searchParams.get('code'),
    code_verifier: c.pkce.verifier,
    redirect_uri: c.redirect_uri,
  }),
});
const corpo = await r.json();
if (!r.ok) {
  console.error(`\nA troca do código falhou (${r.status}): ${JSON.stringify(corpo)}`);
  console.error('Se diz que o código expirou, refaça o passo 1 — eles valem poucos minutos.');
  process.exit(1);
}

const { pkce, ...resto } = c;                        // o verifier não serve para mais nada
gravaConfig({
  ...resto,
  access_token: corpo.access_token,
  refresh_token: corpo.refresh_token,
  expira_em: Date.now() + corpo.expires_in * 1000,
  escopos: corpo.scope,
});

console.log('\nautorizado.');
console.log('  escopos :', corpo.scope);
console.log('  validade:', Math.round(corpo.expires_in / 3600), 'horas (renova sozinho daqui pra frente)');
