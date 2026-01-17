const DB_NAME = 'cloud_notes_db';
const DB_VERSION = 1;
const STORE_NOTES_LIST = 'notes_list'; // Stores the full list of metadata
const STORE_NOTES_CONTENT = 'notes_content'; // Stores individual note content

interface DBWrapper {
  get: <T>(storeName: string, key: string) => Promise<T | undefined>;
  set: <T>(storeName: string, key: string, value: T) => Promise<void>;
  del: (storeName: string, key: string) => Promise<void>;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NOTES_LIST)) {
        db.createObjectStore(STORE_NOTES_LIST);
      }
      if (!db.objectStoreNames.contains(STORE_NOTES_CONTENT)) {
        db.createObjectStore(STORE_NOTES_CONTENT);
      }
    };
  });

  return dbPromise;
};

export const db: DBWrapper = {
  get: async <T>(storeName: string, key: string): Promise<T | undefined> => {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  set: async <T>(storeName: string, key: string, value: T): Promise<void> => {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  del: async (storeName: string, key: string): Promise<void> => {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};

export const CACHE_KEYS = {
  ALL_NOTES: 'all_notes_meta',
};

export { STORE_NOTES_LIST, STORE_NOTES_CONTENT };
