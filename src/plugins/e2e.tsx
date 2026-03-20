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

        if (note.content.startsWith('---ENCRYPTED_V1---')) {
          ctx.alert('This note is already encrypted.');
          return;
        }

        const password = await ctx.prompt('Enter a strong password to encrypt this note:');
        if (!password) return;

        try {
          const encryptedBase64 = await encryptText(note.content, password);
          const newContent = `---ENCRYPTED_V1---\n${encryptedBase64}\n---`;
          ctx.updateNote({ content: newContent });
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
          ctx.alert('No content to decrypt.');
          return;
        }

        if (!note.content.startsWith('---ENCRYPTED_V1---')) {
          ctx.alert('This note is not encrypted.');
          return;
        }

        const password = await ctx.prompt('Enter your password to decrypt this note:');
        if (!password) return;

        try {
          // Extract the Base64 payload
          const lines = note.content.split('\n');
          // Format is:
          // ---ENCRYPTED_V1---
          // [Base64 Data]
          // ---
          if (lines.length >= 3 && lines[0] === '---ENCRYPTED_V1---') {
            const encryptedBase64 = lines[1];
            const originalText = await decryptText(encryptedBase64, password);
            ctx.updateNote({ content: originalText });
            ctx.alert('Note decrypted successfully.');
          } else {
             ctx.alert('Invalid encrypted note format.');
          }
        } catch (error: any) {
          ctx.alert(`Decryption failed: Incorrect password or corrupted data.`);
        }
      }
    });
  }
};
