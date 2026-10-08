// Lê uma coleção inteira do Firestore — ou o retrato local dela, se for recente.
//
// POR QUE ISSO EXISTE
//
// Quase todo script do projeto começa lendo coleções inteiras, e o Firestore cobra por documento:
// `characters` + `arsenal` + `imageChecklist` são 1.684 leituras por execução. Numa sessão de
// conferência roda-se a mesma pergunta várias vezes seguidas — em 08/10/2026 foram 40 mil leituras
// num dia só de scripts, sem um visitante ter gasto nenhuma.
//
// Então a primeira leitura guarda o resultado em `.cache/firestore/`, e as seguintes, por 15
// minutos, leem dali. Cada vez que isso acontece o script avisa de quando é o retrato.
//
// QUEM GRAVA NUNCA LÊ DO RETRATO. Rodando com `--apply` a leitura é sempre do banco: um script que
// calculasse em cima de dado velho sobrescreveria o que alguém editou no Painel nesse meio-tempo.
// E como ele vai mudar o banco, apaga o retrato das coleções que leu — senão a conferência seguinte
// leria o estado de ANTES da correção e diria que nada foi corrigido.
//
//   --fresco             força a leitura do banco sem gravar nada
//   LEITURA_MINUTOS=0    desliga o retrato de vez (ou muda a validade)
//
// O que volta imita o que `collection().get()` devolve, no que os scripts usam: `docs`, e em cada
// um `id`, `data()` e `ref`. Assim trocar uma chamada pela outra é mudar uma linha.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const PASTA = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.cache', 'firestore');
const MINUTOS = Number(process.env.LEITURA_MINUTOS ?? 15);
const GRAVANDO = process.argv.includes('--apply');
const FRESCO = process.argv.includes('--fresco');

export async function leColecao(db, nome, { fresco = false } = {}) {
  const arquivo = join(PASTA, `${nome}.json`);
  const monta = lista => ({
    size: lista.length,
    docs: lista.map(({ id, dados }) => ({ id, data: () => dados, ref: db.collection(nome).doc(id) })),
  });

  if (!GRAVANDO && !FRESCO && !fresco && MINUTOS > 0 && existsSync(arquivo)) {
    try {
      const { lidoEm, docs } = JSON.parse(readFileSync(arquivo, 'utf8'));
      const idade = (Date.now() - lidoEm) / 60000;
      if (idade < MINUTOS) {
        console.log(`[${nome}: retrato local de ${idade < 1 ? 'menos de 1' : Math.floor(idade)} min atrás, 0 leituras — --fresco lê o banco]`);
        return monta(docs);
      }
    } catch { /* retrato ilegível: lê do banco e regrava */ }
  }

  const snap = await db.collection(nome).get();
  const docs = snap.docs.map(d => ({ id: d.id, dados: d.data() }));
  if (GRAVANDO) {
    rmSync(arquivo, { force: true });
  } else {
    mkdirSync(PASTA, { recursive: true });
    writeFileSync(arquivo, JSON.stringify({ lidoEm: Date.now(), docs }), 'utf8');
  }
  // O que sai daqui é o snapshot de verdade: no modo de gravação os scripts usam `ref` para
  // escrever, e o do snapshot é o mais direto.
  return snap;
}
