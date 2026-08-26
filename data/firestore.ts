// Acesso aos dados no Firestore (leitura e escrita de admin).
import { collection, getDocs, doc, addDoc, setDoc, deleteDoc, updateDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { ref as storageRef, getBytes, getMetadata, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebaseStorage';
import { Character, ChecklistItem, GalleryImage, PrototypeEntry, FamilyTree, TodoItem } from '../types';
import { Equipment } from '../types/Equipment';
import { groupItems } from './checklistGrouping';

// Gera um ID legível a partir do nome (ex: "Nishinoya Senju" -> "nishinoya-senju").
export function slugify(name: string): string {
  return String(name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos/macrons
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function fetchCharacters(): Promise<Character[]> {
  const snap = await getDocs(collection(db, 'characters'));
  return snap.docs
    .map(d => ({ ...(d.data() as Character), docId: d.id }))
    .sort((a, b) => a.id - b.id);
}

export async function fetchArsenal(): Promise<Equipment[]> {
  const snap = await getDocs(collection(db, 'arsenal'));
  return snap.docs
    .map(d => ({ ...(d.data() as Equipment), docId: d.id }))
    .sort((a, b) => a.id - b.id);
}

// Escuta o Firestore em tempo real (mudanças feitas por qualquer admin, em qualquer lugar,
// aparecem instantaneamente para quem estiver com o site aberto). Retorna a função de unsubscribe.
export function subscribeCharacters(
  onData: (chars: Character[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, 'characters'),
    snap => {
      const data = snap.docs
        .map(d => ({ ...(d.data() as Character), docId: d.id }))
        .sort((a, b) => a.id - b.id);
      onData(data);
    },
    onError,
  );
}

export function subscribeArsenal(
  onData: (items: Equipment[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, 'arsenal'),
    snap => {
      const data = snap.docs
        .map(d => ({ ...(d.data() as Equipment), docId: d.id }))
        .sort((a, b) => a.id - b.id);
      onData(data);
    },
    onError,
  );
}

// Limpa campos undefined (o Firestore não aceita undefined).
function clean<T extends Record<string, unknown>>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Cria ou atualiza um personagem. O ID do documento é o slug do nome.
// `existingDocId` é passado na edição quando o nome (e portanto o slug) não muda.
export async function saveCharacter(
  character: Character,
  takenDocIds: string[],
  existingDocId?: string,
): Promise<string> {
  let docId = slugify(character.name) || `personagem-${character.id}`;
  // evita colisão de slug (a não ser que seja o próprio doc em edição)
  if (docId !== existingDocId && takenDocIds.includes(docId)) {
    docId = `${docId}-${character.id}`;
  }
  const { docId: _omit, ...data } = character as Character & { docId?: string };
  await setDoc(doc(db, 'characters', docId), clean(data));
  // se o nome mudou na edição, remove o documento antigo
  if (existingDocId && existingDocId !== docId) {
    await deleteDoc(doc(db, 'characters', existingDocId));
  }
  return docId;
}

/**
 * Grava o perfil de combate de um personagem: estilo, foco de atributo e proporção da divisão. Os
 * três são internos e juntos determinam os sete atributos quando o NC sobe — ver data/atributos.ts.
 */
export async function setCombatProfile(
  docId: string,
  perfil: {
    combatStyle?: Character['combatStyle'];
    focosAtributo?: Character['focosAtributo'];
    divisaoAtributo?: Character['divisaoAtributo'];
  },
): Promise<void> {
  // so grava o que veio: passar um dos campos nao apaga os outros. O array de focos e o objeto de
  // divisao podem vir vazios de proposito, entao sao testados por !== undefined, nao por veracidade.
  const limpo: Partial<Pick<Character, 'combatStyle' | 'focosAtributo' | 'divisaoAtributo'>> = {};
  if (perfil.combatStyle) limpo.combatStyle = perfil.combatStyle;
  if (perfil.focosAtributo !== undefined) limpo.focosAtributo = perfil.focosAtributo;
  if (perfil.divisaoAtributo !== undefined) limpo.divisaoAtributo = perfil.divisaoAtributo;
  await updateDoc(doc(db, 'characters', docId), limpo);
}

export async function deleteCharacter(docId: string): Promise<void> {
  await deleteDoc(doc(db, 'characters', docId));
}

// Cria ou atualiza uma arma. O ID do documento é o slug do nome.
export async function saveEquipment(
  equipment: Equipment,
  takenDocIds: string[],
  existingDocId?: string,
): Promise<string> {
  let docId = slugify(equipment.name) || `arma-${equipment.id}`;
  if (docId !== existingDocId && takenDocIds.includes(docId)) {
    docId = `${docId}-${equipment.id}`;
  }
  const { docId: _omit, ...data } = equipment as Equipment & { docId?: string };
  await setDoc(doc(db, 'arsenal', docId), clean(data));
  if (existingDocId && existingDocId !== docId) {
    await deleteDoc(doc(db, 'arsenal', existingDocId));
  }
  return docId;
}

export async function deleteEquipment(docId: string): Promise<void> {
  await deleteDoc(doc(db, 'arsenal', docId));
}

// Checklist de produção de imagens (quem produz as imagens marca aqui o que já foi feito).
export function subscribeChecklist(
  onData: (items: ChecklistItem[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, 'imageChecklist'),
    snap => {
      const data = snap.docs
        .map(d => ({ ...(d.data() as ChecklistItem), docId: d.id }))
        .sort((a, b) => a.order - b.order);
      onData(data);
    },
    onError,
  );
}

export async function setChecklistItemDone(docId: string, done: boolean, doneBy?: string | null): Promise<void> {
  await updateDoc(doc(db, 'imageChecklist', docId), { done, doneBy: done ? (doneBy ?? null) : null });
}

/**
 * Reconcilia a Galeria das fichas com um evento. Não grava nada do item — só o reflexo.
 *
 * Três condições para a imagem aparecer numa ficha: o evento tem arte, o elenco está FECHADO, e a
 * pessoa está na lista. Enquanto o elenco está aberto o evento existe só na Galeria pública, que lê
 * o checklist direto — assim ninguém abre uma ficha e vê uma cena com metade do elenco.
 *
 * A entrada é casada pelo `eventId` (o docId do item), e não pela URL: quatro eventos estão
 * duplicados no checklist com dois itens apontando para a mesma imagem, e por URL um sobrescreveria
 * o outro.
 */
function planoDaGaleria(
  item: ChecklistItem,
  nomes: string[],
  fechado: boolean,
  chars: Character[],
): { docId: string; gallery: GalleryImage[] }[] {
  const publica = !!item.imageUrl && fechado;
  const alvo = new Set(publica ? nomes : []);
  const legenda = [item.arco, item.subarco, item.name].filter(Boolean).join(' - ');
  const saida: { docId: string; gallery: GalleryImage[] }[] = [];
  for (const c of chars) {
    if (!c.docId) continue;
    const gal = c.gallery ?? [];
    const daquele = (g: GalleryImage) => g.eventId === item.docId;
    const tem = gal.some(daquele);
    const deve = alvo.has(c.name);
    if (tem === deve) continue;
    saida.push({
      docId: c.docId,
      gallery: deve
        ? [...gal, { url: item.imageUrl!, caption: legenda, category: 'evento' as const, season: item.temporada, eventId: item.docId }]
        : gal.filter(g => !daquele(g)),
    });
  }
  return saida;
}

/**
 * Grava quem estava num evento. O `personagens` do item é a fonte da verdade; a Galeria das fichas é
 * o reflexo, e só recebe quando o elenco está fechado.
 *
 * Nome de protótipo ou de pendente também pode entrar, e simplesmente não casa com ficha nenhuma até
 * a ficha existir.
 */
export async function setEventParticipants(
  item: ChecklistItem,
  nomes: string[],
  chars: Character[],
): Promise<void> {
  if (!item.docId) throw new Error('item sem docId');
  const batch = writeBatch(db);
  batch.update(doc(db, 'imageChecklist', item.docId), { personagens: nomes });
  planoDaGaleria(item, nomes, !!item.elencoFechado, chars)
    .forEach(p => batch.update(doc(db, 'characters', p.docId), { gallery: p.gallery }));
  await batch.commit();
}

/**
 * Marca/desmarca "já adicionei todo mundo dessa imagem". Não mexe em quem está marcado, mas é o que
 * publica ou despublica o evento nas fichas: fechar materializa a imagem em cada participante,
 * reabrir tira de todos.
 */
export async function setEventCastClosed(
  item: ChecklistItem,
  fechado: boolean,
  chars: Character[],
): Promise<void> {
  if (!item.docId) throw new Error('item sem docId');
  const batch = writeBatch(db);
  batch.update(doc(db, 'imageChecklist', item.docId), { elencoFechado: fechado });
  planoDaGaleria(item, item.personagens ?? [], fechado, chars)
    .forEach(p => batch.update(doc(db, 'characters', p.docId), { gallery: p.gallery }));
  await batch.commit();
}

/** Mesma regra do ImageUploadButton, para o arquivo renomeado seguir o padrão da pasta. */
const sanitizeArquivo = (nome: string) => nome.replace(/[^a-zA-Z0-9._-]/g, '_');

/**
 * Renomeia o arquivo no Storage para acompanhar o nome novo do item. O Storage não tem "mover":
 * é baixar, subir com o nome novo e apagar o antigo.
 *
 * A ordem é à prova de falha — o antigo só é apagado depois de o novo existir. Se qualquer passo
 * falhar, devolve null e o chamador segue com a URL antiga: o arquivo fica com o nome velho, o que é
 * cosmético, em vez de a ficha ficar sem imagem, que é grave.
 */
async function renomearArquivo(url: string, nomeNovo: string): Promise<string | null> {
  try {
    const caminho = decodeURIComponent(url.split('/o/')[1].split('?')[0]);
    const pasta = caminho.slice(0, caminho.lastIndexOf('/'));
    const arquivoAntigo = caminho.slice(caminho.lastIndexOf('/') + 1);
    const ext = arquivoAntigo.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? '';
    const arquivoNovo = `${sanitizeArquivo(nomeNovo)}${ext}`;
    if (arquivoNovo === arquivoAntigo) return null;

    const antigo = storageRef(storage, caminho);
    const bytes = await getBytes(antigo);
    const meta = await getMetadata(antigo);
    const novo = storageRef(storage, `${pasta}/${arquivoNovo}`);
    await uploadBytes(novo, bytes, { contentType: meta.contentType, cacheControl: meta.cacheControl ?? 'public, max-age=86400' });
    const urlNova = await getDownloadURL(novo);
    await deleteObject(antigo);   // só depois de o novo existir e ter URL
    return `${urlNova}${urlNova.includes('?') ? '&' : '?'}v=${Date.now()}`;
  } catch (e) {
    console.error('Não consegui renomear o arquivo no Storage — o item foi renomeado e a URL antiga continua valendo:', e);
    return null;
  }
}

/**
 * Renomeia um item da checklist e leva o resto junto: o arquivo no Storage, a URL do item, e a
 * legenda e a URL gravadas na Galeria de cada participante.
 *
 * A Galeria da ficha guarda CÓPIAS da legenda e da URL — a ficha não lê o checklist. Sem propagar,
 * renomear deixaria a ficha mostrando o nome antigo da cena para sempre, e trocar o arquivo
 * quebraria a imagem dela.
 *
 * Se o Storage não colaborar (CORS, permissão, rede), o rename do arquivo é abandonado sem prejuízo:
 * o item e as fichas ficam com o nome novo e a URL antiga, que continua funcionando.
 */
export async function renameChecklistItem(item: ChecklistItem, nome: string): Promise<void> {
  if (!item.docId) throw new Error('item sem docId');

  const urlNova = item.imageUrl ? await renomearArquivo(item.imageUrl, nome) : null;
  await updateDoc(doc(db, 'imageChecklist', item.docId), {
    name: nome,
    ...(urlNova ? { imageUrl: urlNova } : {}),
  });

  const ehEvento = (item.type ?? 'evento') === 'evento';
  const gente = item.personagens ?? [];
  if (!ehEvento || !gente.length || !item.imageUrl || !item.elencoFechado) return;

  const legenda = [item.arco, item.subarco, nome].filter(Boolean).join(' - ');
  const snap = await getDocs(collection(db, 'characters'));
  const batch = writeBatch(db);
  let mexeu = 0;
  for (const d2 of snap.docs) {
    const c = d2.data() as Character;
    if (!gente.includes(c.name)) continue;
    const gal = c.gallery ?? [];
    const precisa = gal.some(g => g.eventId === item.docId
      && (g.caption !== legenda || (urlNova && g.url !== urlNova)));
    if (!precisa) continue;
    batch.update(d2.ref, {
      gallery: gal.map(g => (g.eventId === item.docId
        ? { ...g, caption: legenda, ...(urlNova ? { url: urlNova } : {}) }
        : g)),
    });
    mexeu++;
  }
  if (mexeu) await batch.commit();
}

// Edição administrativa da checklist (texto, ordem, placeholder, criação e remoção de itens).
export async function updateChecklistItem(docId: string, changes: Partial<ChecklistItem>): Promise<void> {
  const { docId: _omit, ...rest } = changes as ChecklistItem;
  await updateDoc(doc(db, 'imageChecklist', docId), clean(rest));
}

export async function addChecklistItem(item: Omit<ChecklistItem, 'docId'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'imageChecklist'), clean(item));
  return docRef.id;
}

export async function deleteChecklistItem(docId: string): Promise<void> {
  await deleteDoc(doc(db, 'imageChecklist', docId));
}

// Cada tipo do checklist é um projeto do Canva, e o `order` reserva uma faixa de 10 mil para
// cada um: assim a numeração do item já diz em qual arquivo ele mora, e acrescentar um
// personagem só renumera a faixa dele em vez de empurrar tudo. A ordem das faixas é a ordem
// dos projetos.
/**
 * Faixa de `order` de cada projeto. O bloco isola a numeração: renumerar um projeto nunca mexe na
 * página de outro, e o número da página é a posição DENTRO do bloco, não o order cru.
 *
 * O evento ficou em 50_000 desde o começo e tem 253 itens numerados ali, então os projetos novos
 * entram depois dele em vez de empurrar tudo.
 */
export const CHECKLIST_BLOCOS: Record<NonNullable<ChecklistItem['type']>, number> = {
  timeline: 10_000,
  transformacao: 20_000,
  capa: 30_000,
  invocacao: 40_000,
  evento: 50_000,
  capaInvocacao: 60_000,
  arsenal: 70_000,
};

// Renumera o campo `order` dentro da faixa de cada tipo (10000, 10001...), sem lacunas nem
// colisões, preservando a sequência que já aparece corretamente na visão agrupada
// (temporada > arco > subarco). Corrige a visão "Geral" da Galeria caso ela volte a
// ficar fora de ordem. Retorna quantos itens tiveram o `order` de fato alterado.
//
// Renumera POR FAIXA de propósito: renumerar tudo de 0 a N juntaria os quatro projetos numa
// sequência só e desfaria a separação.
export async function fixChecklistOrder(): Promise<number> {
  const snap = await getDocs(collection(db, 'imageChecklist'));
  const items = snap.docs
    .map(d => ({ ...(d.data() as ChecklistItem), docId: d.id }))
    .sort((a, b) => a.order - b.order);

  const batch = writeBatch(db);
  let changed = 0;
  for (const [tipo, base] of Object.entries(CHECKLIST_BLOCOS)) {
    const doTipo = items.filter(i => (i.type ?? 'evento') === tipo);
    if (!doTipo.length) continue;
    const flat = groupItems(doTipo).flatMap(t => t.arcos.flatMap(a => a.subarcos.flatMap(s => s.items)));
    flat.forEach((item, index) => {
      if (item.order !== base + index) {
        batch.update(doc(db, 'imageChecklist', item.docId!), { order: base + index });
        changed++;
      }
    });
  }
  if (changed > 0) await batch.commit();
  return changed;
}

// Rascunhos de personagens em desenvolvimento (aba "Protótipo" do Painel) — texto e/ou
// imagem soltos, mandados aos poucos antes de virarem ficha oficial.
export function subscribePrototype(
  onData: (items: PrototypeEntry[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, 'prototypeEntries'),
    snap => {
      const data = snap.docs
        .map(d => ({ ...(d.data() as PrototypeEntry), docId: d.id }))
        .sort((a, b) => a.order - b.order);
      onData(data);
    },
    onError,
  );
}

export async function deletePrototypeEntry(docId: string): Promise<void> {
  await deleteDoc(doc(db, 'prototypeEntries', docId));
}

// A Fazer (aba "A Fazer") — pendências do RPG que não cabem em código nem no checklist de imagens.
// Coleção isolada e só de admin, como os protótipos: é anotação interna, não conteúdo do site.
export function subscribeAFazer(
  onData: (items: TodoItem[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, 'aFazer'),
    snap => {
      const data = snap.docs
        .map(d => ({ ...(d.data() as TodoItem), docId: d.id }))
        // feito desce; entre iguais vale a ordem, e criadoEm desempata
        .sort((a, b) => Number(!!a.feito) - Number(!!b.feito)
          || (a.ordem ?? 0) - (b.ordem ?? 0)
          || (a.criadoEm ?? 0) - (b.criadoEm ?? 0));
      onData(data);
    },
    onError,
  );
}

/** Cria um item no fim do grupo. Devolve o docId. */
export async function addAFazer(texto: string, grupo?: string): Promise<string> {
  const limpo = texto.trim();
  if (!limpo) throw new Error('texto vazio');
  const snap = await getDocs(collection(db, 'aFazer'));
  const ordem = snap.docs.reduce((m, d) => Math.max(m, Number((d.data() as TodoItem).ordem) || 0), 0) + 1;
  const ref = await addDoc(collection(db, 'aFazer'), {
    texto: limpo,
    ...(grupo?.trim() ? { grupo: grupo.trim() } : {}),
    feito: false,
    ordem,
    criadoEm: Date.now(),
  });
  return ref.id;
}

export async function setAFazerFeito(docId: string, feito: boolean): Promise<void> {
  await updateDoc(doc(db, 'aFazer', docId), { feito });
}

export async function editAFazer(docId: string, campos: { texto?: string; grupo?: string }): Promise<void> {
  const limpo: { texto?: string; grupo?: string } = {};
  if (campos.texto !== undefined) limpo.texto = campos.texto.trim();
  if (campos.grupo !== undefined) limpo.grupo = campos.grupo.trim();
  await updateDoc(doc(db, 'aFazer', docId), limpo);
}

export async function deleteAFazer(docId: string): Promise<void> {
  await deleteDoc(doc(db, 'aFazer', docId));
}

// Árvores genealógicas (aba "Árvore") — recurso experimental, coleção isolada de propósito:
// se não funcionar bem, dá pra apagar a coleção inteira sem afetar mais nada no site.
export function subscribeFamilyTrees(
  onData: (trees: FamilyTree[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, 'familyTrees'),
    snap => {
      const data = snap.docs
        .map(d => ({ ...(d.data() as FamilyTree), docId: d.id }))
        .sort((a, b) => a.order - b.order);
      onData(data);
    },
    onError,
  );
}
