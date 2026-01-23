import type { CommandItem } from '../components/editor/slash-command';
import type { ActionItem } from '../components/CommandPalette';
import type { Note, CloudItemMeta } from './api';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

export interface PluginContext {
  registerCommand: (command: CommandItem) => void;
  registerAction: (action: ActionItem) => void;
  getCurrentNote: () => Note | null;
  getAllNotes: () => CloudItemMeta[];
  updateNote: (updates: Partial<Note>) => void;
  createNote: (note: Partial<Note>) => void;
  navigateTo: (id: string) => void;
  getCanvasAPI: () => ExcalidrawImperativeAPI | null;
  setMode: (mode: string) => void;
}

export interface Plugin {
  id: string;
  name: string;
  init: (context: PluginContext) => void;
}

class PluginRegistryService {
  private plugins: Map<string, Plugin> = new Map();
  private commands: CommandItem[] = [];
  private actions: ActionItem[] = [];

  // Callbacks provided by App
  private noteGetter: () => Note | null = () => null;
  private allNotesGetter: () => CloudItemMeta[] = () => [];
  private noteUpdater: (updates: Partial<Note>) => void = () => {};
  private noteCreator: (note: Partial<Note>) => void = () => {};
  private navigator: (id: string) => void = () => {};
  private modeSetter: (mode: string) => void = () => {};
  private canvasAPI: ExcalidrawImperativeAPI | null = null;

  setNoteGetter(getter: () => Note | null) {
    this.noteGetter = getter;
  }

  setAllNotesGetter(getter: () => CloudItemMeta[]) {
    this.allNotesGetter = getter;
  }

  setNoteUpdater(updater: (updates: Partial<Note>) => void) {
    this.noteUpdater = updater;
  }

  setNoteCreator(creator: (note: Partial<Note>) => void) {
    this.noteCreator = creator;
  }

  setNavigator(navigator: (id: string) => void) {
    this.navigator = navigator;
  }

  setModeSetter(setter: (mode: string) => void) {
    this.modeSetter = setter;
  }

  setCanvasAPI(api: ExcalidrawImperativeAPI | null) {
    this.canvasAPI = api;
  }

  getCurrentNote(): Note | null {
    return this.noteGetter();
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
        this.commands.push(cmd);
      },
      registerAction: (action) => {
        this.actions.push(action);
      },
      getCurrentNote: () => this.noteGetter(),
      getAllNotes: () => this.allNotesGetter(),
      updateNote: (updates: Partial<Note>) => this.noteUpdater(updates),
      createNote: (note) => this.noteCreator(note),
      navigateTo: (id) => this.navigator(id),
      getCanvasAPI: () => this.canvasAPI,
      setMode: (mode) => this.modeSetter(mode)
    };

    try {
      plugin.init(context);
      console.log(`Plugin loaded: ${plugin.name}`);
    } catch (e) {
      console.error(`Failed to load plugin ${plugin.id}:`, e);
    }
  }

  getSlashCommands(): CommandItem[] {
    return this.commands;
  }

  getActions(): ActionItem[] {
    return this.actions;
  }

  registerAll(plugins: Plugin[]) {
    plugins.forEach(p => this.register(p));
  }
}

export const PluginRegistry = new PluginRegistryService();
