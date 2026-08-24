import { auth, db } from './firebase';

export type RecoveryCollection = 'bookVersions' | 'trash';

const CHUNK_SIZE = 300_000;

function getUserId(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Пользователь не авторизован');
  return uid;
}

function splitPayload(payload: unknown): string[] {
  const serialized = JSON.stringify(payload);
  const chunks: string[] = [];
  for (let index = 0; index < serialized.length; index += CHUNK_SIZE) {
    chunks.push(serialized.slice(index, index + CHUNK_SIZE));
  }
  return chunks.length > 0 ? chunks : ['{}'];
}

function getDocumentId(collectionName: RecoveryCollection, id: string): string {
  return `${collectionName}_${id}`;
}

export async function saveRecoveryPayload(
  collectionName: RecoveryCollection,
  id: string,
  payload: unknown,
  previousChunkCount = 0,
): Promise<number> {
  const uid = getUserId();
  const { deleteDoc, doc, setDoc } = await import('firebase/firestore');
  const chunks = splitPayload(payload);
  const documentId = getDocumentId(collectionName, id);

  const writes: Promise<unknown>[] = [
    setDoc(doc(db, 'users', uid, 'data', documentId), {
      chunk: chunks[0],
      chunkCount: chunks.length,
      updatedAt: Date.now(),
    }),
  ];

  for (let index = 1; index < chunks.length; index++) {
    writes.push(setDoc(doc(db, 'users', uid, 'data', `${documentId}_chunk_${index}`), {
      chunk: chunks[index],
      parentId: id,
      index,
    }));
  }

  for (let index = chunks.length; index < previousChunkCount; index++) {
    writes.push(deleteDoc(doc(db, 'users', uid, 'data', `${documentId}_chunk_${index}`)));
  }

  await Promise.all(writes);
  return chunks.length;
}

export async function loadRecoveryPayload<T>(
  collectionName: RecoveryCollection,
  id: string,
  expectedChunkCount?: number,
): Promise<T> {
  const uid = getUserId();
  const { doc, getDoc } = await import('firebase/firestore');
  const documentId = getDocumentId(collectionName, id);
  const first = await getDoc(doc(db, 'users', uid, 'data', documentId));
  if (!first.exists()) throw new Error('Сохранённые данные не найдены');

  const firstData = first.data();
  const chunkCount = expectedChunkCount || firstData.chunkCount || 1;
  const chunks = new Array<string>(chunkCount);
  chunks[0] = firstData.chunk || '';

  const reads: Promise<void>[] = [];
  for (let index = 1; index < chunkCount; index++) {
    reads.push(
      getDoc(doc(db, 'users', uid, 'data', `${documentId}_chunk_${index}`)).then(snapshot => {
        if (!snapshot.exists()) throw new Error(`Не найден фрагмент ${index + 1} из ${chunkCount}`);
        chunks[index] = snapshot.data().chunk || '';
      }),
    );
  }
  await Promise.all(reads);
  return JSON.parse(chunks.join('')) as T;
}

export async function deleteRecoveryPayload(
  collectionName: RecoveryCollection,
  id: string,
  chunkCount: number,
): Promise<void> {
  const uid = getUserId();
  const { deleteDoc, doc } = await import('firebase/firestore');
  const documentId = getDocumentId(collectionName, id);
  const deletes: Promise<unknown>[] = [deleteDoc(doc(db, 'users', uid, 'data', documentId))];
  for (let index = 1; index < chunkCount; index++) {
    deletes.push(deleteDoc(doc(db, 'users', uid, 'data', `${documentId}_chunk_${index}`)));
  }
  await Promise.all(deletes);
}
