// Acha a chave de serviço do Admin SDK — e garante que ela é DESTE projeto.
//
// A versão anterior pegava simplesmente o "*firebase-adminsdk*.json" mais recente da pasta
// Downloads. Em 31/08/2026 uma chave de outro projeto (spotfinder-original) caiu ali e passou a ser
// a mais recente: todo script do repo começou a apontar pro Firebase errado. Deu
// PERMISSION_DENIED por sorte — se as duas contas tivessem permissão, teria gravado no banco errado
// sem avisar.
//
// Agora o project_id é conferido antes de devolver o caminho. SERVICE_ACCOUNT_KEY_PATH continua
// tendo prioridade, mas também é conferido.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import os from 'os';

export const PROJETO = 'era-genetica-db';

const leProjeto = caminho => {
  try { return JSON.parse(readFileSync(caminho, 'utf8')).project_id ?? null; } catch { return null; }
};

export function achaChave({ projeto = PROJETO } = {}) {
  if (process.env.SERVICE_ACCOUNT_KEY_PATH) {
    const p = process.env.SERVICE_ACCOUNT_KEY_PATH;
    const dela = leProjeto(p);
    if (dela !== projeto) {
      throw new Error(`SERVICE_ACCOUNT_KEY_PATH aponta pro projeto "${dela ?? 'ilegível'}", não "${projeto}": ${p}`);
    }
    return p;
  }
  const downloads = join(os.homedir(), 'Downloads');
  const todas = readdirSync(downloads)
    .filter(f => /firebase-adminsdk.*\.json$/i.test(f))
    .map(f => join(downloads, f))
    .filter(f => statSync(f).size > 0);
  const certas = todas
    .filter(f => leProjeto(f) === projeto)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!certas.length) {
    const outras = todas.map(f => `${f} (projeto ${leProjeto(f) ?? '?'})`).join('\n    ');
    throw new Error(
      `Nenhuma chave do projeto "${projeto}" em ${downloads}.` +
      (outras ? `\n  Chaves encontradas, todas de outro projeto:\n    ${outras}` : '') +
      `\n  Gere uma no Console Firebase ou defina SERVICE_ACCOUNT_KEY_PATH.`,
    );
  }
  return certas[0];
}
