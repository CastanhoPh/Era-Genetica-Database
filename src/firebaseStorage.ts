// Storage separado do firebase.ts principal — só é baixado quando algo que realmente usa
// upload/leitura de Storage é carregado (Painel administrativo, botões de upload), nunca
// pelo visitante comum que só navega pelas fichas.
import { getStorage } from "firebase/storage";
import { app } from "./firebase";

export const storage = getStorage(app);
