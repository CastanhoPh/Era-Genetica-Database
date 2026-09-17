// Fala com a Connect API do Canva: guarda o token, renova sozinho e faz as chamadas.
//
// AS CREDENCIAIS VIVEM FORA DO REPOSITÓRIO, em ~/.era-genetica-canva.json. O motivo é o mesmo do
// .gitignore lá em cima: o vite.config.ts injeta variável de ambiente no bundle do cliente, então
// um .env aqui iria parar no site publicado E no histórico do git. O client_secret dá acesso de
// ESCRITA aos designs — ele reordena e apaga página — então não pode encostar em nada versionado.
//
// O token de acesso dura 4 horas e o arquivo guarda o refresh_token junto. Quem chama `token()`
// nunca precisa saber disso: se faltar menos de 5 minutos para vencer, ele renova antes de
// devolver. Cinco minutos de folga porque um `canva:ordenar` de projeto grande leva minutos, e um
// token que vence no meio do lote deixaria metade das páginas movidas.
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

export const CONFIG = join(os.homedir(), '.era-genetica-canva.json');
const TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';
const API = 'https://api.canva.com/rest/v1';

export const leConfig = () => {
  try {
    return JSON.parse(readFileSync(CONFIG, 'utf8'));
  } catch {
    throw new Error(
      `Não achei as credenciais do Canva em ${CONFIG}.\n` +
      `  Crie a integração em https://www.canva.com/developers/integrations e rode: npm run canva:login`,
    );
  }
};

export const gravaConfig = c => writeFileSync(CONFIG, JSON.stringify(c, null, 2) + '\n', 'utf8');

/** O cabeçalho Basic que o endpoint de token exige: base64 de "client_id:client_secret". */
export const basic = c => 'Basic ' + Buffer.from(`${c.client_id}:${c.client_secret}`).toString('base64');

/**
 * Troca o refresh_token por um par novo. O Canva devolve um refresh_token NOVO a cada renovação e
 * invalida o anterior, então o arquivo é regravado na mesma hora — se o processo morrer entre a
 * resposta e a gravação, o próximo login tem que ser pelo navegador de novo.
 */
async function renova(c) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basic(c), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.refresh_token }),
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(`renovação do token falhou (${r.status}): ${JSON.stringify(corpo)}`);
  const novo = {
    ...c,
    access_token: corpo.access_token,
    refresh_token: corpo.refresh_token ?? c.refresh_token,
    expira_em: Date.now() + corpo.expires_in * 1000,
  };
  gravaConfig(novo);
  return novo;
}

/** Devolve um access_token válido, renovando se estiver perto de vencer. */
export async function token() {
  let c = leConfig();
  if (!c.refresh_token) {
    throw new Error(`Ainda não autorizei a integração. Rode: npm run canva:login`);
  }
  if (!c.access_token || Date.now() > (c.expira_em ?? 0) - 5 * 60_000) c = await renova(c);
  return c.access_token;
}

/**
 * Uma chamada à API. `caminho` é relativo a /rest/v1 e já vem com a query montada.
 *
 * O 429 é tratado aqui e não em quem chama porque TODO script deste conjunto esbarra nele: o
 * export tem limite de 750 por 5 minutos e o merge de 100 por minuto. Espera o que o cabeçalho
 * Retry-After mandar e tenta de novo, até três vezes.
 */
export async function api(caminho, opts = {}) {
  const t = await token();
  for (let tentativa = 0; ; tentativa++) {
    const r = await fetch(`${API}${caminho}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${t}`,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (r.status === 429 && tentativa < 3) {
      const espera = Number(r.headers.get('Retry-After') ?? 10) * 1000;
      console.log(`  (429 — esperando ${espera / 1000}s)`);
      await new Promise(f => setTimeout(f, espera));
      continue;
    }
    const corpo = r.status === 204 ? null : await r.json().catch(() => null);
    if (!r.ok) throw new Error(`${opts.method ?? 'GET'} ${caminho} → ${r.status}: ${JSON.stringify(corpo)}`);
    return corpo;
  }
}

/** Percorre uma listagem paginada até o fim e devolve tudo junto. */
export async function tudo(caminho, campo) {
  const saida = [];
  let token;
  do {
    const sep = caminho.includes('?') ? '&' : '?';
    const r = await api(caminho + (token ? `${sep}continuation=${encodeURIComponent(token)}` : ''));
    saida.push(...(r[campo] ?? []));
    token = r.continuation;
  } while (token);
  return saida;
}
