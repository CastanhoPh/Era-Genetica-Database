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
 * O vínculo é por E-MAIL, não por UID, de propósito. Até a véspera da sessão o endereço era o da
 * conta de teste, para o Takeshi não ver a mensagem antes da hora; agora aponta para ele. Por
 * e-mail a troca é esta linha; por UID seria preciso descobrir o identificador da conta nova antes
 * de poder escrever a linha.
 *
 * Voltar para a conta de teste: 'teste@eragenetica.com'.
 */
const EMAIL_DO_AVISO = 'takeshi.hatake@eragenetica.com';

/**
 * Marca que o último login partiu DESTA aba.
 *
 * O Firebase espalha o login para todas as abas abertas do site. Sem a marca, cada aba via a conta
 * do aviso entrar e abria a sequência por conta própria — o Pedro saiu da conta numa aba e deu de
 * cara com o aviso rodando na outra.
 */
let loginDestaAba = false;

/** Diz se a troca de usuário que acabou de chegar veio de um login feito nesta aba, e apaga a marca. */
export function trocaVeioDestaAba(): boolean {
  const veio = loginDestaAba;
  loginDestaAba = false;
  return veio;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  const login = (email: string, password: string) => {
    loginDestaAba = true;
    return signInWithEmailAndPassword(auth, email, password).catch(e => {
      loginDestaAba = false;   // senha errada não pode deixar a marca para um login de outra aba
      throw e;
    });
  };

  const logout = () => signOut(auth);

  const isAdmin = !!user && ADMIN_UIDS.has(user.uid);
  const isChecklistEditor = isAdmin || (!!user && CHECKLIST_EDITOR_UIDS.has(user.uid));

  const veAviso = !!user && user.email?.toLowerCase() === EMAIL_DO_AVISO;

  return { user, isAdmin, isChecklistEditor, veAviso, authReady, login, logout };
}
