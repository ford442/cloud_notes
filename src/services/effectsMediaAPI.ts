/**
 * Effects Media API — ford442/image_video_effects GCS bucket integration
 *
 * Lists images/videos from the public GCS bucket (my-sd35-space-images-2025).
 * Uploads and deletes go through the VPS storage API (storage.noahcohn.com).
 */

import { getVpsBaseUrl } from './vpsStorageAPI';

const DEFAULT_GCS_BUCKET = 'my-sd35-space-images-2025';
export const EFFECTS_IMAGE_PREFIX = 'stablediff';
export const EFFECTS_VIDEO_PREFIX = 'video';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi']);

export type EffectsMediaType = 'image' | 'video';

export interface EffectsMediaItem {
  name: string;
  path: string;
  url: string;
  size: number;
  modified_at: string;
  mediaType: EffectsMediaType;
  contentType?: string;
}

export function getGcsBucket(): string {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('gcs_bucket');
    if (saved) return saved;
  }
  return DEFAULT_GCS_BUCKET;
}

export function getPublicGcsUrl(path: string): string {
  return `https://storage.googleapis.com/${getGcsBucket()}/${path}`;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

function inferMediaType(name: string): EffectsMediaType | null {
  const ext = getExtension(name);
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  return null;
}

async function generateWebhookSignature(payload: string): Promise<string> {
  const secret = typeof localStorage !== 'undefined' ? localStorage.getItem('webhook_secret') : null;
  if (!secret) return '';

  const encoder = new TextEncoder();
  const crypto = window.crypto || (window as unknown as { msCrypto?: Crypto }).msCrypto;
  if (!crypto?.subtle) return '';

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const hashHex = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256=${hashHex}`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface GcsListResponse {
  items?: Array<{
    name: string;
    size?: string;
    updated?: string;
    contentType?: string;
  }>;
  nextPageToken?: string;
}

async function listGcsObjects(prefix: string, mediaType: EffectsMediaType): Promise<EffectsMediaItem[]> {
  const bucket = getGcsBucket();
  const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const results: EffectsMediaItem[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`);
    url.searchParams.set('prefix', normalizedPrefix);
    url.searchParams.set('maxResults', '200');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to list GCS objects: ${res.status}`);
    }

    const data: GcsListResponse = await res.json();
    for (const item of data.items ?? []) {
      if (!item.name || item.name.endsWith('/')) continue;
      const filename = item.name.slice(normalizedPrefix.length);
      if (!filename) continue;
      const type = inferMediaType(filename);
      if (type !== mediaType) continue;

      results.push({
        name: filename,
        path: item.name,
        url: getPublicGcsUrl(item.name),
        size: Number(item.size ?? 0),
        modified_at: item.updated ?? '',
        mediaType,
        contentType: item.contentType,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  results.sort((a, b) => b.modified_at.localeCompare(a.modified_at));
  return results;
}

async function postImageEffectsWebhook(payload: Record<string, unknown>): Promise<{ status: string; message?: string; files?: string[] }> {
  const body = JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
  });
  const signature = await generateWebhookSignature(body);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (signature) headers['X-Hub-Signature-256'] = signature;

  const res = await fetch(`${getVpsBaseUrl()}/webhook/image-effects`, {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`Webhook failed (${res.status}): ${text}`);
  }

  return res.json();
}

export const effectsMediaAPI = {
  async listImages(): Promise<EffectsMediaItem[]> {
    return listGcsObjects(EFFECTS_IMAGE_PREFIX, 'image');
  },

  async listVideos(): Promise<EffectsMediaItem[]> {
    return listGcsObjects(EFFECTS_VIDEO_PREFIX, 'video');
  },

  async uploadImage(file: File): Promise<EffectsMediaItem> {
    const base64Data = await readFileAsBase64(file);
    const result = await postImageEffectsWebhook({
      action: 'upload_texture',
      name: file.name,
      data: {
        file_data: base64Data,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        upload_type: 'image',
        gcs_prefix: EFFECTS_IMAGE_PREFIX,
        gcs_bucket: getGcsBucket(),
        saved_at: new Date().toISOString(),
      },
    });

    const remotePath = result.files?.[0] ?? `${EFFECTS_IMAGE_PREFIX}/${file.name}`;
    return {
      name: file.name,
      path: remotePath,
      url: getPublicGcsUrl(remotePath),
      size: file.size,
      modified_at: new Date().toISOString(),
      mediaType: 'image',
      contentType: file.type,
    };
  },

  async uploadVideo(file: File, metadata?: { title?: string; description?: string; tags?: string }): Promise<EffectsMediaItem> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', metadata?.title ?? file.name);
    formData.append('description', metadata?.description ?? '');
    formData.append('tags', metadata?.tags ?? '');

    const res = await fetch(`${getVpsBaseUrl()}/api/videos/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new Error(`Video upload failed (${res.status}): ${text}`);
    }

    const result = await res.json();
    const remotePath = result.path ?? result.url?.replace(/^https?:\/\/[^/]+\//, '') ?? `${EFFECTS_VIDEO_PREFIX}/${file.name}`;
    const publicUrl = result.url ?? getPublicGcsUrl(remotePath);

    return {
      name: file.name,
      path: remotePath,
      url: publicUrl,
      size: file.size,
      modified_at: new Date().toISOString(),
      mediaType: 'video',
      contentType: file.type,
    };
  },

  async deleteItem(item: EffectsMediaItem): Promise<boolean> {
    try {
      await postImageEffectsWebhook({
        action: 'delete_media',
        name: item.name,
        data: {
          path: item.path,
          media_type: item.mediaType,
          gcs_bucket: getGcsBucket(),
        },
      });
      return true;
    } catch {
      return false;
    }
  },
};
