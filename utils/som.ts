// Os sons do aviso do Hanzo, sintetizados no navegador.
//
// POR QUE SINTETIZADO, e não arquivo de áudio: não entra MP3 no repositório, não há licença para
// conferir, não há download para o visitante, e o som sai exatamente com a cara do resto —
// onda quadrada, ruído branco e zumbido, que é do que era feito o som de máquina antiga.
//
// TODO SOM DEPENDE DE GESTO DO USUÁRIO. O navegador cria o AudioContext suspenso enquanto ninguém
// tiver clicado na página, e é por isso que `acorda()` existe e é chamado em todo lugar: ele tenta
// retomar, e se não conseguir deixa um ouvinte de clique/tecla armado para retomar na primeira
// interação. Sem isso o alarme sairia mudo para quem entrasse com a sessão já aberta.
//
// O volume mestre passa por `MUDO`, que vive no localStorage: quem desligar o som uma vez não o
// ouve de novo.

const CHAVE_MUDO = 'era-genetica-aviso-mudo';

let ctx: AudioContext | null = null;
let mestre: GainNode | null = null;
let ruido: AudioBuffer | null = null;

export const estaMudo = (): boolean => {
  try { return localStorage.getItem(CHAVE_MUDO) === '1'; } catch { return false; }
};

export const defineMudo = (mudo: boolean): void => {
  try { localStorage.setItem(CHAVE_MUDO, mudo ? '1' : '0'); } catch { /* janela anônima */ }
  if (mestre && ctx) mestre.gain.setTargetAtTime(mudo ? 0 : 1, ctx.currentTime, 0.02);
};

/** Cria o contexto na primeira chamada e tenta destravá-lo; se estiver suspenso, arma o gesto. */
function audio(): { ctx: AudioContext; mestre: GainNode } | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      mestre = ctx.createGain();
      mestre.gain.value = estaMudo() ? 0 : 1;
      mestre.connect(ctx.destination);

      // ruído branco de meio segundo, reaproveitado por todos os estalos e chiados
      ruido = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
      const d = ruido.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => { /* precisa de gesto: o ouvinte abaixo resolve */ });
      const destrava = () => { ctx?.resume().catch(() => {}); };
      window.addEventListener('pointerdown', destrava, { once: true });
      window.addEventListener('keydown', destrava, { once: true });
    }
    return { ctx, mestre: mestre! };
  } catch {
    return null;   // navegador sem Web Audio: o aviso funciona igual, só mudo
  }
}

/** Um tom curto. `tipo` muda o caráter: quadrada é alarme, dente de serra é motor. */
function tom(freq: number, dur: number, vol: number, tipo: OscillatorType = 'square', atraso = 0): void {
  const a = audio(); if (!a) return;
  const t = a.ctx.currentTime + atraso;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t);
  // ataque de 5ms e queda exponencial: corte seco estala no alto-falante
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(a.mestre);
  osc.start(t); osc.stop(t + dur + 0.02);
}

/** Um estalo: ruído branco passado por filtro, que é como soa relé e cabeçote de disco. */
function estalo(vol: number, freq: number, dur: number, atraso = 0): void {
  const a = audio(); if (!a || !ruido) return;
  const t = a.ctx.currentTime + atraso;
  const src = a.ctx.createBufferSource();
  const filtro = a.ctx.createBiquadFilter();
  const g = a.ctx.createGain();
  src.buffer = ruido;
  filtro.type = 'bandpass';
  filtro.frequency.value = freq;
  filtro.Q.value = 6;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filtro); filtro.connect(g); g.connect(a.mestre);
  src.start(t); src.stop(t + dur + 0.02);
}

/**
 * O alarme do URGENTE: duas notas duras se alternando, com chiado de interferência por cima.
 *
 * Devolve a função que desliga. Quem chama é responsável por chamá-la ao sair da fase — alarme que
 * continua tocando depois da tela sair é o pior defeito possível aqui.
 */
export function alarme(): () => void {
  let alta = true;
  const bater = () => { tom(alta ? 880 : 590, 0.22, 0.16); alta = !alta; };
  bater();
  const t1 = setInterval(bater, 260);
  // o chiado entra fora do compasso das notas, para não virar um pulso só
  const t2 = setInterval(() => estalo(0.10, 1200 + Math.random() * 2200, 0.09), 430);
  return () => { clearInterval(t1); clearInterval(t2); };
}

/**
 * Máquina antiga ligando: o zumbido da fonte subindo, relés fechando e o cabeçote procurando.
 *
 * O zumbido é um dente de serra grave que sobe de 42 para 58 Hz em dois segundos e fica. É o som
 * de ventoinha ganhando rotação, e é ele que sustenta a cena — os estalos por cima são o tempero.
 */
export function ligando(): () => void {
  const a = audio(); if (!a) return () => {};
  const t = a.ctx.currentTime;

  const zumbido = a.ctx.createOscillator();
  const gz = a.ctx.createGain();
  zumbido.type = 'sawtooth';
  zumbido.frequency.setValueAtTime(42, t);
  zumbido.frequency.linearRampToValueAtTime(58, t + 2);
  gz.gain.setValueAtTime(0, t);
  gz.gain.linearRampToValueAtTime(0.055, t + 1.2);
  zumbido.connect(gz); gz.connect(a.mestre);
  zumbido.start(t);

  // três relés fechando na partida
  [0, 0.28, 0.62].forEach((d, i) => estalo(0.3 - i * 0.06, 320 + i * 180, 0.06, d));

  // o cabeçote procurando, em intervalos irregulares: regular soaria como metrônomo
  const t1 = setInterval(() => {
    estalo(0.13, 900 + Math.random() * 1600, 0.05);
    if (Math.random() > 0.55) estalo(0.09, 2200 + Math.random() * 1200, 0.035, 0.07);
  }, 340);

  return () => {
    clearInterval(t1);
    try {
      const fim = a.ctx.currentTime;
      gz.gain.cancelScheduledValues(fim);
      gz.gain.setValueAtTime(gz.gain.value, fim);
      gz.gain.exponentialRampToValueAtTime(0.0001, fim + 0.35);   // desliga descendo, não cortado
      zumbido.stop(fim + 0.4);
    } catch { /* já parado */ }
  };
}

/** O bipe de POST, quando a máquina termina de subir. */
export function bipeDePartida(): void {
  tom(880, 0.09, 0.22, 'square');
  tom(1320, 0.16, 0.20, 'square', 0.11);
}

/** O clique seco de tecla, para a carta sendo impressa. Bem baixo: são centenas deles. */
export function tecla(): void {
  estalo(0.045, 2400 + Math.random() * 900, 0.022);
}
