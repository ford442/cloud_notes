import { useState, useEffect } from 'react';
import { EncryptionService } from '../utils/encryption';
import { useToast } from './Toast';
import { PluginRegistry } from '../services/plugin';

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
import { normalizeFlacApiUrl } from '../utils/flac';
import { vpsStorageAPI } from '../services/vpsStorageAPI';

const Tabs = ['General', 'Security', 'Integrations', 'Data'];

export const SettingsModal = ({ isOpen, onClose, authorName, setAuthorName, theme, setTheme, onVpsSync }: SettingsModalProps) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('General');
  const [readwiseToken, setReadwiseToken] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [newEncryptionKey, setNewEncryptionKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showNewKey, setShowNewKey] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationProgress, setRotationProgress] = useState<number | null>(null);

  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [flacApiUrl, setFlacApiUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [isRescanningPresets, setIsRescanningPresets] = useState(false);
  const [presetScanStatus, setPresetScanStatus] = useState('');

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

  const handleRotateKey = async () => {
    if (!encryptionKey.trim()) return addToast('Current key cannot be empty', 'error');
    if (!newEncryptionKey.trim()) return addToast('New key cannot be empty', 'error');
    if (encryptionKey === newEncryptionKey) return addToast('New key must be different', 'error');

    const confirmed = await PluginRegistry.confirm(
      'Are you sure you want to rotate your encryption key? This will download, decrypt, and re-encrypt all your notes. Please do not close the app during this process.'
    );
    if (!confirmed) return;

    setIsRotating(true);
    setRotationProgress(0);

    try {
      const notesMeta = await vpsStorageAPI.listNotes();
      if (notesMeta.length === 0) {
          EncryptionService.setPassword(newEncryptionKey);
          addToast('Encryption key updated (no notes to migrate).', 'success');
          setNewEncryptionKey('');
          setIsRotating(false);
          setRotationProgress(null);
          return;
      }

      // 1. Verify current password works against the first note
      const sampleNote = await vpsStorageAPI.readNote(notesMeta[0].name);
      const isCurrentKeyValid = await EncryptionService.verifyPassword(encryptionKey, sampleNote.content);
      if (!isCurrentKeyValid) {
          setIsRotating(false);
          setRotationProgress(null);
          return addToast('Current key is incorrect. Decryption failed.', 'error');
      }

      // 2. Batch process notes
      const BATCH_SIZE = 5;
      let processedCount = 0;

      for (let i = 0; i < notesMeta.length; i += BATCH_SIZE) {
          const batch = notesMeta.slice(i, i + BATCH_SIZE);

          await Promise.all(batch.map(async (meta) => {
              try {
                  const note = await vpsStorageAPI.readNote(meta.name);
                  // Decrypt with OLD key
                  const decryptedContent = await EncryptionService.decrypt(note.content, encryptionKey);

                  // If it failed to decrypt (e.g. not encrypted, or corrupted), skip re-encryption to avoid data loss
                  if (decryptedContent.startsWith('**Decryption Failed**')) {
                      console.warn(`[KeyRotation] Skipping note ${meta.name} due to decryption failure.`);
                      return;
                  }

                  // Encrypt with NEW key
                  const reEncryptedContent = await EncryptionService.encrypt(decryptedContent, newEncryptionKey);

                  // Save back to VPS
                  await vpsStorageAPI.writeNote(meta.name, reEncryptedContent);
              } catch (e) {
                  console.error(`[KeyRotation] Error processing note ${meta.name}:`, e);
                  throw new Error(`Failed to migrate note ${meta.name}`);
              }
          }));

          processedCount += batch.length;
          setRotationProgress(Math.round((processedCount / notesMeta.length) * 100));
      }

      // 3. Finalize: Set the new key globally
      EncryptionService.setPassword(newEncryptionKey);
      addToast('Encryption key successfully rotated!', 'success');
      setEncryptionKey(newEncryptionKey);
      setNewEncryptionKey('');

      // Optionally reload to ensure all local caches are using the new key seamlessly
      setTimeout(() => window.location.reload(), 1500);

    } catch (e) {
        console.error('[KeyRotation] Fatal error during rotation:', e);
        addToast(`Key rotation failed: ${e instanceof Error ? e.message : 'Unknown error'}. Your global key was NOT changed.`, 'error');
    } finally {
        setIsRotating(false);
        setRotationProgress(null);
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

  const handleRescanPresets = async () => {
    if (isRescanningPresets) return;
    setIsRescanningPresets(true);
    setPresetScanStatus('Starting scan...');
    try {
      const baseUrl = apiUrl.replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/api/presets/rescan`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const counts = data.dirs || {};
      const total = Object.values(counts).reduce((a: number, b: unknown) => a + (b as number), 0);
      setPresetScanStatus(`${total} presets indexed`);
      addToast('Preset scan complete', 'success');
    } catch (e) {
      console.error(e);
      setPresetScanStatus('Failed');
      addToast('Preset scan failed', 'error');
    } finally {
      setIsRescanningPresets(false);
      setTimeout(() => setPresetScanStatus(''), 5000);
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

                <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6 flex items-start gap-4">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">Project-M Presets</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                      Rebuild the cached preset index on the storage manager server. This indexes the milk, milkLRG, milkMED, milkSML, and custom_milk directories so the Project-M WASM app can load random presets without scanning.
                    </p>

                    <div className="flex items-center gap-4">
                        <button
                          onClick={handleRescanPresets}
                          disabled={isRescanningPresets}
                          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isRescanningPresets ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                Scanning...
                              </>
                          ) : (
                              <>
                                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Rescan Presets on Server
                              </>
                          )}
                        </button>
                        {presetScanStatus && (
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Status</span>
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 font-mono">{presetScanStatus}</span>
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
                 <strong>Warning:</strong> Your notes are encrypted with this key. If you lose it, you lose access to your encrypted content. Rotating the key will securely re-encrypt all your saved notes.
               </div>

               <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Current Encryption Key</label>
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

               <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 mt-4">New Encryption Key</label>
                <div className="relative">
                  <input
                    type={showNewKey ? "text" : "password"}
                    value={newEncryptionKey}
                    onChange={e => setNewEncryptionKey(e.target.value)}
                    disabled={isRotating}
                    className="w-full pl-4 pr-12 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono disabled:opacity-50"
                  />
                  <button
                    onClick={() => setShowNewKey(!showNewKey)}
                    disabled={isRotating}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-50"
                  >
                    {showNewKey ? (
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
               </div>

               {isRotating && rotationProgress !== null && (
                 <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span>Re-encrypting notes...</span>
                      <span>{rotationProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${rotationProgress}%` }}></div>
                    </div>
                 </div>
               )}

               <div className="flex justify-end mt-4">
                 <button
                   onClick={handleRotateKey}
                   disabled={isRotating}
                   className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                 >
                   {isRotating ? 'Rotating...' : 'Rotate Key'}
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
