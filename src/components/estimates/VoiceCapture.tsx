import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { Mic, Square } from "lucide-react-native";
import { Pressable } from "react-native";
import { parseLineItemsFromVoice } from "@/lib/api";
import type { DraftLineItem } from "@/types/database";

type Props = {
  onParsed: (items: DraftLineItem[]) => void;
};

// Records a short voice note describing the work done, uploads it for
// Whisper transcription + GPT parsing, and hands back structured line items.
export function VoiceCapture({ onParsed }: Props) {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);

  async function startRecording() {
    setError(null);
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      setError("Microphone permission is required to record a voice note.");
      return;
    }

    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    recordingRef.current = recording;
    setState("recording");
  }

  async function stopRecording() {
    const recording = recordingRef.current;
    if (!recording) return;

    setState("processing");
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error("Recording failed — no audio file was produced.");

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { lineItems } = await parseLineItemsFromVoice({
        audioBase64,
        audioMimeType: "audio/m4a",
      });
      onParsed(lineItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process the voice note.");
    } finally {
      setState("idle");
    }
  }

  return (
    <View className="items-center gap-2 rounded-2xl border border-border bg-surface p-5">
      <Pressable
        onPress={state === "recording" ? stopRecording : startRecording}
        disabled={state === "processing"}
        className={`h-16 w-16 items-center justify-center rounded-full ${
          state === "recording" ? "bg-danger" : "bg-brand-600"
        } ${state === "processing" ? "opacity-50" : ""}`}
      >
        {state === "recording" ? <Square color="#fff" size={22} /> : <Mic color="#fff" size={26} />}
      </Pressable>
      <Text className="text-sm font-medium text-ink">
        {state === "recording"
          ? "Recording… tap to stop"
          : state === "processing"
            ? "Transcribing and parsing…"
            : "Tap to describe the job"}
      </Text>
      {error && <Text className="text-center text-xs text-danger">{error}</Text>}
    </View>
  );
}
