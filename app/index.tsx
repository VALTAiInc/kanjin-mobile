import React, { useState, useRef, useCallback, useContext, useMemo, createContext, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  ActivityIndicator, Modal, FlatList, TouchableOpacity,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { COLORS, LANGUAGES } from "../constants/config";
import { translateAndSpeak, translateAndSpeakWithMyVoice, speakText, VoiceOverrides } from "../utils/api";
import { getMyVoice, MyVoice } from "../utils/voice-storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MyVoiceScreen from "./my-voice";
import Slider from "@react-native-community/slider";

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

function LangPickerModal({ visible, selected, onSelect, onClose, myVoice }: {
  visible: boolean; selected: string; onSelect: (c: string) => void; onClose: () => void; myVoice?: MyVoice | null;
}) {
  const { c } = useContext(ThemeCtx);
  const listData = myVoice ? [{ code: "my-voice", label: `My Voice (${myVoice.name})`, flag: "\uD83C\uDFA4" }, ...LANGUAGES] : LANGUAGES;
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
          data={listData}
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

function LangButton({ code, onPress, myVoiceName }: { code: string; onPress: () => void; myVoiceName?: string }) {
  const { c } = useContext(ThemeCtx);
  const isEmpty = !code;
  const isMyVoice = code === "my-voice";
  const lang = isEmpty ? { code: "", label: "Language", flag: "" }
    : isMyVoice ? { code: "my-voice", label: `My Voice (${myVoiceName ?? ""})`, flag: "\uD83C\uDFA4" }
    : (LANGUAGES.find(l => l.code === code) ?? LANGUAGES[0]);
  return (
    <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }} onPress={onPress}>
      {!isEmpty && <Text style={{ fontSize: 18 }}>{lang.flag}</Text>}
      <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: isEmpty ? c.textMuted : c.text }}>{lang.label}</Text>
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

function SplashScreen({ onTranslate, onTranscribe, onMyVoice }: { onTranslate: () => void; onTranscribe: () => void; onMyVoice: () => void }) {
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
          VOICE <Text style={splashStyles.titleBy}>by VALT</Text>
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
        <Pressable style={splashStyles.myVoiceBtn} onPress={onMyVoice}>
          <Ionicons name="mic" size={18} color="rgba(255,255,255,0.7)" />
          <Text style={splashStyles.myVoiceBtnText}>Clone Your Voice</Text>
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
  btnRow: { flexDirection: "row", gap: 12 },
  translateBtn: { flex: 1, backgroundColor: "#FE7725", borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  transcribeBtn: { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", backgroundColor: "transparent" },
  startBtnText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1.2 },
  transcribeBtnText: { fontSize: 16, fontWeight: "800", color: "rgba(255,255,255,0.7)", letterSpacing: 1.2 },
  myVoiceBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, borderRadius: 14, paddingVertical: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", backgroundColor: "transparent" },
  myVoiceBtnText: { fontSize: 16, fontWeight: "800", color: "rgba(255,255,255,0.7)", letterSpacing: 1.2 },
});

function TranscribeScreen({ onBack, onUseInTranslator }: { onBack: () => void; onUseInTranslator: (text: string) => void }) {
  const [audioLang, setAudioLang] = useState("en");
  const [translateTo, setTranslateTo] = useState("none");
  const [showAudioLangPicker, setShowAudioLangPicker] = useState(false);
  const [showTranslatePicker, setShowTranslatePicker] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [translation, setTranslation] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [status, setStatus] = useState<{ msg: string; type: "idle" | "active" | "success" | "error" }>({ msg: "Tap the mic to record", type: "idle" });
  const scrollRef = useRef<ScrollView>(null);

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

  const sendToTranscribe = useCallback(async (uri: string, name: string, mimeType: string) => {
    setStatus({ msg: "Transcribing...", type: "active" });
    setTranslation("");
    try {
      const formData = new FormData();
      formData.append("audio", { uri, name, type: mimeType } as any);
      formData.append("language", audioLang);

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

      if (translateTo !== "none" && text) {
        setStatus({ msg: "Translating...", type: "active" });
        const result = await translateAndSpeak(text, audioLang, translateTo);
        setTranslation(result.translation);
      }

      setStatus({ msg: "Done", type: "success" });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    } catch (e: any) {
      setStatus({ msg: "Error: " + e.message, type: "error" });
    }
  }, [audioLang, translateTo]);

  const stopAndTranscribe = useCallback(async () => {
    if (!recording) return;
    setIsRecording(false);
    setFileName(null);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (!uri) { setStatus({ msg: "No recording found", type: "error" }); return; }
      await sendToTranscribe(uri, "recording.m4a", "audio/m4a");
    } catch (e: any) {
      setStatus({ msg: "Error: " + e.message, type: "error" });
    }
  }, [recording, sendToTranscribe]);

  const pickAndTranscribe = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/x-m4a", "audio/mp4", "audio/mpeg", "audio/wav", "audio/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const ext = asset.name.split(".").pop()?.toLowerCase() ?? "m4a";
      const mimeMap: Record<string, string> = { m4a: "audio/m4a", mp3: "audio/mpeg", wav: "audio/wav" };
      setFileName(asset.name);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await sendToTranscribe(asset.uri, asset.name, mimeMap[ext] ?? asset.mimeType ?? "audio/m4a");
    } catch (e: any) {
      setStatus({ msg: "Error: " + e.message, type: "error" });
    }
  }, [sendToTranscribe]);

  const pickVideoAndTranscribe = useCallback(async () => {
    try {
      const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permStatus !== "granted") { setStatus({ msg: "Photo library permission denied", type: "error" }); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const uri = asset.uri;
      const name = uri.split("/").pop() ?? "video.mp4";
      const ext = name.split(".").pop()?.toLowerCase() ?? "mp4";
      const mimeMap: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime" };
      setFileName(name);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await sendToTranscribe(uri, name, mimeMap[ext] ?? "video/mp4");
    } catch (e: any) {
      setStatus({ msg: "Error: " + e.message, type: "error" });
    }
  }, [sendToTranscribe]);

  const transcribeYoutube = useCallback(async () => {
    const url = youtubeUrl.trim();
    if (!url) { setStatus({ msg: "Please paste a YouTube URL", type: "error" }); return; }
    setStatus({ msg: "Fetching YouTube captions...", type: "active" });
    setTranscript("");
    setTranslation("");
    setFileName(null);
    try {
      const response = await fetch("https://bridge-backend-production-b481.up.railway.app/api/transcribe-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: url }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: `Server error ${response.status}` }));
        throw new Error(errData.error || `Server error ${response.status}`);
      }
      const data = await response.json();
      const text = data.transcript ?? "";
      setTranscript(text);

      if (translateTo !== "none" && text) {
        setStatus({ msg: "Translating...", type: "active" });
        const result = await translateAndSpeak(text, audioLang, translateTo);
        setTranslation(result.translation);
      }

      setStatus({ msg: "Done", type: "success" });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    } catch (e: any) {
      setStatus({ msg: e.message, type: "error" });
    }
  }, [youtubeUrl, audioLang, translateTo]);

  const copyAll = useCallback(async () => {
    const text = translation ? `Transcript:\n${transcript}\n\nTranslation:\n${translation}` : transcript;
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [transcript, translation]);

  const shareAll = useCallback(async () => {
    const text = translation ? `Transcript:\n${transcript}\n\nTranslation:\n${translation}` : transcript;
    const fileUri = (FileSystem.documentDirectory ?? "") + "transcript.txt";
    await FileSystem.writeAsStringAsync(fileUri, text);
    await Sharing.shareAsync(fileUri, { mimeType: "text/plain", dialogTitle: "Share Transcript" });
  }, [transcript, translation]);

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

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Audio Language selector */}
        <View style={{ marginTop: 16, gap: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.8 }}>AUDIO LANGUAGE</Text>
          <LangButton code={audioLang} onPress={() => setShowAudioLangPicker(true)} />
        </View>

        {/* Translate To selector */}
        <View style={{ marginTop: 12, gap: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.8 }}>TRANSLATE TO</Text>
          <Pressable
            style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#12121A", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
            onPress={() => setShowTranslatePicker(true)}
          >
            {translateTo === "none" ? (
              <>
                <Ionicons name="remove-circle-outline" size={18} color="rgba(255,255,255,0.45)" />
                <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.45)" }}>No translation</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 18 }}>{LANGUAGES.find(l => l.code === translateTo)?.flag ?? ""}</Text>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>{LANGUAGES.find(l => l.code === translateTo)?.label ?? ""}</Text>
              </>
            )}
            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.45)" />
          </Pressable>
        </View>

        {/* Mic button */}
        <View style={{ alignItems: "center", marginTop: 32, marginBottom: 24 }}>
          <Pressable
            onPress={isRecording ? stopAndTranscribe : startRecording}
            style={({ pressed }) => ({
              width: 120, height: 120, borderRadius: 60,
              backgroundColor: isRecording ? "#FE7725" : pressed ? "rgba(254,119,37,0.3)" : "#12121A",
              borderWidth: 3, borderColor: "#FE7725",
              alignItems: "center", justifyContent: "center",
              ...(isRecording ? { shadowColor: "#FE7725", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20 } : {}),
            })}
          >
            <Ionicons name={isRecording ? "stop" : "mic"} size={48} color={isRecording ? "#FFFFFF" : "#FE7725"} />
          </Pressable>
          <Text style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}>
            {isRecording ? "Tap to stop" : "Tap to record"}
          </Text>
        </View>

        {/* Upload button */}
        <View style={{ alignItems: "center", marginBottom: 20 }}>
          <Pressable
            onPress={pickAndTranscribe}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 8,
              paddingHorizontal: 20, paddingVertical: 10,
              borderRadius: 20, borderWidth: 1,
              borderColor: pressed ? "#FE7725" : "rgba(255,255,255,0.2)",
              backgroundColor: pressed ? "rgba(254,119,37,0.1)" : "transparent",
            })}
          >
            <Ionicons name="cloud-upload-outline" size={18} color="rgba(255,255,255,0.6)" />
            <Text style={{ fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.6)" }}>Upload audio file</Text>
          </Pressable>
          <View style={{ height: 8 }} />
          <Pressable
            onPress={pickVideoAndTranscribe}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 8,
              paddingHorizontal: 20, paddingVertical: 10,
              borderRadius: 20, borderWidth: 1,
              borderColor: pressed ? "#FE7725" : "rgba(255,255,255,0.2)",
              backgroundColor: pressed ? "rgba(254,119,37,0.1)" : "transparent",
            })}
          >
            <Ionicons name="videocam-outline" size={18} color="rgba(255,255,255,0.6)" />
            <Text style={{ fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.6)" }}>Upload video file</Text>
          </Pressable>
        </View>

        {/* YouTube URL */}
        <View style={{ marginBottom: 16, gap: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.8 }}>YOUTUBE URL</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={{ flex: 1, backgroundColor: "#12121A", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 8, color: "#FFFFFF", fontSize: 13, paddingHorizontal: 10, paddingVertical: 8 }}
              value={youtubeUrl}
              onChangeText={setYoutubeUrl}
              placeholder="https://youtube.com/watch?v=..."
              placeholderTextColor="rgba(255,255,255,0.18)"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={transcribeYoutube}
            />
            <Pressable
              onPress={transcribeYoutube}
              style={({ pressed }) => ({
                backgroundColor: pressed ? "#FE7725" : "rgba(254,119,37,0.15)",
                borderRadius: 8, paddingHorizontal: 12, justifyContent: "center",
                borderWidth: 1, borderColor: "#FE7725",
              })}
            >
              <Ionicons name="logo-youtube" size={20} color="#FE7725" />
            </Pressable>
          </View>
        </View>

        {/* Status */}
        <StatusPill msg={status.msg} type={status.type} />

        {/* Transcript & Translation */}
        {transcript !== "" && (
          <View style={{ marginTop: 16, backgroundColor: "#12121A", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 14, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.8 }}>TRANSCRIPT</Text>
              <Pressable onPress={async () => { await Clipboard.setStringAsync(transcript); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} hitSlop={8}>
                <Ionicons name="copy-outline" size={16} color="rgba(255,255,255,0.45)" />
              </Pressable>
            </View>
            {fileName && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="document-outline" size={14} color="rgba(255,255,255,0.35)" />
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{fileName}</Text>
              </View>
            )}
            <Text style={{ fontSize: 15, color: "#FFFFFF", lineHeight: 22 }} selectable>{transcript}</Text>

            {translation !== "" && (
              <>
                <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 4 }} />
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.8 }}>TRANSLATION</Text>
                  <Pressable onPress={async () => { await Clipboard.setStringAsync(translation); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} hitSlop={8}>
                    <Ionicons name="copy-outline" size={16} color="rgba(255,255,255,0.45)" />
                  </Pressable>
                </View>
                <Text style={{ fontSize: 15, color: "#FE7725", lineHeight: 22 }} selectable>{translation}</Text>
              </>
            )}

            <Pressable onPress={copyAll} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#12121A", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingVertical: 12, marginTop: 4 }}>
              <Ionicons name="copy-outline" size={18} color="#FE7725" />
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#FE7725" }}>Copy</Text>
            </Pressable>

            <Pressable onPress={() => onUseInTranslator(translation || transcript)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(232,118,26,0.15)", borderRadius: 10, borderWidth: 1, borderColor: "#FE7725", paddingVertical: 12 }}>
              <Ionicons name="language-outline" size={18} color="#FE7725" />
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#FE7725" }}>Use in Translator</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <LangPickerModal visible={showAudioLangPicker} selected={audioLang} onSelect={setAudioLang} onClose={() => setShowAudioLangPicker(false)} />

      {/* Translate-to picker with "No translation" option */}
      <Modal visible={showTranslatePicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTranslatePicker(false)}>
        <View style={{ flex: 1, backgroundColor: "#0A0A0F" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>Translate To</Text>
            <Pressable onPress={() => setShowTranslatePicker(false)} style={{ backgroundColor: "#FE7725", paddingHorizontal: 16, paddingVertical: 7, borderRadius: 16 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={[{ code: "none", label: "No translation", flag: "" }, ...LANGUAGES]}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }, item.code === translateTo && { backgroundColor: "rgba(232,118,26,0.15)" }]}
                onPress={() => { setTranslateTo(item.code); setShowTranslatePicker(false); }}
              >
                {item.code === "none" ? (
                  <Ionicons name="remove-circle-outline" size={20} color="rgba(255,255,255,0.45)" />
                ) : (
                  <Text style={{ fontSize: 20 }}>{item.flag}</Text>
                )}
                <Text style={[{ flex: 1, fontSize: 15, fontWeight: "500", color: "rgba(255,255,255,0.45)" }, item.code === translateTo && { color: "#FE7725", fontWeight: "700" }]}>
                  {item.label}
                </Text>
                {item.code === translateTo && <Ionicons name="checkmark" size={18} color="#FE7725" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function AppEntry() {
  const [started, setStarted] = useState(false);
  const [transcribeMode, setTranscribeMode] = useState(false);
  const [myVoiceMode, setMyVoiceMode] = useState(false);
  const [singleText, setSingleText] = useState("");
  const [myVoice, setMyVoice] = useState<MyVoice | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);

  useEffect(() => { getMyVoice().then(setMyVoice); }, []);
  useEffect(() => { if (started) getMyVoice().then(setMyVoice); }, [started]);
  useEffect(() => {
    AsyncStorage.getItem("disclaimer_accepted_v2").then(val => {
      setDisclaimerChecked(true);
      if (val !== "true") setShowDisclaimer(true);
    });
  }, []);

  const acceptDisclaimer = useCallback(async () => {
    await AsyncStorage.setItem("disclaimer_accepted_v2", "true");
    setShowDisclaimer(false);
  }, []);

  if (!started) {
    return (
      <>
      <SplashScreen
        onTranslate={() => setStarted(true)}
        onTranscribe={() => { setStarted(true); setTranscribeMode(true); }}
        onMyVoice={() => { setStarted(true); setMyVoiceMode(true); }}
      />
      {showDisclaimer && (
        <Modal visible animationType="fade" transparent>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
            <View style={{ backgroundColor: "#12121A", borderRadius: 16, padding: 24, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#FFFFFF", textAlign: "center", marginBottom: 16 }}>Disclaimer</Text>
              <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 22, textAlign: "center", marginBottom: 24 }}>
                Kanjin uses AI-powered voice cloning and translation. By using this app you agree that: recordings are processed securely, cloned voices are for personal use only, and VALT AI Inc. is not responsible for misuse of generated audio.
              </Text>
              <Pressable onPress={acceptDisclaimer} style={{ backgroundColor: "#FE7725", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1 }}>I Agree</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
      </>
    );
  }

  if (myVoiceMode) {
    return (
      <MyVoiceScreen onBack={() => { setStarted(false); setMyVoiceMode(false); getMyVoice().then(setMyVoice); }} />
    );
  }

  if (transcribeMode) {
    return (
      <TranscribeScreen
        onBack={() => { setStarted(false); setTranscribeMode(false); }}
        onUseInTranslator={(text) => { setSingleText(text); setTranscribeMode(false); }}
      />
    );
  }

  return <HomeScreen singleText={singleText} setSingleText={setSingleText} onBack={() => setStarted(false)} myVoice={myVoice} />;
}

function HomeScreen({ singleText, setSingleText, onBack, myVoice }: { singleText: string; setSingleText: (t: string) => void; onBack: () => void; myVoice: MyVoice | null }) {
  const [isDark, setIsDark] = useState(true);
  const c = isDark ? DARK : LIGHT;
  const theme = useMemo(() => ({ c, isDark }), [isDark]);

  const [activeTab, setActiveTab] = useState<"single"|"batch">("single");

  const [singleMode, setSingleMode] = useState<"translate"|"speak">("translate");
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("");
  const [speakLang, setSpeakLang] = useState("ja");
  const [singleTranslation, setSingleTranslation] = useState("");
  const [singleStatus, setSingleStatus] = useState<{msg:string;type:"idle"|"active"|"success"|"error"}>({ msg: "Paste text and hit Generate", type: "idle" });
  const [singleAudioUri, setSingleAudioUri] = useState<string|null>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [showSpeakPicker, setShowSpeakPicker] = useState(false);
  const singleSoundRef = useRef<Audio.Sound|null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceStability, setVoiceStability] = useState(0.35);
  const [voiceStyle, setVoiceStyle] = useState(0.25);

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

  async function stopAudio() {
    try {
      if (singleSoundRef.current) { await singleSoundRef.current.stopAsync(); await singleSoundRef.current.unloadAsync(); singleSoundRef.current = null; }
    } catch {}
    setIsPlaying(false);
  }

  async function playAudio(uri: string) {
    try {
      await stopAudio();
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 1.0 });
      singleSoundRef.current = sound;
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((st: any) => {
        if (st?.isLoaded && st?.didJustFinish) { setIsPlaying(false); sound.unloadAsync(); singleSoundRef.current = null; }
      });
    } catch (e) { console.error("Playback error:", e); setIsPlaying(false); }
  }

  const runSingle = useCallback(async () => {
    const text = singleText.trim();
    if (!text) { setSingleStatus({ msg: "Please enter some text first", type: "error" }); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSingleAudioUri(null); setSingleTranslation("");
    try {
      let audioUri: string;
      if (singleMode === "translate") {
        if (!targetLang) { Alert.alert("No Target Language", "Please select a target language first."); return; }
        setSingleStatus({ msg: "Translating & generating audio...", type: "active" });
        let result: { translation: string; audioUri: string };
        if (targetLang === "my-voice" && myVoice?.voiceId) {
          const overrides = myVoice.settings ? { speed: myVoice.settings.speed, stability: myVoice.settings.stability, style: myVoice.settings.style } : undefined;
          result = await translateAndSpeakWithMyVoice(text, sourceLang, myVoice.voiceId, overrides);
        } else {
          result = await translateAndSpeak(text, sourceLang, targetLang);
        }
        setSingleTranslation(result.translation);
        audioUri = result.audioUri;
      } else {
        setSingleStatus({ msg: "Generating audio...", type: "active" });
        const lang = speakLang === "my-voice" ? "en" : speakLang;
        const overrides: VoiceOverrides = speakLang === "my-voice" && myVoice?.settings
          ? { speed: myVoice.settings.speed, stability: myVoice.settings.stability, style: myVoice.settings.style }
          : lang === "ja" ? { stability: voiceStability, style: voiceStyle, speed: voiceSpeed } : { speed: voiceSpeed };
        const customId = speakLang === "my-voice" ? myVoice?.voiceId : undefined;
        audioUri = await speakText(text, lang, overrides, customId);
      }
      setSingleAudioUri(audioUri);
      setSingleStatus({ msg: "Done — tap Play or Share", type: "success" });
      await playAudio(audioUri);
    } catch (err: any) { setSingleStatus({ msg: "Error: " + err.message, type: "error" }); }
  }, [singleText, singleMode, sourceLang, targetLang, speakLang, voiceSpeed, voiceStability, voiceStyle, myVoice]);

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
          let result: { translation: string; audioUri: string };
          if (batchTargetLang === "my-voice" && myVoice?.voiceId) {
            const overrides = myVoice.settings ? { speed: myVoice.settings.speed, stability: myVoice.settings.stability, style: myVoice.settings.style } : undefined;
            result = await translateAndSpeakWithMyVoice(text, batchSourceLang, myVoice.voiceId, overrides);
          } else {
            result = await translateAndSpeak(text, batchSourceLang, batchTargetLang);
          }
          audioUri = result.audioUri;
        } else {
          const lang = batchSpeakLang === "my-voice" ? "en" : batchSpeakLang;
          const overrides: VoiceOverrides = batchSpeakLang === "my-voice" && myVoice?.settings
            ? { speed: myVoice.settings.speed, stability: myVoice.settings.stability, style: myVoice.settings.style }
            : lang === "ja" ? { stability: voiceStability, style: voiceStyle, speed: voiceSpeed } : { speed: voiceSpeed };
          const customId = batchSpeakLang === "my-voice" ? myVoice?.voiceId : undefined;
          audioUri = await speakText(text, lang, overrides, customId);
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
        <View style={{ flex: 1, paddingLeft: 16 }}><Pressable onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Ionicons name="arrow-back" size={22} color={c.text} /><Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>Back</Text></Pressable></View>
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
                <LangButton code={speakLang} onPress={() => setShowSpeakPicker(true)} myVoiceName={myVoice?.name} />
              </View>
            )}

            {singleMode === "translate" && targetLang !== "" && (
              <View style={{ backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 10, gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, letterSpacing: 0.8 }}>VOICE SETTINGS</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 11, color: c.textMuted, width: 55 }}>Speed</Text>
                  <Slider style={{ flex: 1, height: 28 }} minimumValue={0.5} maximumValue={2.0} step={0.05} value={voiceSpeed} onValueChange={setVoiceSpeed} minimumTrackTintColor={c.orange} maximumTrackTintColor={c.border} thumbTintColor={c.orange} />
                  <Text style={{ fontSize: 11, color: c.text, width: 32, textAlign: "right" }}>{voiceSpeed.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 11, color: c.textMuted, width: 55 }}>Stability</Text>
                  <Slider style={{ flex: 1, height: 28 }} minimumValue={0.0} maximumValue={1.0} step={0.05} value={voiceStability} onValueChange={setVoiceStability} minimumTrackTintColor={c.orange} maximumTrackTintColor={c.border} thumbTintColor={c.orange} />
                  <Text style={{ fontSize: 11, color: c.text, width: 32, textAlign: "right" }}>{voiceStability.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 11, color: c.textMuted, width: 55 }}>Style</Text>
                  <Slider style={{ flex: 1, height: 28 }} minimumValue={0.0} maximumValue={1.0} step={0.05} value={voiceStyle} onValueChange={setVoiceStyle} minimumTrackTintColor={c.orange} maximumTrackTintColor={c.border} thumbTintColor={c.orange} />
                  <Text style={{ fontSize: 11, color: c.text, width: 32, textAlign: "right" }}>{voiceStyle.toFixed(2)}</Text>
                </View>
              </View>
            )}

            {singleMode === "speak" && (
              <View style={{ backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 10, gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, letterSpacing: 0.8 }}>VOICE SETTINGS</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 11, color: c.textMuted, width: 55 }}>Speed</Text>
                  <Slider style={{ flex: 1, height: 28 }} minimumValue={0.5} maximumValue={2.0} step={0.05} value={voiceSpeed} onValueChange={setVoiceSpeed} minimumTrackTintColor={c.orange} maximumTrackTintColor={c.border} thumbTintColor={c.orange} />
                  <Text style={{ fontSize: 11, color: c.text, width: 32, textAlign: "right" }}>{voiceSpeed.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 11, color: c.textMuted, width: 55 }}>Stability</Text>
                  <Slider style={{ flex: 1, height: 28 }} minimumValue={0.0} maximumValue={1.0} step={0.05} value={voiceStability} onValueChange={setVoiceStability} minimumTrackTintColor={c.orange} maximumTrackTintColor={c.border} thumbTintColor={c.orange} />
                  <Text style={{ fontSize: 11, color: c.text, width: 32, textAlign: "right" }}>{voiceStability.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 11, color: c.textMuted, width: 55 }}>Style</Text>
                  <Slider style={{ flex: 1, height: 28 }} minimumValue={0.0} maximumValue={1.0} step={0.05} value={voiceStyle} onValueChange={setVoiceStyle} minimumTrackTintColor={c.orange} maximumTrackTintColor={c.border} thumbTintColor={c.orange} />
                  <Text style={{ fontSize: 11, color: c.text, width: 32, textAlign: "right" }}>{voiceStyle.toFixed(2)}</Text>
                </View>
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
                {isPlaying ? (
                  <Pressable style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: c.red + "20", borderRadius: 8, borderWidth: 1, borderColor: c.red, paddingVertical: 10 }} onPress={stopAudio}>
                    <Ionicons name="stop" size={20} color={c.red} />
                    <Text style={{ fontSize: 13, fontWeight: "600", color: c.red }}>Stop</Text>
                  </Pressable>
                ) : (
                  <Pressable style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingVertical: 10 }} onPress={() => playAudio(singleAudioUri)}>
                    <Ionicons name="play" size={20} color={c.text} />
                    <Text style={{ fontSize: 13, fontWeight: "600", color: c.text }}>Play</Text>
                  </Pressable>
                )}
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
                <LangButton code={batchSpeakLang} onPress={() => setShowBatchSpeakPicker(true)} myVoiceName={myVoice?.name} />
              </View>
            )}

            {batchMode === "speak" && (
              <View style={{ backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 10, gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, letterSpacing: 0.8 }}>VOICE SETTINGS</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 11, color: c.textMuted, width: 55 }}>Speed</Text>
                  <Slider style={{ flex: 1, height: 28 }} minimumValue={0.5} maximumValue={2.0} step={0.05} value={voiceSpeed} onValueChange={setVoiceSpeed} minimumTrackTintColor={c.orange} maximumTrackTintColor={c.border} thumbTintColor={c.orange} />
                  <Text style={{ fontSize: 11, color: c.text, width: 32, textAlign: "right" }}>{voiceSpeed.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 11, color: c.textMuted, width: 55 }}>Stability</Text>
                  <Slider style={{ flex: 1, height: 28 }} minimumValue={0.0} maximumValue={1.0} step={0.05} value={voiceStability} onValueChange={setVoiceStability} minimumTrackTintColor={c.orange} maximumTrackTintColor={c.border} thumbTintColor={c.orange} />
                  <Text style={{ fontSize: 11, color: c.text, width: 32, textAlign: "right" }}>{voiceStability.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 11, color: c.textMuted, width: 55 }}>Style</Text>
                  <Slider style={{ flex: 1, height: 28 }} minimumValue={0.0} maximumValue={1.0} step={0.05} value={voiceStyle} onValueChange={setVoiceStyle} minimumTrackTintColor={c.orange} maximumTrackTintColor={c.border} thumbTintColor={c.orange} />
                  <Text style={{ fontSize: 11, color: c.text, width: 32, textAlign: "right" }}>{voiceStyle.toFixed(2)}</Text>
                </View>
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

      <LangPickerModal visible={showSourcePicker} selected={sourceLang} onSelect={setSourceLang} onClose={() => setShowSourcePicker(false)} myVoice={myVoice} />
      <LangPickerModal visible={showTargetPicker} selected={targetLang} onSelect={setTargetLang} onClose={() => setShowTargetPicker(false)} myVoice={myVoice} />
      <LangPickerModal visible={showSpeakPicker} selected={speakLang} onSelect={setSpeakLang} onClose={() => setShowSpeakPicker(false)} myVoice={myVoice} />
      <LangPickerModal visible={showBatchSourcePicker} selected={batchSourceLang} onSelect={setBatchSourceLang} onClose={() => setShowBatchSourcePicker(false)} myVoice={myVoice} />
      <LangPickerModal visible={showBatchTargetPicker} selected={batchTargetLang} onSelect={setBatchTargetLang} onClose={() => setShowBatchTargetPicker(false)} myVoice={myVoice} />
      <LangPickerModal visible={showBatchSpeakPicker} selected={batchSpeakLang} onSelect={setBatchSpeakLang} onClose={() => setShowBatchSpeakPicker(false)} myVoice={myVoice} />
    </View>
    </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
    </SafeAreaView>
    </ThemeCtx.Provider>
  );
}
