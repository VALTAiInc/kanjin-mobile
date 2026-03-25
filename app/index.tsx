import React, { useState, useRef, useCallback, useContext, useMemo, createContext } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  ActivityIndicator, Modal, FlatList, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { COLORS, LANGUAGES } from "../constants/config";
import { translateText, synthesizeText } from "../utils/api";

interface VoiceSettings { speed: number; stability: number; style: number; }
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

function SliderRow({ label, value, min, max, step, hint, onChange, onReset }: {
  label: string; value: number; min: number; max: number; step: number;
  hint: string; onChange: (v: number) => void; onReset: () => void;
}) {
  const { c } = useContext(ThemeCtx);
  const steps = Math.round((max - min) / step);
  const currentStep = Math.round((value - min) / step);
  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: c.text }}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: c.orange, minWidth: 32, textAlign: "right" }}>{value.toFixed(2)}</Text>
          <Pressable onPress={onReset} style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ fontSize: 10, color: c.textDim }}>reset</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 22 }}>
        {Array.from({ length: steps + 1 }).map((_, i) => (
          <Pressable key={i}
            onPress={() => onChange(Math.round((min + i * step) * 100) / 100)}
            style={i === currentStep
              ? { width: 14, height: 14, borderRadius: 7, backgroundColor: c.orange, borderWidth: 1, borderColor: c.orange }
              : { width: 9, height: 9, borderRadius: 5, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }
            }
          />
        ))}
      </View>
      <Text style={{ fontSize: 10, color: c.textDim }}>{hint}</Text>
    </View>
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

function SplashScreen({ onStart }: { onStart: () => void }) {
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
        <Pressable style={splashStyles.startBtn} onPress={onStart}>
          <Text style={splashStyles.startBtnText}>START TRANSLATING</Text>
        </Pressable>
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
  startBtn: { backgroundColor: "#FE7725", borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  startBtnText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1.2 },
});

export default function AppEntry() {
  const [started, setStarted] = useState(false);
  if (!started) return <SplashScreen onStart={() => setStarted(true)} />;
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
  const [singleVoice, setSingleVoice] = useState<VoiceSettings>({ speed: 1.0, stability: 0.5, style: 0.2 });
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [showSpeakPicker, setShowSpeakPicker] = useState(false);
  const singleSoundRef = useRef<Audio.Sound|null>(null);

  const [batchMode, setBatchMode] = useState<"translate"|"speak">("translate");
  const [batchSourceLang, setBatchSourceLang] = useState("en");
  const [batchTargetLang, setBatchTargetLang] = useState("ja");
  const [batchSpeakLang, setBatchSpeakLang] = useState("ja");
  const [batchText, setBatchText] = useState("");
  const [batchVoice, setBatchVoice] = useState<VoiceSettings>({ speed: 1.0, stability: 0.5, style: 0.2 });
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
      let outputText = text;
      const tgtLang = singleMode === "translate" ? targetLang : speakLang;
      if (singleMode === "translate") {
        setSingleStatus({ msg: "Step 1/2 — Translating with Claude...", type: "active" });
        outputText = await translateText(text, sourceLang, targetLang);
        setSingleTranslation(outputText);
      }
      setSingleStatus({ msg: singleMode === "translate" ? "Step 2/2 — Generating voice..." : "Generating voice...", type: "active" });
      const uri = await synthesizeText(outputText, tgtLang, singleVoice);
      setSingleAudioUri(uri);
      setSingleStatus({ msg: "Done — tap Play or Share", type: "success" });
      await playAudio(uri);
    } catch (err: any) { setSingleStatus({ msg: "Error: " + err.message, type: "error" }); }
  }, [singleText, singleMode, sourceLang, targetLang, speakLang, singleVoice]);

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
    const tgtLang = batchMode === "translate" ? batchTargetLang : batchSpeakLang;
    const tempDir = (FileSystem.cacheDirectory ?? "") + "kanjin-batch/";
    await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
    const filePaths: string[] = [];
    const errors: {id:string;error:string}[] = [];
    for (let i = 0; i < lines.length; i++) {
      const { id, text } = lines[i];
      setBatchStatus({ msg: `Processing ${i + 1} / ${lines.length}...`, type: "active" });
      try {
        let speakText = text;
        if (batchMode === "translate") speakText = await translateText(text, batchSourceLang, tgtLang);
        const uri = await synthesizeText(speakText, tgtLang, batchVoice);
        const dest = tempDir + `${id}.mp3`;
        await FileSystem.copyAsync({ from: uri, to: dest });
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
  }, [batchText, batchMode, batchSourceLang, batchTargetLang, batchSpeakLang, batchVoice, batchRunning]);

  const lineCount = parseLines(batchText).length;

  return (
    <ThemeCtx.Provider value={theme}>
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top"]}>
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

            <View style={{ backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 10, gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>VOICE CONTROLS</Text>
              <SliderRow label="Speed" value={singleVoice.speed} min={0.7} max={1.2} step={0.1} hint="0.7 = slow · 1.0 = normal · 1.2 = fast"
                onChange={v => setSingleVoice(p => ({ ...p, speed: v }))} onReset={() => setSingleVoice(p => ({ ...p, speed: 1.0 }))} />
              <SliderRow label="Stability" value={singleVoice.stability} min={0} max={1} step={0.25} hint="Low = expressive · High = consistent"
                onChange={v => setSingleVoice(p => ({ ...p, stability: v }))} onReset={() => setSingleVoice(p => ({ ...p, stability: 0.5 }))} />
              <SliderRow label="Style" value={singleVoice.style} min={0} max={1} step={0.25} hint="Low = neutral · High = dramatic"
                onChange={v => setSingleVoice(p => ({ ...p, style: v }))} onReset={() => setSingleVoice(p => ({ ...p, style: 0.2 }))} />
            </View>

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

            <View style={{ backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 10, gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>VOICE CONTROLS</Text>
              <SliderRow label="Speed" value={batchVoice.speed} min={0.7} max={1.2} step={0.1} hint="0.7 = slow · 1.0 = normal · 1.2 = fast"
                onChange={v => setBatchVoice(p => ({ ...p, speed: v }))} onReset={() => setBatchVoice(p => ({ ...p, speed: 1.0 }))} />
              <SliderRow label="Stability" value={batchVoice.stability} min={0} max={1} step={0.25} hint="Low = expressive · High = consistent"
                onChange={v => setBatchVoice(p => ({ ...p, stability: v }))} onReset={() => setBatchVoice(p => ({ ...p, stability: 0.5 }))} />
              <SliderRow label="Style" value={batchVoice.style} min={0} max={1} step={0.25} hint="Low = neutral · High = dramatic"
                onChange={v => setBatchVoice(p => ({ ...p, style: v }))} onReset={() => setBatchVoice(p => ({ ...p, style: 0.2 }))} />
            </View>

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
    </SafeAreaView>
    </ThemeCtx.Provider>
  );
}
