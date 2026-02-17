import type { Plugin } from '../services/plugin';
import { StorageService, API_BASE_URL } from '../services/api';

export const VoicePlugin: Plugin = {
  id: 'voice-memos',
  name: 'Voice Memos',
  init: (ctx) => {
    ctx.registerCommand({
      title: 'Voice Memo',
      description: 'Record audio',
      searchTerms: ['voice', 'record', 'audio', 'mic'],
      icon: <span className="text-lg">🎙️</span>,
      section: 'Media',
      command: async ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        // Check support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            await ctx.alert('Microphone not supported in this browser.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const chunks: BlobPart[] = [];

            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

            const uniqueId = Date.now().toString().slice(-4);
            const placeholder = `[Recording Audio ${uniqueId}...]`;
            const uploadingPlaceholder = `[Uploading Audio ${uniqueId}...]`;

            // Insert placeholder
            editor.chain().focus().insertContent(placeholder).run();

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });

                // Update placeholder to Uploading
                let pos = -1;
                editor.state.doc.descendants((node, position) => {
                    if (node.isText && node.text?.includes(placeholder)) {
                        pos = position + node.text.indexOf(placeholder);
                        return false;
                    }
                });

                if (pos !== -1) {
                    editor.chain().focus().deleteRange({ from: pos, to: pos + placeholder.length })
                        .insertContent(uploadingPlaceholder).run();
                } else {
                    // Placeholder lost, try to insert at end
                    editor.chain().focus().insertContent(uploadingPlaceholder).run();
                }

                // Upload
                const res = await StorageService.uploadFile(file, "User", "Voice Memo");

                // Find uploading placeholder
                 pos = -1;
                editor.state.doc.descendants((node, position) => {
                    if (node.isText && node.text?.includes(uploadingPlaceholder)) {
                        pos = position + node.text.indexOf(uploadingPlaceholder);
                        return false;
                    }
                });

                if (res.success && res.id) {
                    const url = `${API_BASE_URL}/api/samples/${res.id}`;
                    if (pos !== -1) {
                        editor.chain().focus().deleteRange({ from: pos, to: pos + uploadingPlaceholder.length })
                        .insertContent({
                            type: 'audio',
                            attrs: { src: url }
                        }).run();
                    } else {
                         editor.chain().focus().insertContent({
                            type: 'audio',
                            attrs: { src: url }
                        }).run();
                    }
                } else {
                    if (pos !== -1) {
                        editor.chain().focus().deleteRange({ from: pos, to: pos + uploadingPlaceholder.length })
                        .insertContent('**Upload Failed**').run();
                    }
                    await ctx.alert('Failed to upload audio.');
                }
            };

            mediaRecorder.start();

            // Use ctx.confirm to simulate a "Stop" dialog
            await ctx.confirm('Recording in progress... Press OK to stop.');

            mediaRecorder.stop();
            stream.getTracks().forEach(track => track.stop());

        } catch (e) {
            console.error(e);
            await ctx.alert('Failed to start recording: ' + e);
        }
      }
    });
  }
};
