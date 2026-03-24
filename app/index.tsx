import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  ActivityIndicator, Modal, FlatList, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { COLORS, LANGUAGES } from "../constants/config";
import { translateText, synthesizeText } from "../utils/api";

interface VoiceSettings { speed: number; stability: number; style: number; }
interface BatchLine { id: string; text: string; }
interface BatchResult { id: string; status: "ok" | "error" | "pending"; error?: string; }

function LangPickerModal({ visible, selected, onSelect, onClose }: {
  visible: boolean; selected: string; onSelect: (c: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Language</Text>
          <Pressable onPress={onClose} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>Done</Text>
          </Pressable>
        </View>
        <FlatList
          data={LANGUAGES}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.langItem, item.code === selected && styles.langItemActive]}
              onPress={() => { onSelect(item.code); onClose(); }}
            >
              <Text style={styles.langFlag}>{item.flag}</Text>
              <Text style={[styles.langItemText, item.code === selected && styles.langItemTextActive]}>
                {item.label}
              </Text>
              {item.code === selected && <Ionicons name="checkmark" size={18} color={COLORS.orange} />}
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

function LangButton({ code, onPress }: { code: string; onPress: () => void }) {
  const lang = LANGUAGES.find(l => l.code === code) ?? LANGUAGES[0];
  return (
    <Pressable style={styles.langButton} onPress={onPress}>
      <Text style={styles.langFlag}>{lang.flag}</Text>
      <Text style={styles.langButtonText}>{lang.label}</Text>
      <Ionicons name="chevron-down" size={14} color={COLORS.textMuted} />
    </Pressable>
  );
}

function SliderRow({ label, value, min, max, step, hint, onChange, onReset }: {
  label: string; value: number; min: number; max: number; step: number;
  hint: string; onChange: (v: number) => void; onReset: () => void;
}) {
  const steps = Math.round((max - min) / step);
  const currentStep = Math.round((value - min) / step);
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderTop}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <View style={styles.sliderRight}>
          <Text style={styles.sliderValue}>{value.toFixed(2)}</Text>
          <Pressable onPress={onReset} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>reset</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.sliderTrack}>
        {Array.from({ length: steps + 1 }).map((_, i) => (
          <Pressable key={i}
            onPress={() => onChange(Math.round((min + i * step) * 100) / 100)}
            style={[styles.sliderDot, i === currentStep && styles.sliderDotActive]}
          />
        ))}
      </View>
      <Text style={styles.sliderHint}>{hint}</Text>
    </View>
  );
}

function StatusPill({ msg, type }: { msg: string; type: "idle"|"active"|"success"|"error" }) {
  const colors = { idle: COLORS.textMuted, active: COLORS.orange, success: COLORS.teal, error: COLORS.red };
  return (
    <View style={[styles.statusPill, { borderColor: type === "idle" ? COLORS.border : colors[type] + "66" }]}>
      {type === "active" && <ActivityIndicator size="small" color={COLORS.orange} style={{ marginRight: 8 }} />}
      <Text style={[styles.statusText, { color: colors[type] }]}>{msg}</Text>
    </View>
  );
}

export default function HomeScreen() {
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
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerAppName}>Kanjin</Text>
        <Text style={styles.poweredBy}>powered by</Text>
        <Text style={styles.valtText}>VALT AI Inc.</Text>
      </View>

      <View style={styles.tabBar}>
        <Pressable style={[styles.tabBtn, activeTab === "single" && styles.tabBtnActive]} onPress={() => setActiveTab("single")}>
          <Ionicons name="mic" size={14} color={activeTab === "single" ? "#fff" : COLORS.textMuted} />
          <Text style={[styles.tabBtnText, activeTab === "single" && styles.tabBtnTextActive]}>Single Line</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, activeTab === "batch" && styles.tabBtnActive]} onPress={() => setActiveTab("batch")}>
          <Ionicons name="albums" size={14} color={activeTab === "batch" ? "#fff" : COLORS.textMuted} />
          <Text style={[styles.tabBtnText, activeTab === "batch" && styles.tabBtnTextActive]}>Batch Export</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {activeTab === "single" && (
          <View style={styles.section}>
            <View style={styles.modeRow}>
              <Pressable style={[styles.modeBtn, singleMode === "translate" && styles.modeBtnActive]} onPress={() => setSingleMode("translate")}>
                <Text style={[styles.modeBtnText, singleMode === "translate" && styles.modeBtnTextActive]}>🌐 Translate</Text>
              </Pressable>
              <Pressable style={[styles.modeBtn, singleMode === "speak" && styles.modeBtnActive]} onPress={() => setSingleMode("speak")}>
                <Text style={[styles.modeBtnText, singleMode === "speak" && styles.modeBtnTextActive]}>🎙 Speak as-is</Text>
              </Pressable>
            </View>

            {singleMode === "translate" ? (
              <View style={styles.langPair}>
                <View style={styles.langGroup}>
                  <Text style={styles.langGroupLabel}>FROM</Text>
                  <LangButton code={sourceLang} onPress={() => setShowSourcePicker(true)} />
                </View>
                <Pressable style={styles.swapBtn} onPress={() => { const t = sourceLang; setSourceLang(targetLang); setTargetLang(t); }}>
                  <Text style={styles.swapBtnText}>⇄</Text>
                </Pressable>
                <View style={styles.langGroup}>
                  <Text style={styles.langGroupLabel}>TO</Text>
                  <LangButton code={targetLang} onPress={() => setShowTargetPicker(true)} />
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.sectionLabel}>VOICE LANGUAGE</Text>
                <LangButton code={speakLang} onPress={() => setShowSpeakPicker(true)} />
              </View>
            )}

            <View style={styles.voiceBox}>
              <Text style={styles.sectionLabel}>VOICE CONTROLS</Text>
              <SliderRow label="Speed" value={singleVoice.speed} min={0.7} max={1.2} step={0.1} hint="0.7 = slow · 1.0 = normal · 1.2 = fast"
                onChange={v => setSingleVoice(p => ({ ...p, speed: v }))} onReset={() => setSingleVoice(p => ({ ...p, speed: 1.0 }))} />
              <SliderRow label="Stability" value={singleVoice.stability} min={0} max={1} step={0.25} hint="Low = expressive · High = consistent"
                onChange={v => setSingleVoice(p => ({ ...p, stability: v }))} onReset={() => setSingleVoice(p => ({ ...p, stability: 0.5 }))} />
              <SliderRow label="Style" value={singleVoice.style} min={0} max={1} step={0.25} hint="Low = neutral · High = dramatic"
                onChange={v => setSingleVoice(p => ({ ...p, style: v }))} onReset={() => setSingleVoice(p => ({ ...p, style: 0.2 }))} />
            </View>

            <Text style={styles.sectionLabel}>{singleMode === "translate" ? "TEXT TO TRANSLATE" : "TEXT TO SPEAK"}</Text>
            <TextInput style={styles.textInput} multiline value={singleText} onChangeText={setSingleText}
              placeholder="Type or paste text here..." placeholderTextColor={COLORS.textDim} maxLength={5000} />
            <Text style={styles.charCount}>{singleText.length} / 5000</Text>

            <Pressable style={styles.primaryBtn} onPress={runSingle}>
              <Ionicons name="flash" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>{singleMode === "translate" ? "Translate + Generate Audio" : "Generate Audio"}</Text>
            </Pressable>

            <StatusPill msg={singleStatus.msg} type={singleStatus.type} />

            {singleTranslation !== "" && singleMode === "translate" && (
              <View style={styles.resultBox}>
                <Text style={styles.sectionLabel}>TRANSLATION</Text>
                <Text style={styles.resultText} selectable>{singleTranslation}</Text>
              </View>
            )}

            {singleAudioUri && (
              <View style={styles.audioRow}>
                <Pressable style={styles.playBtn} onPress={() => playAudio(singleAudioUri)}>
                  <Ionicons name="play" size={20} color="#fff" />
                  <Text style={styles.playBtnText}>Play</Text>
                </Pressable>
                <Pressable style={styles.shareBtn} onPress={shareSingleAudio}>
                  <Ionicons name="share-outline" size={20} color={COLORS.orange} />
                  <Text style={styles.shareBtnText}>Share MP3</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {activeTab === "batch" && (
          <View style={styles.section}>
            <View style={styles.modeRow}>
              <Pressable style={[styles.modeBtn, batchMode === "translate" && styles.modeBtnActive]} onPress={() => setBatchMode("translate")}>
                <Text style={[styles.modeBtnText, batchMode === "translate" && styles.modeBtnTextActive]}>🌐 Translate</Text>
              </Pressable>
              <Pressable style={[styles.modeBtn, batchMode === "speak" && styles.modeBtnActive]} onPress={() => setBatchMode("speak")}>
                <Text style={[styles.modeBtnText, batchMode === "speak" && styles.modeBtnTextActive]}>🎙 Speak as-is</Text>
              </Pressable>
            </View>

            {batchMode === "translate" ? (
              <View style={styles.langPair}>
                <View style={styles.langGroup}>
                  <Text style={styles.langGroupLabel}>FROM</Text>
                  <LangButton code={batchSourceLang} onPress={() => setShowBatchSourcePicker(true)} />
                </View>
                <Pressable style={styles.swapBtn} onPress={() => { const t = batchSourceLang; setBatchSourceLang(batchTargetLang); setBatchTargetLang(t); }}>
                  <Text style={styles.swapBtnText}>⇄</Text>
                </Pressable>
                <View style={styles.langGroup}>
                  <Text style={styles.langGroupLabel}>TO</Text>
                  <LangButton code={batchTargetLang} onPress={() => setShowBatchTargetPicker(true)} />
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.sectionLabel}>VOICE LANGUAGE</Text>
                <LangButton code={batchSpeakLang} onPress={() => setShowBatchSpeakPicker(true)} />
              </View>
            )}

            <View style={styles.voiceBox}>
              <Text style={styles.sectionLabel}>VOICE CONTROLS</Text>
              <SliderRow label="Speed" value={batchVoice.speed} min={0.7} max={1.2} step={0.1} hint="0.7 = slow · 1.0 = normal · 1.2 = fast"
                onChange={v => setBatchVoice(p => ({ ...p, speed: v }))} onReset={() => setBatchVoice(p => ({ ...p, speed: 1.0 }))} />
              <SliderRow label="Stability" value={batchVoice.stability} min={0} max={1} step={0.25} hint="Low = expressive · High = consistent"
                onChange={v => setBatchVoice(p => ({ ...p, stability: v }))} onReset={() => setBatchVoice(p => ({ ...p, stability: 0.5 }))} />
              <SliderRow label="Style" value={batchVoice.style} min={0} max={1} step={0.25} hint="Low = neutral · High = dramatic"
                onChange={v => setBatchVoice(p => ({ ...p, style: v }))} onReset={() => setBatchVoice(p => ({ ...p, style: 0.2 }))} />
            </View>

            <Text style={styles.sectionLabel}>NUMBERED SCRIPT</Text>
            <TextInput style={[styles.textInput, { minHeight: 160 }]} multiline value={batchText} onChangeText={setBatchText}
              placeholder={"Paste your numbered script here, e.g:\n1-1: Welcome to the JLPT N5 Kanji Accelerator.\n1-2: In this video..."}
              placeholderTextColor={COLORS.textDim} />
            <Text style={styles.charCount}>{lineCount} lines detected</Text>

            <Pressable style={[styles.primaryBtn, batchRunning && styles.primaryBtnDisabled]} onPress={runBatch} disabled={batchRunning}>
              <Ionicons name="albums" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Generate All MP3 Files</Text>
            </Pressable>

            <StatusPill msg={batchStatus.msg} type={batchStatus.type} />

            {batchResults.length > 0 && (
              <View style={styles.progressBox}>
                {batchResults.map(r => (
                  <View key={r.id} style={styles.progressItem}>
                    <Text style={styles.progressId}>{r.id}</Text>
                    <Text style={[styles.progressStatus,
                      r.status === "ok" && { color: COLORS.teal },
                      r.status === "error" && { color: COLORS.red },
                      r.status === "pending" && { color: COLORS.textDim },
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
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  section: { paddingHorizontal: 20, gap: 14 },
  header: { alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerAppName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  poweredBy: { fontSize: 10, fontWeight: "500", color: "#fff", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 2 },
  valtText: { fontSize: 16, fontWeight: "800", color: COLORS.orange, letterSpacing: 1 },
  tabBar: { flexDirection: "row", margin: 16, backgroundColor: COLORS.surface, borderRadius: 12, padding: 4, gap: 4, borderWidth: 1, borderColor: COLORS.border },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 9 },
  tabBtnActive: { backgroundColor: COLORS.orange },
  tabBtnText: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted },
  tabBtnTextActive: { color: "#fff" },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center" },
  modeBtnActive: { backgroundColor: "rgba(232,118,26,0.15)", borderColor: COLORS.orange },
  modeBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
  modeBtnTextActive: { color: COLORS.orange },
  langPair: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  langGroup: { flex: 1, gap: 5 },
  langGroupLabel: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted, letterSpacing: 0.8 },
  langButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  langFlag: { fontSize: 20 },
  langButtonText: { flex: 1, fontSize: 13, fontWeight: "600", color: COLORS.text },
  swapBtn: { width: 38, height: 40, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  swapBtnText: { fontSize: 16, color: COLORS.textMuted },
  sectionLabel: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },
  voiceBox: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 14, gap: 12 },
  sliderRow: { gap: 6 },
  sliderTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sliderLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  sliderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  sliderValue: { fontSize: 12, fontWeight: "700", color: COLORS.orange, minWidth: 32, textAlign: "right" },
  resetBtn: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  resetBtnText: { fontSize: 11, color: COLORS.textDim },
  sliderTrack: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 24 },
  sliderDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border },
  sliderDotActive: { backgroundColor: COLORS.orange, borderColor: COLORS.orange, width: 16, height: 16, borderRadius: 8 },
  sliderHint: { fontSize: 11, color: COLORS.textDim },
  textInput: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, color: COLORS.text, fontSize: 15, lineHeight: 22, padding: 14, minHeight: 110, textAlignVertical: "top" },
  charCount: { textAlign: "right", fontSize: 11, color: COLORS.textDim, marginTop: -8 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.orange, borderRadius: 12, paddingVertical: 14 },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  statusPill: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 13, flex: 1 },
  resultBox: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 14, gap: 8 },
  resultText: { fontSize: 17, fontWeight: "600", color: COLORS.text, lineHeight: 24 },
  audioRow: { flexDirection: "row", gap: 10 },
  playBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 12 },
  playBtnText: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  shareBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(232,118,26,0.12)", borderRadius: 10, borderWidth: 1, borderColor: COLORS.orange, paddingVertical: 12 },
  shareBtnText: { fontSize: 14, fontWeight: "600", color: COLORS.orange },
  progressBox: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  progressItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  progressId: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  progressStatus: { fontSize: 12, fontWeight: "600" },
  modalContainer: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  modalClose: { backgroundColor: COLORS.orange, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 16 },
  modalCloseText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  langItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  langItemActive: { backgroundColor: "rgba(232,118,26,0.1)" },
  langItemText: { flex: 1, fontSize: 15, fontWeight: "500", color: COLORS.textMuted },
  langItemTextActive: { color: COLORS.orange, fontWeight: "700" },
});
