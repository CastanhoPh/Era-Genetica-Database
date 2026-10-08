// Auth separado do firebase.ts principal — fica no próprio chunk (firebase/auth só entra
// no bundle de quem realmente usa login, não some no chunk pesado do Firestore).
import { getAuth } from "firebase/auth";
import { app } from "./firebase";

export const auth = getAuth(app);
