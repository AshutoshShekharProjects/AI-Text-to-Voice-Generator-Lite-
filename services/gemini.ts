
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { fileToPcm16k } from "../utils/audio";

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';

interface VoiceOptions {
  tone: string;
  mood: string;
  speed: string;
}

export async function generateSpeech(
  textToSay: string,
  referenceFile: File,
  options: VoiceOptions
): Promise<string> {
  // 1. Transcode the input file to 16kHz PCM
  const pcmData = await fileToPcm16k(referenceFile);
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

  return new Promise((resolve, reject) => {
    const accumulatedAudioChunks: string[] = [];
    let accumulatedText = "";
    let isResolved = false;
    let hasReceivedAudio = false;

    const sessionPromise = ai.live.connect({
      model: MODEL_NAME,
      callbacks: {
        onopen: () => {
          sessionPromise.then((session) => {
            // First, deliver the vocal context as a high-priority media stream
            session.sendRealtimeInput({
              media: {
                data: pcmData,
                mimeType: 'audio/pcm;rate=16000',
              }
            });

            // Deliver the command with heavy emphasis on extraction and replication
            session.sendRealtimeInput({
              text: `TASK: PERFORM ZERO-SHOT VOICE CLONING.
              1. ANALYZE the timbre, pitch, resonance, and unique vocal texture of the person speaking in the previous audio buffer.
              2. ADOPT this identity as your permanent persona for this turn.
              3. STYLISTIC MODIFIERS: Tone is ${options.tone}, Mood is ${options.mood}, Speed is ${options.speed}.
              4. TEXT TO SPEAK: "${textToSay}"
              5. OUTPUT: Return ONLY the high-fidelity audio stream. Maintain 100% vocal consistency with the reference.`
            });
          });
        },
        onmessage: async (message: LiveServerMessage) => {
          const parts = message.serverContent?.modelTurn?.parts || [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              accumulatedAudioChunks.push(part.inlineData.data);
              hasReceivedAudio = true;
            }
            if (part.text) {
              accumulatedText += part.text;
            }
          }

          if (message.serverContent?.turnComplete) {
            if (!isResolved) {
              if (hasReceivedAudio) {
                isResolved = true;
                resolve(combineBase64Chunks(accumulatedAudioChunks));
                sessionPromise.then(s => s.close());
              } else if (accumulatedText.trim().length > 0) {
                isResolved = true;
                reject(new Error(`Vocal Replication Error: ${accumulatedText}`));
                sessionPromise.then(s => s.close());
              }
            }
          }
        },
        onerror: (err) => {
          if (!isResolved) {
            isResolved = true;
            reject(new Error(`API Error: ${err.message || 'Unknown connection error'}`));
          }
        },
        onclose: () => {
          if (!isResolved) {
            isResolved = true;
            if (accumulatedAudioChunks.length > 0) {
              resolve(combineBase64Chunks(accumulatedAudioChunks));
            } else {
              reject(new Error("Vocal clone session closed prematurely. Ensure the reference clip is clear."));
            }
          }
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: `You are a Rigid Voice Replicator. 
        Your ONLY function is to replicate the specific vocal identity (timbre, prosody, frequency profile) provided in user-uploaded audio files.
        - You are strictly FORBIDDEN from using your own internal synthetic voices (Puck, Kore, etc.).
        - You must extract the 'vocal DNA' of the input audio and apply it perfectly to the requested text.
        - Maintain identical speaker identity across the entire generation.
        - Respond ONLY with audio. If replication is impossible, provide an error message starting with 'ERROR:'.`,
      },
    });

    // Safety timeout
    setTimeout(() => {
      if (!isResolved) {
        if (accumulatedAudioChunks.length > 0) {
          isResolved = true;
          resolve(combineBase64Chunks(accumulatedAudioChunks));
          sessionPromise.then(s => s.close());
        } else {
          isResolved = true;
          const errorMsg = accumulatedText 
            ? `Vocal cloning failed: ${accumulatedText}`
            : "Vocal cloning timeout. The complexity of the reference exceeded processing limits.";
          reject(new Error(errorMsg));
          sessionPromise.then(s => s.close());
        }
      }
    }, 60000); 
  });
}

function combineBase64Chunks(chunks: string[]): string {
  if (chunks.length === 0) return "";
  
  const byteArrays = chunks.map(base64 => {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch (e) {
      console.error("Failed to decode base64 chunk", e);
      return new Uint8Array(0);
    }
  });

  const totalLength = byteArrays.reduce((acc, curr) => acc + curr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of byteArrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  let binary = '';
  const len = result.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(result[i]);
  }
  return btoa(binary);
}
