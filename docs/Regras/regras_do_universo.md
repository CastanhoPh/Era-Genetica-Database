# REGRAS_DO_UNIVERSO.md

# ERA GENÉTICA — REGRAS FUNDAMENTAIS DO UNIVERSO

---

# I. NC — NÍVEL DE CAMPANHA

## Definição

O NC representa:

- escala mecânica;
- atributos;
- vida;
- chakra;
- capacidade geral de combate.

O NC NÃO representa automaticamente:

- superioridade absoluta;
- vitória garantida;
- posição fixa em rankings;
- poder narrativo definitivo.

---

# ESCALONAMENTO DE PODER

## Diferença de NC

Diferenças de NC possuem impacto extremamente elevado.

Regra geral:

- 1 NC já representa vantagem significativa;
- 2 NC é considerado esmagador em combate direto.

Por isso:
combates entre personagens de NC muito diferentes normalmente exigem:

- preparação;
- suporte;
- estratégia;
- números;
- condições especiais;
- counters específicos;
- desgaste prévio.

---

# ESCALA OFICIAL DE NC

## 4–10
Shinobi comuns.

## 11–16
Elite shinobi.

## 17–20
Monstros de elite.

## 21–25
Lendas históricas.

## 26–28
Existências absolutas.

## 29–30
Transcendentais.

---

# NC30

NC30 representa o limite absoluto conhecido da Era Genética.

Personagens nesse nível:
- ultrapassaram completamente o padrão shinobi;
- são tratados como entidades históricas;
- possuem impacto global apenas por existirem.

Exemplos conhecidos:
- Nishinoya Senju;
- Hades;
- Raikun;
- Kaizuka;
- Omega.

---

# II. SISTEMA DE RANK

## Escala Oficial

F → E → D → C → B → A → A+ → S → S+ → S++ → Z

---

## O que define um Rank

O rank pode ser determinado por:

- poder destrutivo;
- raridade;
- dificuldade de obtenção;
- impacto histórico;
- perigo global;
- complexidade;
- importância mundial.

---

## Rank Z

Rank Z representa:

- técnicas impossíveis;
- artefatos lendários;
- poderes históricos;
- manifestações extremamente raras;
- ameaças globais;
- fenômenos considerados anormais pelo mundo shinobi.

Um Rank Z NÃO depende apenas de força bruta.

Exemplo:

- um artefato pode ser Rank Z pelo impacto mundial mesmo sem grande poder ofensivo.

---

# III. SISTEMA DE ATRIBUTOS

## Atributos Oficiais

- Força
- Destreza
- Agilidade
- Inteligência
- Espírito
- Vigor
- Percepção

---

## Limite Máximo

O limite máximo natural de atributos é:

## 30

Esse é o teto absoluto, alcançado apenas no NC 30. O teto real de cada personagem é o próprio NC — ver "Teto por atributo" abaixo.

---

## Teto por atributo

**Nenhum atributo pode ser maior que o NC do personagem.**

Um NC 16 tem teto 16 em cada atributo; um NC 23, teto 23. O 30 aparece como limite absoluto apenas porque é o NC máximo da campanha.

---

## Grafia: Juken, sem macron e com um u

O Punho Suave dos Hyuga se escreve **`Juken`**. É exceção à convenção de macrons do projeto, junto com [Fujogan] — e o nome composto mantém os macrons das outras palavras: `Juken: Jūho Sōshiken`.

O projeto tinha três grafias ao mesmo tempo, separadas por onde apareciam: `Juken` nos nomes de poder, `Jūken` nos campos `nature` das técnicas do Katsumi, e `Juuken` em dois lugares. As 18 ocorrências foram unificadas em 2026-08-19, incluindo o nome da técnica do Katsumi e o arquivo dela no Storage.

---
## Estilo de combate — como distribuir quando o NC sobe

Todo personagem é de **combate corporal** ou de **combate a distância**. Isso nunca aparece no site: é informação interna, e serve só para distribuir atributo.

| Estilo | Vão ao **teto** (= NC) | Vão ao **mínimo** |
|---|---|---|
| **Corporal** | Força e Agilidade | Destreza e Percepção |
| **Distância** | Destreza e Percepção | Força e Agilidade |

**Vigor, Espírito e Inteligência** ficam com o que sobra. Duas escolhas, também internas, decidem como:

- **Foco** — quais desses três vão ao teto. Até dois.
- **Proporção** — em que percentual os que não são foco repartem o resto, em passos de **2,5%**. Sem proporção definida, repartem em partes iguais.

A proporção incide sobre **todo o valor que sobrou**, não sobre o excedente do mínimo. É o que separa dois personagens com o mesmo foco:

| | Foco | Proporção | Resultado no NC 18 |
|---|---|---|---|
| **Kaito** | Espírito → 18 | Int 60 / Vig 40 | Int **17** · Vig **11** |
| **Takeshi** | Espírito → 18 | Int 55 / Vig 45 | Int **15** · Vig **13** |

Os dois têm Destreza 18, Percepção 18, Força 7, Agilidade 7 e Espírito 18 — 5% de diferença na proporção é toda a distância entre as duas fichas.

Isso vive nos campos `combatStyle`, `focosAtributo` e `divisaoAtributo` da ficha, e é editável na aba **Perfil** do Painel, que mostra a prévia dos sete atributos antes de qualquer coisa ser aplicada. A implementação é `data/atributos.ts`.

Duas ressalvas:

- **Atributo que já está acima do mínimo não desce.** A regra só empurra para cima.
- **Não existe "Híbrido".** O que já foi marcado assim é Distância com a aptidão **Acuidade** — que 54 das 86 fichas têm, e portanto não distingue nada.

A conta sempre fecha. Com dois atributos no teto e dois no mínimo, a sobra para os outros três é `4 × NC − 12 − 2 × mínimo`, e ela cai dentro da faixa `[3 × mínimo, 3 × NC]` em **todo NC de 4 a 30** — nunca dá impossível. Exemplo no NC 29: dois em 29 e dois em 12 somam 82, e sobram 80 para três atributos que aceitam de 36 a 87.

O estilo fica no campo `combatStyle` da ficha; o foco e a proporção, em `focosAtributo` e `divisaoAtributo`.

### Quando o par oposto está acima do mínimo

Oito fichas têm o par do estilo no teto mas o par oposto **acima** do mínimo — o Oddy tem Força 9 num NC 18 cujo mínimo é 7, o Sho tem Percepção 20 num mínimo de 11. O estilo delas é inequívoco, mas o orçamento dos três livres fica menor que o da fórmula, então nenhuma combinação de foco e proporção reproduz a ficha.

Essas oito ficam com **só o `combatStyle` gravado**, sem foco nem proporção. Gravar um foco que não reproduz a ficha seria pior que deixar em branco: na próxima subida de NC ele aplicaria atributos errados em silêncio.

Vale registrar que a regra "atributo acima do mínimo não desce" e a fórmula ainda não conversam nesses casos: subir o Oddy de 18 para 19 levaria o mínimo a 8, e a fórmula poria Força 8 — abaixo dos 9 que ele tem hoje. Está em aberto.

### Onde isso está preenchido

`combatStyle`, `focosAtributo` e `divisaoAtributo` estão em 84 das 86 fichas, e **as 84 reproduzem os sete atributos exatos**. Só Beta e Hades ficam de fora, por não terem NC — e nos dois isso é proposital. Confira com `npm run perfil:conferir` — todas conferidas rodando o perfil de volta e exigindo os sete atributos exatos. O que falta:

- **Build mista: resolvido em 2026-08-19.** As oito (Hirato, Hana, Sayuri, Tessai, Kurohime, Akairo, Genei, Kaien) tinham um atributo de cada par no teto. O Pedro decidiu manter o perfil e reescrever a ficha, então os atributos passaram a ser o que o perfil produz — e HP e Chakra foram recalculados, porque Vigor ou Espírito mudaram em cinco delas.
- **Par oposto acima do mínimo: resolvido em 2026-08-19.** As sete que sobravam (Sho, Hoshiro, Yuji, Reito, Enrai, Koji, Shin, mais o Oddy antes delas) seguiram o mesmo caminho das de build mista: o perfil manda, o par oposto desceu ao mínimo e os pontos voltaram aos livres. O campo de piso ficou sem uso — mas a lacuna que ele fecharia segue aberta, e vai reaparecer na primeira ficha que precise de um atributo acima do mínimo.
- **Foco trocado: resolvido em 2026-08-19.** Seis fichas tinham foco gravado que discordava dos atributos (Hisoka, Rock Gunma, Katsuo, Shikatsu, Yoru, Enrai). O perfil venceu em todas.
- **5 fichas em branco** — Ryuta e os quatro da Elite (Katakana, Ganmasen, Deruta, Shiita).
- **Hades e Beta**, que não têm NC: os dois ficam com `nc: 0`, e a aba Perfil mostra "sem NC" em vez de tentar distribuir.

`npm run perfil:derivar` deduz e confere tudo isso; sem `--apply` só relata.

---

## Máximo de atributos

O **total dos sete atributos somados** é limitado pelo NC. É o orçamento de pontos do personagem:

## Máximo = (6 × NC) − 12

| NC | máximo | NC | máximo | NC | máximo |
|---:|---:|---:|---:|---:|---:|
| 4 | 12 | 13 | 66 | 22 | 120 |
| 5 | 18 | 14 | 72 | 23 | 126 |
| 6 | 24 | 15 | 78 | 24 | 132 |
| 7 | 30 | 16 | 84 | 25 | 138 |
| 8 | 36 | 17 | 90 | 26 | 144 |
| 9 | 42 | 18 | 96 | 27 | 150 |
| 10 | 48 | 19 | 102 | 28 | 156 |
| 11 | 54 | 20 | 108 | 29 | 162 |
| 12 | 60 | 21 | 114 | 30 | 168 |

Subir de NC aumenta o orçamento em 6 pontos por nível. Uma ficha que não gastou o máximo está incompleta, não irregular.

---

## Mínimo por NC

Cada um dos sete atributos precisa ter, no mínimo:

| NC | mínimo |
|---:|---:|
| 4 | 0 |
| 5 – 6 | 1 |
| 7 – 8 | 2 |
| 9 – 10 | 3 |
| 11 – 12 | 4 |
| 13 – 14 | 5 |
| 15 – 16 | 6 |
| 17 – 18 | 7 |
| 19 – 22 | 8 |
| 23 – 24 | 9 |
| 25 – 26 | 10 |
| 27 – 28 | 11 |
| 29 – 30 | 12 |

Isso impede a existência de personagens de alto NC com capacidades absurdamente inferiores ao padrão esperado daquele nível.

Repare que **19 a 22 é a única faixa de quatro níveis**; todas as outras são de dois. Não é erro de digitação.

---

## Nível dos poderes

O nível de poder mais alto de um personagem é:

## Teto do poder = NC ÷ 2, arredondado para baixo

NC 16 → 8 · NC 23 → 11 · NC 26 → 13 · NC 30 → 15.

Poderes abaixo desse teto são permitidos e comuns — o que a regra fixa é o mais alto. Ao subir de NC, os poderes que estavam no teto antigo acompanham.

---

# IV. SISTEMA DE HP

## Fórmula Oficial

HP = (NC × 5) + (Vigor × 3) + 10

---

## Interpretação

HP representa:

- resistência;
- vitalidade;
- durabilidade física.

---

# V. SISTEMA DE CHAKRA

## Fórmula Oficial

Chakra = (Espírito × 3) + 10

---

## Aptidão Chakra Expandido

Cada aptidão **Chakra Expandido** multiplica o resultado por 1,5:

Chakra = ((Espírito × 3) + 10) × (1 + 0,5 × nº de Chakra Expandido)

**O arredondamento é para cima.** Espírito 11 com uma aptidão dá `43 × 1,5 = 64,5`, que vira **65**.

A aptidão fica na lista de **aptidões**, não na de poderes.

---

## Modificadores de item

Alguns itens somam ao HP ou ao Chakra por fora da fórmula. Um valor que confere com a fórmula pura está **errado** se o personagem carrega um desses:

| item | efeito |
|---|---|
| Ishi no Kubikazari | Chakra **+1× Espírito** |
| Ishi no Seimei | HP **+1× Vigor** |

Ao conferir HP ou Chakra, checar o arsenal antes de apontar divergência.

---

## Interpretação

Chakra representa:

- volume energético;
- sustentação de técnicas;
- resistência espiritual;
- capacidade de combate prolongado.

---

# VI. SISTEMA DE PODERES

## Limite Máximo

Os poderes possuem nível máximo:

## 15

---

## Escala

1–5 → básico  
6–10 → avançado  
11–13 → especialista absoluto  
14 → lendário  
15 → domínio monstruoso ou histórico

---

# VII. CHAKRA

## Funcionamento

Todo ser vivo possui chakra.

Chakra é utilizado para:

- técnicas;
- fortalecimento corporal;
- habilidades especiais;
- manipulação elemental.

---

## Exaustão

Quando o chakra se esgota completamente:

- o usuário desmaia;
- o corpo entra em colapso físico.

Chakra NÃO se regenera instantaneamente.

A recuperação ocorre apenas através de:

- descanso;
- tempo;
- recuperação física.

---

## Cores do Chakra

A maioria das cores de chakra não possui importância absoluta.

Exceção:

- Chakra Profano.

---

# VIII. CHAKRA PROFANO

## Definição

O Chakra Profano é um poder exclusivo da família principal Hyūga após o despertar do Fujogan.

---

## Origem

O Chakra Profano surge quando o indivíduo rompe:

- estabilidade emocional;
- calmaria;
- controle absoluto tradicional dos Hyūga.

---

## Gatilhos

- emoções extremas;
- ruptura psicológica;
- rejeição da própria natureza.

---

## Propriedades

- amplifica qualquer chakra existente;
- ignora limitações naturais do corpo;
- evolui conforme o estado emocional;
- possui comportamento instável;
- cresce de forma expansiva.

---

## Corrupção de Chakra

Antigamente o Chakra Profano era confundido com corrupção de chakra.

Posteriormente:
- Hoshiro;
- Kai;
- Haruki;
- OCA;

compreenderam sua verdadeira natureza.

---

# IX. FUJOGAN

## Definição

O Fujogan é a evolução natural do Byakugan.

---

## Regras

- exclusivo da família principal Hyūga;
- extremamente raro;
- apenas poucos casos documentados na história.

Cada Fujogan é único.

Suas propriedades devem ser analisadas individualmente na ficha do usuário.

---

## Consequência

Quanto maior o uso:
- maior a perda emocional do usuário.

O poder do Fujogan consome gradualmente a humanidade emocional do portador.

---

# X. YANG

## Conceito

O Yang representa:
- emoções;
- instinto;
- intensidade vital.

---

## As 7 Emoções Fundamentais

🟣 Roxo — Intensidade  
🔵 Azul Escuro — Frieza  
🔷 Azul Claro — Serenidade  
🟢 Verde — Determinação  
🟡 Amarelo — Orgulho  
🟠 Laranja — Fúria  
🔴 Vermelho — Impulso

---

## Yang Absoluto

A união das sete emoções cria o Yang Absoluto.

Características:
- vida absoluta;
- instinto perfeito;
- chakra baseado em emoção;
- combate guiado pela essência vital.

Hades afirma ter alcançado este estado.  
Ainda não existem explicações completas registradas.

---

# XI. YING

## Conceito

O Ying representa:
- conceitos;
- existência;
- leis fundamentais da realidade.

---

## Os 7 Mangekyō Fundamentais

⏳ Tempo — Oddy  
🌌 Espaço — Naoki  
🌀 Realidade — Sho  
🧵 Destino — Kuromi  
🕳️ Entropia — Shizumi  
🔗 Conexão — Ayumi  
🎯 Seleção — Madara

---

## Ying Absoluto

A união dos sete conceitos cria:
- Existência Absoluta.

Capacidades:
- manipulação da realidade;
- controle conceitual da existência;
- domínio das leis universais.

---

# XII. SENJUTSU

## Funcionamento

Usuários absorvem energia natural para fortalecer:
- corpo;
- chakra;
- percepção;
- técnicas.

---

## Aprendizado

O Senjutsu pode ser aprendido através de:
- animais sábios;
- treinamentos específicos;
- conexões naturais raras.

---

## Exceção Histórica

Nishinoya Senju foi o único usuário conhecido a desenvolver Senjutsu sem treinamento direto de animais sábios.

---

# XIII. AOI KATON

## Definição

O Aoi Katon é uma evolução natural extremamente rara do Katon.

---

## Usuário Conhecido

O único usuário registrado é:
- Nishinoya Senju.

---

# XIV. BIJUUS

As Bijūs seguem majoritariamente os registros clássicos shinobi:
- consciência;
- personalidade;
- vontade própria.

---

# XV. BIJUU PROFANA

## Definição

A Bijū Profana NÃO é uma criatura externa.

Ela é:
- manifestação mental do Chakra Profano.

---

## Condições de Manifestação

São necessárias:
- mente infantil;
- mais de 50% do sistema composto por Chakra Profano.

---

## Função

A Bijū Profana:
- estabiliza o hospedeiro;
- regula o Chakra Profano;
- impede colapso mental;
- evita morte cerebral.

---

## Observação

Cada Bijū Profana é única.

---

# XVI. TECNOLOGIA

## OCA

A OCA possui a tecnologia mais avançada do mundo shinobi.

Inclui:
- próteses;
- chips;
- engenharia biológica;
- modificações corporais;
- experimentos humanos;
- tecnologia militar avançada.

---

# XVII. MODIFICAÇÕES CORPORAIS

Existem modificações utilizando:
- células especiais;
- tecnologia da OCA;
- engenharia genética.

---

# XVIII. MORTE

## Regra Absoluta

É impossível reviver alguém de forma perfeita.

---

## Edo Tensei

O Edo Tensei:
- é temporário;
- não constitui ressurreição verdadeira.

---

## Shiki Fūjin

O Shiki Fūjin atua diretamente sobre a alma.

Seu selamento é considerado absoluto.

---

# XIX. LIMITES ABSOLUTOS

As seguintes ações são consideradas impossíveis:

- reviver alguém perfeitamente;
- ignorar completamente custos de poder;
- utilizar poder infinito absoluto;
- superar leis universais sem consequências;
- estabilizar Chakra Profano sem condições específicas.

---

# XX. DEUS SHINOBI

"Deus Shinobi" não é um rank oficial.

É um título simbólico concedido a indivíduos reconhecidos mundialmente como existências acima do padrão shinobi.

Exemplo conhecido:
- Nishinoya Senju.

---

# XXI. ENVELHECIMENTO

- Humanos envelhecem normalmente.
- Chakra não aumenta expectativa de vida.
- Não existem seres naturalmente centenários.
- O corpo humano possui limites físicos absolutos.

---

# XXII. PRINCÍPIO CENTRAL DA ERA GENÉTICA

A Era Genética é construída sobre:
- emoção;
- evolução;
- ruptura da natureza humana;
- transcendência;
- identidade;
- poder;
- existência.

O conflito central do universo gira em torno da tentativa humana de ultrapassar seus próprios limites naturais.