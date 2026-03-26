export const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? "";
export const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? "";
export const ELEVENLABS_MODEL = "eleven_multilingual_v2";

export const VOICE_IDS: Record<string, string> = {
  en:    "EXAVITQu4vr4xnSDxMaL",
  ja:    "T7yYq3WpB94yAuOXraRi",
  es:    "AZnzlk1XvdvUeBnXmlld",
  fr:    "MF3mGyEYCl7XYWbV9V6O",
  de:    "ErXwobaYiN019PkySvjV",
  pt:    "VR6AewLTigWG4xSOukaG",
  zh:    "pNInz6obpgDQGcFmaJgB",
  ko:    "pMsXgVXv3BLzUgSXRplE",
  ar:    "jsCqWAovK2LkecY7zXl4",
  "ar-LB": "jsCqWAovK2LkecY7zXl4",
  hi:    "ThT5KcBeYPX3keUQqHPh",
  it:    "TxGEqnHWrfWFTfGW9XjX",
  ru:    "yoZ06aMxZJJ28mfd3POQ",
  nl:    "Zlb1dXrM653N07WRdFW3",
  tr:    "g5CIjZEefAph4nQFvHAz",
  pl:    "onwK4e9ZLuTAKqWW03F9",
};

export const LANGUAGES = [
  { code: "en",    label: "English",         flag: "🇨🇦" },
  { code: "ja",    label: "Japanese",         flag: "🇯🇵" },
  { code: "es",    label: "Spanish",          flag: "🇪🇸" },
  { code: "fr",    label: "French",           flag: "🇫🇷" },
  { code: "de",    label: "German",           flag: "🇩🇪" },
  { code: "pt",    label: "Portuguese",       flag: "🇧🇷" },
  { code: "zh",    label: "Mandarin Chinese", flag: "🇨🇳" },
  { code: "ko",    label: "Korean",           flag: "🇰🇷" },
  { code: "ar",    label: "Arabic",           flag: "🇸🇦" },
  { code: "ar-LB", label: "Lebanese Arabic",  flag: "🇱🇧" },
  { code: "hi",    label: "Hindi",            flag: "🇮🇳" },
  { code: "it",    label: "Italian",          flag: "🇮🇹" },
  { code: "ru",    label: "Russian",          flag: "🇷🇺" },
  { code: "nl",    label: "Dutch",            flag: "🇳🇱" },
  { code: "tr",    label: "Turkish",          flag: "🇹🇷" },
  { code: "pl",    label: "Polish",           flag: "🇵🇱" },
];

export const LANG_NAMES: Record<string, string> = {
  en: "English", ja: "Japanese", es: "Spanish", fr: "French",
  de: "German", pt: "Portuguese", zh: "Mandarin Chinese", ko: "Korean",
  ar: "Arabic", "ar-LB": "Lebanese Arabic", hi: "Hindi", it: "Italian",
  ru: "Russian", nl: "Dutch", tr: "Turkish", pl: "Polish",
};

export const COLORS = {
  bg: "#0A0A0F",
  surface: "#12121A",
  surface2: "#1A1A26",
  border: "rgba(255,255,255,0.08)",
  orange: "#E8761A",
  orangeDim: "rgba(232,118,26,0.15)",
  text: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.45)",
  textDim: "rgba(255,255,255,0.18)",
  teal: "#4ECDC4",
  red: "#FF6B6B",
};
