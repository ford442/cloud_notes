export function formatSyncMessage(res: { pulled: number; pushed: number; conflicts: number; errors: string[] }): { message: string; tone: 'error' | 'info' | 'success' } {
  if (res.errors.length > 0) {
    return {
      message: `Sync completed with ${res.errors.length} errors`,
      tone: 'error',
    };
  }

  return {
    message: `Synced: ${res.pulled} pulled, ${res.pushed} pushed${res.conflicts > 0 ? `, ${res.conflicts} conflicts` : ''}`,
    tone: res.conflicts > 0 ? 'info' : 'success',
  };
}
