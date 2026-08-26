import fs from 'fs';
const p = 'scripts/canva-export.mjs';
let s = fs.readFileSync(p, 'utf8');
const troca = (de, para) => {
  if (!s.includes(de)) throw new Error('nao achei -> ' + de.slice(0, 70));
  s = s.replace(de, para);
};

troca(
`// Só desce item COM arte: página sem arte não tem arquivo, e o prefixo pula. Isso é de propósito —
// se o prefixo fosse a posição entre os que têm arte, cada arte nova renumeraria o resto.
//
// Arquivo que não corresponde a nenhuma página vai para _antigos/ em vez de ser apagado. Acontece
// quando um item é renomeado ou reordenado, e o arquivo velho ficaria como página duplicada.`,
`// Só baixa o que FALTA. Um arquivo que já existe fica como está mesmo se o tamanho diferir do
// Storage: o arquivo local é o export do Canva e a cópia no Storage é derivada dele, então diferença
// de alguns bytes entre dois exports do mesmo design é normal, não é arquivo velho. As diferenças
// saem no relatório, e --rebaixar força a troca.
//
// O nome desejado é calculado para TODA página, com arte ou sem. Uma página sem arte no site pode
// muito bem ter export local, e ela não pode ser tratada como arquivo sobrando por causa disso.
//
// Sobrando é o arquivo que não corresponde a página nenhuma — item renomeado ou reordenado, que
// viraria página duplicada no import. Esse vai para _antigos/ em vez de ser apagado.`);

troca(`const APPLY = process.argv.includes('--apply');`,
`const APPLY = process.argv.includes('--apply');
const REBAIXAR = process.argv.includes('--rebaixar');`);

troca(`let baixar = [], jaOk = 0, semArte = 0, sumidos = [], mover = [];`,
`let baixar = [], jaOk = 0, semArte = 0, sumidos = [], mover = [], difere = [];`);

troca(
`  itens.forEach((i, k) => {
    if (!i.imageUrl) { semArte++; return; }
    const caminho = caminhoDe(i.imageUrl);
    if (!caminho) { sumidos.push(\`\${p.pasta}: URL ilegível em "\${tituloDe(p.tipo, i)}"\`); return; }
    if (!tamanhoRemoto.has(caminho)) { sumidos.push(\`\${p.pasta}: no Firestore mas não no Storage — \${caminho}\`); return; }
    comArte++;
    const ext = caminho.match(/\.(\w+)$/)?.[1].toLowerCase() ?? 'png';
    const arquivo = \`\${String(k + 1).padStart(largura, '0')} - \${limpa(tituloDe(p.tipo, i))}.\${ext}\`;
    querem.add(arquivo);
    const destino = join(dir, arquivo);
    const local = existsSync(destino) ? statSync(destino).size : -1;
    if (local === tamanhoRemoto.get(caminho)) { jaOk++; return; }
    if (local === -1) faltando++; else atualizar++;
    baixar.push({ caminho, destino, dir, arquivo, pasta: p.pasta });
  });`,
`  itens.forEach((i, k) => {
    const caminho = i.imageUrl ? caminhoDe(i.imageUrl) : null;
    if (i.imageUrl && !caminho) { sumidos.push(\`\${p.pasta}: URL ilegível em "\${tituloDe(p.tipo, i)}"\`); }
    if (caminho && !tamanhoRemoto.has(caminho)) { sumidos.push(\`\${p.pasta}: no Firestore mas não no Storage — \${caminho}\`); }
    const remoto = caminho ? tamanhoRemoto.get(caminho) : undefined;

    // Sem arte no site ainda pode ter export local, então o nome é reservado de todo jeito. A
    // extensão vem do Storage quando existe; png é o padrão dos projetos.
    const ext = caminho?.match(/\.(\w+)$/)?.[1].toLowerCase() ?? 'png';
    const arquivo = \`\${String(k + 1).padStart(largura, '0')} - \${limpa(tituloDe(p.tipo, i))}.\${ext}\`;
    querem.add(arquivo);

    if (remoto === undefined) { semArte++; return; }
    comArte++;
    const destino = join(dir, arquivo);
    const local = existsSync(destino) ? statSync(destino).size : -1;
    if (local === -1) { faltando++; baixar.push({ caminho, destino, dir, arquivo, pasta: p.pasta }); return; }
    if (local === remoto) { jaOk++; return; }
    // Existe com outro tamanho: não é gap, é divergência. Só troca se pedirem.
    difere.push({ pasta: p.pasta, arquivo, local, remoto });
    if (REBAIXAR) { atualizar++; baixar.push({ caminho, destino, dir, arquivo, pasta: p.pasta }); }
  });`);

troca(
`    atualizar ? \`\${atualizar} desatualizada(s)\` : null,`,
`    atualizar ? \`\${atualizar} a trocar\` : null,`);

troca(
`console.log(\`\${semArte} página(s) sem arte — não geram arquivo\`);`,
`console.log(\`\${semArte} página(s) sem arte no site — o nome fica reservado, o arquivo não é baixado\`);
if (difere.length) {
  console.log(\`\n\${difere.length} arquivo(s) existem com tamanho diferente do Storage (mantidos; --rebaixar troca):\`);
  difere.slice(0, 6).forEach(x => console.log(\`   \${x.pasta}/\${x.arquivo} — local \${x.local} vs storage \${x.remoto}\`));
}`);

fs.writeFileSync(p, s);
console.log('ok');
