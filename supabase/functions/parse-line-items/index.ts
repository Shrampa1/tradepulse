// Turns a voice note (transcript or raw audio) or a job-site photo into
// structured estimate line items using Google's Gemini API. Runs server-side
// because it needs GEMINI_API_KEY, which must never ship inside the mobile
// app. Gemini handles audio and images natively in one call, so there's no
// separate transcription step (unlike Whisper + a text model).
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { getUserId } from "../_shared/supabase-admin.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are an assistant for tradespeople (contractors, landscapers, cleaners) \
turning a description of completed or planned work into estimate line items.
Rules:
- If given audio, first understand what the speaker describes doing (or planning to do), then extract line items from it — don't just transcribe.
- Infer a reasonable quantity (default 1) and a reasonable US market unit price per item if the input doesn't give one explicitly.
- Split distinct tasks/materials into separate line items.
- Keep descriptions short and client-facing (e.g. "Trim front hedges", "Haul away debris").
- If given a job-site photo, suggest line items for the work implied by it (e.g. debris to haul, lawn to mow, damage to repair).
- If you cannot identify any billable work, return an empty lineItems array.`;

const LINE_ITEMS_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    lineItems: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          description: { type: "STRING" },
          quantity: { type: "NUMBER" },
          unit_price: { type: "NUMBER" },
        },
        required: ["description", "quantity", "unit_price"],
      },
    },
  },
  required: ["lineItems"],
};

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
  if (!userId) return json({ error: "Unauthorized" }, 401);

  try {
    const body = (await req.json()) as RequestBody;

    if (body.mode === "voice") {
      if (!body.transcript && !body.audioBase64) {
        return json({ error: "transcript or audioBase64 is required." }, 422);
      }
      const parts = body.audioBase64
        ? [
            { text: "Here is a voice note describing the work. Extract line items from it." },
            { inline_data: { mime_type: body.audioMimeType ?? "audio/m4a", data: body.audioBase64 } },
          ]
        : [{ text: body.transcript! }];
      const lineItems = await callGemini(parts);
      return json({ lineItems });
    }

    if (body.mode === "photo") {
      if (!body.imageBase64) return json({ error: "imageBase64 is required." }, 422);
      const parts = [
        { text: "Suggest line items for the work implied by this job site photo." },
        { inline_data: { mime_type: body.imageMimeType ?? "image/jpeg", data: body.imageBase64 } },
      ];
      const lineItems = await callGemini(parts);
      return json({ lineItems });
    }

    return json({ error: "mode must be 'voice' or 'photo'." }, 422);
  } catch (error) {
    console.error("parse-line-items error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

async function callGemini(parts: Array<Record<string, unknown>>) {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: LINE_ITEMS_RESPONSE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return parseLineItemsJson(text);
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
