/**
 * VPS Storage Adapter for contabo_storage_manager / rain_edit
 * Base URL: https://storage.noahcohn.com (configurable via localStorage 'api_url')
 */

const DEFAULT_BASE_URL = 'https://storage.noahcohn.com';

export function getVpsBaseUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('api_url');
    if (saved) return saved.replace(/\/$/, '');
  }
  return DEFAULT_BASE_URL;
}

export interface VpsNoteMeta {
  name: string;
  updated_at: string;
  size: number;
}

export interface VpsNoteDetailedMeta extends VpsNoteMeta {
  wordCount?: number;
  lastEdited?: string;
  version?: number;
  dailyDate?: string;
}

export interface VpsNoteContent {
  name: string;
  content: string;
  updated_at: string;
}

export const vpsStorageAPI = {
  async listNotes(): Promise<VpsNoteMeta[]> {
    const res = await fetch(`${getVpsBaseUrl()}/api/notes/list`);
    if (!res.ok) throw new Error(`Failed to list notes: ${res.status}`);
    return res.json();
  },

  async readNote(name: string): Promise<VpsNoteContent> {
    const res = await fetch(`${getVpsBaseUrl()}/api/notes/read/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error(`Failed to read note "${name}": ${res.status}`);
    return res.json();
  },

  async writeNote(
    name: string,
    content: string
  ): Promise<{ success: boolean; name: string; size: number; updated_at: string }> {
    const res = await fetch(`${getVpsBaseUrl()}/api/notes/write/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error(`Failed to write note "${name}": ${res.status}`);
    return res.json();
  },

  async deleteNote(name: string): Promise<boolean> {
    const res = await fetch(`${getVpsBaseUrl()}/api/notes/delete/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new Error(`Failed to delete note "${name}": ${res.status} - ${text}`);
    }
    return res.ok;
  },
};
