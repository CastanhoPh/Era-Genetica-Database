// Ordem de força ditada pelo Pedro — o ranking de quem bate em quem, do mais forte pro mais fraco.
//
// É uma lista SEPARADA do NC de propósito. O NC diz o patamar; dentro do mesmo patamar quem vem
// primeiro aqui é o mais forte. A lista foi ditada agrupada por NC, mas guardamos ela achatada:
// assim, se o NC de alguém mudar depois, ele muda de bloco na tela sem precisar reescrever a ordem.
//
// Os nomes aqui são os nomes de ficha (`character.name`), não os nomes falados — é o que permite
// casar sem heurística. Quem não está na lista cai no fim do próprio bloco de NC e a tela marca
// isso, então dá pra ver de longe quem ainda falta o Pedro posicionar.
export const ORDEM_DE_FORCA: string[] = [
  // NC 30
  'Nishinoya Senju',
  'Kaizuka Hyuga',
  'Raikun Hatake',
  'Hana Sabaku',
  'Naomi Uzumaki',
  'Kaien Ishi (Omega)',
  'Tobirama Senju',
  'Ganmaren Yuki',
  // NC 29
  'Rock Gunma',
  'Juzo Kuroshio',
  'Kiyoshi Hagane',
  'Hoshiro Hyuga',
  'Amakumo Hōzuki',
  'Sho Uchiha',
  'Enkai Kuroshio',
  'Genzō Umikage',
  // NC 28
  'Shiita Sabaku (Theta)',
  'Hiroshi Hanzo',
  'Katakana Yotsuki (Alpha)',
  'Ganmasen Yuki (Gama)',
  'Deruta Muujin (Delta)',
  'Kōga Kirisame',
  'Gordon Kirisame',
  'Oogway Uchiha',
  'Hisoka Senju',
  'Ayame Sazanami',
  'Hahiko Shiosaki',
  'Raizuki Hoshigaki',
  // NC 27
  'Reto Sabaku',
  'Satoshi Namikaze',
  'Kuromi Uchiha',
  'Katsuo Uzumaki',
  'Shikatsu Nara (Togo Kage)',
  'Tōma Umikage',
  'Mei Yuki',
  'Chigiri Chinoike',
  'Gorai Arashiumi',
  'Himari Yuki',
  'Shizuru Kurogane',
  // NC 26
  'Shikure Chinoike',
  'Nao Arashio',
  'Genei (G)',
  'Naoki Uchiha',
  'Mirei Sazanami',
  'Yuji Yotsuki',
  'Borashi Hyuga (B)',
  'Enrai Hanzo',
  'Inazuma Kazuchi',
  // NC 25
  'Tessai Enshaku',
  'Akira Dokuhana',
  'Daichi Muujin',
  'Asami Hyuga',
  'Yumi Uzumaki',
  'Chisaki Dokuhana (C)',
  'Nayara Kazemori',
  // NC 24
  'Akairo Uchiha (A)',
  'Mika Yotsuki',
  'Arashi Shidehara',
  'Apollo Sarutobi',
  'Suiren Shiranami',
  // NC 23
  'Tetsu Sabaku',
  'Mizue Dokuhana',
  'Raiden Yotsuki',
  'Yoru Kurogami',
  // NC 22
  'Shikaki Nara',
  'Midori Kurogane',
  'Nagi Yuki',
  'Yasuo Kurogane',
  'Raizen Kurogane',
  // NC 21
  'Sayuri Sabaku',
  'Kurohime Kazeori',
  'Akane Sumigami',
  // NC 20
  'Hirato Ishi',
  'Hikaru Ishi',
  'Reito Kurogami',
  // NC 18
  'Hayato Hanzo (H)',
  'Ryuta Hyuga',
  'Shizumi Uchiha',
  'Airi Senju',
  'Ayumi Uchiha',
  'Koji Ishizuma',
  'Daiki Uzumaki (D)',
  'Yuuto Han',
  'Shin Mizukari',
  // NC 14
  'Etsuko Senju (E)',
  'Fuyuki Dokuhana (F)',
  // NC 8
  'Shoyu Uzumaki',
  'Souma Namikaze',
  'Reika Uzumaki',
];

// Quem fica FORA do ranking de força não é uma lista à parte: é a própria tag de tipo da ficha.
// `categories` sempre começa com o tipo — 'Personagem', 'NPC', 'Vilão' — e as 10 fichas marcadas
// 'Personagem' são justamente os principais, que têm NC mas não disputam força com ninguém.
//
// Derivar em vez de listar à mão é o que impede o desalinho: ficha nova marcada 'Personagem' já
// nasce fora do ranking, e nenhuma lista precisa ser lembrada. Uso `includes` e não `[0]` porque a
// posição da tag no array não é garantida por nada — hoje é sempre a primeira, por convenção.
export const TIPO_FORA_DO_RANKING = 'Personagem';
export const foraDoRanking = (categories?: string[]): boolean =>
  (categories ?? []).includes(TIPO_FORA_DO_RANKING);

// Mapa nome -> posição, pra ordenar em O(1). Quem não está na lista recebe uma posição depois do
// último colocado — finita de propósito, porque `Infinity - Infinity` daria NaN no comparador e
// embaralharia justamente quem a gente quer ver junto no fim do bloco.
const POSICAO = new Map(ORDEM_DE_FORCA.map((n, i) => [n, i]));
export const posicaoDeForca = (nome: string): number => POSICAO.get(nome) ?? ORDEM_DE_FORCA.length;
export const estaNaOrdemDeForca = (nome: string): boolean => POSICAO.has(nome);
// Quem tem ficha, não está na ordem e também não é principal: é pendência de verdade, o Pedro
// ainda precisa dizer onde entra.
export const semPosicaoNaForca = (nome: string, categories?: string[]): boolean =>
  !POSICAO.has(nome) && !foraDoRanking(categories);
