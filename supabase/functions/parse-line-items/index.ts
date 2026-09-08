// Turns a voice note (transcript or raw audio) or a job-site photo into
// structured estimate line items using OpenAI. Runs server-side because it
// needs OPENAI_API_KEY, which must never ship inside the mobile app.
import OpenAI, { toFile } from "npm:openai@4";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { getUserId } from "../_shared/supabase-admin.ts";

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

const LINE_ITEMS_SYSTEM_PROMPT = `You are an assistant for tradespeople (contractors, landscapers, cleaners) \
turning a description of completed or planned work into estimate line items. \
Return STRICT JSON only, matching this shape:
{"lineItems": [{"description": string, "quantity": number, "unit_price": number}]}
Rules:
- Infer a reasonable quantity (default 1) and a reasonable US market unit price per item \
  if the input doesn't give one explicitly.
- Split distinct tasks/materials into separate line items.
- Keep descriptions short and client-facing (e.g. "Trim front hedges", "Haul away debris").
- If you cannot identify any billable work, return {"lineItems": []}.`;

type RequestBody = {
  mode: "voice" | "photo";
  transcript?: string;
  audioBase64?: string;
  audioMimeType?: string;
  imageBase64?: string;
  imageMimeType?: string;
};

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const userId = await getUserId(req);
  if (!userId) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = (await req.json()) as RequestBody;

    if (body.mode === "voice") {
      const transcript = body.transcript ?? (await transcribe(body.audioBase64, body.audioMimeType));
      if (!transcript) return json({ error: "No speech detected." }, 422);
      const lineItems = await extractLineItemsFromText(transcript);
      return json({ lineItems });
    }

    if (body.mode === "photo") {
      if (!body.imageBase64) return json({ error: "imageBase64 is required." }, 422);
      const lineItems = await extractLineItemsFromImage(body.imageBase64, body.imageMimeType ?? "image/jpeg");
      return json({ lineItems });
    }

    return json({ error: "mode must be 'voice' or 'photo'." }, 422);
  } catch (error) {
    console.error("parse-line-items error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

async function transcribe(audioBase64?: string, mimeType = "audio/m4a") {
  if (!audioBase64) return null;
  const bytes = base64ToBytes(audioBase64);
  const extension = mimeType.includes("m4a") ? "m4a" : mimeType.includes("wav") ? "wav" : "mp3";
  const file = await toFile(bytes, `voice-note.${extension}`, { type: mimeType });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });
  return transcription.text;
}

async function extractLineItemsFromText(transcript: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: LINE_ITEMS_SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ],
  });
  return parseLineItemsJson(completion.choices[0]?.message?.content);
}

async function extractLineItemsFromImage(imageBase64: string, mimeType: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: LINE_ITEMS_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Suggest line items for the work implied by this job site photo (e.g. debris to haul, lawn to mow, damage to repair).",
          },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ],
  });
  return parseLineItemsJson(completion.choices[0]?.message?.content);
}

function parseLineItemsJson(content?: string | null) {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    const rawItems = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
    return rawItems
      .filter((item: unknown): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        id: crypto.randomUUID(),
        description: String(item.description ?? "").slice(0, 200) || "Untitled item",
        quantity: toPositiveNumber(item.quantity, 1),
        unit_price: toPositiveNumber(item.unit_price, 0),
      }));
  } catch {
    return [];
  }
}

function toPositiveNumber(value: unknown, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
