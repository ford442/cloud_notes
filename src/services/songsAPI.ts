/**
 * Songs API adapter for contabo_storage_manager
 * Base URL: https://storage.noahcohn.com (configurable via localStorage 'api_url')
 * Endpoints: /api/songs/dirs/*
 */

import { getVpsBaseUrl } from './vpsStorageAPI';

export const SONG_DIRS = ['songs', 'weeks_songs', 'flac_songs'] as const;
export type SongDirName = typeof SONG_DIRS[number];

export interface SongDirInfo {
  name: SongDirName;
  count: number;
  updated_at: string | null;
}

export interface SongFileMeta {
  name: string;
  size: number;
  modified_at: string;
  url: string;
}

export const songsAPI = {
  async listDirs(): Promise<SongDirInfo[]> {
    const res = await fetch(`${getVpsBaseUrl()}/api/songs/dirs`);
    if (!res.ok) throw new Error(`Failed to list song dirs: ${res.status}`);
    return res.json();
  },

  async listFiles(dir: SongDirName): Promise<SongFileMeta[]> {
    const res = await fetch(`${getVpsBaseUrl()}/api/songs/dirs/${encodeURIComponent(dir)}`);
    if (!res.ok) throw new Error(`Failed to list files in "${dir}": ${res.status}`);
    return res.json();
  },

  getSongUrl(dir: SongDirName, filename: string): string {
    return `${getVpsBaseUrl()}/api/songs/dirs/${encodeURIComponent(dir)}/${encodeURIComponent(filename)}`;
  },
};
