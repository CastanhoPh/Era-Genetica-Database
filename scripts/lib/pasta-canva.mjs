// Onde ficam as pastas locais dos projetos do Canva — uma por projeto, um arquivo por página.
//
// O caminho estava escrito em cinco scripts e era o do Windows do Pedro. Desde a mudança para o Mac
// (outubro/2026) ele mora aqui, num lugar só, e vale a primeira destas que existir:
//
//   1. a variável de ambiente CANVA_PASTA
//   2. a pasta antiga do Windows, para aquela máquina continuar funcionando sem configurar nada
//   3. ~/Desktop/Backup Era Genética Db, que é o padrão em qualquer outra máquina
//
// Os scripts que aceitam --base= continuam aceitando, e ele ganha de tudo isto.
import { existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

const WINDOWS = 'C:/Users/PedroCastanho/OneDrive - Teddy Open Finance/Área de Trabalho/Canva';
const PADRAO = join(os.homedir(), 'Desktop', 'Backup Era Genética Db');

export const PASTA_CANVA = process.env.CANVA_PASTA ?? (existsSync(WINDOWS) ? WINDOWS : PADRAO);

/**
 * O nome de arquivo de cada página, SEM número na frente. Decisão do Pedro em 08/10/2026: no Canva
 * a página já tem número, e repetir no arquivo só fazia 170 nomes mudarem toda vez que um evento
 * entrava no meio.
 *
 * Sem o número, duas páginas com o mesmo título disputariam o mesmo arquivo — e isso existe: há
 * eventos duplicados no checklist. A segunda ganha " (2)", na ordem das páginas. A comparação
 * ignora maiúscula porque o disco do Mac e o do Windows também ignoram.
 *
 * Uma instância por pasta, chamada para TODA página na ordem, com arte ou sem: é o que mantém o
 * " (2)" no mesmo item nos três scripts que montam nome (export, nomes, brancos).
 */
export function nomeador() {
  const vistos = new Map();
  return titulo => {
    const base = titulo.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
    const n = (vistos.get(base.toLowerCase()) ?? 0) + 1;
    vistos.set(base.toLowerCase(), n);
    return n === 1 ? base : `${base} (${n})`;
  };
}
