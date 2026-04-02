import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "my_voice";

export interface MyVoice {
  voiceId: string;
  name: string;
}

export async function saveMyVoice(voiceId: string, name: string): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ voiceId, name }));
}

export async function getMyVoice(): Promise<MyVoice | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  return JSON.parse(raw) as MyVoice;
}

export async function clearMyVoice(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
