import type { Plugin } from '../services/plugin';
import { StorageService, API_BASE_URL } from '../services/api';
import { AIService } from '../services/ai';
import { markdownToHtml } from '../utils/serialization';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

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
                editor.state.doc.descendants((node: ProseMirrorNode, position: number) => {
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
                editor.state.doc.descendants((node: ProseMirrorNode, position: number) => {
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

                    // Start Transcription
                    try {
                        const transcriptId = Date.now().toString().slice(-4);
                        const transcriptText = `[Transcribing audio ${transcriptId}...]`;
                        const transcriptPlaceholder = `\n${transcriptText}\n`;
                        editor.chain().focus().insertContent(markdownToHtml(transcriptPlaceholder)).run();

                        // Decode and resample audio to 16kHz for Whisper
                        const arrayBuffer = await blob.arrayBuffer();
                        const audioContext = new AudioContext({ sampleRate: 16000 });
                        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                        const float32Data = audioBuffer.getChannelData(0); // Whisper expects mono audio
                        audioContext.close();

                        const transcript = await AIService.transcribeAudio(float32Data);

                        // Find transcript placeholder and replace safely
                        let tPos = -1;
                        let tNodeSize = 0;
                        editor.state.doc.descendants((node: ProseMirrorNode, position: number) => {
                            if (node.isText && node.text?.includes(transcriptText)) {
                                tPos = position + node.text.indexOf(transcriptText);
                                tNodeSize = transcriptText.length;
                                return false;
                            }
                        });

                        if (tPos !== -1 && transcript) {
                            editor.chain().focus()
                                .deleteRange({ from: tPos, to: tPos + tNodeSize })
                                .insertContent(markdownToHtml(`> **Transcript:** ${transcript}`)) // remove \n wrapper so we don't break block boundaries
                                .run();
                        } else if (tPos !== -1 && !transcript) {
                            // Delete placeholder if no transcript
                            editor.chain().focus()
                                .deleteRange({ from: tPos, to: tPos + tNodeSize })
                                .run();
                        } else if (transcript) {
                             editor.chain().focus().insertContent(markdownToHtml(`\n> **Transcript:** ${transcript}\n`)).run();
                        }

                    } catch (err) {
                        console.error('Transcription failed:', err);
                        // Clean up placeholder
                        let tPos = -1;
                        let tNodeSize = 0;
                        editor.state.doc.descendants((node: ProseMirrorNode, position: number) => {
                            if (node.isText && node.text?.includes('Transcribing audio')) {
                                tPos = position + node.text.indexOf(node.text);
                                tNodeSize = node.text.length;
                                return false;
                            }
                        });
                        if (tPos !== -1) {
                            editor.chain().focus().deleteRange({ from: tPos, to: tPos + tNodeSize }).run();
                        }
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
