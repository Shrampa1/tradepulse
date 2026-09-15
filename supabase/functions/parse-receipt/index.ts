// Turns a photo of a material receipt — or a spoken description of an
// expense — into a prefilled expense (vendor, description, amount, date)
// using Gemini. Sibling to parse-line-items — same model/env var, same
// dual voice/photo mode — but with its own prompt/schema since the output
// shape is an expense, not line items.
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { getUserId } from "../_shared/supabase-admin.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are an assistant for tradespeople (contractors, landscapers, cleaners) \
recording a job-related expense from either a photo of a receipt or a spoken description.
Rules:
- Identify the vendor/store name if mentioned or visible. If not, leave it blank.
- Identify the total amount charged (the final total, not a subtotal or a single line item).
- Write a short, client-facing description of what was purchased (e.g. "Lumber and fasteners", "Plumbing fittings").
- If a purchase date is visible or mentioned, return it as an ISO 8601 date (YYYY-MM-DD). If not, omit it.
- If you cannot determine an amount at all, return 0 for amount.`;

const RECEIPT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    vendor: { type: "STRING" },
    description: { type: "STRING" },
    amount: { type: "NUMBER" },
    occurred_at: { type: "STRING" },
  },
  required: ["vendor", "description", "amount"],
};

type RequestBody = {
  imageBase64?: string;
  imageMimeType?: string;
  transcript?: string;
  audioBase64?: string;
  audioMimeType?: string;
};

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const userId = await getUserId(req);
  if (!userId) return json({ error: "Unauthorized" }, 401);

  try {
    const body = (await req.json()) as RequestBody;

    let parts: Array<Record<string, unknown>>;
    if (body.imageBase64) {
      parts = [
        { text: "Read this receipt photo and extract the vendor, a short description, the total amount, and the date." },
        { inline_data: { mime_type: body.imageMimeType ?? "image/jpeg", data: body.imageBase64 } },
      ];
    } else if (body.audioBase64) {
      parts = [
        { text: "Here is a voice note describing an expense. Extract the expense details." },
        { inline_data: { mime_type: body.audioMimeType ?? "audio/m4a", data: body.audioBase64 } },
      ];
    } else if (body.transcript) {
      parts = [{ text: body.transcript }];
    } else {
      return json({ error: "imageBase64, audioBase64, or transcript is required." }, 422);
    }

    const expense = await callGemini(parts);
    return json({ expense });
  } catch (error) {
    console.error("parse-receipt error", error);
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
        responseSchema: RECEIPT_RESPONSE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return parseReceiptJson(text);
}

function parseReceiptJson(content?: string | null) {
  if (!content) return { vendor: "", description: "", amount: 0, occurred_at: null };
  try {
    const parsed = JSON.parse(content);
    return {
      vendor: String(parsed.vendor ?? "").slice(0, 200),
      description: String(parsed.description ?? "").slice(0, 200) || "Materials",
      amount: toPositiveNumber(parsed.amount, 0),
      occurred_at: typeof parsed.occurred_at === "string" ? parsed.occurred_at : null,
    };
  } catch {
    return { vendor: "", description: "", amount: 0, occurred_at: null };
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
