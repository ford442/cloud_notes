<<<<<<< SEARCH
        try {
          let conflictHandled = false;

          // Conflict Check:
          // A conflict is when both remote and local have been updated since the last sync.
          // We only perform this check if we have a valid lastSyncedAt to compare against.
          if (vpsNote && localNote && vpsTime > 0 && localTime > 0 && localNote.lastSyncedAt) {
            const lastSync = localNote.lastSyncedAt;
            const TOLERANCE_MS = 5000; // 5 seconds tolerance for clock skew/network timing

            // If both local and remote have changed since last sync...
            if (vpsTime > (lastSync + TOLERANCE_MS) && localTime > (lastSync + TOLERANCE_MS)) {
              // Only now do we fetch the remote note to see if contents actually differ
              const remote = await vpsStorageAPI.readNote(name);

              if (remote.content !== localNote.content) {
                onProgress?.(`Conflict detected for "${name}"...`);

                // 1. Save local as conflicted copy
                const conflictId = `${name}_conflict_${Date.now()}`;
                const conflictTitle = `${localNote.title} (Conflicted Copy)`;
                const conflictNote: Note = {
                  ...localNote,
                  id: conflictId,
                  title: conflictTitle,
                  updatedAt: new Date().toISOString(),
                  lastSyncedAt: vpsTime // Use server time of the original note to prevent skew issues
                };
                await db.set(STORE_NOTES_CONTENT, conflictId, conflictNote);

                const conflictMeta: CloudItemMeta = {
                  id: conflictId,
                  name: conflictId,
                  author: conflictNote.subject,
                  date: conflictNote.updatedAt || new Date().toISOString(),
                  type: 'note',
                  description: createPackedDescription(conflictNote),
                };
                await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, [conflictMeta, ...localMetaList]);
                localMetaList.unshift(conflictMeta);

                // 2. Push the conflict copy to the VPS as well so it's safely backed up
                try {
                  await vpsStorageAPI.writeNote(conflictId, conflictNote.content);
                } catch (e) {
                  console.warn('[Sync] Failed to push conflict copy', e);
                }

                // 3. Force overwrite the original local note with the remote note
                const updatedNote: Note = {
                  id: name,
                  title: name,
                  content: remote.content,
                  subject: localNote?.subject || 'General',
                  section: localNote?.section || 'Inbox',
                  tags: localNote?.tags || '',
                  updatedAt: remote.updated_at,
                  lastSyncedAt: vpsTime
                };
                await db.set(STORE_NOTES_CONTENT, name, updatedNote);

                const packedDesc = createPackedDescription(updatedNote);
                const meta: CloudItemMeta = {
                  id: name,
                  name,
                  author: localNote?.subject || 'User',
                  date: remote.updated_at,
                  type: 'note',
                  description: packedDesc,
                };

                if (localMetaMap.has(name)) {
                  const newList = localMetaList.map(m => (m.id === name ? meta : m));
                  await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, newList);
                } else {
                  await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, [meta, ...localMetaList]);
                  localMetaList.unshift(meta);
                }
                localMetaMap.set(name, meta);

                result.conflicts++;
                result.pulled++;
                conflictHandled = true;
              }
            }
          }

          if (!conflictHandled) {
            // Include a minor tolerance when checking which is newer, to avoid pushing
            // repeatedly just because the local clock is slightly ahead.
            const TOLERANCE_MS = 5000;

            if (vpsNote && (!localNote || vpsTime > (localTime + TOLERANCE_MS))) {
              onProgress?.(`Pulling "${name}"...`);
              const remote = await vpsStorageAPI.readNote(name);

              // We parsed vpsTime above from remote.updated_at (if vpsNote existed), or we can re-parse
              const newVpsTime = remote.updated_at ? new Date(remote.updated_at).getTime() : Date.now();

              const updatedNote: Note = {
                id: name,
                title: name,
                content: remote.content,
                subject: localNote?.subject || 'General',
                section: localNote?.section || 'Inbox',
                tags: localNote?.tags || '',
                updatedAt: remote.updated_at,
                lastSyncedAt: newVpsTime // Trust the server's clock
              };
              await db.set(STORE_NOTES_CONTENT, name, updatedNote);

              const packedDesc = createPackedDescription(updatedNote);
              const meta: CloudItemMeta = {
                id: name,
                name,
                author: localNote?.subject || 'User',
                date: remote.updated_at,
                type: 'note',
                description: packedDesc,
              };

              if (localMetaMap.has(name)) {
                const newList = localMetaList.map(m => (m.id === name ? meta : m));
                await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, newList);
              } else {
                await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, [meta, ...localMetaList]);
                localMetaList.unshift(meta);
              }
              localMetaMap.set(name, meta);
              result.pulled++;
            } else if (localNote && (!vpsNote || localTime > (vpsTime - TOLERANCE_MS))) {
              onProgress?.(`Pushing "${name}"...`);
              await vpsStorageAPI.writeNote(name, localNote.content);

              const timeOfPush = Date.now();
              localNote.lastSyncedAt = timeOfPush;

              await db.set(STORE_NOTES_CONTENT, name, localNote);

              // Also update STORE_NOTES_LIST to maintain consistency
              const meta: CloudItemMeta = {
                id: name,
                name,
                author: localNote.subject || 'User',
                date: localNote.updatedAt || new Date(timeOfPush).toISOString(),
                type: 'note',
                description: createPackedDescription(localNote),
              };

              if (localMetaMap.has(name)) {
                const newList = localMetaList.map(m => (m.id === name ? meta : m));
                await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, newList);
              } else {
                await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, [meta, ...localMetaList]);
                localMetaList.unshift(meta);
              }
              localMetaMap.set(name, meta);

              result.pushed++;
            }
          }
        } catch (err) {
=======
        try {
          const lastSync = localNote?.lastSyncedAt || 0;
          const TOLERANCE_MS = 5000;

          let action: 'PULL' | 'PUSH' | 'CONFLICT' | 'NOOP' = 'NOOP';

          if (!localNote && vpsNote) {
             action = 'PULL';
          } else if (localNote && !vpsNote) {
             action = 'PUSH';
          } else if (localNote && vpsNote) {
             const hasLocalChanges = localTime > lastSync;
             const hasServerChanges = vpsTime > (lastSync + TOLERANCE_MS);

             if (hasLocalChanges && hasServerChanges) {
                // If it looks like a conflict, we fetch remote content to verify
                // they actually differ (to prevent false conflicts if the user edited locally, pushed,
                // and the server just touched timestamps).
                const remote = await vpsStorageAPI.readNote(name);
                if (remote.content !== localNote.content) {
                   action = 'CONFLICT';
                } else {
                   // Contents are identical, just update the sync marker locally
                   action = 'PULL'; // (We'll just pull the metadata/timestamp from the server)
                }
             } else if (hasLocalChanges) {
                action = 'PUSH';
             } else if (hasServerChanges) {
                action = 'PULL';
             }
          }

          if (action === 'CONFLICT' && localNote && vpsNote) {
             onProgress?.(`Conflict detected for "${name}"...`);
             const remote = await vpsStorageAPI.readNote(name);

             // 1. Save local as conflicted copy
             const conflictId = `${name}_conflict_${Date.now()}`;
             const conflictTitle = `${localNote.title} (Conflicted Copy)`;
             const conflictNote: Note = {
               ...localNote,
               id: conflictId,
               title: conflictTitle,
               updatedAt: new Date().toISOString(),
               lastSyncedAt: Date.now()
             };
             await db.set(STORE_NOTES_CONTENT, conflictId, conflictNote);

             const conflictMeta: CloudItemMeta = {
               id: conflictId,
               name: conflictId,
               author: conflictNote.subject,
               date: conflictNote.updatedAt || new Date().toISOString(),
               type: 'note',
               description: createPackedDescription(conflictNote),
             };
             await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, [conflictMeta, ...localMetaList]);
             localMetaList.unshift(conflictMeta);

             // 2. Push the conflict copy to the VPS as well so it's safely backed up
             try {
               await vpsStorageAPI.writeNote(conflictId, conflictNote.content);
             } catch (e) {
               console.warn('[Sync] Failed to push conflict copy', e);
             }

             // 3. Force overwrite the original local note with the remote note (effectively a PULL)
             action = 'PULL';
             result.conflicts++;
          }

          if (action === 'PULL') {
            onProgress?.(`Pulling "${name}"...`);
            const remote = await vpsStorageAPI.readNote(name);
            const newVpsTime = remote.updated_at ? new Date(remote.updated_at).getTime() : Date.now();

            const updatedNote: Note = {
              id: name,
              title: name,
              content: remote.content,
              subject: localNote?.subject || 'General',
              section: localNote?.section || 'Inbox',
              tags: localNote?.tags || '',
              updatedAt: remote.updated_at,
              lastSyncedAt: newVpsTime // Trust the server's clock as the sync marker
            };
            await db.set(STORE_NOTES_CONTENT, name, updatedNote);

            const packedDesc = createPackedDescription(updatedNote);
            const meta: CloudItemMeta = {
              id: name,
              name,
              author: localNote?.subject || 'User',
              date: remote.updated_at,
              type: 'note',
              description: packedDesc,
            };

            if (localMetaMap.has(name)) {
              const newList = localMetaList.map(m => (m.id === name ? meta : m));
              await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, newList);
            } else {
              await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, [meta, ...localMetaList]);
              localMetaList.unshift(meta);
            }
            localMetaMap.set(name, meta);
            result.pulled++;
          } else if (action === 'PUSH' && localNote) {
            onProgress?.(`Pushing "${name}"...`);
            await vpsStorageAPI.writeNote(name, localNote.content);

            // Fast-forward lastSyncedAt to current time after a successful push
            const timeOfPush = Date.now();
            localNote.lastSyncedAt = timeOfPush;

            await db.set(STORE_NOTES_CONTENT, name, localNote);

            // Also update STORE_NOTES_LIST to maintain consistency, without altering original updatedAt
            const meta: CloudItemMeta = {
              id: name,
              name,
              author: localNote.subject || 'User',
              date: localNote.updatedAt || new Date(timeOfPush).toISOString(),
              type: 'note',
              description: createPackedDescription(localNote),
            };

            if (localMetaMap.has(name)) {
              const newList = localMetaList.map(m => (m.id === name ? meta : m));
              await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, newList);
            } else {
              await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, [meta, ...localMetaList]);
              localMetaList.unshift(meta);
            }
            localMetaMap.set(name, meta);

            result.pushed++;
          }
        } catch (err) {
>>>>>>> REPLACE
