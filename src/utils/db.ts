const DB_NAME = 'cloud_notes_db';
const DB_VERSION = 4;
const STORE_NOTES_LIST = 'notes_list'; // Stores the full list of metadata
const STORE_NOTES_CONTENT = 'notes_content'; // Stores individual note content
const STORE_EMBEDDINGS = 'notes_embeddings'; // Stores vector embeddings for semantic search
const STORE_PENDING_OPS = 'pending_ops'; // Stores offline operations
const STORE_HISTORY = 'notes_history'; // Stores note version history

interface DBWrapper {
  get: <T>(storeName: string, key: string) => Promise<T | undefined>;
  getAll: <T>(storeName: string) => Promise<{ key: string; value: T }[]>;
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
      if (!db.objectStoreNames.contains(STORE_EMBEDDINGS)) {
        db.createObjectStore(STORE_EMBEDDINGS);
      }
      if (!db.objectStoreNames.contains(STORE_PENDING_OPS)) {
        db.createObjectStore(STORE_PENDING_OPS);
      }
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        db.createObjectStore(STORE_HISTORY);
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
  },

  getAll: async <T>(storeName: string): Promise<{ key: string; value: T }[]> => {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.openCursor();
      const results: { key: string; value: T }[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          results.push({ key: cursor.key as string, value: cursor.value });
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
};

export const CACHE_KEYS = {
  ALL_NOTES: 'all_notes_meta',
};

export { STORE_NOTES_LIST, STORE_NOTES_CONTENT, STORE_EMBEDDINGS, STORE_PENDING_OPS, STORE_HISTORY };
