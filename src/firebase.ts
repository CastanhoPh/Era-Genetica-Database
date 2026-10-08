// Configuração e inicialização do Firebase (cliente / navegador).
// Estas chaves são públicas por design — a segurança fica nas regras do Firestore.
import { initializeApp } from "firebase/app";
import {
  initializeFirestore, getFirestore,
  persistentLocalCache, persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD5mgExupTw0hRMPNBDTd2Lzk0frx_lp1o",
  authDomain: "era-genetica-db.firebaseapp.com",
  projectId: "era-genetica-db",
  storageBucket: "era-genetica-db.firebasestorage.app",
  messagingSenderId: "6522730585",
  appId: "1:6522730585:web:b282b56d23cc0cfd539948",
};

export const app = initializeApp(firebaseConfig);

/**
 * Instância do Firestore usada em todo o app, com cache persistente (IndexedDB).
 *
 * O cache não é conforto, é conta: sem ele, todo `onSnapshot` que se conecta paga a coleção inteira,
 * sempre, mesmo que nada tenha mudado. Abrir o Painel custava 1.311 leituras (1.285 do checklist +
 * 26 do A Fazer) e o Checklist 1.388 — e cada volta ao Painel cobrava de novo. Com o cache, o SDK
 * guarda os documentos e um resume token, e ao reassinar o servidor manda só o que mudou.
 *
 * Onde isso mais pesava era o `npm run dev`: cada Ctrl+S dispara HMR, que remonta os componentes e
 * reassina os listeners. Uma tarde de edição com o Painel aberto rendia dezenas de milhares de
 * leituras sem ninguém usar o site.
 *
 * `persistentMultipleTabManager` é obrigatório aqui — sem ele, a segunda aba do navegador falha ao
 * ativar a persistência, e o Pedro trabalha com Painel e site abertos ao mesmo tempo.
 *
 * Não zera sempre: o resume token tem validade, e depois de muito tempo offline o SDK refaz a
 * consulta cheia. Reduz muito, não elimina.
 *
 * O fallback existe porque IndexedDB pode não estar disponível — janela anônima, navegador com dados
 * de site bloqueados. Ali o app volta ao comportamento antigo (paga as leituras) em vez de quebrar.
 */
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (e) {
    console.warn('Cache persistente do Firestore indisponível, seguindo sem ele:', e);
    return getFirestore(app);
  }
})();
