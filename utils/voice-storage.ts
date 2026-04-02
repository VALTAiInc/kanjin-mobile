import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "my_voice";

export interface MyVoiceSettings {
  speed: number;
  stability: number;
  style: number;
}

export interface MyVoice {
  voiceId: string;
  name: string;
  settings: MyVoiceSettings;
}

export async function saveMyVoice(voiceId: string, name: string, settings: MyVoiceSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ voiceId, name, settings }));
}

export async function getMyVoice(): Promise<MyVoice | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  return JSON.parse(raw) as MyVoice;
}

export async function clearMyVoice(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
