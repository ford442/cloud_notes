import { useState, useEffect } from 'react';
import { EncryptionService } from '../utils/encryption';
import { useToast } from './Toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  authorName: string;
  setAuthorName: (name: string) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  onVpsSync?: (onProgress?: (message: string) => void) => Promise<{ pulled: number; pushed: number; errors: string[] }>;
}

import { SemanticService } from '../services/semantic';

const Tabs = ['General', 'Security', 'Integrations', 'Data'];

function normalizeFlacApiUrl(rawUrl: string): string {
  const trimmed = rawUrl?.trim().replace(/\/+$|\/$/, '') || '';
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    const cleanedPath = url.pathname.replace(/\/+$|\/$/, '');
    if (cleanedPath.toLowerCase().endsWith('/flac-player')) {
      url.pathname = '';
      url.search = '';
      url.hash = '';
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return trimmed;
  }
}

export const SettingsModal = ({ isOpen, onClose, authorName, setAuthorName, theme, setTheme, onVpsSync }: SettingsModalProps) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('General');
  const [readwiseToken, setReadwiseToken] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [flacApiUrl, setFlacApiUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReadwiseToken(localStorage.getItem('readwise_token') || '');
      setEncryptionKey(EncryptionService.getOrInitPassword());
      setShowKey(false);
      setApiUrl(localStorage.getItem('api_url') || 'https://storage.noahcohn.com');
      setFlacApiUrl(normalizeFlacApiUrl(localStorage.getItem('flac_api_url') || ''));
    }
  }, [isOpen]);

  const handleSaveApiUrl = () => {
    if (!apiUrl.trim()) return addToast('API URL cannot be empty', 'error');
    localStorage.setItem('api_url', apiUrl);
    addToast('Storage API URL updated. Please reload.', 'success');
    setTimeout(() => window.location.reload(), 1500);
  };

  const handleSaveReadwise = () => {
    localStorage.setItem('readwise_token', readwiseToken);
    addToast('Readwise token saved', 'success');
  };

  const handleSaveFlacUrl = () => {
    const cleanUrl = normalizeFlacApiUrl(flacApiUrl);
    if (!cleanUrl) return addToast('FLAC API URL cannot be empty', 'error');
    setFlacApiUrl(cleanUrl);
    localStorage.setItem('flac_api_url', cleanUrl);
    addToast('FLAC API URL saved', 'success');
  };

  const handleUseStorageApiForFlac = () => {
    const storageUrl = normalizeFlacApiUrl(apiUrl);
    setFlacApiUrl(storageUrl);
    localStorage.setItem('flac_api_url', storageUrl);
    addToast('FLAC API URL set to match Storage API', 'success');
  };

  const handleUpdateKey = () => {
    if (!encryptionKey.trim()) return addToast('Key cannot be empty', 'error');
    if (confirm('Warning: changing the encryption key will make existing encrypted notes unreadable. Are you sure?')) {
        EncryptionService.setPassword(encryptionKey);
        addToast('Encryption key updated. Please reload.', 'success');
        setTimeout(() => window.location.reload(), 1500);
    }
  };

  const handleReindex = async () => {
      if (isReindexing) return;
      setIsReindexing(true);
      setReindexProgress('Starting...');
      try {
          await SemanticService.reindexAll((count, total) => {
              setReindexProgress(`Indexing ${count} / ${total}...`);
          });
          addToast('Re-indexing complete', 'success');
          setReindexProgress('Done');
      } catch (e) {
          console.error(e);
          addToast('Re-indexing failed', 'error');
      } finally {
          setIsReindexing(false);
      }
  };

  const handleSync = async () => {
    if (!onVpsSync || isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('Starting sync...');
    try {
      await onVpsSync((msg) => setSyncStatus(msg));
      setSyncStatus('Done');
    } catch (e) {
      console.error(e);
      setSyncStatus('Failed');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(''), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-2 border-b border-slate-100 dark:border-slate-700 space-x-6">
          {Tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === tab
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">

          {activeTab === 'General' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Author Name</label>
                <input
                  type="text"
                  value={authorName}
                  onChange={e => setAuthorName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Enter your name"
                />
                <p className="text-xs text-slate-400 mt-1">This name will be attached to new notes you create.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Theme</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setTheme('light')}
                    className={`px-4 py-3 rounded-xl border transition-all ${
                      theme === 'light'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-semibold text-sm">Light Mode</div>
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`px-4 py-3 rounded-xl border transition-all ${
                      theme === 'dark'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-semibold text-sm">Dark Mode</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Data' && (
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 transition-all">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">Storage API URL</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                      Configure the URL of the VPS API or backend storage service.
                    </p>
                    <div className="flex gap-3">
                      <input
                        type="url"
                        value={apiUrl}
                        onChange={e => setApiUrl(e.target.value)}
                        className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="https://..."
                      />
                      <button
                        onClick={handleSaveApiUrl}
                        className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors shrink-0"
                      >
                        Save URL
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">Semantic Index</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                      Re-build the vector index for all your notes. This allows the AI Q&A and "Find Similar" features to work across your entire knowledge base. This process happens entirely in your browser.
                    </p>

                    <div className="flex items-center gap-4">
                        <button
                          onClick={handleReindex}
                          disabled={isReindexing}
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isReindexing ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                Indexing...
                              </>
                          ) : (
                              <>
                                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Re-index All Notes
                              </>
                          )}
                        </button>
                        {reindexProgress && (
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Status</span>
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 font-mono">{reindexProgress}</span>
                            </div>
                        )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6 flex items-start gap-4">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">VPS Sync</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                      Bidirectionally sync your local notes with the VPS storage manager (rain_edit). Newer notes overwrite older ones in both directions.
                    </p>

                    <div className="flex items-center gap-4">
                        <button
                          onClick={handleSync}
                          disabled={isSyncing || !onVpsSync}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isSyncing ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                Syncing...
                              </>
                          ) : (
                              <>
                                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Sync Notes Now
                              </>
                          )}
                        </button>
                        {syncStatus && (
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Status</span>
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 font-mono">{syncStatus}</span>
                            </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Security' && (
            <div className="space-y-4">
               <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
                 <strong>Warning:</strong> Your notes are encrypted with this key. If you lose it, you lose access to your encrypted content. If you change it, you must migrate your data or it will be unreadable.
               </div>

               <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Encryption Key</label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={encryptionKey}
                    onChange={e => setEncryptionKey(e.target.value)}
                    className="w-full pl-4 pr-12 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showKey ? (
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
               </div>

               <div className="flex justify-end">
                 <button
                   onClick={handleUpdateKey}
                   className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                 >
                   Update Key
                 </button>
               </div>
            </div>
          )}

          {activeTab === 'Integrations' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Readwise Access Token</label>
                <input
                  type="password"
                  value={readwiseToken}
                  onChange={e => setReadwiseToken(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Paste your token here"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Get your token from <a href="https://readwise.io/access_token" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Readwise</a>.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveReadwise}
                  className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                >
                  Save Token
                </button>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">FLAC Player API URL</label>
                <input
                  type="url"
                  value={flacApiUrl}
                  onChange={e => setFlacApiUrl(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="https://your-flac-player-backend.com"
                />
                <p className="text-xs text-slate-400 mt-1">
                  URL of your FLAC Player backend for music library management.
                  Use the backend host root (for example <code>https://test.1ink.us</code>), not the UI path <code>/flac-player</code>.
                  {apiUrl && apiUrl !== flacApiUrl && (
                    <button
                      onClick={handleUseStorageApiForFlac}
                      className="ml-2 text-blue-500 hover:underline"
                    >
                      Use same host as Storage API
                    </button>
                  )}
                </p>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={handleSaveFlacUrl}
                    className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                  >
                    Save URL
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Webhook Secret (Storage Manager)</label>
                <input
                  type="password"
                  defaultValue={localStorage.getItem('webhook_secret') || ''}
                  onChange={e => localStorage.setItem('webhook_secret', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Paste your webhook secret here"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Used to generate HMAC signatures for the VPS Storage Manager webhook integration.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
