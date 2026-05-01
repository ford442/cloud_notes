/**
 * Textures API adapter for contabo_storage_manager
 * Base URL: https://storage.noahcohn.com (configurable via localStorage 'api_url')
 * Endpoints: /api/textures/*
 */

import { getVpsBaseUrl } from './vpsStorageAPI';

export const TEXTURE_DIRS = ['textures', 'weeks_textures', 'custom_textures'] as const;
export type TextureDirName = typeof TEXTURE_DIRS[number];

export interface TextureDirInfo {
  name: TextureDirName;
  count: number;
  updated_at: string | null;
}

export interface TextureFileMeta {
  name: string;
  size: number;
  modified_at: string;
  url: string;
}

export const texturesAPI = {
  async listDirs(): Promise<TextureDirInfo[]> {
    const res = await fetch(`${getVpsBaseUrl()}/api/textures/`);
    if (!res.ok) throw new Error(`Failed to list texture dirs: ${res.status}`);
    return res.json();
  },

  async listFiles(dir: TextureDirName): Promise<TextureFileMeta[]> {
    const res = await fetch(`${getVpsBaseUrl()}/api/textures/${encodeURIComponent(dir)}`);
    if (!res.ok) throw new Error(`Failed to list files in "${dir}": ${res.status}`);
    return res.json();
  },

  getFileUrl(dir: TextureDirName, filename: string): string {
    return `${getVpsBaseUrl()}/api/textures/${encodeURIComponent(dir)}/${encodeURIComponent(filename)}`;
  },

  async uploadFile(dir: TextureDirName, file: File): Promise<boolean> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${getVpsBaseUrl()}/api/textures/${encodeURIComponent(dir)}`, {
      method: 'POST',
      body: formData,
    });
    return res.ok;
  },

  async deleteFile(dir: TextureDirName, filename: string): Promise<boolean> {
    const res = await fetch(
      `${getVpsBaseUrl()}/api/textures/${encodeURIComponent(dir)}/${encodeURIComponent(filename)}`,
      { method: 'DELETE' }
    );
    return res.ok;
  },
};
