import type { CommandItem } from '../components/editor/slash-command';
import type { ActionItem } from '../components/CommandPalette';
import type { Note, CloudItemMeta } from './api';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

export interface DialogRequest {
  type: 'alert' | 'confirm' | 'prompt';
  message: string;
  defaultValue?: string;
}

export type DialogHandler = (request: DialogRequest) => Promise<string | boolean | undefined | null>;

export interface PluginContext {
  registerCommand: (command: CommandItem) => void;
  registerCommandProvider: (provider: () => CommandItem[]) => void;
  registerAction: (action: ActionItem) => void;
  getCurrentNote: () => Note | null;
  getAllNotes: () => CloudItemMeta[];
  updateNote: (updates: Partial<Note>) => Promise<void>;
  createNote: (note: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  navigateTo: (id: string) => void;
  getCanvasAPI: () => ExcalidrawImperativeAPI | null;
  setMode: (mode: string) => void;
  setFocusMode: (enabled: boolean) => void;
  alert: (message: string) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
  prompt: (message: string, defaultValue?: string) => Promise<string | null>;
}

export interface Plugin {
  id: string;
  name: string;
  init: (context: PluginContext) => void;
}

class PluginRegistryService {
  private plugins: Map<string, Plugin> = new Map();
  private commands: Map<string, CommandItem> = new Map();
  private commandProviders: (() => CommandItem[])[] = [];
  private actions: Map<string, ActionItem> = new Map();

  // Callbacks provided by App
  private noteGetter: () => Note | null = () => null;
  private allNotesGetter: () => CloudItemMeta[] = () => [];
  private noteUpdater: (updates: Partial<Note>) => Promise<void> | void = () => {};
  private noteCreator: (note: Partial<Note>) => Promise<void> | void = () => {};
  private noteDeleter: (id: string) => Promise<void> = async () => {};
  private navigator: (id: string) => void = () => {};
  private modeSetter: (mode: string) => void = () => {};
  private focusModeSetter: (enabled: boolean) => void = () => {};
  private canvasAPI: ExcalidrawImperativeAPI | null = null;
  private dialogHandler: DialogHandler = async () => null;

  setDialogHandler(handler: DialogHandler) {
    this.dialogHandler = handler;
  }

  async alert(message: string): Promise<void> {
    await this.dialogHandler({ type: 'alert', message });
  }

  async confirm(message: string): Promise<boolean> {
    const result = await this.dialogHandler({ type: 'confirm', message });
    return result === true;
  }

  async prompt(message: string, defaultValue?: string): Promise<string | null> {
    const result = await this.dialogHandler({ type: 'prompt', message, defaultValue });
    return typeof result === 'string' ? result : null;
  }

  setNoteGetter(getter: () => Note | null) {
    this.noteGetter = getter;
  }

  setAllNotesGetter(getter: () => CloudItemMeta[]) {
    this.allNotesGetter = getter;
  }

  setNoteUpdater(updater: (updates: Partial<Note>) => Promise<void> | void) {
    this.noteUpdater = updater;
  }

  setNoteCreator(creator: (note: Partial<Note>) => Promise<void> | void) {
    this.noteCreator = creator;
  }

  setNoteDeleter(deleter: (id: string) => Promise<void>) {
    this.noteDeleter = deleter;
  }

  setNavigator(navigator: (id: string) => void) {
    this.navigator = navigator;
  }

  setModeSetter(setter: (mode: string) => void) {
    this.modeSetter = setter;
  }

  setFocusModeSetter(setter: (enabled: boolean) => void) {
    this.focusModeSetter = setter;
  }

  setCanvasAPI(api: ExcalidrawImperativeAPI | null) {
    this.canvasAPI = api;
  }

  getCurrentNote(): Note | null {
    return this.noteGetter();
  }

  async updateNote(updates: Partial<Note>): Promise<void> {
    await this.noteUpdater(updates);
  }

  register(plugin: Plugin) {
    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin ${plugin.id} is already registered.`);
      return;
    }
    this.plugins.set(plugin.id, plugin);
    this.initPlugin(plugin);
  }

  private initPlugin(plugin: Plugin) {
    const context: PluginContext = {
      registerCommand: (cmd) => {
        const commandKey = `${plugin.id}:${cmd.title}`;
        if (this.commands.has(commandKey)) {
          console.warn(`Command ${commandKey} is already registered.`);
          return;
        }
        this.commands.set(commandKey, cmd);
      },
      registerCommandProvider: (provider) => {
        this.commandProviders.push(provider);
      },
      registerAction: (action) => {
        if (this.actions.has(action.id)) {
          console.warn(`Action ${action.id} is already registered.`);
          return;
        }
        this.actions.set(action.id, action);
      },
      getCurrentNote: () => this.noteGetter(),
      getAllNotes: () => this.allNotesGetter(),
      updateNote: async (updates: Partial<Note>) => { await this.noteUpdater(updates); },
      createNote: async (note) => { await this.noteCreator(note); },
      deleteNote: (id) => this.noteDeleter(id),
      navigateTo: (id) => this.navigator(id),
      getCanvasAPI: () => this.canvasAPI,
      setMode: (mode) => this.modeSetter(mode),
      setFocusMode: (enabled) => this.focusModeSetter(enabled),
      alert: (msg) => this.alert(msg),
      confirm: (msg) => this.confirm(msg),
      prompt: (msg, def) => this.prompt(msg, def)
    };

    try {
      plugin.init(context);
      console.log(`Plugin loaded: ${plugin.name}`);
    } catch (e) {
      console.error(`Failed to load plugin ${plugin.id}:`, e);
    }
  }

  getSlashCommands(): CommandItem[] {
    const dynamicCommands = this.commandProviders.flatMap(provider => provider());
    return [...Array.from(this.commands.values()), ...dynamicCommands];
  }

  getActions(): ActionItem[] {
    return Array.from(this.actions.values());
  }

  registerAll(plugins: Plugin[]) {
    plugins.forEach(p => this.register(p));
  }
}

export const PluginRegistry = new PluginRegistryService();
