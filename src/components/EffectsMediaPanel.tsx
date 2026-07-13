import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useToast } from './Toast';
import { effectsMediaAPI } from '../services/effectsMediaAPI';
import type { EffectsMediaItem, EffectsMediaType } from '../services/effectsMediaAPI';

interface EffectsMediaPanelProps {
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function MediaThumbnail({ item }: { item: EffectsMediaItem }) {
  if (item.mediaType === 'video') {
    return (
      <video
        src={item.url}
        muted
        preload="metadata"
        className="w-full h-full object-cover"
        onLoadedData={(e) => {
          const el = e.currentTarget;
          el.currentTime = Math.min(1, el.duration * 0.1);
        }}
      />
    );
  }

  return (
    <img
      src={item.url}
      alt={item.name}
      loading="lazy"
      className="w-full h-full object-cover"
    />
  );
}

export const EffectsMediaPanel = ({ onClose }: EffectsMediaPanelProps) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<EffectsMediaType>('image');
  const [images, setImages] = useState<EffectsMediaItem[]>([]);
  const [videos, setVideos] = useState<EffectsMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [previewItem, setPreviewItem] = useState<EffectsMediaItem | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [imgData, vidData] = await Promise.all([
        effectsMediaAPI.listImages(),
        effectsMediaAPI.listVideos(),
      ]);
      setImages(imgData);
      setVideos(vidData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load media from GCS bucket';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const currentItems = activeTab === 'image' ? images : videos;

  const filteredItems = useMemo(() => {
    if (!search.trim()) return currentItems;
    const q = search.toLowerCase();
    return currentItems.filter(item => item.name.toLowerCase().includes(q));
  }, [currentItems, search]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (const file of files) {
      try {
        if (activeTab === 'image') {
          await effectsMediaAPI.uploadImage(file);
        } else {
          await effectsMediaAPI.uploadVideo(file);
        }
        successCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to upload ${file.name}`;
        addToast(msg, 'error');
      }
    }

    setUploading(false);

    if (successCount > 0) {
      addToast(`Uploaded ${successCount} file${successCount !== 1 ? 's' : ''}`, 'success');
      await fetchMedia();
    }
  }, [activeTab, addToast, fetchMedia]);

  const handleDelete = useCallback(async (item: EffectsMediaItem) => {
    if (!confirm(`Delete "${item.name}" from the GCS bucket?`)) return;

    const ok = await effectsMediaAPI.deleteItem(item);
    if (ok) {
      addToast(`Deleted ${item.name}`, 'success');
      if (previewItem?.path === item.path) setPreviewItem(null);
      if (item.mediaType === 'image') {
        setImages(prev => prev.filter(i => i.path !== item.path));
      } else {
        setVideos(prev => prev.filter(i => i.path !== item.path));
      }
    } else {
      addToast(`Failed to delete ${item.name}. Check webhook secret in Settings.`, 'error');
    }
  }, [addToast, previewItem]);

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-slate-800/80 backdrop-blur-xl shrink-0">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <span>🎬</span> Effects Media
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleUploadClick}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {uploading ? '⏳ Uploading…' : '⬆ Upload'}
          </button>
          <button
            onClick={fetchMedia}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>🔄</span>
            Sync
          </button>
          <button
            onClick={onClose}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-slate-100 transition-colors"
            title="Close"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={activeTab === 'image' ? 'image/*' : 'video/*'}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Tabs + search */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-700/60 bg-slate-800/40 shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('image'); setPreviewItem(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'image'
                ? 'bg-amber-700/40 text-amber-200 border border-amber-500/50'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/50'
            }`}
          >
            🖼️ Images ({images.length})
          </button>
          <button
            onClick={() => { setActiveTab('video'); setPreviewItem(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'video'
                ? 'bg-amber-700/40 text-amber-200 border border-amber-500/50'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/50'
            }`}
          >
            🎥 Videos ({videos.length})
          </button>
        </div>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${activeTab === 'image' ? 'images' : 'videos'}…`}
          className="flex-1 max-w-md px-4 py-2 bg-slate-800 border border-slate-700/60 rounded-lg text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500/50"
        />
        <span className="text-xs text-slate-500 hidden md:inline">
          GCS: my-sd35-space-images-2025
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Thumbnail grid */}
        <div className={`flex-1 overflow-auto p-6 ${previewItem ? 'border-r border-slate-700/60' : ''}`}>
          {error && (
            <div className="mb-4 bg-red-900/40 border border-red-700/60 text-red-300 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
              <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading from GCS bucket…</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-4">
              <span className="text-5xl">{activeTab === 'image' ? '🖼️' : '🎥'}</span>
              <p className="text-lg font-medium">
                {search ? 'No matches' : `No ${activeTab === 'image' ? 'images' : 'videos'} in bucket`}
              </p>
              <button
                onClick={handleUploadClick}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-sm font-medium"
              >
                Upload {activeTab === 'image' ? 'an image' : 'a video'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredItems.map(item => (
                <div
                  key={item.path}
                  className={`group relative rounded-xl overflow-hidden border transition-all cursor-pointer ${
                    previewItem?.path === item.path
                      ? 'border-amber-500/70 ring-2 ring-amber-500/30'
                      : 'border-slate-700/60 hover:border-slate-500/60'
                  }`}
                  onClick={() => setPreviewItem(item)}
                >
                  <div className="aspect-square bg-slate-800 overflow-hidden">
                    <MediaThumbnail item={item} />
                  </div>
                  <div className="p-2 bg-slate-800/90">
                    <p className="text-xs font-mono text-slate-200 truncate" title={item.name}>
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-500">{formatBytes(item.size)}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(item); }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-red-700/90 hover:bg-red-600 text-white text-xs rounded-lg font-medium"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview pane */}
        {previewItem && (
          <div className="w-full max-w-xl flex flex-col overflow-hidden shrink-0">
            <div className="px-4 py-3 bg-slate-800/80 flex items-center gap-3 border-b border-slate-700/60 shrink-0">
              <span className="font-mono text-sm text-amber-300 truncate flex-1">{previewItem.name}</span>
              <button
                onClick={() => setPreviewItem(null)}
                className="text-slate-500 hover:text-slate-200 transition-colors"
                title="Close preview"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-950/60 p-4">
              {previewItem.mediaType === 'video' ? (
                <video
                  src={previewItem.url}
                  controls
                  className="max-w-full max-h-full rounded-lg border border-slate-700/40"
                />
              ) : (
                <img
                  src={previewItem.url}
                  alt={previewItem.name}
                  className="max-w-full max-h-full rounded-lg object-contain border border-slate-700/40"
                />
              )}
            </div>
            <div className="px-4 py-3 bg-slate-800/60 border-t border-slate-700/60 text-xs text-slate-400 space-y-1 shrink-0">
              <p>Size: {formatBytes(previewItem.size)}</p>
              <p>Modified: {formatDate(previewItem.modified_at)}</p>
              <p className="truncate" title={previewItem.path}>Path: {previewItem.path}</p>
              <button
                onClick={() => handleDelete(previewItem)}
                className="mt-2 w-full px-3 py-2 bg-red-700/80 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Delete from bucket
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
