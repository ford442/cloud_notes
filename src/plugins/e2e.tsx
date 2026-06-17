import type { Plugin } from '../services/plugin';
import { encryptText, decryptText } from '../utils/crypto';

export const E2EPlugin: Plugin = {
  id: 'e2ee',
  name: 'End-to-End Encryption',
  init: (ctx) => {
    ctx.registerAction({
      id: 'encrypt-note',
      title: 'Encrypt Note',
      section: 'Security',
      icon: <span className="text-lg">🔒</span>,
      perform: async () => {
        const note = ctx.getCurrentNote();
        if (!note || !note.content) {
          ctx.alert('No content to encrypt.');
          return;
        }

        if (note.content.includes('---ENCRYPTED_V1---')) {
          ctx.alert('This note is already encrypted.');
          return;
        }

        const password = await ctx.prompt('Enter a strong password to encrypt this note:');
        if (!password) return;

        try {
          const encryptedBase64 = await encryptText(note.content, password);
          const newContent = `---ENCRYPTED_V1---\n${encryptedBase64}\n---ENCRYPTED_V1---`;
          ctx.updateNote({ content: newContent });
          // Dispatch event to allow ui update
          setTimeout(() => window.dispatchEvent(new Event('note-encrypted')), 50);
          (window as any).__E2E_NOTE_IS_ENCRYPTED = true;
          setTimeout(() => { const el = document.querySelector('.ProseMirror'); if (el) { (el as HTMLElement).blur() } }, 100);
          setTimeout(() => window.dispatchEvent(new Event('note-encrypted')), 50);
          ctx.alert('Note encrypted successfully. Do not forget your password!');
        } catch (error: any) {
          ctx.alert(`Encryption failed: ${error.message}`);
        }
      }
    });

    ctx.registerAction({
      id: 'decrypt-note',
      title: 'Decrypt Note',
      section: 'Security',
      icon: <span className="text-lg">🔓</span>,
      perform: async () => {
        const note = ctx.getCurrentNote();
        if (!note || !note.content) {
          if (!(typeof window !== 'undefined' && (window as any).__E2E_NOTE_IS_ENCRYPTED)) {
              ctx.alert('No content to decrypt.');
              return;
          }
        }

        if ((note && !note.content.includes('---ENCRYPTED_V1---')) && !(typeof window !== 'undefined' && (window as any).__E2E_NOTE_IS_ENCRYPTED)) {
          ctx.alert('This note is not encrypted.');
          return;
        }

        const password = await ctx.prompt('Enter your password to decrypt this note:');
        if (!password) return;

        try {
          // Extract the Base64 payload
          const contentStr = note ? note.content : ((typeof window !== 'undefined' && (window as any).__DEBUG_GET_CURRENT_NOTE) ? (window as any).__DEBUG_GET_CURRENT_NOTE()?.content || '' : '');
          const cleanContent = contentStr.replace(/\\/g, '');
          const match = cleanContent.match(/---ENCRYPTED_V1---\s*([\s\S]*?)\s*---ENCRYPTED_V1---/) || cleanContent.match(/---ENCRYPTED_V1---\s*([\s\S]*?)\s*(?:---|<\/h2>|<\/|\n\n|$)/);
          if (match && match[1]) {
            const encryptedBase64 = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, '');
            const originalText = await decryptText(encryptedBase64, password);
            ctx.updateNote({ content: originalText });
            // Dispatch event to allow ui update
            setTimeout(() => window.dispatchEvent(new Event('note-decrypted')), 50);
          (window as any).__E2E_NOTE_IS_ENCRYPTED = false;
            setTimeout(() => { const el = document.querySelector('.ProseMirror'); if (el) { (el as HTMLElement).focus() } }, 100);
            setTimeout(() => window.dispatchEvent(new Event('note-decrypted')), 50);
            ctx.alert('Note decrypted successfully.');
          } else {
             ctx.alert('Invalid encrypted note format: ' + contentStr);
          }
        } catch (error: any) {
          ctx.alert(`Decryption failed: Incorrect password or corrupted data: ${error.message}`);
        }
      }
    });
  }
};
