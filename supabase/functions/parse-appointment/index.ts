// Turns a spoken description of a job to schedule ("fence repair Tuesday at
// 2pm") into a structured appointment (title/date/time/location) using
// Gemini, so the Schedule tab can offer voice input with a confirm-before-
// creating step. Sibling to parse-line-items/parse-receipt — same model/env
// var, same single-call approach — but needs today's actual date in the
// prompt so Gemini can resolve relative phrases like "tomorrow" correctly.
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { getUserId } from "../_shared/supabase-admin.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const APPOINTMENT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    date: { type: "STRING" },
    time: { type: "STRING" },
    location: { type: "STRING" },
  },
  required: ["title", "date", "time"],
};

type RequestBody = {
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
    if (!body.transcript && !body.audioBase64) {
      return json({ error: "transcript or audioBase64 is required." }, 422);
    }

    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt = `You are an assistant for tradespeople scheduling a job from a spoken description. \
Today's date is ${today} (YYYY-MM-DD). Resolve relative dates ("tomorrow", "next Tuesday", "Friday") against it.
Rules:
- title: a short, client-facing job title (e.g. "Fence repair", "Lawn mowing").
- date: the job's date as YYYY-MM-DD.
- time: the job's start time as 24-hour HH:MM. If no time is mentioned, use "09:00".
- location: the job address/location if mentioned, otherwise omit it.`;

    const parts = body.audioBase64
      ? [
          { text: "Here is a voice note describing a job to schedule. Extract the appointment details." },
          { inline_data: { mime_type: body.audioMimeType ?? "audio/m4a", data: body.audioBase64 } },
        ]
      : [{ text: body.transcript! }];

    const appointment = await callGemini(systemPrompt, parts);
    return json({ appointment });
  } catch (error) {
    console.error("parse-appointment error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

async function callGemini(systemPrompt: string, parts: Array<Record<string, unknown>>) {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: APPOINTMENT_RESPONSE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return parseAppointmentJson(text);
}

function parseAppointmentJson(content?: string | null) {
  const fallbackDate = new Date().toISOString().slice(0, 10);
  if (!content) return { title: "", date: fallbackDate, time: "09:00", location: null };
  try {
    const parsed = JSON.parse(content);
    return {
      title: String(parsed.title ?? "").slice(0, 200) || "Untitled job",
      date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : fallbackDate,
      time: /^\d{1,2}:\d{2}$/.test(parsed.time) ? parsed.time : "09:00",
      location: typeof parsed.location === "string" && parsed.location ? parsed.location : null,
    };
  } catch {
    return { title: "", date: fallbackDate, time: "09:00", location: null };
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
