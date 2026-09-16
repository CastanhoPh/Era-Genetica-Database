// Hook de autenticação: rastreia o admin logado e expõe login/logout.
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { auth } from './firebaseAuth';

const ADMIN_UID = '5Eo9GEhVMGgfmvKgDt68H5lBlcw2';
// Conta de QA usada pelo Claude pra testar telas administrativas (mesmo nível do ADMIN_UID).
const ADMIN_UIDS = new Set([
  ADMIN_UID,
  'QWQHFo4xUxevsRZronUVa1IzJTc2', // Claude (QA)
]);
// Amigos com acesso só à checklist de produção de imagens (não são admin do site).
const CHECKLIST_EDITOR_UIDS = new Set([
  'G2YvfxwlWoRz2TH878cnugTi8gi1', // Liu
  'csE07Qq2LLaUwg3wYSeNXWbVrE73', // Zeck
]);

/**
 * QUEM VÊ O AVISO DO HIROSHI HANZO ao entrar. Uma conta só, e ela não é admin nem editora da
 * checklist: o resto do site é o que qualquer visitante vê.
 *
 * O vínculo é por E-MAIL, não por UID, de propósito. Este endereço vai trocar pelo menos mais uma
 * vez — hoje aponta para a conta de teste, e na véspera da sessão passa para o Takeshi, para ele
 * não ver a mensagem antes da hora. Por e-mail a troca é esta linha; por UID seria preciso
 * descobrir o identificador da conta nova antes de poder escrever a linha.
 *
 * Trocar de volta: 'takeshi.hatake@eragenetica.com'.
 */
const EMAIL_DO_AVISO = 'teste@eragenetica.com';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  const login = (email: string, password: string) =>
    signInWithEmailAndPassword(auth, email, password);

  const logout = () => signOut(auth);

  const isAdmin = !!user && ADMIN_UIDS.has(user.uid);
  const isChecklistEditor = isAdmin || (!!user && CHECKLIST_EDITOR_UIDS.has(user.uid));

  const veAviso = !!user && user.email?.toLowerCase() === EMAIL_DO_AVISO;

  return { user, isAdmin, isChecklistEditor, veAviso, authReady, login, logout };
}
