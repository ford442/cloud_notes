import re

with open('src/services/api.ts', 'r') as f:
    content = f.read()

batch_sync_method = """
  async _dispatchBatchWebhook(ops: PendingOp[], idMap: Map<string, string>): Promise<void> {
      try {
          const payload = {
            source: 'cloud_notes',
            event: 'batch.sync',
            timestamp: new Date().toISOString(),
            data: await Promise.all(ops.map(async op => {
              const realId = idMap.get(op.noteId) || op.noteId;
              if (op.type === 'delete') {
                return { type: 'delete', noteId: realId };
              }
              const packedDesc = createPackedDescription(op.note!);
              const encryptedContent = await EncryptionService.encrypt(op.note!.content);
              return {
                type: op.type,
                noteId: realId,
                data: {
                  id: realId,
                  title: op.note!.title,
                  content: encryptedContent,
                  subject: op.note!.subject || 'General',
                  section: op.note!.section || 'Inbox',
                  tags: op.note!.tags || '',
                  author: op.author || 'User',
                  description: packedDesc,
                  updatedAt: op.note!.updatedAt || new Date().toISOString()
                }
              };
            }))
          };

          const payloadStr = JSON.stringify(payload);
          const signature = await this._generateHmacSignature(payloadStr);

          const headers: Record<string, string> = {
              'Content-Type': 'application/json'
          };
          if (signature) headers['X-Signature-256'] = signature;

          fetch(`${API_BASE_URL}/webhook/notes`, {
              method: 'POST',
              headers,
              body: payloadStr
          }).catch(e => console.warn(`[Webhook Bridge] Failed to dispatch batch webhook:`, e));

      } catch (e) {
          console.error('[Webhook Bridge] Error preparing batch payload:', e);
      }
  },
"""

sync_pending_orig = """      const consolidatedOps = Array.from(latestOpsMap.values());
      consolidatedOps.sort((a, b) => a.op.timestamp - b.op.timestamp);

      // Map to track temporary offline IDs resolving to real server IDs
      const idMap = new Map<string, string>();

      for (const { keys, op } of consolidatedOps) {
        try {
          let success = false;

          // Resolve the target ID (if this note was created offline, use the new real server ID)
          const targetId = idMap.get(op.noteId) || op.noteId;

          if (op.type === 'create' && op.note) {
            const res = await this._networkSaveNote(op.note, op.author || "User");
            if (res.success && res.id) {
              idMap.set(op.noteId, res.id); // Map the temp ID to the real ID!

              // Clean up local cache: migrate temp ID to real ID
              await db.del(STORE_NOTES_CONTENT, op.noteId);
              await db.set(STORE_NOTES_CONTENT, res.id, { ...op.note, id: res.id });

              success = true;
            }
          }
          else if (op.type === 'update' && op.note) {
            const res = await this._networkUpdateNote(targetId, op.note, op.author || "User");
            success = res.success;
          }
          // Note: Ready for offline DELETE when you implement delete UI
          else if (op.type === 'delete') {
             const res = await this._networkDeleteNote(targetId);
             success = res;
          }

          if (success) {
            for (const k of keys) {
              await db.del(STORE_PENDING_OPS, k);
            }
          } else {
            console.warn(`[Sync Engine] Op ${keys.join(', ')} failed, keeping in queue for next retry.`);
          }
        } catch (e) {
          console.error(`[Sync Engine] Failed to process op ${keys.join(', ')}`, e);
        }
      }

      // If we synced things successfully, refresh the global cache
      if (consolidatedOps.length > 0) {
          this.getNotes(false).catch(console.warn);
      }"""


new_sync_pending = """      const consolidatedOps = Array.from(latestOpsMap.values());
      consolidatedOps.sort((a, b) => a.op.timestamp - b.op.timestamp);

      // Map to track temporary offline IDs resolving to real server IDs
      const idMap = new Map<string, string>();

      const successfulOps: PendingOp[] = [];

      for (const { keys, op } of consolidatedOps) {
        try {
          let success = false;

          // Resolve the target ID (if this note was created offline, use the new real server ID)
          const targetId = idMap.get(op.noteId) || op.noteId;

          if (op.type === 'create' && op.note) {
            // NOTE: We pass a flag or skip the individual webhook inside the network call if we are doing batch
            const res = await this._networkSaveNote(op.note, op.author || "User", true);
            if (res.success && res.id) {
              idMap.set(op.noteId, res.id); // Map the temp ID to the real ID!

              // Clean up local cache: migrate temp ID to real ID
              await db.del(STORE_NOTES_CONTENT, op.noteId);
              await db.set(STORE_NOTES_CONTENT, res.id, { ...op.note, id: res.id });

              success = true;
            }
          }
          else if (op.type === 'update' && op.note) {
            const res = await this._networkUpdateNote(targetId, op.note, op.author || "User", true);
            success = res.success;
          }
          // Note: Ready for offline DELETE when you implement delete UI
          else if (op.type === 'delete') {
             const res = await this._networkDeleteNote(targetId, true);
             success = res;
          }

          if (success) {
            successfulOps.push(op);
            for (const k of keys) {
              await db.del(STORE_PENDING_OPS, k);
            }
          } else {
            console.warn(`[Sync Engine] Op ${keys.join(', ')} failed, keeping in queue for next retry.`);
          }
        } catch (e) {
          console.error(`[Sync Engine] Failed to process op ${keys.join(', ')}`, e);
        }
      }

      // Dispatch batch webhook for all successful operations
      if (successfulOps.length > 1) {
          this._dispatchBatchWebhook(successfulOps, idMap);
      } else if (successfulOps.length === 1) {
          const op = successfulOps[0];
          const realId = idMap.get(op.noteId) || op.noteId;
          if (op.type === 'delete') {
              // Delete webhook was handled inside the network call or we should dispatch it
              this._networkDeleteNote(realId);
          } else {
              this._dispatchWebhook({ ...op.note!, id: realId }, op.author || "User", op.type as 'create' | 'update');
          }
      }

      // If we synced things successfully, refresh the global cache
      if (consolidatedOps.length > 0) {
          this.getNotes(false).catch(console.warn);
      }"""


if "_dispatchBatchWebhook" not in content:
    content = content.replace("  async _dispatchWebhook(note: Note, author: string, action: 'create' | 'update'): Promise<void> {", batch_sync_method + "\n  async _dispatchWebhook(note: Note, author: string, action: 'create' | 'update'): Promise<void> {")

content = content.replace(sync_pending_orig, new_sync_pending)

# Modify _network calls to take skipWebhook param
content = content.replace("async _networkSaveNote(note: Note, author: string): Promise<{ success: boolean; id?: string }> {", "async _networkSaveNote(note: Note, author: string, skipWebhook = false): Promise<{ success: boolean; id?: string }> {")
content = content.replace("this._dispatchWebhook(note, author, 'create');", "if (!skipWebhook) this._dispatchWebhook(note, author, 'create');")

content = content.replace("async _networkDeleteNote(id: string): Promise<boolean> {", "async _networkDeleteNote(id: string, skipWebhook = false): Promise<boolean> {")
content = content.replace("const res = await fetch(`${API_BASE_URL}/webhook/notes`, {", "if (!skipWebhook) {\n      const res = await fetch(`${API_BASE_URL}/webhook/notes`, {\n        method: 'POST',\n        headers,\n        body: payloadStr\n      });\n      if (!res.ok) throw new Error(await res.text());\n      }")
content = content.replace("if (!res.ok) throw new Error(await res.text());\n      return true;", "return true;")

content = content.replace("async _networkUpdateNote(id: string, note: Note, author: string): Promise<{ success: boolean; id?: string }> {", "async _networkUpdateNote(id: string, note: Note, author: string, skipWebhook = false): Promise<{ success: boolean; id?: string }> {")
content = content.replace("this._dispatchWebhook({ ...note, id }, author, 'update');", "if (!skipWebhook) this._dispatchWebhook({ ...note, id }, author, 'update');")


with open('src/services/api.ts', 'w') as f:
    f.write(content)
