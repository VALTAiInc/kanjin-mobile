import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Keyboard, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { COLORS } from "../constants/config";
import { cloneVoice } from "../utils/api";
import { saveMyVoice } from "../utils/voice-storage";
import Slider from "@react-native-community/slider";

const c = COLORS;

const QUALITY_OPTIONS = [
  { key: "good" as const, label: "Good", target: 30, desc: "~30 seconds" },
  { key: "better" as const, label: "Better", target: 90, desc: "1-2 minutes" },
  { key: "best" as const, label: "Best", target: 180, desc: "3+ minutes" },
];

const SCRIPT = `Hello! My name is your name, and I'm recording this to create my own voice. Let's get started, shall we?

Have you ever wondered what it would be like to speak another language fluently? I think about that all the time. Imagine walking into a room and being able to talk to anyone... in any language. That's the goal, isn't it?

Today is a great day. The sun is out, the coffee is hot, and I'm feeling good about this. Are you ready? Because I'm ready!

Let me tell you something important. Communication is everything. Without it, we have nothing. But with it... we can change the world. Pretty powerful, right?

Sometimes I ask myself — what's holding me back? Is it fear? Is it time? Or is it just not knowing where to start? Those are fair questions. And honestly, I don't always have the answers.

Wait — did you hear that? No? Good. Because there's nothing to hear. Just my voice, loud and clear, coming through perfectly.

I love working with technology. Building things, solving problems, making something out of nothing — that excites me! Every single day is a chance to create something new.

So what do we do next? We keep going. We don't stop. Not now, not ever. Because the best work is always just ahead of us.

Thank you for listening. That's it — short, simple, and hopefully exactly what we needed!`;

export default function MyVoiceScreen({ onBack }: { onBack: () => void }) {
  const [quality, setQuality] = useState<"good" | "better" | "best">("better");
  const [voiceName, setVoiceName] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ uri: string; name: string } | null>(null);
  const [cloning, setCloning] = useState(false);
  const [status, setStatus] = useState<{ msg: string; type: "idle" | "active" | "success" | "error" }>({ msg: "Record or upload audio of your voice", type: "idle" });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceStability, setVoiceStability] = useState(0.75);
  const [voiceStyle, setVoiceStyle] = useState(0.35);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const targetSeconds = QUALITY_OPTIONS.find(q => q.key === quality)!.target;

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setUploadedFile(null);
      setRecordedUri(null);
      setRecordingSeconds(0);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { setStatus({ msg: "Microphone permission denied", type: "error" }); return; }
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
      setStatus({ msg: "Recording... read the script below", type: "active" });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch (e: any) {
      setStatus({ msg: "Failed to start: " + e.message, type: "error" });
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (uri) {
        setRecordedUri(uri);
        setStatus({ msg: `Recorded ${formatTime(recordingSeconds)}`, type: "success" });
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e: any) {
      setStatus({ msg: "Error stopping: " + e.message, type: "error" });
    }
  }, [recording, recordingSeconds]);

  const resetRecording = useCallback(() => {
    setRecordedUri(null);
    setRecordingSeconds(0);
    setStatus({ msg: "Record or upload audio of your voice", type: "idle" });
  }, []);

  const pickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/mpeg", "audio/wav", "audio/x-m4a", "audio/mp4", "audio/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setUploadedFile({ uri: asset.uri, name: asset.name });
      setRecordedUri(null);
      setRecordingSeconds(0);
      setStatus({ msg: `File selected: ${asset.name}`, type: "success" });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e: any) {
      setStatus({ msg: "Error: " + e.message, type: "error" });
    }
  }, []);

  const handleClone = useCallback(async () => {
    const audioUri = recordedUri || uploadedFile?.uri;
    if (!audioUri) { setStatus({ msg: "Please record or upload audio first", type: "error" }); return; }
    const name = voiceName.trim();
    if (!name) { Alert.alert("Voice Name Required", "Please enter a voice name first."); return; }
    setCloning(true);
    setStatus({ msg: "Cloning your voice...", type: "active" });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const voiceId = await cloneVoice(audioUri, name);
      await saveMyVoice(voiceId, name, { speed: voiceSpeed, stability: voiceStability, style: voiceStyle });
      setStatus({ msg: "Voice cloned successfully!", type: "success" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Voice Cloned!", `"${name}" is now available in the voice picker.`, [
        { text: "OK", onPress: () => onBack() },
      ]);
    } catch (e: any) {
      setStatus({ msg: "Clone failed: " + e.message, type: "error" });
    } finally {
      setCloning(false);
    }
  }, [recordedUri, uploadedFile, voiceName, onBack, voiceSpeed, voiceStability, voiceStyle]);

  const progress = Math.min(recordingSeconds / targetSeconds, 1);
  const audioReady = !!(recordedUri || uploadedFile);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Pressable onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="arrow-back" size={22} color={c.text} />
                <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>Back</Text>
              </Pressable>
              <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: c.text }}>My Voice</Text>
              <View style={{ width: 60 }} />
            </View>

            {/* Quality Selector — sticky below header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>RECORDING QUALITY</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                {QUALITY_OPTIONS.map(opt => (
                  <Pressable
                    key={opt.key}
                    onPress={() => setQuality(opt.key)}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
                      backgroundColor: quality === opt.key ? c.orangeDim : c.surface,
                      borderWidth: 1, borderColor: quality === opt.key ? c.orange : c.border,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: quality === opt.key ? c.orange : c.text }}>{opt.label}</Text>
                    <Text style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{opt.desc}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }} keyboardShouldPersistTaps="handled" onScrollBeginDrag={() => Keyboard.dismiss()}>
              {/* Voice Name — at top so keyboard doesn't push quality off screen */}
              <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 16 }}>VOICE NAME</Text>
              <TextInput
                style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 10, color: c.text, fontSize: 14, padding: 12, marginTop: 6 }}
                value={voiceName}
                onChangeText={setVoiceName}
                placeholder="e.g. Dave's Voice"
                placeholderTextColor={c.textDim}
                maxLength={100}
              />

              {/* Advanced Settings */}
              <Pressable
                onPress={() => setShowAdvanced(v => !v)}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 14 }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: c.textMuted }}>Voice Settings</Text>
                <Ionicons name={showAdvanced ? "chevron-down" : "chevron-forward"} size={16} color={c.textMuted} />
              </Pressable>
              {showAdvanced && (
                <View style={{ backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 10, marginTop: 6, gap: 6 }}>
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

              {/* Recording Section */}
              <Text style={{ fontSize: 11, fontWeight: "600", color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 20 }}>RECORD YOUR VOICE</Text>
              <View style={{ backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 16, marginTop: 6, alignItems: "center", gap: 12 }}>
                {/* Timer */}
                <Text style={{ fontSize: 36, fontWeight: "300", color: isRecording ? c.orange : c.text, fontVariant: ["tabular-nums"] }}>
                  {formatTime(recordingSeconds)}
                </Text>

                {/* Progress bar */}
                <View style={{ width: "100%", height: 6, backgroundColor: c.surface2, borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ width: `${progress * 100}%`, height: "100%", backgroundColor: progress >= 1 ? c.teal : c.orange, borderRadius: 3 }} />
                </View>
                <Text style={{ fontSize: 10, color: c.textMuted }}>
                  {recordingSeconds > 0 ? `${formatTime(recordingSeconds)} / ${formatTime(targetSeconds)} target` : `Target: ${formatTime(targetSeconds)}`}
                </Text>

                {/* Buttons */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  {!isRecording ? (
                    <Pressable
                      onPress={startRecording}
                      style={({ pressed }) => ({
                        width: 64, height: 64, borderRadius: 32, backgroundColor: pressed ? c.orangeDim : c.surface2,
                        borderWidth: 2, borderColor: c.orange, alignItems: "center", justifyContent: "center",
                      })}
                    >
                      <Ionicons name="mic" size={28} color={c.orange} />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={stopRecording}
                      style={{
                        width: 64, height: 64, borderRadius: 32, backgroundColor: c.orange,
                        alignItems: "center", justifyContent: "center",
                        shadowColor: c.orange, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16,
                      }}
                    >
                      <Ionicons name="stop" size={28} color="#fff" />
                    </Pressable>
                  )}
                  {recordedUri && !isRecording && (
                    <Pressable
                      onPress={resetRecording}
                      style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}
                    >
                      <Ionicons name="refresh" size={24} color={c.red} />
                    </Pressable>
                  )}
                </View>

                {/* Script — inside recording box so it's visible while recording */}
                <View style={{ width: "100%", height: 1, backgroundColor: c.border }} />
                <Text style={{ fontSize: 10, color: c.textMuted, alignSelf: "flex-start" }}>Read this aloud while recording</Text>
                <View style={{ width: "100%", height: 160, backgroundColor: c.surface2, borderRadius: 8, padding: 10 }}>
                  <ScrollView showsVerticalScrollIndicator nestedScrollEnabled={true}>
                    <Text style={{ fontSize: 13, color: c.text, lineHeight: 20 }} selectable>{voiceName.trim() ? SCRIPT.replace("your name", voiceName.trim()) : SCRIPT}</Text>
                  </ScrollView>
                </View>
              </View>

              {/* Upload */}
              <Pressable
                onPress={pickFile}
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                  paddingVertical: 12, marginTop: 12, borderRadius: 10, borderWidth: 1,
                  borderColor: pressed ? c.orange : c.border, backgroundColor: pressed ? c.orangeDim : "transparent",
                })}
              >
                <Ionicons name="cloud-upload-outline" size={18} color={c.textMuted} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: c.textMuted }}>Upload audio file (MP3, WAV, M4A)</Text>
              </Pressable>
              {uploadedFile && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Ionicons name="document-outline" size={14} color={c.teal} />
                  <Text style={{ fontSize: 12, color: c.teal }}>{uploadedFile.name}</Text>
                </View>
              )}

              {/* Clone Button */}
              <Pressable
                onPress={handleClone}
                disabled={cloning}
                style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                  backgroundColor: cloning ? c.surface2 : c.orange,
                  borderRadius: 12, paddingVertical: 14, marginTop: 16,
                  opacity: cloning ? 0.5 : 1,
                }}
              >
                {cloning ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="sparkles" size={20} color="#fff" />
                )}
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Clone My Voice</Text>
              </Pressable>

              {/* Status */}
              <View style={{
                flexDirection: "row", alignItems: "center", padding: 9, marginTop: 10,
                backgroundColor: c.surface, borderRadius: 8, borderWidth: 1,
                borderColor: status.type === "idle" ? c.border : status.type === "active" ? c.orange + "66" : status.type === "success" ? c.teal + "66" : c.red + "66",
              }}>
                {status.type === "active" && <ActivityIndicator size="small" color={c.orange} style={{ marginRight: 8 }} />}
                <Text style={{ fontSize: 12, flex: 1, color: status.type === "idle" ? c.textMuted : status.type === "active" ? c.orange : status.type === "success" ? c.teal : c.red }}>{status.msg}</Text>
              </View>

            </ScrollView>
          </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
