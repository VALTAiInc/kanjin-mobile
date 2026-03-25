import * as FileSystem from "expo-file-system/legacy";
import { ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_MODEL, VOICE_IDS, LANG_NAMES } from "../constants/config";

export async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const sourceName = LANG_NAMES[sourceLang] || sourceLang;
  const targetName = LANG_NAMES[targetLang] || targetLang;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are a professional translator. Translate the given text naturally and accurately into ${targetName}. Output ONLY the translated text — no explanations, no quotes, no preamble.`,
      messages: [{ role: "user", content: `Translate this from ${sourceName} to ${targetName}:\n\n${text}` }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error ${response.status}`);
  const data = await response.json();
  return data.content[0].text.trim();
}

export async function synthesizeText(
  text: string,
  targetLang: string,
  voiceSettings: { speed: number; stability: number; style: number }
): Promise<string> {
  const voiceId = VOICE_IDS[targetLang] || VOICE_IDS["en"];
  const { speed, stability, style } = voiceSettings;

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
        text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: {
          stability,
          similarity_boost: 1.0,
          style,
          use_speaker_boost: true,
          speed,
        },
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
