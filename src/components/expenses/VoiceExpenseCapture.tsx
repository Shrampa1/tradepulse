import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from "expo-audio";
import { Mic, Square } from "lucide-react-native";
import { parseExpenseFromVoice } from "@/lib/api";

type ParsedExpense = { vendor: string; description: string; amount: number; occurred_at: string | null };

type Props = {
  onParsed: (expense: ParsedExpense) => void;
};

// Same recording flow as VoiceCapture/VoiceScheduleCapture, handed to
// parse-receipt's voice mode instead of its photo mode.
export function VoiceExpenseCapture({ onParsed }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [state, setState] = useState<"idle" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);

  async function startRecording() {
    setError(null);
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError("Microphone permission is required to record a voice note.");
      return;
    }

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function stopRecording() {
    setState("processing");
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("Recording failed — no audio file was produced.");

      const blob = await (await fetch(uri)).blob();
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const { expense } = await parseExpenseFromVoice({ audioBase64, audioMimeType: "audio/m4a" });
      onParsed(expense);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process the voice note.");
    } finally {
      setState("idle");
    }
  }

  const isRecording = recorderState.isRecording;

  return (
    <View className="items-center gap-2 rounded-2xl border border-border bg-surface p-5">
      <Pressable
        onPress={isRecording ? stopRecording : startRecording}
        disabled={state === "processing"}
        className={`h-14 w-14 items-center justify-center rounded-full ${
          isRecording ? "bg-danger" : "bg-brand-600"
        } ${state === "processing" ? "opacity-50" : ""}`}
      >
        {isRecording ? <Square color="#fff" size={20} /> : <Mic color="#fff" size={22} />}
      </Pressable>
      <Text className="text-sm font-medium text-ink">
        {isRecording
          ? "Recording… tap to stop"
          : state === "processing"
            ? "Understanding the expense…"
            : "Speak an expense"}
      </Text>
      {error && <Text className="text-center text-xs text-danger">{error}</Text>}
    </View>
  );
}
