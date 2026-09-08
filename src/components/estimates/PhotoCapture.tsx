import { useState } from "react";
import { Image, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImagePlus } from "lucide-react-native";
import { Pressable } from "react-native";
import { parseLineItemsFromPhoto } from "@/lib/api";
import type { DraftLineItem } from "@/types/database";

type Props = {
  onParsed: (items: DraftLineItem[]) => void;
};

// Lets the tradesperson snap or pick a job-site photo; GPT-4o vision
// suggests standard task descriptions and pricing categories from it.
export function PhotoCapture({ onParsed }: Props) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePicked(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPreviewUri(asset.uri);
    setError(null);
    setIsProcessing(true);
    try {
      if (!asset.base64) throw new Error("Could not read the selected photo.");
      const { lineItems } = await parseLineItemsFromPhoto({
        imageBase64: asset.base64,
        imageMimeType: asset.mimeType ?? "image/jpeg",
      });
      onParsed(lineItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze the photo.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Camera permission is required to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true });
    await handlePicked(result);
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library permission is required to attach a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, base64: true });
    await handlePicked(result);
  }

  return (
    <View className="gap-3 rounded-2xl border border-border bg-surface p-5">
      {previewUri && (
        <Image source={{ uri: previewUri }} className="h-40 w-full rounded-xl" resizeMode="cover" />
      )}

      <View className="flex-row gap-3">
        <ActionButton label="Take photo" Icon={Camera} onPress={takePhoto} disabled={isProcessing} />
        <ActionButton label="Choose photo" Icon={ImagePlus} onPress={pickPhoto} disabled={isProcessing} />
      </View>

      {isProcessing && <Text className="text-center text-sm text-subtle">Analyzing job site…</Text>}
      {error && <Text className="text-center text-xs text-danger">{error}</Text>}
    </View>
  );
}

function ActionButton({
  label,
  Icon,
  onPress,
  disabled,
}: {
  label: string;
  Icon: typeof Camera;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border py-3 ${
        disabled ? "opacity-50" : "active:bg-muted"
      }`}
    >
      <Icon size={16} color="#2563eb" />
      <Text className="text-sm font-semibold text-brand-600">{label}</Text>
    </Pressable>
  );
}
