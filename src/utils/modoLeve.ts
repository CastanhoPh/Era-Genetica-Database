// MODO LEVE — desliga os efeitos visuais caros para o site rodar em computador simples.
//
// Nasceu da véspera de uma sessão: o computador que ia ser usado era fraco e o site travava na
// rolagem. Em vez de tirar os efeitos de todo mundo, ele virou uma chave por aparelho — quem tem
// máquina boa continua vendo o terminal inteiro, e só quem liga o modo abre mão dele.
//
// O modo é UMA classe na raiz (`html.modo-leve`) e o CSS em index.css faz o resto. Não há lógica
// espalhada por componente: ligar e desligar é pôr e tirar a classe, e é por isso que desligar
// devolve o site exatamente como era.
//
// A preferência é por navegador, como a de capas coloridas, e nunca sai daqui. Ela é aplicada
// ANTES da primeira pintura por um script inline no index.html — sem isso a página nasceria com os
// efeitos, piscaria, e só depois o React tiraria. Este arquivo cuida do resto: ler, gravar e
// avisar quem estiver ouvindo.
import { useEffect, useState } from 'react';

/** Onde a preferência mora no navegador. O script do index.html lê esta MESMA chave. */
export const CHAVE_MODO_LEVE = 'era-genetica:modo-leve';
const CLASSE = 'modo-leve';
const EVENTO = 'era-genetica:modo-leve-mudou';

/** Lê a preferência gravada. Navegador sem armazenamento (aba anônima, bloqueio) conta como desligado. */
export function modoLeveGravado(): boolean {
  try {
    return localStorage.getItem(CHAVE_MODO_LEVE) === '1';
  } catch {
    return false;
  }
}

/** Liga ou desliga a classe na raiz, sem gravar nada. */
export function aplicarModoLeve(ligado: boolean) {
  document.documentElement.classList.toggle(CLASSE, ligado);
}

/** Grava a preferência, aplica, e avisa os outros componentes que estiverem mostrando o estado. */
export function definirModoLeve(ligado: boolean) {
  try {
    if (ligado) localStorage.setItem(CHAVE_MODO_LEVE, '1');
    else localStorage.removeItem(CHAVE_MODO_LEVE);
  } catch {
    // sem armazenamento a preferência não sobrevive ao recarregar, mas vale para esta visita
  }
  aplicarModoLeve(ligado);
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: ligado }));
}

/** O estado do modo leve, sincronizado entre componentes e entre abas do mesmo navegador. */
export function useModoLeve(): [boolean, (ligado: boolean) => void] {
  const [ligado, setLigado] = useState(modoLeveGravado);

  useEffect(() => {
    const aqui = (e: Event) => setLigado(Boolean((e as CustomEvent<boolean>).detail));
    // outra aba mudou: o evento `storage` só dispara nas OUTRAS abas, nunca na que gravou
    const outraAba = (e: StorageEvent) => {
      if (e.key !== CHAVE_MODO_LEVE) return;
      const novo = e.newValue === '1';
      aplicarModoLeve(novo);
      setLigado(novo);
    };
    window.addEventListener(EVENTO, aqui);
    window.addEventListener('storage', outraAba);
    return () => {
      window.removeEventListener(EVENTO, aqui);
      window.removeEventListener('storage', outraAba);
    };
  }, []);

  return [ligado, definirModoLeve];
}
