export interface Power {
  name: string;
  level: number | string;
}

export interface Stats {
  strength: number | string;
  dexterity: number | string;
  agility: number | string;
  intelligence: number | string;
  spirit: number | string;
  vigor: number | string;
  perception: number | string;
}

export interface Technique {
  name: string;
  classification?: string;
  nature?: string;
  description?: string;
  destruction?: string;
  history?: string;
  status?: string;
  image?: string;
  /**
   * Cores dos dois fachos do anel de rank Z, quando a técnica usa mais de um chakra. Um valor
   * pinta só o primeiro facho, dois pintam um cada. O que faltar cai no `chakraColor` do
   * personagem, que é o padrão — técnica de um chakra só não precisa deste campo.
   */
  chakraColors?: string[];
}

export interface GalleryImage {
  url: string;
  caption?: string;
  /** "era" = fase da Linha do Tempo · "transformacao" = Modo/Transformação · "evento" = cena. */
  category: 'era' | 'evento' | 'transformacao';
  /** Só relevante para category "evento": qual temporada/arco (1ª a 5ª Temporada). */
  season?: string;
  /**
   * Só para category "evento": docId do item do checklist que gerou esta entrada. É por ele que a
   * entrada é encontrada quando os participantes mudam — a URL não serve de chave porque quatro
   * eventos estão duplicados no checklist e dois itens apontam para a mesma imagem.
   */
  eventId?: string;
}

export const EVENT_SEASONS = ['1ª Temporada', '2ª Temporada', '3ª Temporada', '4ª Temporada', '5ª Temporada'] as const;

// Item da checklist de produção de imagens (organizada por Temporada > Arco > Subarco).
// Também reaproveitado para a Linha do Tempo (type: "timeline"): nesse caso
// `temporada` guarda o nome do personagem e `arco` guarda a fase da linha do tempo.
// Mesma coisa para Modos e Transformações (type: "transformacao"), com `arco` guardando o
// nome do modo (ex: "Manto Matatabi V1") — é uma lista aberta, não um conjunto fechado de
// fases como a Linha do Tempo.
// E para Capa (type: "capa"): um item por personagem, com `temporada`, `arco` e `name`
// todos iguais ao nome do personagem (mesmo padrão "achatado" da Linha do Tempo, um nível
// mais raso — não existe fase, só a capa em si).
//
// Cada type corresponde a um projeto do Canva, 1 pra 1 — é o que permite mapear página do
// design para item do checklist. Por isso Modos e Transformações é um type próprio, e não
// mais fases avulsas dentro de "timeline".
/**
 * Uma invocação na ficha do dono. Vem de dois projetos do Canva, ambos 4:3: a `capa` é o retrato
 * que o card mostra, e a `arte` é a ilustração cheia que abre ao clicar.
 */
export interface Invocacao {
  /** Nome próprio da criatura — "Gurenmaru", "Yuki Fukuro", "Zotora". */
  nome: string;
  /** Capa 4:3, do projeto "Capas Invocação". É a imagem do card. */
  capaUrl?: string;
  /** Arte cheia 4:3, do projeto "Invocações". É o que abre ao clicar no card. */
  arteUrl?: string;
  /** Rank na mesma escala do arsenal: Z, S++, S+, S. */
  rank?: string;
  /** Natureza, herdada do dono: Mokuton, Fujogan, Senjutsu, Kage Mane, Ketton, Doton, Hyouton, Matatabi, Kurama. */
  nature?: string;
  /** Vila de origem da invocação. */
  village?: string;
  /** A arte é uma página em branco: existe arquivo, não existe desenho. */
  placeholder?: boolean;
}

export interface ChecklistItem {
  docId?: string;
  /**
   * Um por projeto do Canva, porque cada projeto tem um formato próprio. Ausente = "evento", que é
   * o padrão histórico.
   *
   *   evento         16:9         Eventos
   *   timeline       1080×1620    Linha do Tempo
   *   transformacao  1080×1620    Modos e Transformações
   *   capa           4:3          Capas Personagens
   *   invocacao      4:3          Invocações — a arte da criatura
   *   capaInvocacao  4:3          Capas Invocação — a capa de cada invocação
   *   arsenal        1080×1080    Arsenal — a arte de cada arma
   */
  type?: 'evento' | 'timeline' | 'capa' | 'transformacao' | 'invocacao' | 'capaInvocacao' | 'arsenal';
  temporada: string;
  arco: string;
  subarco?: string;
  name: string;
  /** Ordem global de exibição (sequência única entre todos os itens). */
  order: number;
  done: boolean;
  /** Item "Será adicionado em breve": ainda não tem conteúdo definido, não é marcável. */
  placeholder?: boolean;
  /** Nome de quem marcou o item como feito (só preenchido quando done=true). */
  doneBy?: string | null;
  /** URL da imagem já produzida para este item (exibida na aba Galeria). */
  imageUrl?: string | null;
  /**
   * Só para evento: quem estava na cena, por nome completo. É a fonte da verdade — a imagem do
   * evento aparece na aba Eventos da ficha de cada um desses, e sai de lá quando o nome sai daqui.
   * Aceita nome de protótipo ou de pendente: quem ainda não tem ficha fica guardado aqui e passa a
   * aparecer no dia em que a ficha existir.
   */
  /**
  * Rank da invocação, na mesma escala do arsenal (Z, S++, S+, S, A+). Só faz sentido nos tipos
  * `invocacao` e `capaInvocacao`, e o reconciliador leva ele para a ficha.
  */
  rank?: string;
  /** Natureza da invocação — o caminho de chakra do dono (Mokuton, Fujogan, Senjutsu…). */
  nature?: string;
  /** Vila da invocação. É a origem DELA, não a do dono: o Nagi tem ficha em Konohagakure e a
   *  invocação dele é de Kirigakure, de onde vem o clã Yuki. */
  village?: string;
  personagens?: string[];
  /**
   * Só para evento: o elenco está fechado, ou seja, todo mundo que aparece na imagem já foi
   * marcado. Separado do `done`, que é sobre a ARTE existir — um evento pode ter a arte pronta e o
   * elenco pela metade, e sem esta marca não há como distinguir "só duas pessoas nessa cena" de
   * "parei de marcar na segunda".
   */
  elencoFechado?: boolean;
}

// Rascunho livre de personagem em desenvolvimento (aba "Protótipo" do Painel): o Pedro manda
// imagens/textos aos poucos, antes de o personagem virar ficha oficial ou entrar em
// PENDING_CHARACTERS. Um card por protótipo (título = nome do personagem), que pode acumular
// várias imagens e texto ao longo do tempo. Apagado por completo ao fim do RPG.
export interface PrototypeEntry {
  docId?: string;
  title: string;
  /** Vila do personagem (Konohagakure, Kirigakure, Sunagakure, Iwagakure ou Kumogakure) — organiza a aba em sub-abas por vila. */
  village: string;
  text?: string;
  images: string[];
  /** Ordem de exibição (mais recente por último). */
  order: number;
  /** Subgrupo dentro da vila (ex: nome da frota em Kirigakure — Kraken, Leviatã,
   * Megalodon, Jörmungandr). Opcional; quando ausente, o card entra em "Outros". */
  subgroup?: string;
  /** Posto dentro do subgrupo (ex: Almirante, Vice-Almirante, Capitão de Frota,
   * Capitão-Tenente em Kirigakure). Usado pela visão "Kanban" — opcional. */
  rank?: string;
}

// Uma pessoa dentro de uma árvore genealógica (aba "Árvore" do Painel/site — recurso
// experimental: se não funcionar bem, a aba e a coleção inteira são apagadas sem afetar
// mais nada). Se o nome bater com um personagem já cadastrado em `characters`, o card
// vira link pra ficha dele.
export interface FamilyTreeMember {
  name: string;
  isDead?: boolean;
  /** Nome do cônjuge (opcional; basta registrar de um dos dois lados). */
  spouse?: string;
  /** Nomes dos pais (0, 1 ou 2). Ausente/vazio = geração raiz da árvore. */
  parents?: string[];
  /**
   * Nome de outro personagem cadastrado cuja FOTO deve ser usada no card (twist de
   * identidade secreta — ex: alguém da árvore que na verdade é outro personagem já
   * revelado). Só empresta a imagem; o nome exibido e o clique continuam sendo os do
   * `name` normal, então o segredo não aparece escrito em lugar nenhum.
   */
  secretImageFrom?: string;
}

export interface FamilyTree {
  docId?: string;
  /** Nome de exibição da família, ex: "Senju". */
  family: string;
  members: FamilyTreeMember[];
  /** Ordem de exibição entre as famílias. */
  order: number;
}

export interface Character {
  docId?: string; // ID do documento no Firestore (slug do nome)
  id: number;
  name: string;
  clan: string;
  categories: string[];
  titles: string[];
  nc: number;
  position: string;
  role: string;
  description: string;
  hp: number;
  chakra: number;
  image: string;
  stats: Stats;
  powers: Power[];
  aptitudes: string[];
  isDead?: boolean;
  killedBy?: string;
  techniques?: Technique[];
  arsenal?: number[];
  gallery?: GalleryImage[];
  /**
   * Invocações do personagem, cópia desnormalizada do checklist — mesma escolha da `gallery`: a
   * ficha é pública e não pode ler as 741 linhas do `imageChecklist` só para achar as suas.
   *
   * Reconstruído por `npm run invocacoes:fix`, que casa o `temporada` do item (o primeiro nome do
   * dono) com a ficha. Editar aqui à mão é perder na próxima reconciliação.
   */
  invocacoes?: Invocacao[];
  /** Temporada da 1ª aparição na história (padrão: "Prólogo"). Fases antes disso não existem. */
  timelineAppearance?: string;
  /** Temporada em que o personagem morreu, se aplicável — nada depois disso existe. */
  timelineDeath?: string | null;
  /** Temporadas em que o personagem não apareceu (buraco pontual, volta depois). */
  timelineSkipped?: string[];
  /** Boss final ou similar: não tem Linha do Tempo nenhuma, de propósito. */
  timelineExcluded?: boolean;
  /**
   * Cargos de liderança da vila, da lista que o Pedro validou (2026-08-27). Lista porque oito
   * fichas têm dois: o Nishinoya é 3º Hokage e 2º Líder da Equipe de Elite, o Hiroshi Hanzo é
   * 3º Líder de Rastreio em Konoha e 2º General em Kumo. A ordem é a da lista dele, do posto
   * Ordenada por chefia de vila primeiro: Hokage, Kazekage, Raikage, Mizukage, Tsuchikage,
   * General e Governador vêm antes de qualquer liderança de divisão. Dentro do mesmo nível a
   * ordem é a da lista do Pedro, que não define precedência entre divisões — por isso o par
   * Ambu/Rastreio do Katsuo, Equipe de Elite/Inovações do Raikun e Dama/Força Médica da Yumi
   * estão na ordem em que ele escreveu, não numa hierarquia. O card mostra só o primeiro.
   *
   * Só no Firestore, como `vila` e `organizacao`.
   */
  cargo?: string[];
  /**
   * Patente dentro da organização, separada de `position` na mesma data. Texto único porque
   * ninguém tem duas patentes, mesmo entre os três que têm duas organizações.
   *
   * Tem prioridade sobre o `cargo` na exibição: quem tem organização mostra a patente dela.
   * Só no Firestore.
   */
  patente?: string;
  /**
   * Graduação de ninja: Genin, Chunin, Jounin, Jounin de Elite, Sannin, Sannin de Elite.
   * Separada de `position` em 2026-08-27, quando ficou claro que aquele campo guardava três
   * coisas diferentes: cargo de vila, patente de organização e esta escada.
   *
   * Não é exibida em lugar nenhum ainda — o card e a ficha mostram só o `position`. Sai do NC,
   * então quando for implementada vira valor derivado e não escolha; até lá é o valor que o
   * campo antigo tinha, preservado para não se perder.
   */
  graduacao?: string;
  /**
   * Vilas do personagem, migrado de `categories` (2026-08-27). Lista porque uma ficha pode ter
   * duas vilas — o Hiroshi Hanzo e o Rock Gunma têm. Todo mundo tem pelo menos uma, mesmo quem é
   * só membro sem cargo; as duas exceções propositais são o Genei e o Hades, deixados sem vila.
   *
   * Escrito e mantido só no Firestore, como o `focosAtributo` — `data/characters.ts` não tem esse
   * campo, e por isso ele está na whitelist `SO_NO_FIRESTORE` do `scripts/sync-push.mjs`.
   */
  vila?: string[];
  /**
   * Organizações do personagem, também migrado de `categories`. Diferente da vila, é opcional:
   * 44 das 86 fichas têm. Três têm duas (Shikatsu Nara, Shikure Chinoike, Yuuto Han). Só no
   * Firestore, igual ao `vila`.
   */
  organizacao?: string[];
  /** Vila de nascença (única, mesmo quando `categories` lista mais de uma vila de afiliação/atuação). */
  birthVillage?: string;
  /** Cor do chakra em hex. Pinta os dois fachos do anel nas técnicas e armas de rank Z. */
  chakraColor?: string;
  /**
   * Estilo de combate. Nunca é exibido — serve só para distribuir atributo quando o NC sobe:
   *
   *   Corporal   → Força e Agilidade vão ao teto (= NC), Destreza e Percepção ao mínimo
   *   Distância  → Destreza e Percepção vão ao teto, Força e Agilidade ao mínimo
   *
   * O que sobra fica com Vigor, Espírito e Inteligência, que o Pedro informa. A conta fecha em
   * todo NC de 4 a 30 — a sobra nunca cai fora da faixa [3 × mínimo, 3 × NC].
   *
   * Atributo já acima do mínimo NÃO desce. E não existe "Híbrido": o que era marcado assim é
   * Distância com a aptidão Acuidade, que 54 das 86 fichas têm.
   */
  combatStyle?: 'Corporal' | 'Distância';
  /**
   * Quais dos três atributos livres (Inteligência, Vigor, Espírito) recebem a sobra primeiro quando o
   * NC sobe. Até dois. Vazio ou ausente = os três dividem por igual.
   *
   * Interno, como o combatStyle — junto com ele, os sete atributos de qualquer NC ficam determinados.
   * O que sobra é repartido pelo divisaoAtributo, logo abaixo. Ver data/atributos.ts.
   */
  focosAtributo?: ('inteligencia' | 'vigor' | 'espirito')[];
  /**
   * Em que proporção os livres que NÃO são foco repartem o que sobrou, em percentuais que somam 100
   * (passos de 5). Ausente = partes iguais.
   *
   * É o que separa dois personagens com o mesmo foco: Kaito e Takeshi têm Espírito no teto, mas o
   * Kaito reparte Inteligência/Vigor 60/40 (→ 17/11) e o Takeshi 55/45 (→ 15/13). A proporção incide
   * sobre o total que sobrou, não sobre o excedente do mínimo. Ver data/atributos.ts.
   */
  divisaoAtributo?: Partial<Record<'inteligencia' | 'vigor' | 'espirito', number>>;
}

/** Peso de cada rank, do mais forte para o mais fraco. Usado para ordenar o Arsenal. */
export const CLASSIFICATION_PRIORITY: Record<string, number> = {
  'Z': 100,
  'S++': 90,
  'S+': 80,
  'S': 70,
  'A+': 60,
  'A': 50,
  'B+': 45,
  'B': 40,
  'C+': 35,
  'C': 30,
  'D': 20,
  'E': 10,
  'F': 0,
};

export const SEASON_ORDER = ['Prólogo', 'Clássico', '1ª Temporada', '2ª Temporada', '3ª Temporada', '4ª Temporada', '5ª Temporada'] as const;

// Nomes/marcos das temporadas — PROVISÓRIO, só referência (não usar em outro lugar do app).
export const SEASON_LORE: { season: string; title: string; start: string; end: string }[] = [
  { season: 'Prólogo', title: 'O Início', start: '1ª Guerra Ninja', end: 'Fundação de Konoha e Primeiras Gerações' },
  { season: 'Clássico', title: 'Um mundo de Paz', start: 'Início da Academia Ninja', end: 'Fim da Academia Ninja' },
  { season: '1ª Temporada', title: 'Prefácios', start: 'Lámen com Nishinoya', end: 'Hiato Pós Exame Chunin' },
  { season: '2ª Temporada', title: 'A Primeira Queda', start: 'Reencontro de Kaito, Oddy, Katsumi e Najin', end: 'Luta contra Omega' },
  { season: '3ª Temporada', title: 'Ecos da Dor', start: 'Morte de Nishinoya', end: 'Treinamento com Kai' },
  { season: '4ª Temporada', title: 'A Última Esperança', start: 'Volta do Treinamento', end: 'Luta contra os Kages' },
  { season: '5ª Temporada', title: '', start: 'Chegada a Sunagakure', end: '(em andamento)' },
];

// Personagens que já existem na história mas ainda não foram cadastrados no Banco de Dados.
// Baseado na lista mestre que o Pedro mantém à parte — atualizar conforme ele for adicionando.
// `role` é só pra lembrete (parentesco/cargo), não é dado oficial de ficha. `nc` é opcional —
// só preenchido quando o Pedro já decidiu o NC do personagem antes de ele virar ficha oficial.
/**
 * Um item da aba "A Fazer" do Painel. É a lista de pendências do RPG que não cabem em código nem no
 * checklist de imagens: decisões de lore, dados que só o Pedro tem, coisas para não esquecer.
 *
 * Vive em coleção própria (`aFazer`) e só o admin lê, como os protótipos — é anotação interna.
 */
export interface TodoItem {
  docId?: string;
  texto: string;
  /** Agrupador livre, digitado à mão: "Invocações", "Arte", "Fichas"… Vazio cai em "Sem grupo". */
  grupo?: string;
  feito?: boolean;
  /** Posição dentro do grupo. Item novo entra no fim. */
  ordem: number;
  /** ms desde a época. Serve para o "há N dias" e para desempatar ordem igual. */
  criadoEm?: number;
}

export const PENDING_CHARACTERS: { village: string; entries: { name: string; role?: string; dead?: boolean; nc?: number }[] }[] = [
  {
    village: 'Konohagakure',
    entries: [
      { name: 'Amai Inuzuka', role: 'Mãe de Najin e Takeshi', nc: 25 },
      { name: 'Kawarama Senju', role: 'Pai de Nishinoya', dead: true, nc: 28 },
      { name: 'Sakura Namikaze', role: 'Mãe de Nishinoya', dead: true, nc: 26 },
      { name: 'Mito Uzumaki', role: 'Esposa de Hashirama', dead: true, nc: 28 },
      { name: 'Hiruzen Sarutobi', role: 'Pai de Shoei e Apollo', nc: 28 },
      { name: 'Hina Sarutobi', role: 'Mãe de Shoei e Apollo', nc: 24 },
      { name: 'Oogway Uchiha', role: 'Pai de Sho e Shin', nc: 28 },
      { name: 'Konan Uchiha', role: 'Mãe de Naoki, Oddy, Kuromi, Ayumi e Shizumi', nc: 24 },
      { name: 'Inazuma Uchiha', role: 'Filho do Velho, morto por Beta, descartado pela OCA', dead: true, nc: 14 },
      { name: 'Shikado Nara', role: 'Pai de Shikaki e Shikatsu, morto por Hades', dead: true, nc: 26 },
      { name: 'Kurai Nara', role: 'Mãe de Shikaki e Shikatsu, morta por Hades', dead: true, nc: 26 },
      { name: 'Iwaki Haruno', role: 'Pai de Yui, ensinou Doton a Kaito e morto pelo Nagare', dead: true, nc: 18 },
      { name: 'Hina Haruno', role: 'Mãe de Yui', nc: 16 },
      { name: 'Yui Haruno', role: 'Criança Prodígio', nc: 8 },
      { name: 'Renji Hyuga', role: 'Irmão de Ryuta, treinou Katsumi e morto pelo Furyuzan', dead: true, nc: 16 },
      { name: 'Minoru Hyuga', role: 'Pai de Hoshiro, Kaizuka e Haruki, morto por Maldição do Fujogan', dead: true, nc: 30 },
      { name: 'Ashina Uzumaki', role: 'Pai de Mito, Yumi, Naomi e Katsuo, morreu selando Kurama em Naomi', dead: true, nc: 30 },
      { name: 'Akemi Hyuga', role: 'Esposa de Minoru Hyuga, mãe de Hoshiro, Kaizuka e Haruki' },
      { name: 'Akemi Shimura', role: 'Esposa de Oogway Uchiha, mãe de Sho e Shin' },
      { name: 'Atsuko Uchiha', role: 'Esposa de Sho Uchiha, mãe de Akairo e Genpachi' },
      { name: 'Ayame Namikaze', role: 'Esposa de Ashina Uzumaki, mãe de Mito, Yumi, Naomi e Katsuo' },
      { name: 'Butsuma Senju', role: 'Pai de Hashirama, Tobirama, Kawarama e Itama' },
      { name: 'Genpachi Shimura', role: 'Filho de Sho Uchiha e Atsuko Uchiha' },
      { name: 'Haruki Hyuga', role: 'Filho de Minoru e Akemi' },
      { name: 'Harunobu Namikaze', role: 'Pai de Sakura e Satoshi' },
      { name: 'Itama Senju', role: 'Filho de Butsuma e Kaori' },
      { name: 'Izuna Uchiha', role: 'Filho de Tajima e Setsuna' },
      { name: 'Kaori Senju', role: 'Mãe de Hashirama, Tobirama, Kawarama e Itama' },
      { name: 'Kohana Uzumaki', role: 'Esposa de Harunobu Namikaze, mãe de Sakura e Satoshi' },
      { name: 'Masahiro Hyuga', role: 'Irmão de Minoru Hyuga, pai de Ryuta e Renji' },
      { name: 'Reizan Yamanaka', role: 'Filho de Tajima e Setsuna' },
      { name: 'Satoshi Namikaze', role: 'Filho de Harunobu e Kohana' },
      { name: 'Sayuri Hyuga', role: 'Esposa de Masahiro Hyuga, mãe de Ryuta e Renji' },
      { name: 'Setsuna Yamanaka', role: 'Esposa de Tajima Uchiha, mãe de Madara, Izuna e Reizan' },
      { name: 'Shin Uchiha', role: 'Filho de Oogway e Akemi' },
      { name: 'Tajima Uchiha', role: 'Irmão de Oogway Uchiha, pai de Madara, Izuna e Reizan' },
      { name: 'Fuyuhiko Chinoike', role: 'Pai de Furyuzan e Shikure' },
      { name: 'Akane Shimura', role: 'Esposa de Fuyuhiko Chinoike, mãe de Furyuzan e Shikure' },
    ],
  },
  {
    village: 'Kirigakure',
    entries: [
      { name: 'Murasame Hoshigaki', role: 'Mãe de Kazuki, morta por Ganmasen', dead: true, nc: 18 },
      { name: 'Ganmaren Yuki', role: 'Grande Almirante da Marinha, comandante supremo das três frotas; irmão de Ganmasen', nc: 30 },
      { name: 'Amakuro Kozuki', role: 'Almirante da 1ª Frota (Kraken)', nc: 28 },
      { name: 'Seiran Kirisame', role: 'Vice-Almirante da 1ª Frota (Kraken)', nc: 28 },
      { name: 'Kōga Kirisame', role: 'Capitão de Frota da 1ª Frota (Kraken)', nc: 24 },
      { name: 'Nao Shiosaki', role: 'Capitão-Tenente da 1ª Frota (Kraken)', nc: 20 },
      { name: 'Raizen Kuroshio', role: 'Almirante da 3ª Frota (Megalodon)', nc: 28 },
      { name: 'Genzō Umikage', role: 'Vice-Almirante da 1ª Frota (Kraken)', nc: 26 },
      { name: 'Kaien Arashio', role: 'Capitão de Frota da 2ª Frota (Leviatã)', nc: 22 },
      { name: 'Suiren Shiranami', role: 'Capitão-Tenente da 1ª Frota (Kraken)', nc: 20 },
      { name: 'Rinako Kuroshio', role: 'Almirante da 2ª Frota (Leviatã)', nc: 28 },
      { name: 'Ayame Sazanami', role: 'Vice-Almirante da 3ª Frota (Megalodon)', nc: 26 },
      { name: 'Mirei Sazanami', role: 'Capitã de Frota da 3ª Frota (Megalodon)', nc: 22 },
      { name: 'Tōma Umikage', role: 'Capitão-Tenente da 3ª Frota (Megalodon)', nc: 20 },
      // 4ª Frota (Jörmungandr) — Almirante é o Ganmasen Yuki, que já tem ficha própria (não entra aqui).
      { name: 'Raizuki Hoshigaki', role: 'Pai de Kazuki, morto por Ganmasen; Vice-Almirante da 4ª Frota (Jörmungandr)', dead: true, nc: 28 },
      { name: 'Mei Yuki', role: 'Filha de Ganmasen, morta por Nagare; Capitã de Frota da 4ª Frota (Jörmungandr)', dead: true, nc: 22 },
      { name: 'Himari Yuki', role: 'Filho de Ganmasen, morto por Nagare; Capitão-Tenente da 4ª Frota (Jörmungandr)', dead: true, nc: 20 },
    ],
  },
  {
    village: 'Kumogakure',
    entries: [
      { name: 'Inazuma Kazuchi', role: 'Irmão mais velho de Yoru', nc: 26 },
      { name: 'Raiden Kurokumo', role: 'Criança prodígio', nc: 8 },
    ],
  },
  {
    village: 'Iwagakure',
    entries: [
      { name: 'Oryo Soryo', role: 'Mestre do Koton, Pai de Kenma e Líder da linhagem vermelha (Espírito)', nc: 30 },
      { name: 'Iwana Soryo', role: 'Mestre do Senjutsu e Mãe de Kenma', nc: 26 },
      { name: 'Bilal Bakuren', role: 'Criança Prodígio', nc: 8 },
      { name: 'Iwana Bakuren', role: 'Mãe de Bilal', nc: 16 },
      { name: 'Banjin Bakuren', role: 'Pai de Bilal', nc: 20 },
      { name: 'Iwato Kamizuru', role: 'Mestre das Abelhas e Líder da linhagem verde (Corpo)', nc: 27 },
      { name: 'Sora Ganseki', role: 'Mestre de Genjutsu pelas vibrações do solo e Líder da linhagem azul (Alma)', nc: 27 },
      { name: 'Sekio Ishi', role: 'Rei dos Samurai', nc: 30 },
      { name: 'Fudo Gunma', role: 'Pai de Rock Gunma, Primeiro Tsuchikage', nc: 30 },
      { name: 'Shingen Ishi', role: 'Irmão mais novo de Sekio Ishi', nc: 28 },
      { name: 'Tetsugen Ishi', role: 'Pai de Sekio Ishi', nc: 30 },
    ],
  },
];

// Armas/artefatos que já existem na história mas ainda não foram cadastrados no Arsenal.
// Mesmo espírito do PENDING_CHARACTERS, só que pra itens do Arsenal — `role` é lembrete
// (dono/contexto), `classification` é o rank (Z, S++, S+, S, A+, A, B, F) quando já souber.
export const PENDING_ARSENAL: { village: string; entries: { name: string; role?: string; classification?: string }[] }[] = [];