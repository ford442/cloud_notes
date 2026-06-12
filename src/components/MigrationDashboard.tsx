import { useState } from 'react';
import { StorageService } from '../services/api';
import { vpsStorageAPI } from '../services/vpsStorageAPI';
import type { CloudItemMeta } from '../services/api';

interface MigrationDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MigrationStats {
  totalLocal: number;
  totalVps: number;
  missingOnVps: CloudItemMeta[];
}

export const MigrationDashboard = ({ isOpen, onClose }: MigrationDashboardProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  if (!isOpen) return null;

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const handleDryRun = async () => {
    setIsAnalyzing(true);
    setLogs([]);
    addLog('Starting analysis...');

    try {
      const localNotes = await StorageService.getCachedNotes();
      addLog(`Found ${localNotes.length} notes in local cache.`);

      let vpsNotes: import('../services/vpsStorageAPI').VpsNoteMeta[] = [];
      try {
          vpsNotes = await vpsStorageAPI.listNotes();
          addLog(`Found ${vpsNotes.length} notes on VPS.`);
      } catch (e) {
          addLog(`Error fetching VPS notes: ${e instanceof Error ? e.message : String(e)}`);
          vpsNotes = [];
      }

      const vpsNoteNames = new Set(vpsNotes.map(n => n.name));
      const missing = localNotes.filter(n => {
          // Compare using id or name
          const fileName = `${n.id}.md`;
          return !vpsNoteNames.has(fileName) && !vpsNoteNames.has(n.id) && !vpsNoteNames.has(n.name);
      });

      setStats({
        totalLocal: localNotes.length,
        totalVps: vpsNotes.length,
        missingOnVps: missing
      });

      addLog(`Analysis complete. ${missing.length} notes need migration.`);
    } catch (e) {
      addLog(`Analysis failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMigrate = async () => {
    if (!stats || stats.missingOnVps.length === 0) return;

    setIsMigrating(true);
    setProgress(0);
    addLog('Starting migration to VPS...');

    let successCount = 0;
    let failCount = 0;
    const total = stats.missingOnVps.length;

    for (let i = 0; i < total; i++) {
      const noteMeta = stats.missingOnVps[i];
      try {
        let note = await StorageService.getCachedNote(noteMeta.id);
        if (!note) {
          addLog(`Fetching content for ${noteMeta.name} from remote...`);
          note = await StorageService.getNoteContent(noteMeta.id);
        }

        if (note && note.content) {
            const fileName = `${noteMeta.id}.md`;
            await vpsStorageAPI.writeNote(fileName, note.content);
            successCount++;
            addLog(`✅ Migrated: ${noteMeta.name}`);
        } else {
            failCount++;
            addLog(`❌ Failed to read content for: ${noteMeta.name}`);
        }
      } catch (e) {
        failCount++;
        addLog(`❌ Error migrating ${noteMeta.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
      setProgress(Math.round(((i + 1) / total) * 100));
    }

    addLog(`Migration finished. Success: ${successCount}, Failed: ${failCount}`);
    setIsMigrating(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-900/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Storage Migration Dashboard</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Migrate notes to Contabo VPS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="flex gap-4">
            <button
              onClick={handleDryRun}
              disabled={isAnalyzing || isMigrating}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {isAnalyzing ? 'Analyzing...' : '1. Run Analysis (Dry Run)'}
            </button>
            <button
              onClick={handleMigrate}
              disabled={!stats || stats.missingOnVps.length === 0 || isAnalyzing || isMigrating}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {isMigrating ? `Migrating... ${progress}%` : '2. Migrate Missing Notes'}
            </button>
          </div>

          {stats && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{stats.totalLocal}</div>
                <div className="text-sm text-slate-500">Local Notes</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{stats.totalVps}</div>
                <div className="text-sm text-slate-500">VPS Notes</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-700/30 text-center">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">{stats.missingOnVps.length}</div>
                <div className="text-sm text-amber-600/80 dark:text-amber-500/80">Need Migration</div>
              </div>
            </div>
          )}

          {isMigrating && (
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
          )}

          <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <span className="text-slate-500">Ready for analysis.</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`mb-1 ${log.includes('✅') ? 'text-emerald-400' : log.includes('❌') ? 'text-rose-400' : 'text-slate-300'}`}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
