import React, { useState, useRef, useCallback, useContext, useMemo, createContext } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  ActivityIndicator, Modal, FlatList, TouchableOpacity,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import { COLORS, LANGUAGES } from "../constants/config";
import { translateAndSpeak, speakText } from "../utils/api";

interface BatchLine { id: string; text: string; }
interface BatchResult { id: string; status: "ok" | "error" | "pending"; error?: string; }

type ThemeColors = {
  bg: string; surface: string; surface2: string; border: string;
  orange: string; orangeDim: string; text: string; textMuted: string; textDim: string;
  teal: string; red: string;
};

const DARK: ThemeColors = {
  bg: "#0A0A0F", surface: "#12121A", surface2: "#1A1A26",
  border: "rgba(255,255,255,0.08)", orange: "#E8761A", orangeDim: "rgba(232,118,26,0.15)",
  text: "#FFFFFF", textMuted: "rgba(255,255,255,0.45)", textDim: "rgba(255,255,255,0.18)",
  teal: "#4ECDC4", red: "#FF6B6B",
};

const LIGHT: ThemeColors = {
  bg: "#F5F5F5", surface: "#FFFFFF", surface2: "#E8E8E8",
  border: "rgba(0,0,0,0.10)", orange: "#E8761A", orangeDim: "rgba(232,118,26,0.10)",
  text: "#1A1A1A", textMuted: "rgba(0,0,0,0.45)", textDim: "rgba(0,0,0,0.22)",
  teal: "#2BA89E", red: "#D94444",
};

const ThemeCtx = createContext<{ c: ThemeColors; isDark: boolean }>({ c: DARK, isDark: true });

function LangPickerModal({ visible, selected, onSelect, onClose }: {
  visible: boolean; selected: string; onSelect: (c: string) => void; onClose: () => void;
}) {
  const { c } = useContext(ThemeCtx);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: c.text }}>Select Language</Text>
          <Pressable onPress={onClose} style={{ backgroundColor: c.orange, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 16 }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Done</Text>
          </Pressable>
        </View>
        <FlatList
          data={LANGUAGES}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border }, item.code === selected && { backgroundColor: c.orangeDim }]}
              onPress={() => { onSelect(item.code); onClose(); }}
            >
              <Text style={{ fontSize: 20 }}>{item.flag}</Text>
              <Text style={[{ flex: 1, fontSize: 15, fontWeight: "500", color: c.textMuted }, item.code === selected && { color: c.orange, fontWeight: "700" }]}>
                {item.label}
              </Text>
              {item.code === selected && <Ionicons name="checkmark" size={18} color={c.orange} />}
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

function LangButton({ code, onPress }: { code: string; onPress: () => void }) {
  const { c } = useContext(ThemeCtx);
  const lang = LANGUAGES.find(l => l.code === code) ?? LANGUAGES[0];
  return (
    <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }} onPress={onPress}>
      <Text style={{ fontSize: 18 }}>{lang.flag}</Text>
      <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: c.text }}>{lang.label}</Text>
      <Ionicons name="chevron-down" size={14} color={c.textMuted} />
    </Pressable>
  );
}



function StatusPill({ msg, type }: { msg: string; type: "idle"|"active"|"success"|"error" }) {
  const { c } = useContext(ThemeCtx);
  const typeColors = { idle: c.textMuted, active: c.orange, success: c.teal, error: c.red };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", padding: 9, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: type === "idle" ? c.border : typeColors[type] + "66" }}>
      {type === "active" && <ActivityIndicator size="small" color={c.orange} style={{ marginRight: 8 }} />}
      <Text style={{ fontSize: 12, flex: 1, color: typeColors[type] }}>{msg}</Text>
    </View>
  );
}

function SplashScreen({ onTranslate, onTranscribe }: { onTranslate: () => void; onTranscribe: () => void }) {
  return (
    <View style={splashStyles.container}>
      <View style={splashStyles.content}>
        <LinearGradient
          colors={["#3A2010", "#1A0D05", "#0A0A0F"]}
          style={splashStyles.iconBox}
        >
          <Text style={splashStyles.kanji}>声</Text>
        </LinearGradient>

        <Text style={splashStyles.title}>
          BRIDGE <Text style={splashStyles.titleBy}>by VALT</Text>
        </Text>

        <Text style={splashStyles.tagline}>Every conversation, every language.</Text>
      </View>

      <View style={splashStyles.bottom}>
        <View style={splashStyles.btnRow}>
          <Pressable style={splashStyles.translateBtn} onPress={onTranslate}>
            <Text style={splashStyles.startBtnText}>Translate</Text>
          </Pressable>
          <Pressable style={splashStyles.transcribeBtn} onPress={onTranscribe}>
            <Text style={splashStyles.transcribeBtnText}>Transcribe</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0F", justifyContent: "space-between", alignItems: "center", paddingVertical: 60, paddingHorizontal: 24 },
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20 },
  iconBox: { width: 120, height: 120, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  kanji: { fontSize: 60, color: "#FFFFFF", fontWeight: "300" },
  title: { fontSize: 28, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1.5 },
  titleBy: { color: "#FE7725", fontWeight: "800" },
  tagline: { fontSize: 15, color: "rgba(255,255,255,0.45)", fontStyle: "italic" },
  bottom: { width: "100%" },
  btnRow: { flexDirection: "row", gap: 12 },
  translateBtn: { flex: 1, backgroundColor: "#FE7725", borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  transcribeBtn: { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", backgroundColor: "transparent" },
  startBtnText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1.2 },
  transcribeBtnText: { fontSize: 16, fontWeight: "800", color: "rgba(255,255,255,0.7)", letterSpacing: 1.2 },
});

function TranscribeScreen({ onBack }: { onBack: () => void }) {
  const [lang, setLang] = useState("en");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<{ msg: string; type: "idle" | "active" | "success" | "error" }>({ msg: "Hold the mic to record", type: "idle" });

  const startRecording = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { setStatus({ msg: "Microphone permission denied", type: "error" }); return; }
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
      setStatus({ msg: "Recording...", type: "active" });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e: any) {
      setStatus({ msg: "Failed to start recording: " + e.message, type: "error" });
    }
  }, []);

  const stopAndTranscribe = useCallback(async () => {
    if (!recording) return;
    setIsRecording(false);
    setStatus({ msg: "Transcribing...", type: "active" });
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (!uri) { setStatus({ msg: "No recording found", type: "error" }); return; }

      const formData = new FormData();
      formData.append("audio", { uri, name: "recording.m4a", type: "audio/m4a" } as any);
      formData.append("language", lang);

      const response = await fetch("https://bridge-backend-production-b481.up.railway.app/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        throw new Error(`Server error ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      const text = data.transcript ?? data.text ?? "";
      setTranscript(text);
      setStatus({ msg: "Transcription complete", type: "success" });
    } catch (e: any) {
      setStatus({ msg: "Error: " + e.message, type: "error" });
    }
  }, [recording, lang]);

  const copyTranscript = useCallback(async () => {
    await Clipboard.setStringAsync(transcript);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [transcript]);

  const shareTranscript = useCallback(async () => {
    const fileUri = (FileSystem.documentDirectory ?? "") + "transcript.txt";
    await FileSystem.writeAsStringAsync(fileUri, transcript);
    await Sharing.shareAsync(fileUri, { mimeType: "text/plain", dialogTitle: "Share Transcript" });
  }, [transcript]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0A0F" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
        <Pressable onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}>Back</Text>
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>Transcribe</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Language selector */}
        <View style={{ marginTop: 16, gap: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.8 }}>LANGUAGE</Text>
          <LangButton code={lang} onPress={() => setShowLangPicker(true)} />
        </View>

        {/* Mic button */}
        <View style={{ alignItems: "center", marginTop: 40, marginBottom: 24 }}>
          <Pressable
            onPressIn={startRecording}
            onPressOut={stopAndTranscribe}
            style={({ pressed }) => ({
              width: 120, height: 120, borderRadius: 60,
              backgroundColor: isRecording ? "#FE7725" : pressed ? "rgba(254,119,37,0.3)" : "#12121A",
              borderWidth: 3, borderColor: "#FE7725",
              alignItems: "center", justifyContent: "center",
              ...(isRecording ? { shadowColor: "#FE7725", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20 } : {}),
            })}
          >
            <Ionicons name="mic" size={48} color={isRecording ? "#FFFFFF" : "#FE7725"} />
          </Pressable>
          <Text style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}>
            {isRecording ? "Release to transcribe" : "Hold to record"}
          </Text>
        </View>

        {/* Status */}
        <StatusPill msg={status.msg} type={status.type} />

        {/* Transcript */}
        {transcript !== "" && (
          <View style={{ marginTop: 16, backgroundColor: "#12121A", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 14, gap: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.8 }}>TRANSCRIPT</Text>
            <Text style={{ fontSize: 15, color: "#FFFFFF", lineHeight: 22 }} selectable>{transcript}</Text>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <Pressable onPress={copyTranscript} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(232,118,26,0.15)", borderRadius: 8, borderWidth: 1, borderColor: "#FE7725", paddingVertical: 10 }}>
                <Ionicons name="copy-outline" size={18} color="#FE7725" />
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#FE7725" }}>Copy</Text>
              </Pressable>
              <Pressable onPress={shareTranscript} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#12121A", borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingVertical: 10 }}>
                <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>Share</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      <LangPickerModal visible={showLangPicker} selected={lang} onSelect={setLang} onClose={() => setShowLangPicker(false)} />
    </SafeAreaView>
  );
}

export default function AppEntry() {
  const [started, setStarted] = useState(false);
  const [transcribeMode, setTranscribeMode] = useState(false);

  if (!started) {
    return (
      <SplashScreen
        onTranslate={() => setStarted(true)}
        onTranscribe={() => { setStarted(true); setTranscribeMode(true); }}
      />
    );
  }

  if (transcribeMode) {
    return <TranscribeScreen onBack={() => { setStarted(false); setTranscribeMode(false); }} />;
  }

  return <HomeScreen />;
}

function HomeScreen() {
  const [isDark, setIsDark] = useState(true);
  const c = isDark ? DARK : LIGHT;
  const theme = useMemo(() => ({ c, isDark }), [isDark]);

  const [activeTab, setActiveTab] = useState<"single"|"batch">("single");

  const [singleMode, setSingleMode] = useState<"translate"|"speak">("translate");
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("ja");
  const [speakLang, setSpeakLang] = useState("ja");
  const [singleText, setSingleText] = useState("");
  const [singleTranslation, setSingleTranslation] = useState("");
  const [singleStatus, setSingleStatus] = useState<{msg:string;type:"idle"|"active"|"success"|"error"}>({ msg: "Paste text and hit Generate", type: "idle" });
  const [singleAudioUri, setSingleAudioUri] = useState<string|null>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [showSpeakPicker, setShowSpeakPicker] = useState(false);
  const singleSoundRef = useRef<Audio.Sound|null>(null);

  const [batchMode, setBatchMode] = useState<"translate"|"speak">("translate");
  const [batchSourceLang, setBatchSourceLang] = useState("en");
  const [batchTargetLang, setBatchTargetLang] = useState("ja");
  const [batchSpeakLang, setBatchSpeakLang] = useState("ja");
  const [batchText, setBatchText] = useState("");
  const [batchStatus, setBatchStatus] = useState<{msg:string;type:"idle"|"active"|"success"|"error"}>({ msg: "Paste script, hit Generate", type: "idle" });
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [showBatchSourcePicker, setShowBatchSourcePicker] = useState(false);
  const [showBatchTargetPicker, setShowBatchTargetPicker] = useState(false);
  const [showBatchSpeakPicker, setShowBatchSpeakPicker] = useState(false);

  function parseLines(raw: string): BatchLine[] {
    const pattern = /^(\d+(?:-\d+)+)\s*:\s*(.+)$/;
    return raw.split("\n").map(l => l.trim()).filter(Boolean)
      .map(l => { const m = l.match(pattern); return m ? { id: m[1], text: m[2].trim() } : null; })
      .filter(Boolean) as BatchLine[];
  }

  async function playAudio(uri: string) {
    try {
      if (singleSoundRef.current) { await singleSoundRef.current.unloadAsync(); singleSoundRef.current = null; }
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 1.0 });
      singleSoundRef.current = sound;
    } catch (e) { console.error("Playback error:", e); }
  }

  const runSingle = useCallback(async () => {
    const text = singleText.trim();
    if (!text) { setSingleStatus({ msg: "Please enter some text first", type: "error" }); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSingleAudioUri(null); setSingleTranslation("");
    try {
      let audioUri: string;
      if (singleMode === "translate") {
        setSingleStatus({ msg: "Translating & generating audio...", type: "active" });
        const result = await translateAndSpeak(text, sourceLang, targetLang);
        setSingleTranslation(result.translation);
        audioUri = result.audioUri;
      } else {
        setSingleStatus({ msg: "Generating audio...", type: "active" });
        audioUri = await speakText(text, speakLang);
      }
      setSingleAudioUri(audioUri);
      setSingleStatus({ msg: "Done — tap Play or Share", type: "success" });
      await playAudio(audioUri);
    } catch (err: any) { setSingleStatus({ msg: "Error: " + err.message, type: "error" }); }
  }, [singleText, singleMode, sourceLang, targetLang, speakLang]);

  async function shareSingleAudio() {
    if (!singleAudioUri) return;
    const dest = (FileSystem.documentDirectory ?? "") + "kanjin-audio.mp3";
    await FileSystem.copyAsync({ from: singleAudioUri, to: dest });
    await Sharing.shareAsync(dest, { mimeType: "audio/mpeg", dialogTitle: "Save or share audio" });
  }

  const runBatch = useCallback(async () => {
    const lines = parseLines(batchText);
    if (!lines.length) { setBatchStatus({ msg: "No numbered lines found. Format: 1-1: Your text", type: "error" }); return; }
    if (batchRunning) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setBatchRunning(true);
    setBatchResults(lines.map(l => ({ id: l.id, status: "pending" })));
    const tempDir = (FileSystem.cacheDirectory ?? "") + "kanjin-batch/";
    await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
    const filePaths: string[] = [];
    const errors: {id:string;error:string}[] = [];
    for (let i = 0; i < lines.length; i++) {
      const { id, text } = lines[i];
      setBatchStatus({ msg: `Processing ${i + 1} / ${lines.length}...`, type: "active" });
      try {
        let audioUri: string;
        if (batchMode === "translate") {
          const result = await translateAndSpeak(text, batchSourceLang, batchTargetLang);
          audioUri = result.audioUri;
        } else {
          audioUri = await speakText(text, batchSpeakLang);
        }
        const dest = tempDir + `${id}.mp3`;
        await FileSystem.copyAsync({ from: audioUri, to: dest });
        filePaths.push(dest);
        setBatchResults(prev => prev.map(r => r.id === id ? { ...r, status: "ok" } : r));
      } catch (err: any) {
        errors.push({ id, error: err.message });
        setBatchResults(prev => prev.map(r => r.id === id ? { ...r, status: "error", error: err.message } : r));
      }
      await new Promise(r => setTimeout(r, 300));
    }
    if (filePaths.length > 0) {
      try { await Sharing.shareAsync(filePaths[0], { mimeType: "audio/mpeg", dialogTitle: "Save MP3 files" }); }
      catch (e) { console.error("Share error:", e); }
    }
    setBatchRunning(false);
    setBatchStatus(errors.length === 0
      ? { msg: `✓ All ${lines.length} files generated!`, type: "success" }
      : { msg: `Done — ${lines.length - errors.length} OK, ${errors.length} failed`, type: "error" });
  }, [batchText, batchMode, batchSourceLang, batchTargetLang, batchSpeakLang, batchRunning]);

  const lineCount = parseLines(batchText).length;

  return (
    <ThemeCtx.Provider value={theme}>
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top"]}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: c.text }}>Kanjin</Text>
          <Text style={{ fontSize: 10, fontWeight: "500", color: c.text, textTransform: "uppercase", letterSpacing: 1.5, marginTop: 1 }}>powered by</Text>
          <Text style={{ fontSize: 16, fontWeight: "800", color: c.orange, letterSpacing: 1 }}>VALT AI Inc.</Text>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end", paddingRight: 16 }}>
          <Pressable onPress={() => setIsDark(d => !d)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={isDark ? "sunny" : "moon"} size={16} color={isDark ? "#FFC857" : "#5A5A8A"} />
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: "row", marginHorizontal: 14, marginVertical: 10, backgroundColor: c.surface, borderRadius: 10, padding: 3, gap: 3, borderWidth: 1, borderColor: c.border }}>
        <Pressable style={[{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 8 }, activeTab === "single" && { backgroundColor: c.orange }]} onPress={() => setActiveTab("single")}>
          <Ionicons name="mic" size={14} color={activeTab === "single" ? "#fff" : c.textMuted} />
          <Text style={[{ fontSize: 12, fontWeight: "600", color: c.textMuted }, activeTab === "single" && { color: "#fff" }]}>Single Line</Text>
        </Pressable>
        <Pressable style={[{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 8 }, activeTab === "batch" && { backgroundColor: c.orange }]} onPress={() => setActiveTab("batch")}>
          <Ionicons name="albums" size={14} color={activeTab === "batch" ? "#fff" : c.textMuted} />
          <Text style={[{ fontSize: 12, fontWeight: "600", color: c.textMuted }, activeTab === "batch" && { color: "#fff" }]}>Batch Export</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {activeTab === "single" && (
          <View style={{ paddingHorizontal: 14, gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
              <Pressable style={[{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center" }, singleMode === "translate" && { backgroundColor: c.orangeDim, borderColor: c.orange }]} onPress={() => setSingleMode("translate")}>
                <Text style={[{ fontSize: 13, fontWeight: "600", color: c.textMuted }, singleMode === "translate" && { color: c.orange }]}>🌐 Translate</Text>
              </Pressable>
              <Pressable style={[{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center" }, singleMode === "speak" && { backgroundColor: c.orangeDim, borderColor: c.orange }]} onPress={() => setSingleMode("speak")}>
                <Text style={[{ fontSize: 13, fontWeight: "600", color: c.textMuted }, singleMode === "speak" && { color: c.orange }]}>🎙 Speak as-is</Text>
              </Pressable>
            </View>

            {singleMode === "translate" ? (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, letterSpacing: 0.8 }}>FROM</Text>
                  <LangButton code={sourceLang} onPress={() => setShowSourcePicker(true)} />
                </View>
                <Pressable style={{ width: 34, height: 34, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 1 }} onPress={() => { const t = sourceLang; setSourceLang(targetLang); setTargetLang(t); }}>
                  <Text style={{ fontSize: 16, color: c.textMuted }}>⇄</Text>
                </Pressable>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, letterSpacing: 0.8 }}>TO</Text>
                  <LangButton code={targetLang} onPress={() => setShowTargetPicker(true)} />
                </View>
              </View>
            ) : (
              <View>
                <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>VOICE LANGUAGE</Text>
                <LangButton code={speakLang} onPress={() => setShowSpeakPicker(true)} />
              </View>
            )}

            <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>{singleMode === "translate" ? "TEXT TO TRANSLATE" : "TEXT TO SPEAK"}</Text>
            <TextInput style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 10, color: c.text, fontSize: 14, lineHeight: 20, padding: 10, minHeight: 85, textAlignVertical: "top" }} multiline value={singleText} onChangeText={setSingleText}
              placeholder="Type or paste text here..." placeholderTextColor={c.textDim} maxLength={5000} />
            <Text style={{ textAlign: "right", fontSize: 10, color: c.textDim, marginTop: -6 }}>{singleText.length} / 5000</Text>

            <Pressable style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: c.orange, borderRadius: 10, paddingVertical: 12 }} onPress={runSingle}>
              <Ionicons name="flash" size={18} color="#fff" />
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>{singleMode === "translate" ? "Translate + Generate Audio" : "Generate Audio"}</Text>
            </Pressable>

            <StatusPill msg={singleStatus.msg} type={singleStatus.type} />

            {singleTranslation !== "" && singleMode === "translate" && (
              <View style={{ backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 10, gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>TRANSLATION</Text>
                <Text style={{ fontSize: 16, fontWeight: "600", color: c.text, lineHeight: 22 }} selectable>{singleTranslation}</Text>
              </View>
            )}

            {singleAudioUri && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingVertical: 10 }} onPress={() => playAudio(singleAudioUri)}>
                  <Ionicons name="play" size={20} color={c.text} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: c.text }}>Play</Text>
                </Pressable>
                <Pressable style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: c.orangeDim, borderRadius: 8, borderWidth: 1, borderColor: c.orange, paddingVertical: 10 }} onPress={shareSingleAudio}>
                  <Ionicons name="share-outline" size={20} color={c.orange} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: c.orange }}>Share MP3</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {activeTab === "batch" && (
          <View style={{ paddingHorizontal: 14, gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
              <Pressable style={[{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center" }, batchMode === "translate" && { backgroundColor: c.orangeDim, borderColor: c.orange }]} onPress={() => setBatchMode("translate")}>
                <Text style={[{ fontSize: 13, fontWeight: "600", color: c.textMuted }, batchMode === "translate" && { color: c.orange }]}>🌐 Translate</Text>
              </Pressable>
              <Pressable style={[{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center" }, batchMode === "speak" && { backgroundColor: c.orangeDim, borderColor: c.orange }]} onPress={() => setBatchMode("speak")}>
                <Text style={[{ fontSize: 13, fontWeight: "600", color: c.textMuted }, batchMode === "speak" && { color: c.orange }]}>🎙 Speak as-is</Text>
              </Pressable>
            </View>

            {batchMode === "translate" ? (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, letterSpacing: 0.8 }}>FROM</Text>
                  <LangButton code={batchSourceLang} onPress={() => setShowBatchSourcePicker(true)} />
                </View>
                <Pressable style={{ width: 34, height: 34, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 1 }} onPress={() => { const t = batchSourceLang; setBatchSourceLang(batchTargetLang); setBatchTargetLang(t); }}>
                  <Text style={{ fontSize: 16, color: c.textMuted }}>⇄</Text>
                </Pressable>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, letterSpacing: 0.8 }}>TO</Text>
                  <LangButton code={batchTargetLang} onPress={() => setShowBatchTargetPicker(true)} />
                </View>
              </View>
            ) : (
              <View>
                <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>VOICE LANGUAGE</Text>
                <LangButton code={batchSpeakLang} onPress={() => setShowBatchSpeakPicker(true)} />
              </View>
            )}

            <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>NUMBERED SCRIPT</Text>
            <TextInput style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 10, color: c.text, fontSize: 14, lineHeight: 20, padding: 10, minHeight: 160, textAlignVertical: "top" }} multiline value={batchText} onChangeText={setBatchText}
              placeholder={"Paste your numbered script here, e.g:\n1-1: Welcome to the JLPT N5 Kanji Accelerator.\n1-2: In this video..."}
              placeholderTextColor={c.textDim} />
            <Text style={{ textAlign: "right", fontSize: 10, color: c.textDim, marginTop: -6 }}>{lineCount} lines detected</Text>

            <Pressable style={[{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: c.orange, borderRadius: 10, paddingVertical: 12 }, batchRunning && { opacity: 0.4 }]} onPress={runBatch} disabled={batchRunning}>
              <Ionicons name="albums" size={18} color="#fff" />
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Generate All MP3 Files</Text>
            </Pressable>

            <StatusPill msg={batchStatus.msg} type={batchStatus.type} />

            {batchResults.length > 0 && (
              <View style={{ backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
                {batchResults.map(r => (
                  <View key={r.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: c.text }}>{r.id}</Text>
                    <Text style={[{ fontSize: 12, fontWeight: "600" },
                      r.status === "ok" && { color: c.teal },
                      r.status === "error" && { color: c.red },
                      r.status === "pending" && { color: c.textDim },
                    ]}>
                      {r.status === "ok" ? "✓ Done" : r.status === "error" ? "✗ Error" : "Waiting"}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <LangPickerModal visible={showSourcePicker} selected={sourceLang} onSelect={setSourceLang} onClose={() => setShowSourcePicker(false)} />
      <LangPickerModal visible={showTargetPicker} selected={targetLang} onSelect={setTargetLang} onClose={() => setShowTargetPicker(false)} />
      <LangPickerModal visible={showSpeakPicker} selected={speakLang} onSelect={setSpeakLang} onClose={() => setShowSpeakPicker(false)} />
      <LangPickerModal visible={showBatchSourcePicker} selected={batchSourceLang} onSelect={setBatchSourceLang} onClose={() => setShowBatchSourcePicker(false)} />
      <LangPickerModal visible={showBatchTargetPicker} selected={batchTargetLang} onSelect={setBatchTargetLang} onClose={() => setShowBatchTargetPicker(false)} />
      <LangPickerModal visible={showBatchSpeakPicker} selected={batchSpeakLang} onSelect={setBatchSpeakLang} onClose={() => setShowBatchSpeakPicker(false)} />
    </View>
    </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
    </SafeAreaView>
    </ThemeCtx.Provider>
  );
}
