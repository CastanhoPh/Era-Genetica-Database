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
 * O Takeshi. Não é admin nem editor da checklist: a conta existe para ele ver o aviso do Hiroshi
 * Hanzo ao entrar, e o resto do site é o que qualquer visitante vê.
 */
const TAKESHI_UID = 'rAX7bghZPgRwuZcfiT2jWhL6X6E3';

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

  const ehTakeshi = !!user && user.uid === TAKESHI_UID;

  return { user, isAdmin, isChecklistEditor, ehTakeshi, authReady, login, logout };
}
