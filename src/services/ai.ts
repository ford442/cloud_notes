// AI Service (Worker Wrapper)

// Initialize Worker
const worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });

interface PendingRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve: (value: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject: (reason?: any) => void;
  onProgress?: (msg: string) => void;
}

const pending = new Map<string, PendingRequest>();

worker.onmessage = (e) => {
  const { id, status, data, error } = e.data;
  const request = pending.get(id);

  if (!request) return;

  if (status === 'progress') {
    request.onProgress?.(data);
  } else if (status === 'complete') {
    request.resolve(data);
    pending.delete(id);
  } else if (status === 'error') {
    request.reject(new Error(error));
    pending.delete(id);
  }
};

worker.onerror = (e) => {
  console.error('AI Worker Error', e);
};

// Helper to send requests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const request = <T>(type: string, payload: any, onProgress?: (msg: string) => void): Promise<T> => {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, type, payload });
  });
};

export const AIService = {
  summarize: (text: string, onProgress?: (msg: string) => void) =>
    request<string>('summarize', text, onProgress),

  suggestTags: (text: string, existingTags: string[] = [], onProgress?: (msg: string) => void) =>
    request<string[]>('suggestTags', { text, existingTags }, onProgress),

  getEmbedding: (text: string) =>
    request<number[]>('getEmbedding', text),

  generateText: (text: string, maxNewTokens = 200) =>
    request<string>('generateText', { text, maxNewTokens }),
};
