// Thin wrappers around the Supabase Edge Functions that need a secret key
// (OpenAI, Stripe) and therefore can't run on-device. Everything else in the
// app talks to Postgres directly via `supabase` and relies on RLS.
import { supabase } from "@/lib/supabase";
import type { DraftLineItem } from "@/types/database";

export class ApiError extends Error {}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new ApiError(error.message);
  return data as T;
}

export async function parseLineItemsFromVoice(params: {
  transcript?: string;
  audioBase64?: string;
  audioMimeType?: string;
}) {
  return invoke<{ lineItems: DraftLineItem[] }>("parse-line-items", {
    mode: "voice",
    ...params,
  });
}

export async function parseLineItemsFromPhoto(params: { imageBase64: string; imageMimeType: string }) {
  return invoke<{ lineItems: DraftLineItem[] }>("parse-line-items", {
    mode: "photo",
    ...params,
  });
}

export async function sendEstimateToClient(estimateId: string) {
  return invoke<{ publicUrl: string }>("send-estimate", { estimateId });
}
