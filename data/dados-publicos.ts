import { Character, ChecklistItem, FamilyTree } from '../types';
import { Equipment } from '../types/Equipment';
import { ARQUIVOS_DE_DADOS } from './dados-versao';

/**
 * Leitura das coleções públicas pelo retrato estático em /dados/*.json, gerado no deploy por
 * scripts/gerar-dados-publicos.mjs.
 *
 * O Firestore cobra por documento lido, e o site é conteúdo que muda poucas vezes por dia. Um
 * visitante que abrisse a lista, a galeria e as invocações gastava 2.761 leituras — 18 visitantes
 * esgotavam a cota diária. Buscar um arquivo no Hosting não custa leitura nenhuma, e o banco público
 * inteiro cabe em 384 KB comprimido, menos do que as idas ao Firestore transferiam.
 *
 * O Firestore segue sendo a fonte da verdade: quem edita (Painel e Checklist) continua no
 * `onSnapshot` ao vivo, porque precisa ver a própria edição na hora.
 */

/**
 * Uma promessa por arquivo, guardada. Navegar entre Galeria e Invocações não refaz o download, e
 * duas telas que pedem o mesmo arquivo ao mesmo tempo compartilham a mesma requisição.
 *
 * Isso cobre a navegação dentro da mesma visita. Entre visitas quem cobre é o cache do navegador: o
 * nome do arquivo carrega o hash do conteúdo e o firebase.json marca /dados/** como `immutable`,
 * então recarregar a página não gera requisição nenhuma até os dados mudarem.
 *
 * A primeira versão disto confiava no `no-cache` e num 304 que NÃO acontece — medido em produção, o
 * Hosting com `no-cache` responde 200 com o corpo inteiro mesmo recebendo `If-None-Match`, e cada
 * recarga rebaixava 269 KB. O `/assets/**`, que é immutable, devolve 304 com 0 bytes.
 */
const emAndamento = new Map<string, Promise<unknown>>();

async function carrega<T>(arquivo: keyof typeof ARQUIVOS_DE_DADOS): Promise<T> {
  const existente = emAndamento.get(arquivo);
  if (existente) return existente as Promise<T>;

  const caminho = `/dados/${ARQUIVOS_DE_DADOS[arquivo]}`;
  const p = (async () => {
    const r = await fetch(caminho);
    // 404 acontece em dois casos legítimos: `npm run dev` sem ter rodado o gerador (a pasta
    // public/dados/ está no .gitignore), e deploy feito sem o passo de geração. Nos dois, quem
    // chamou cai para o Firestore ao vivo.
    if (!r.ok) throw new Error(`${caminho} respondeu ${r.status}`);
    return r.json() as Promise<T>;
  })();

  emAndamento.set(arquivo, p);
  // Erro não fica em cache: a próxima tela tenta de novo em vez de herdar a falha.
  p.catch(() => emAndamento.delete(arquivo));
  return p;
}

export const carregaPersonagens = () => carrega<Character[]>('personagens');
export const carregaArsenal = () => carrega<Equipment[]>('arsenal');
export const carregaChecklist = () => carrega<ChecklistItem[]>('checklist');
export const carregaFamilias = () => carrega<FamilyTree[]>('familias');

/**
 * Entrega os dados uma vez pelo retrato estático, com o Firestore ao vivo como rede de segurança.
 *
 * Devolve uma função de cancelar com a mesma assinatura das `subscribe*`, então trocar uma pela
 * outra numa tela é mudar uma linha — e o `useEffect` que já existia continua igual, inclusive o
 * `return () => cancelar()`.
 *
 * O cancelamento importa de verdade aqui: o `fetch` não é abortável no meio sem `AbortController`,
 * mas o resultado dele é DESCARTADO se a tela desmontou antes de chegar. Sem isso, sair da Galeria
 * antes do download terminar chamaria `setState` num componente morto.
 */
export function fonteEstatica<T>(
  carregaArquivo: () => Promise<T>,
  assinaAoVivo: (onData: (d: T) => void, onError?: (e: Error) => void) => () => void,
  onData: (d: T) => void,
  onError?: (e: Error) => void,
): () => void {
  let vivo = true;
  let cancelaAssinatura: (() => void) | null = null;

  carregaArquivo()
    .then(d => { if (vivo) onData(d); })
    .catch(e => {
      if (!vivo) return;
      console.warn('Retrato estático indisponível, caindo para o Firestore ao vivo:', e.message);
      cancelaAssinatura = assinaAoVivo(onData, onError);
    });

  return () => {
    vivo = false;
    cancelaAssinatura?.();
  };
}
