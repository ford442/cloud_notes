declare module '@tiptap/core' {
  namespace Extension {
    function create<T = any>(config?: any): any;
  }
  export const Extension: {
    create<T = any>(config?: any): any;
  };

  namespace Node {
    function create<T = any>(config?: any): any;
  }
  export const Node: {
    create<T = any>(config?: any): any;
  };

  export function mergeAttributes(...args: any[]): any;
  export type Editor = any;
  export type Range = any;
}

declare module '@tiptap/extension-table' {
  export const Table: any;
}

declare module 'tippy.js' {
  export default function tippy(el: any, options?: any): any;
  export type Instance = any;
}
