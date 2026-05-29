export type BlockType = 'text' | 'heading' | 'image' | 'list' | 'task' | 'code' | 'embed';

export interface BlockMetadata {
  createdBy?: string;
  lastEditedBy?: string;
  source?: string;

  [key: string]: any;
}

export interface Block {
  id: string; // Unique block identifier (UUID)
  type: BlockType;
  content: string; // Core content (markdown text, URL, etc.)
  parentId: string | null; // Null for root blocks
  children: string[]; // Array of child Block IDs for nesting (e.g., lists)
  backlinks: string[]; // Array of Note/Block IDs that link to this block
  createdAt: number;
  updatedAt: number;
  metadata: BlockMetadata;

  properties: Record<string, any>; // Attributes like 'checked' for tasks, 'level' for headings
}

// Scaffolding for future Yjs/CRDT integration (Weeks 1-2 Roadmap)
export interface CRDTBlockUpdate {
  blockId: string;
  clock: number;

  ops: any[]; // Placeholder for Yjs state updates
}