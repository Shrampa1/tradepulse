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
import { parseAppointmentFromVoice } from "@/lib/api";

type ParsedAppointment = { title: string; date: string; time: string; location: string | null };

type Props = {
  onParsed: (appointment: ParsedAppointment) => void;
};

// Same recording flow as estimates' VoiceCapture (fetch + FileReader works
// for both a native file:// uri and a web blob: uri), but hands the result to
// parse-appointment instead of parse-line-items.
export function VoiceScheduleCapture({ onParsed }: Props) {
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

      const { appointment } = await parseAppointmentFromVoice({
        audioBase64,
        audioMimeType: "audio/m4a",
      });
      onParsed(appointment);
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
            ? "Understanding the job…"
            : "Speak a job to schedule"}
      </Text>
      {error && <Text className="text-center text-xs text-danger">{error}</Text>}
    </View>
  );
}
