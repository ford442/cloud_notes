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

export interface LibrarySearchParams {
  type?: string;
  q?: string;
  tags?: string;
  max_rating?: number;
  min_rating?: number;
  played_after?: string;
  limit?: number;
  offset?: number;
  sort_by?: string;
}

export const cloudStorageApi = {
  /**
   * List JSON library items (songs, patterns, banks) with advanced search.
   * @param params Filtering and pagination parameters
   */
  async listLibrary(params: LibrarySearchParams = {}): Promise<MetaData[]> {
    const url = new URL(`${getVpsBaseUrl()}/api/songs`);

    if (params.type) url.searchParams.append('type', params.type);
    if (params.q) url.searchParams.append('q', params.q);
    if (params.tags) url.searchParams.append('tags', params.tags);
    if (params.max_rating !== undefined) url.searchParams.append('max_rating', params.max_rating.toString());
    if (params.min_rating !== undefined) url.searchParams.append('min_rating', params.min_rating.toString());
    if (params.played_after) url.searchParams.append('played_after', params.played_after);
    if (params.limit !== undefined) url.searchParams.append('limit', params.limit.toString());
    if (params.offset !== undefined) url.searchParams.append('offset', params.offset.toString());
    if (params.sort_by) url.searchParams.append('sort_by', params.sort_by);

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
