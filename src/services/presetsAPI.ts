/**
 * Presets API adapter for contabo_storage_manager
 * Base URL: https://storage.noahcohn.com (configurable via localStorage 'api_url')
 * Endpoints: /api/presets/*
 */

import { getVpsBaseUrl } from './vpsStorageAPI';

export const PRESET_DIRS = ['milk', 'milkSML', 'milkMED', 'milkLRG', 'custom_milk'] as const;
export type PresetDirName = typeof PRESET_DIRS[number];

export interface PresetDirInfo {
  name: PresetDirName;
  count: number;
  updated_at: string | null;
}

export interface PresetFileMeta {
  name: string;
  size: number;
  modified_at: string;
}

export const presetsAPI = {
  async listDirs(): Promise<PresetDirInfo[]> {
    const res = await fetch(`${getVpsBaseUrl()}/api/presets/`);
    if (!res.ok) throw new Error(`Failed to list preset dirs: ${res.status}`);
    return res.json();
  },

  async listFiles(dir: PresetDirName): Promise<PresetFileMeta[]> {
    const res = await fetch(`${getVpsBaseUrl()}/api/presets/${encodeURIComponent(dir)}`);
    if (!res.ok) throw new Error(`Failed to list files in "${dir}": ${res.status}`);
    return res.json();
  },

  async getFile(dir: PresetDirName, filename: string): Promise<string> {
    const res = await fetch(
      `${getVpsBaseUrl()}/api/presets/${encodeURIComponent(dir)}/${encodeURIComponent(filename)}`
    );
    if (!res.ok) throw new Error(`Failed to get file "${filename}": ${res.status}`);
    return res.text();
  },

  async saveFile(dir: PresetDirName, filename: string, content: string): Promise<boolean> {
    const res = await fetch(`${getVpsBaseUrl()}/api/presets/${encodeURIComponent(dir)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content }),
    });
    if (!res.ok) throw new Error(`Failed to save file "${filename}": ${res.status}`);
    return true;
  },

  async deleteFile(dir: PresetDirName, filename: string): Promise<boolean> {
    const res = await fetch(
      `${getVpsBaseUrl()}/api/presets/${encodeURIComponent(dir)}/${encodeURIComponent(filename)}`,
      { method: 'DELETE' }
    );
    // Intentionally returns false on failure rather than throwing,
    // so the UI can handle a failed delete gracefully without a try/catch.
    return res.ok;
  },
};
