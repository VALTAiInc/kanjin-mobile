import * as FileSystem from "expo-file-system/legacy";

const API_BASE = "https://bridge-backend-production-b481.up.railway.app";

const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? "";

export interface TranslateResult {
  translation: string;
  audioUri: string;
}

/** Translate text via the Bridge backend (also returns TTS audio). */
export async function translateAndSpeak(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  customVoiceId?: string,
): Promise<TranslateResult> {
  const body: Record<string, string> = { text, sourceLanguage, targetLanguage };
  if (customVoiceId) body.customVoiceId = customVoiceId;
  const response = await fetch(`${API_BASE}/api/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Backend error ${response.status}: ${errBody}`);
  }

  const data = await response.json();

  const fileUri = (FileSystem.cacheDirectory ?? "") + `tts_${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(fileUri, data.audioBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { translation: data.translation, audioUri: fileUri };
}

/** Translate text via the Bridge backend (text only, no TTS). */
async function translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/translate-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, sourceLanguage, targetLanguage }),
  });
  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Translation error ${response.status}: ${errBody}`);
  }
  const data = await response.json();
  return data.translation ?? "";
}

/** Prep text for Japanese TTS voice — add natural punctuation for better delivery. */
async function cleanJapanesePunctuation(text: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/clean-japanese`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.text || text;
  } catch {
    return text;
  }
}

/** Clone a voice via ElevenLabs instant voice cloning. */
export async function cloneVoice(audioUri: string, name: string): Promise<string> {
  const fileInfo = await FileSystem.getInfoAsync(audioUri);
  if (!fileInfo.exists) throw new Error("Audio file not found");

  const ext = audioUri.split(".").pop()?.toLowerCase() ?? "m4a";
  const mimeMap: Record<string, string> = { m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav" };
  const mimeType = mimeMap[ext] ?? "audio/mp4";

  const formData = new FormData();
  formData.append("name", name);
  formData.append("files", { uri: audioUri, name: `voice.${ext}`, type: mimeType } as any);

  const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY },
    body: formData,
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`ElevenLabs clone error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.voice_id;
}

/** Translate via Bridge backend + speak with a custom ElevenLabs voice.
 *  If targetLanguage is omitted, the source text is spoken directly (no translation).
 *  eleven_multilingual_v2 handles any language natively with cloned voices. */
export async function translateAndSpeakWithMyVoice(
  text: string,
  sourceLanguage: string,
  customVoiceId: string,
  overrides?: VoiceOverrides,
  targetLanguage?: string,
): Promise<TranslateResult> {
  let ttsText = text;
  let translation = text;

  // Only translate if a concrete target language is provided and differs from source
  if (targetLanguage && targetLanguage !== sourceLanguage) {
    translation = await translateText(text, sourceLanguage, targetLanguage);
    if (!translation) throw new Error("Empty translation returned");
    ttsText = translation;
  }

  // Speak with custom voice via ElevenLabs (eleven_multilingual_v2 handles any language)
  const defaults = { stability: 0.5, similarity_boost: 1.0, style: 0.2, use_speaker_boost: true, speed: 1.0 };
  const voiceSettings = overrides
    ? { ...defaults, ...overrides, use_speaker_boost: true }
    : defaults;

  const ttsRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${customVoiceId}?output_format=mp3_44100_192`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: ttsText,
        model_id: "eleven_multilingual_v2",
        voice_settings: voiceSettings,
      }),
    }
  );
  if (!ttsRes.ok) throw new Error(`ElevenLabs error ${ttsRes.status}`);

  const arrayBuffer = await ttsRes.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < uint8.byteLength; i++) binary += String.fromCharCode(uint8[i]);
  const base64 = btoa(binary);

  const fileUri = (FileSystem.cacheDirectory ?? "") + `tts_${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

  return { translation, audioUri: fileUri };
}

export interface VoiceOverrides {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  speed?: number;
}

/** Speak text as-is via Bridge backend TTS (no translation). */
export async function speakText(
  text: string,
  language: string,
  overrides?: VoiceOverrides,
  customVoiceId?: string,
): Promise<string> {
  const isJapanese = language === "ja";
  const ttsText = isJapanese ? await cleanJapanesePunctuation(text) : text;

  const response = await fetch(`${API_BASE}/api/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: ttsText,
      language,
      voiceSettings: overrides,
      customVoiceId,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Backend error ${response.status}: ${errBody}`);
  }

  const data = await response.json();

  const fileUri = (FileSystem.cacheDirectory ?? "") + `tts_${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(fileUri, data.audioBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return fileUri;
}
