const fs = require("fs");
const path = require("path");

const inputPath = process.argv.includes("--input")
    ? process.argv[process.argv.indexOf("--input") + 1]
    : "./arsenal.ts";

const outputPath = process.argv.includes("--output")
    ? process.argv[process.argv.indexOf("--output") + 1]
    : "./arsenal.md";

function readFileSafe(filePath) {
    return fs.readFileSync(path.resolve(filePath), "utf8");
}

function extractArrayContent(tsContent) {
    const exportMatch = tsContent.match(
        /export\s+const\s+\w+\s*:\s*[\w<>\[\]]+\s*=\s*(\[[\s\S]*\]);?/
    );
    if (exportMatch) return exportMatch[1];

    const fallbackMatch = tsContent.match(/=\s*(\[[\s\S]*\]);?/);
    if (fallbackMatch) return fallbackMatch[1];

    throw new Error("Não foi possível localizar o array exportado no arquivo .ts");
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
    if (!url || url.trim() === "") return "";
    return `![${alt || "imagem"}](${url.trim()})`;
}

function buildIndex(items) {
    const lines = [
        "# BANCO DE DADOS RPG — ARSENAL",
        "",
        "## ÍNDICE DE EQUIPAMENTOS",
        "",
        "| ID | Nome | Classificação | Natureza | Origem | Dono Atual |",
        "|---:|---|---|---|---|---|"
    ];

    for (const item of items) {
        lines.push(
            `| ${esc(item.id)} | ${esc(item.name)} | ${classification(item.classification)} | ${esc(item.nature)} | ${esc(item.origin)} | ${esc(item.currentOwner)} |`
        );
    }

    return lines.join("\n");
}

function buildItemBlock(item) {
    const img = renderImage(item.image, item.name);

    return [
        `---`,
        ``,
        `# ${esc(item.name)}`,
        `ID: ${esc(item.id)}`,
        `Classificação: ${classification(item.classification)}`,
        `Natureza: ${esc(item.nature)}`,
        `Origem: ${esc(item.origin)}`,
        `Dono Original: ${esc(item.originalOwner)}`,
        `Dono Atual: ${esc(item.currentOwner)}`,
        ``,
        img,
        ``,
        `## Descrição`,
        `${esc(item.description)}`,
        ``
    ]
        .filter(line => line !== null)
        .join("\n");
}

function main() {
    const tsContent = readFileSafe(inputPath);
    const arrayContent = extractArrayContent(tsContent);
    const parsed = tryParseObjects(arrayContent);

    if (!Array.isArray(parsed)) {
        throw new Error("O conteúdo extraído não é um array de equipamentos.");
    }

    const items = parsed.sort((a, b) => (a.id || 0) - (b.id || 0));

    const md = [
        buildIndex(items),
        "",
        ...items.map(buildItemBlock)
    ].join("\n");

    fs.writeFileSync(path.resolve(outputPath), "\uFEFF" + md, "utf8");
    console.log(`✅ Arquivo gerado com sucesso em: ${path.resolve(outputPath)}`);
}

main();