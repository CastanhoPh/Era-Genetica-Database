const fs = require("fs");
const path = require("path");

const inputPath = process.argv.includes("--input")
  ? process.argv[process.argv.indexOf("--input") + 1]
  : "./characters.ts";

const outputPath = process.argv.includes("--output")
  ? process.argv[process.argv.indexOf("--output") + 1]
  : "./characters.md";

function readFileSafe(filePath) {
  return fs.readFileSync(path.resolve(filePath), "utf8");
}

function extractArrayContent(tsContent) {
  const exportMatch = tsContent.match(/export\s+const\s+\w+\s*:\s*[\w<>\[\]]+\s*=\s*(\[[\s\S]*\]);?/);
  if (exportMatch) return exportMatch[1];

  const fallbackMatch = tsContent.match(/=\s*(\[[\s\S]*\]);?/);
  if (fallbackMatch) return fallbackMatch[1];

  throw new Error("Não foi possível localizar o array exportado no characters.ts");
}

function sanitizeToJsonLike(str) {
  return str
    .replace(/^\uFEFF/, "")
    .replace(/(\w+)\s*:/g, '"$1":')
    .replace(/,\s*([}\]])/g, "$1");
}

function tryParseObjects(arrayText) {
  try {
    return Function(`"use strict"; return (${arrayText})`)();
  } catch (e) {
    const jsonLike = sanitizeToJsonLike(arrayText);
    return Function(`"use strict"; return (${jsonLike})`)();
  }
}

function esc(value) {
  if (value === null || value === undefined || value === "") return "Desconhecido";
  return String(value).trim().replace(/\|/g, "\\|");
}

function classification(value) {
  if (value === null || value === undefined || value === "") return "Desconhecido";
  return String(value).trim();
}

function renderImage(url, alt) {
  if (!url || url === "Desconhecido") return "";
  return `![${alt || "imagem"}](${url.trim()})`;
}

function statusText(character) {
  if (character.isDead) {
    return character.killedBy
      ? `Morto (morto por ${character.killedBy})`
      : "Morto";
  }
  return "Vivo";
}

function renderList(arr, formatter) {
  if (!Array.isArray(arr) || !arr.length) return "- Desconhecido";
  return arr.map(formatter).join("\n");
}

function renderStats(stats) {
  if (!stats) return "Desconhecido";
  return [
    `- Força: ${esc(stats.strength)}`,
    `- Destreza: ${esc(stats.dexterity)}`,
    `- Agilidade: ${esc(stats.agility)}`,
    `- Inteligência: ${esc(stats.intelligence)}`,
    `- Espírito: ${esc(stats.spirit)}`,
    `- Vigor: ${esc(stats.vigor)}`,
    `- Percepção: ${esc(stats.perception)}`
  ].join("\n");
}

function renderPowers(powers) {
  if (!Array.isArray(powers) || !powers.length) return "- Desconhecido";
  const capped = powers.slice(0, 15);
  return capped.map(p => `- ${esc(p.name)} — Nível ${esc(p.level)}`).join("\n");
}

function renderAptitudes(aptitudes) {
  if (!Array.isArray(aptitudes) || !aptitudes.length) return "Desconhecido";
  return aptitudes.filter(Boolean).join(", ");
}

function renderArsenal(arsenal) {
  if (!Array.isArray(arsenal) || !arsenal.length) return "Nenhum item cadastrado.";
  return arsenal.map((item, i) => {
    const img = renderImage(item.image, item.name);
    return [
      `### ${i + 1}. ${esc(item.name)}`,
      `Classificação: ${classification(item.classification)} | Natureza: ${esc(item.nature)} | Origem: ${esc(item.origin)}`,
      "",
      img,
      "",
      `Descrição:`,
      `${esc(item.description)}`
    ].filter(line => line !== null).join("\n");
  }).join("\n\n");
}

function renderTechniques(techniques) {
  if (!Array.isArray(techniques) || !techniques.length) return "Nenhuma técnica cadastrada.";
  return techniques.map((t, i) => {
    const img = renderImage(t.image, t.name);
    return [
      `### ${i + 1}. ${esc(t.name)}`,
      `Classificação: ${classification(t.classification)} | Natureza: ${esc(t.nature)}`,
      "",
      img,
      "",
      `Descrição:`,
      `${esc(t.description)}`,
      "",
      `Destruição:`,
      `${esc(t.destruction)}`,
      "",
      `História:`,
      `${esc(t.history)}`,
      "",
      `Status de Uso:`,
      `${esc(t.status)}`
    ].join("\n");
  }).join("\n\n");
}

function buildIndex(characters) {
  const lines = [
    "# BANCO DE DADOS RPG",
    "",
    "## ÍNDICE DE PERSONAGENS",
    "",
    "| ID | Nome | Clã | Grupo | Posição | Função | NC | HP | Chakra | Status |",
    "|---:|---|---|---|---|---|---:|---:|---:|---|"
  ];

  for (const c of characters) {
    const nc = typeof c.nc === "number" ? Math.min(c.nc, 30) : esc(c.nc);
    lines.push(
      `| ${esc(c.id)} | ${esc(c.name)} | ${esc(c.clan)} | ${Array.isArray(c.categories) ? c.categories.join(", ") : esc(c.categories)} | ${c.position ? esc(c.position) : ""} | ${esc(c.role)} | ${nc} | ${esc(c.hp)} | ${esc(c.chakra)} | ${statusText(c)} |`
    );
  }

  return lines.join("\n");
}

function buildCharacterBlock(c) {
  const titles = Array.isArray(c.titles) ? c.titles.join(", ") : esc(c.titles);
  const groups = Array.isArray(c.categories) ? c.categories.join(", ") : esc(c.categories);
  const img = renderImage(c.image, c.name);
  const nc = typeof c.nc === "number" ? Math.min(c.nc, 30) : esc(c.nc);

  return [
    `---`,
    ``,
    `# ${esc(c.name)}`,
    `ID: ${esc(c.id)}`,
    `Clã: ${esc(c.clan)}`,
    `Grupos: ${groups}`,
    ...(c.position ? [`Posição: ${esc(c.position)}`] : []),
    `Função: ${esc(c.role)}`,
    `NC: ${nc}`,
    `HP: ${esc(c.hp)}`,
    `Chakra: ${esc(c.chakra)}`,
    `Status: ${statusText(c)}`,
    `Títulos: ${titles}`,
    ``,
    img,
    ``,
    `## Descrição`,
    `${esc(c.description)}`,
    ``,
    `## Atributos`,
    `${renderStats(c.stats)}`,
    ``,
    `## Poderes e Elementos`,
    `${renderPowers(c.powers)}`,
    ``,
    `## Aptidões`,
    `${renderAptitudes(c.aptitudes)}`,
    ``,
    `## Arsenal`,
    `${renderArsenal(c.arsenal)}`,
    ``,
    `## Técnicas`,
    `${renderTechniques(c.techniques)}`,
    ``
  ].join("\n");
}

function fixExistingMd(mdPath, outPath) {
  const content = readFileSafe(mdPath);

  const fixed = content.replace(
    /Imagem:\s*(https?:\/\/[^\s|\n]+)/g,
    (_, url) => `![imagem](${url.trim()})`
  );

  fs.writeFileSync(path.resolve(outPath), "\uFEFF" + fixed, "utf8");
  console.log(`✅ MD corrigido com sucesso em: ${path.resolve(outPath)}`);
}

function main() {
  const isFixMode = process.argv.includes("--fix-md");
  const isDebug = process.argv.includes("--debug");

  if (isFixMode) {
    fixExistingMd(inputPath, outputPath);
    return;
  }

  const tsContent = readFileSafe(inputPath);
  const arrayContent = extractArrayContent(tsContent);
  const parsed = tryParseObjects(arrayContent);

  if (!Array.isArray(parsed)) {
    throw new Error("O conteúdo extraído não é um array de personagens.");
  }

  if (isDebug) {
    debugClassifications(parsed);
    return;
  }

  const characters = parsed.map(c => c).sort((a, b) => (a.id || 0) - (b.id || 0));

  const md = [
    buildIndex(characters),
    "",
    ...characters.map(buildCharacterBlock)
  ].join("\n");

  fs.writeFileSync(path.resolve(outputPath), "\uFEFF" + md, "utf8");
  console.log(`✅ Arquivo gerado com sucesso em: ${path.resolve(outputPath)}`);
}

main();