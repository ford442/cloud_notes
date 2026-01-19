import type { CommandItem } from '../components/editor/slash-command';
import type { ActionItem } from '../components/CommandPalette';
import type { Note } from './api';

export interface PluginContext {
  registerCommand: (command: CommandItem) => void;
  registerAction: (action: ActionItem) => void;
  getCurrentNote: () => Note | null;
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
  private initialized = false;
  private noteGetter: () => Note | null = () => null;

  setNoteGetter(getter: () => Note | null) {
    this.noteGetter = getter;
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
      getCurrentNote: () => this.getCurrentNote()
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
