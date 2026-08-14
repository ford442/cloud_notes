import { useEffect } from 'react';
import { SettingsModal } from '../components/SettingsModal';
import { HistoryModal } from '../components/HistoryModal';
import { Dialog } from '../components/Dialog';
import type { DialogType } from '../components/Dialog';
import { CommandPalette } from '../components/CommandPalette';
import { SearchModal } from '../components/SearchModal';
import { ChatModal } from '../components/ChatModal';
import { PluginRegistry } from '../services/plugin';
import type { Note, CloudItemMeta } from '../services/api';

export interface DialogConfig {
  isOpen: boolean;
  type: DialogType;
  message: string;
  defaultValue?: string;
  resolve: (value: any) => void;
}

interface AppDialogsProps {
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isHistoryOpen: boolean;
  setIsHistoryOpen: (open: boolean) => void;
  isCmdPaletteOpen: boolean;
  setIsCmdPaletteOpen: (open: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  dialogConfig: DialogConfig | null;
  setDialogConfig: (config: DialogConfig | null) => void;
  authorName: string;
  setAuthorName: (name: string) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  notes: CloudItemMeta[];
  selectedId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onVpsSync: (onProgress?: (message: string) => void) => Promise<any>;
  onRestore: (content: string) => void;
}

export function AppDialogs({
  isSettingsOpen,
  setIsSettingsOpen,
  isHistoryOpen,
  setIsHistoryOpen,
  isCmdPaletteOpen,
  setIsCmdPaletteOpen,
  isSearchOpen,
  setIsSearchOpen,
  isChatOpen,
  setIsChatOpen,
  dialogConfig,
  setDialogConfig,
  authorName,
  setAuthorName,
  theme,
  setTheme,
  notes,
  selectedId,
  onSelectNote,
  onNewNote,
  onVpsSync,
  onRestore,
}: AppDialogsProps) {
  // Setup global dialog handler
  useEffect(() => {
    // Register dialog handler once on mount. AppDialogs is unconditionally rendered
    // in App.tsx, so this component is never unmounted during the app lifecycle.
    PluginRegistry.setDialogHandler((request) => {
      return new Promise((resolve) => {
        setDialogConfig({
          isOpen: true,
          type: request.type,
          message: request.message,
          defaultValue: request.defaultValue,
          resolve: (val) => {
            setDialogConfig(null);
            resolve(val);
          },
        });
      });
    });
  }, []);

  return (
    <>
      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          authorName={authorName}
          setAuthorName={setAuthorName}
          theme={theme}
          setTheme={(t) => setTheme(t as 'light' | 'dark')}
          onVpsSync={onVpsSync}
        />
      )}

      {/* History Modal */}
      {isHistoryOpen && selectedId && (
        <HistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          noteId={selectedId}
          onRestore={onRestore}
        />
      )}

      {/* Global Dialog */}
      {dialogConfig && (
        <Dialog
          key={dialogConfig.message + dialogConfig.type}
          isOpen={dialogConfig.isOpen}
          type={dialogConfig.type}
          message={dialogConfig.message}
          defaultValue={dialogConfig.defaultValue}
          onConfirm={(val) => {
            if (dialogConfig.type === 'confirm') dialogConfig.resolve(true);
            else if (dialogConfig.type === 'prompt') dialogConfig.resolve(val);
            else dialogConfig.resolve(undefined); // alert
          }}
          onCancel={() => {
            if (dialogConfig.type === 'confirm') dialogConfig.resolve(false);
            else dialogConfig.resolve(null); // prompt or alert
          }}
        />
      )}

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCmdPaletteOpen}
        onClose={() => setIsCmdPaletteOpen(false)}
        notes={notes}
        onNavigate={onSelectNote}
        actions={PluginRegistry.getActions()}
        onNewNote={onNewNote}
        onSearchOpen={() => setIsSearchOpen(true)}
      />

      {/* Chat Modal */}
      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onNavigate={(id) => {
          onSelectNote(id);
          setIsChatOpen(false);
        }}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={onSelectNote}
      />
    </>
  );
}
