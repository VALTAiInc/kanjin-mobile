import * as FileSystem from "expo-file-system/legacy";

const API_BASE = "https://bridge-backend-production-b481.up.railway.app";

export interface TranslateResult {
  translation: string;
  audioUri: string;
}

export async function translateAndSpeak(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<TranslateResult> {
  const response = await fetch(`${API_BASE}/api/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, sourceLanguage, targetLanguage }),
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
