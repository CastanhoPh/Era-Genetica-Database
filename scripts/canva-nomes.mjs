// Gera o mapa arquivo -> nome da página, para montar os projetos do Canva.
//
//   npm run canva:nomes
//
// Grava Canva/nomes-das-paginas.tsv com uma linha por página dos quatro projetos.
//
// O nome do ARQUIVO tem prefixo numérico (é só o que garante a ordem no import) e o nome COMPLETO do
// personagem. O nome da PÁGINA não tem número e usa o primeiro nome — os 86 primeiros nomes das
// fichas são únicos entre si. Por isso o mapa é explícito: deduzir um do outro exigiria saber qual
// parte do nome do arquivo é o personagem, e é aí que um script erraria.
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';
import admin from 'firebase-admin';
import { achaChave } from './lib/chave.mjs';

const BASE = process.argv.find(a => a.startsWith('--base='))?.slice('--base='.length)
  ?? 'C:/Users/PedroCastanho/OneDrive - Teddy Open Finance/Área de Trabalho/Canva';
// Os sete projetos, na mesma ordem e com os mesmos nomes de pasta de scripts/canva-export.mjs.
const PROJ = [
  { pasta: 'Linha do Tempo', tipo: 'timeline', tam: '1080x1620' },
  { pasta: 'Modos e Transformações', tipo: 'transformacao', tam: '1080x1620' },
  { pasta: 'Capas Personagens', tipo: 'capa', tam: '1024x768' },
  { pasta: 'Capas Invocações', tipo: 'capaInvocacao', tam: '1024x768' },
  { pasta: 'Invocações', tipo: 'invocacao', tam: '1024x768' },
  { pasta: 'Arsenal', tipo: 'arsenal', tam: '1080x1080' },
  { pasta: 'Eventos', tipo: 'evento', tam: '1600x900' },
];
// Invocação, capa de invocação e arma já têm um nome próprio e único no checklist — não precisam da
// composição temporada/arco que os outros três montam.
const PELO_NOME = new Set(['invocacao', 'capaInvocacao', 'arsenal']);

const chave = { full: achaChave() };
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(chave.full, 'utf8'))) });
const db = admin.firestore();
const cl = (await db.collection('imageChecklist').get()).docs.map(x => x.data());
const nomesFicha = new Set((await db.collection('characters').get()).docs.map(x => x.data().name));

const limpa = s => s.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
const curto = n => (nomesFicha.has(n) ? n.split(' ')[0] : n);

const linhas = [['projeto', 'formato', 'pagina', 'arquivo', 'nome_da_pagina'].join('\t')];
for (const p of PROJ) {
  const itens = cl.filter(i => (i.type ?? 'evento') === p.tipo).sort((a, b) => a.order - b.order);
  const largura = String(itens.length).length;
  itens.forEach((i, k) => {
    const prefixo = String(k + 1).padStart(largura, '0');
    // arquivo: nome completo; página: primeiro nome
    const arquivoTitulo = PELO_NOME.has(p.tipo) ? i.name
      : p.tipo === 'capa' ? i.temporada
        : p.tipo === 'evento' ? [i.temporada, i.arco, i.subarco, i.name].filter(Boolean).join(' - ')
          : `${i.temporada} - ${i.arco}`;
    const paginaTitulo = PELO_NOME.has(p.tipo) ? i.name
      : p.tipo === 'capa' ? curto(i.temporada)
        : p.tipo === 'evento' ? [i.temporada, i.arco, i.subarco, i.name].filter(Boolean).join(' - ')
          : `${curto(i.temporada)} - ${i.arco}`;
    const ext = i.imageUrl
      ? (decodeURIComponent(i.imageUrl.split('/o/')[1].split('?')[0]).match(/\.(\w+)$/)?.[1].toLowerCase() ?? 'png')
      : 'png';
    linhas.push([p.pasta, p.tam, k + 1, `${prefixo} - ${limpa(arquivoTitulo)}.${ext}`, paginaTitulo].join('\t'));
  });
  const rep = itens.length;
  console.log(`${p.pasta.padEnd(24)} ${String(rep).padStart(3)} páginas · ${p.tam} · ${itens.filter(i => i.imageUrl).length} com arte`);
}

if (!existsSync(BASE)) { console.error(`pasta não encontrada: ${BASE}`); process.exit(1); }
const saida = join(BASE, 'nomes-das-paginas.tsv');
writeFileSync(saida, linhas.join('\n') + '\n', 'utf8');
console.log(`\n${linhas.length - 1} linha(s) em ${saida}`);
process.exit(0);
