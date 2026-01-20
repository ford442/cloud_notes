import type { CommandItem } from '../components/editor/slash-command';
import type { ActionItem } from '../components/CommandPalette';
import type { Note } from './api';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

export interface PluginContext {
  registerCommand: (command: CommandItem) => void;
  registerAction: (action: ActionItem) => void;
  getCurrentNote: () => Note | null;
  updateNote: (updates: Partial<Note>) => void;
  getCanvasAPI: () => ExcalidrawImperativeAPI | null;
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
  private noteUpdater: (updates: Partial<Note>) => void = () => {};
  private canvasAPI: ExcalidrawImperativeAPI | null = null;

  setNoteGetter(getter: () => Note | null) {
    this.noteGetter = getter;
  }

  setNoteUpdater(updater: (updates: Partial<Note>) => void) {
    this.noteUpdater = updater;
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
      updateNote: (updates) => this.noteUpdater(updates),
      getCanvasAPI: () => this.canvasAPI
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
