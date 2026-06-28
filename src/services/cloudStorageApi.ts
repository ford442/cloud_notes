import { getVpsBaseUrl } from './vpsStorageAPI';

export interface MetaData {
  id: string;
  name: string;
  author: string;
  date: string;
  type: string;
  description?: string;
  filename: string;
}

export interface ItemPayload {
  name: string;
  author: string;
  description?: string;
  type: string;
  data: Record<string, any>;
}

export const cloudStorageApi = {
  /**
   * List JSON library items (songs, patterns, banks).
   * @param type Optional filter by type (e.g., 'song', 'pattern', 'bank')
   */
  async listLibrary(type?: string): Promise<MetaData[]> {
    const url = new URL(`${getVpsBaseUrl()}/api/songs`);
    if (type) {
      url.searchParams.append('type', type);
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to list library: ${res.statusText}`);
    return res.json();
  },

  /**
   * Upload a JSON item.
   */
  async uploadItem(payload: ItemPayload): Promise<{ success: boolean; id: string }> {
    const res = await fetch(`${getVpsBaseUrl()}/api/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Failed to upload item: ${res.statusText}`);
    return res.json();
  },

  /**
   * Get a JSON item by ID.
   */
  async getItem(id: string, type?: string): Promise<Record<string, any>> {
    const url = new URL(`${getVpsBaseUrl()}/api/songs/${encodeURIComponent(id)}`);
    if (type) {
      url.searchParams.append('type', type);
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to get item: ${res.statusText}`);
    return res.json();
  },

  /**
   * Upload a binary sample.
   */
  async uploadSample(file: File, author: string, description: string = ""): Promise<{ success: boolean; id: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('author', author);
    formData.append('description', description);

    const res = await fetch(`${getVpsBaseUrl()}/api/samples`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error(`Failed to upload sample: ${res.statusText}`);
    return res.json();
  },

  /**
   * Get URL for a sample file.
   */
  getSampleUrl(sampleId: string): string {
    return `${getVpsBaseUrl()}/api/samples/${encodeURIComponent(sampleId)}`;
  },

  /**
   * Trigger smart sync on the storage backend to rebuild JSON indexes based on actual files.
   */
  async syncStorage(): Promise<Record<string, any>> {
    const res = await fetch(`${getVpsBaseUrl()}/api/admin/sync`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`Failed to sync storage: ${res.statusText}`);
    return res.json();
  }
};
