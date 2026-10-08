# Era Genética — Banco de Dados

Site do RPG Era Genética: fichas de personagem, arsenal, invocações, galeria e o painel de produção
de arte.

- **No ar:** https://era-genetica-db.web.app
- **Projeto Firebase:** `era-genetica-db` (Firestore, Storage, Auth e Hosting)
- **Stack:** React 19, Vite, TypeScript, Tailwind

## Primeira vez nesta máquina

```
npm install
```

Se a pasta `node_modules` veio copiada de outro sistema (Windows para Mac, por exemplo), apague-a
antes: os binários do Vite são específicos de cada sistema e os comandos falham com "Permission
denied".

Os scripts que falam com o banco precisam da chave de serviço do projeto. Ela **não fica dentro
desta pasta**: coloque o arquivo `era-genetica-db-firebase-adminsdk-*.json` em `~/Downloads`, ou
aponte para ele com a variável `SERVICE_ACCOUNT_KEY_PATH`. Quem procura a chave é
`scripts/lib/chave.mjs`, que recusa chave de outro projeto.

## Dia a dia

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o site em http://localhost:3000 |
| `npm run lint` | Confere os tipos (`tsc --noEmit`) |
| `npm run build` | Gera o site em `dist/` |
| `npm run conferir` | Relatório de consistência a partir do retrato local, sem ler o banco |
| `npm run conferir -- --deploy` | Também confere se o publicado está em dia com o Firestore |
| `npm run deploy` | Gera os dados, faz o build, o prerender e publica o Hosting |
| `npm run backup` | Copia o Firestore para `docs/backup/` (commitar depois) |

## Estrutura

```
src/                  código do site
  index.tsx           entrada
  App.tsx             casca do app e rotas (lidas do caminho da URL)
  pages/              telas: Arsenal, Invocações, Galeria, Habilidades, Painel, Checklist
  components/         modais de ficha e de arma, cards, upload, login
  data/               acesso ao banco, cópia local das fichas e catálogos de regra
  types.ts, types/    formato dos documentos
  utils/              formatação e modo leve
  firebase*.ts        inicialização do Firebase, um arquivo por SDK
  useAuth.ts          login e papéis
scripts/              geração de dados, deploy, backup, reconciliação, Canva
docs/                 lore e regras da campanha, PDFs e o backup do Firestore
public/dados/         retrato do banco, gerado (fora do git)
dist/                 site pronto para publicar, gerado (fora do git)
```

Os arquivos soltos na raiz são configuração, e cada ferramenta só acha o seu ali:

| Arquivo | De quem é |
|---|---|
| `package.json`, `package-lock.json` | npm |
| `index.html`, `vite.config.ts` | Vite |
| `tsconfig.json` | TypeScript |
| `tailwind.config.js`, `postcss.config.js` | Tailwind |
| `firebase.json`, `.firebaserc` | Firebase (Hosting e projeto) |
| `firestore.rules`, `storage.rules` | Regras de acesso do banco e das imagens |
| `.gitignore`, `.gitattributes` | git |

Dentro de `src/data/`:

| Arquivo | Papel |
|---|---|
| `firestore.ts` | Toda leitura e escrita do site no Firestore |
| `dados-publicos.ts` | Leitura pelo retrato estático em `/dados/*.json` |
| `dados-versao.ts` | Nomes dos arquivos do retrato. Gerado, não editar |
| `characters.ts`, `arsenal.ts` | Cópia local das fichas e das armas |
| os demais | Catálogos e regras: atributos, ordem de força, postos, liberações, habilidades lendárias |

## Banco de dados

| Coleção | Conteúdo | Quem lê | Quem escreve |
|---|---|---|---|
| `characters` | Fichas | todos | admin |
| `arsenal` | Armas e artefatos | todos | admin |
| `imageChecklist` | Uma linha por página de arte | todos | admin, Liu e Zeck |
| `familyTrees` | Genealogia (sem tela no site) | todos | admin |
| `prototypeEntries` | Rascunhos de personagem | admin | admin |
| `aFazer` | Pendências do Painel | admin | admin |

O visitante não lê o Firestore. O deploy grava as três coleções públicas em
`public/dados/<nome>-<hash>.json` e o site busca esses arquivos no Hosting; só o Painel e o Checklist
leem ao vivo. **Uma edição feita no Painel só chega ao público depois de `npm run deploy`.**

As imagens ficam no Storage, com leitura pública, nas pastas `Characters/`, `Galeria/`, `Arsenal/`,
`Prototipo/` e `Uploads/`.

## Publicar

```
npm run deploy                                        # site
npx firebase deploy --only firestore:rules,storage    # regras, à parte
```

O `npm run deploy` publica só o Hosting. Mudança em `firestore.rules` ou `storage.rules` precisa do
segundo comando.

## Sincronizar fichas e armas

`src/data/characters.ts` e `src/data/arsenal.ts` são a cópia local; o Firestore é o que o site lê.

```
npm run sync:diff          # mostra a diferença entre os dois
npm run sync:push          # simula a gravação
npm run sync:push:apply    # grava, com merge
```

O push aborta sozinho se for apagar um campo que só existe no banco. Sete campos vivem só no
Firestore e nunca estão no arquivo local: `vila`, `organizacao`, `cargo`, `patente`,
`focosAtributo`, `divisaoAtributo` e `invocacoes`.

## Reconciliar cópias

A ficha guarda cópias do checklist (eventos na galeria e invocações). Quando divergem:

```
npm run eventos:check       npm run eventos:fix
npm run invocacoes:check    npm run invocacoes:fix
```
