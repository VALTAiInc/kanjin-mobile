import * as FileSystem from "expo-file-system/legacy";

const API_BASE = "https://bridge-backend-production-b481.up.railway.app";

const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? "";
const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? "";

const VOICE_IDS: Record<string, string> = {
  en: "EXAVITQu4vr4xnSDxMaL", ja: "WQz3clzUdMqvBf0jswZQ",
  es: "AZnzlk1XvdvUeBnXmlld", fr: "MF3mGyEYCl7XYWbV9V6O",
  de: "ErXwobaYiN019PkySvjV", pt: "VR6AewLTigWG4xSOukaG",
  zh: "pNInz6obpgDQGcFmaJgB", ko: "pMsXgVXv3BLzUgSXRplE",
  ar: "jsCqWAovK2LkecY7zXl4", "ar-LB": "jsCqWAovK2LkecY7zXl4",
  hi: "ThT5KcBeYPX3keUQqHPh", it: "TxGEqnHWrfWFTfGW9XjX",
  ru: "yoZ06aMxZJJ28mfd3POQ", nl: "Zlb1dXrM653N07WRdFW3",
  tr: "g5CIjZEefAph4nQFvHAz", pl: "onwK4e9ZLuTAKqWW03F9",
};

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

/** Prep text for Japanese TTS voice — add natural punctuation for better delivery. */
async function cleanJapanesePunctuation(text: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) return text;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `You are a text prep assistant for Japanese text-to-speech. The input is English text that will be read aloud by a Japanese voice. Add natural punctuation to improve TTS delivery — use ? for questions and ... for natural pauses. Do not add exclamation marks. Never duplicate punctuation that already exists in the text. Do not translate. Do not change any words. Return ONLY the corrected text.`,
        messages: [{ role: "user", content: text }],
      }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || text;
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

/** Translate via Anthropic + speak with a custom ElevenLabs voice (bypasses bridge backend). */
export async function translateAndSpeakWithMyVoice(
  text: string,
  sourceLanguage: string,
  customVoiceId: string,
  overrides?: VoiceOverrides,
): Promise<TranslateResult> {
  if (!ANTHROPIC_API_KEY) throw new Error("Anthropic API key not configured");

  // 1. Translate via Anthropic
  const translateRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: `You are a professional translator. Translate the user's text from ${sourceLanguage} to English. Return ONLY the translated text, nothing else.`,
      messages: [{ role: "user", content: text }],
    }),
  });
  if (!translateRes.ok) {
    const err = await translateRes.text().catch(() => "");
    throw new Error(`Translation error ${translateRes.status}: ${err}`);
  }
  const translateData = await translateRes.json();
  const translation = translateData.content?.[0]?.text?.trim() ?? "";
  if (!translation) throw new Error("Empty translation returned");

  // 2. Speak with custom voice via ElevenLabs
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
        text: translation,
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

/** Speak text as-is via ElevenLabs TTS (no translation). */
export async function speakText(
  text: string,
  language: string,
  overrides?: VoiceOverrides,
  customVoiceId?: string,
): Promise<string> {
  const voiceId = customVoiceId || VOICE_IDS[language] || VOICE_IDS["en"];
  const isJapanese = language === "ja";

  const ttsText = isJapanese ? await cleanJapanesePunctuation(text) : text;
  const modelId = isJapanese ? "eleven_multilingual_v2" : "eleven_multilingual_v2";
  const defaults = isJapanese
    ? { stability: 0.35, similarity_boost: 0.80, style: 0.25, use_speaker_boost: true }
    : { stability: 0.5, similarity_boost: 1.0, style: 0.2, use_speaker_boost: true, speed: 1.0 };
  const voiceSettings = overrides
    ? { ...defaults, ...overrides, use_speaker_boost: true }
    : defaults;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_192`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: ttsText,
        model_id: modelId,
        voice_settings: voiceSettings,
      }),
    }
  );

  if (!response.ok) throw new Error(`ElevenLabs error ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < uint8.byteLength; i++) binary += String.fromCharCode(uint8[i]);
  const base64 = btoa(binary);

  const fileUri = (FileSystem.cacheDirectory ?? "") + `tts_${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return fileUri;
}
