/**
 * Tiny IndexedDB key-value store for in-progress attempts (answers survive refreshes, crashes and
 * offline periods). Every call fails soft: a browser without IndexedDB (private mode) still works,
 * it just can't recover unsynced answers after a reload.
 */
const DB = "mockprep";
const STORE = "attempts";

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
  return dbPromise;
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  try {
    const store = (await db()).transaction(STORE, mode).objectStore(STORE);
    return await new Promise<T>((resolve, reject) => {
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("indexedDB request failed"));
    });
  } catch {
    return undefined;
  }
}

export const idbGet = <T>(key: string) => run<T>("readonly", (s) => s.get(key) as IDBRequest<T>);
export const idbSet = (key: string, value: unknown) => run("readwrite", (s) => s.put(value, key));
export const idbDelete = (key: string) => run("readwrite", (s) => s.delete(key));
