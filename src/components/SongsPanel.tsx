import { useState, useEffect, useCallback } from 'react';
import { useToast } from './Toast';
import { songsAPI, SONG_DIRS } from '../services/songsAPI';
import type { SongDirName, SongDirInfo, SongFileMeta } from '../services/songsAPI';

interface SongsPanelProps {
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

export const SongsPanel = ({ onClose }: SongsPanelProps) => {
  const { addToast } = useToast();
  const [dirs, setDirs] = useState<SongDirInfo[]>([]);
  const [dirsLoading, setDirsLoading] = useState(true);
  const [dirsError, setDirsError] = useState<string | null>(null);

  const [selectedDir, setSelectedDir] = useState<SongDirName | null>(null);
  const [files, setFiles] = useState<SongFileMeta[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  const fetchDirs = useCallback(async () => {
    setDirsLoading(true);
    setDirsError(null);
    try {
      const data = await songsAPI.listDirs();
      const map = new Map(data.map(d => [d.name, d]));
      const merged: SongDirInfo[] = SONG_DIRS.map(name => map.get(name) ?? { name, count: 0, updated_at: null });
      setDirs(merged);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load song directories'; setDirsError(msg); addToast(msg, 'error');
    } finally {
      setDirsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDirs();
  }, [fetchDirs]);

  const handleSelectDir = useCallback(async (name: SongDirName) => {
    setSelectedDir(name);
    setFiles([]);
    setFilesError(null);
    setFilesLoading(true);
    try {
      const data = await songsAPI.listFiles(name);
      setFiles(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load files'; setFilesError(msg); addToast(msg, 'error');
    } finally {
      setFilesLoading(false);
    }
  }, []);

  const handlePlay = useCallback((url: string, name: string) => {
    new BroadcastChannel('sng').postMessage({ data: url });
    addToast(`Sent to ProjectM: ${name}`, 'success');
  }, []);

  const handleCopyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      addToast('URL copied to clipboard', 'success');
    } catch {
      addToast('Failed to copy URL', 'error');
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-slate-800/80 backdrop-blur-xl shrink-0">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <span>🎵</span> Songs
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDirs}
            disabled={dirsLoading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            <span className={dirsLoading ? 'animate-spin inline-block' : ''}>🔄</span>
            Refresh
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
            SONG_DIRS.map(name => {
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

        {/* Right: file list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedDir ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
              <span className="text-5xl">🎵</span>
              <p className="text-lg font-medium">Select a song directory</p>
              <p className="text-sm text-slate-600">Click a folder on the left to browse its files</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
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
                      <th className="px-4 py-3 w-36"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map(file => {
                      // Always derive URL from our own API method to avoid trusting raw field from response
                      const songUrl = songsAPI.getSongUrl(selectedDir, file.name);
                      return (
                        <tr
                          key={file.name}
                          className="border-t border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                        >
                          <td className="px-6 py-3 font-mono text-slate-200 truncate max-w-xs">{file.name}</td>
                          <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatBytes(file.size)}</td>
                          <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatDate(file.modified_at)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handlePlay(songUrl, file.name)}
                                className="text-xs px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors font-medium whitespace-nowrap"
                              >
                                ▶ Play
                              </button>
                              <button
                                onClick={() => handleCopyUrl(songUrl)}
                                className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors font-medium whitespace-nowrap"
                              >
                                🔗 Copy URL
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
