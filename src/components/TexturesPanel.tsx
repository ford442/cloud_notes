import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './Toast';
import { texturesAPI, TEXTURE_DIRS } from '../services/texturesAPI';
import type { TextureDirName, TextureDirInfo, TextureFileMeta } from '../services/texturesAPI';

interface TexturesPanelProps {
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export const TexturesPanel = ({ onClose }: TexturesPanelProps) => {
  const { addToast } = useToast();
  const [dirs, setDirs] = useState<TextureDirInfo[]>([]);
  const [dirsLoading, setDirsLoading] = useState(true);
  const [dirsError, setDirsError] = useState<string | null>(null);

  const [selectedDir, setSelectedDir] = useState<TextureDirName | null>(null);
  const [files, setFiles] = useState<TextureFileMeta[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDirs = useCallback(async () => {
    setDirsLoading(true);
    setDirsError(null);
    try {
      const data = await texturesAPI.listDirs();
      const map = new Map(data.map(d => [d.name, d]));
      const merged: TextureDirInfo[] = TEXTURE_DIRS.map(name => map.get(name) ?? { name, count: 0, updated_at: null });
      setDirs(merged);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load texture directories'; setDirsError(msg); addToast(msg, 'error');
    } finally {
      setDirsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDirs();
  }, [fetchDirs]);

  const fetchFiles = useCallback(async (name: TextureDirName) => {
    setFiles([]);
    setFilesError(null);
    setPreviewUrl(null);
    setFilesLoading(true);
    try {
      const data = await texturesAPI.listFiles(name);
      setFiles(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load files'; setFilesError(msg); addToast(msg, 'error');
    } finally {
      setFilesLoading(false);
    }
  }, []);

  const handleSelectDir = useCallback((name: TextureDirName) => {
    setSelectedDir(name);
    fetchFiles(name);
  }, [fetchFiles]);

  const handleDelete = useCallback(async (filename: string) => {
    if (!selectedDir) return;
    const ok = await texturesAPI.deleteFile(selectedDir, filename);
    if (ok) {
      addToast(`Deleted ${filename}`, 'success');
      setFiles(prev => prev.filter(f => f.name !== filename));
      setPreviewUrl(prev => prev === texturesAPI.getFileUrl(selectedDir, filename) ? null : prev);
      setDirs(prev => prev.map(d => d.name === selectedDir ? { ...d, count: Math.max(0, d.count - 1) } : d));
    } else {
      addToast(`Failed to delete ${filename}`, 'error');
    }
  }, [selectedDir]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDir) return;
    // reset so the same file can be re-uploaded
    e.target.value = '';
    const ok = await texturesAPI.uploadFile(selectedDir, file);
    if (ok) {
      addToast(`Uploaded ${file.name}`, 'success');
      fetchFiles(selectedDir);
    } else {
      addToast(`Failed to upload ${file.name}`, 'error');
    }
  }, [selectedDir, fetchFiles]);

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-slate-800/80 backdrop-blur-xl shrink-0">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <span>🖼️</span> Textures
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleUploadClick}
            disabled={!selectedDir}
            className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
          >
            ⬆ Upload
          </button>
          <button
            onClick={fetchDirs}
            disabled={dirsLoading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            <span className={dirsLoading ? 'animate-spin inline-block' : ''}>🔄</span>
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: directory cards */}
        <div className="w-72 shrink-0 flex flex-col border-r border-slate-700/60 bg-slate-800/40 overflow-y-auto p-4 gap-3">
          {dirsError && (
            <div className="bg-red-900/40 border border-red-700/60 text-red-300 rounded-lg px-4 py-3 text-sm">
              {dirsError}
            </div>
          )}
          {dirsLoading && dirs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">Loading directories…</span>
            </div>
          ) : (
            TEXTURE_DIRS.map(name => {
              const info = dirs.find(d => d.name === name);
              const isSelected = selectedDir === name;
              return (
                <button
                  key={name}
                  onClick={() => handleSelectDir(name)}
                  className={`text-left rounded-xl px-4 py-4 border transition-all ${
                    isSelected
                      ? 'bg-purple-700/30 border-purple-500/60 text-white'
                      : 'bg-slate-800 border-slate-700/50 text-slate-300 hover:bg-slate-700/60 hover:border-slate-600'
                  }`}
                >
                  <div className="font-semibold text-sm truncate">{name}</div>
                  <div className="text-xs mt-1 text-slate-400">
                    {info ? `${info.count} file${info.count !== 1 ? 's' : ''}` : '—'}
                  </div>
                  {info?.updated_at && (
                    <div className="text-xs mt-0.5 text-slate-500 truncate">
                      {formatDate(info.updated_at)}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Right: file list + preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedDir ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
              <span className="text-5xl">🖼️</span>
              <p className="text-lg font-medium">Select a texture directory</p>
              <p className="text-sm text-slate-600">Click a folder on the left to browse its files</p>
            </div>
          ) : (
            <>
              {/* File list */}
              <div className="border-b border-slate-700/60 overflow-auto" style={{ maxHeight: previewUrl ? '55%' : '100%' }}>
                <div className="px-6 py-3 bg-slate-800/60 flex items-center gap-2 sticky top-0 border-b border-slate-700/40">
                  <span className="font-semibold text-slate-200">{selectedDir}</span>
                  {filesLoading && (
                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin ml-2"></div>
                  )}
                </div>
                {filesError && (
                  <div className="mx-6 mt-4 bg-red-900/40 border border-red-700/60 text-red-300 rounded-lg px-4 py-3 text-sm">
                    {filesError}
                  </div>
                )}
                {!filesLoading && !filesError && files.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <p className="text-sm">No files in this directory</p>
                  </div>
                )}
                {files.length > 0 && (
                  <table className="w-full text-sm text-left">
                    <thead className="sticky top-[45px] bg-slate-800/80 text-xs text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3">Filename</th>
                        <th className="px-4 py-3 w-24">Size</th>
                        <th className="px-4 py-3 w-48">Modified</th>
                        <th className="px-4 py-3 w-14">Preview</th>
                        <th className="px-4 py-3 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map(file => {
                        // Always derive src from our own API method to avoid trusting raw field from response
                        const fileUrl = texturesAPI.getFileUrl(selectedDir, file.name);
                        return (
                          <tr
                            key={file.name}
                            className={`border-t border-slate-700/30 transition-colors cursor-pointer ${
                              previewUrl === fileUrl
                                ? 'bg-purple-900/20'
                                : 'hover:bg-slate-700/20'
                            }`}
                            onClick={() => setPreviewUrl(prev => prev === fileUrl ? null : fileUrl)}
                          >
                            <td className="px-6 py-3 font-mono text-slate-200 truncate max-w-xs">{file.name}</td>
                            <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatBytes(file.size)}</td>
                            <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatDate(file.modified_at)}</td>
                            <td className="px-4 py-2">
                              <img
                                src={fileUrl}
                                alt={file.name}
                                width={48}
                                height={48}
                                className="rounded object-cover border border-slate-700/60"
                                style={{ width: 48, height: 48, objectFit: 'cover' }}
                              />
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleDelete(file.name)}
                                className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-red-700 text-slate-300 hover:text-white rounded-lg transition-colors font-medium"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Full-size image preview */}
              {previewUrl && (
                <div className="flex-1 flex flex-col overflow-hidden border-t border-slate-700/60">
                  <div className="px-6 py-2 bg-slate-800/80 flex items-center gap-3 shrink-0">
                    <span className="font-mono text-sm text-purple-300 truncate">{previewUrl.split('/').pop()}</span>
                    <button
                      onClick={() => setPreviewUrl(null)}
                      className="ml-auto text-slate-500 hover:text-slate-200 transition-colors"
                      title="Close preview"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-950/60 p-4">
                    <img
                      src={previewUrl}
                      alt="preview"
                      className="max-w-full max-h-full rounded-lg object-contain border border-slate-700/40"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
