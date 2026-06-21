// services/groqService.js
// AI-powered revival message generation.
// Primary: Gemini (with live Google Search grounding) — knows about
// real current events, so questions can reference what's actually
// happening today (sports, news, internet discourse) instead of a
// static topic list. Falls back to Groq if Gemini is unavailable.

import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";

/** @type {Groq | null} */
let groqClient = null;
/** @type {GoogleGenAI | null} */
let geminiClient = null;

const recentlyUsed = [];
const RECENT_LIMIT = 10;

export function initGroq() {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    geminiClient = new GoogleGenAI({ apiKey: geminiKey });
    console.log("[Gemini] Client initialized (primary, with search grounding).");
  } else {
    console.warn("[Gemini] GEMINI_API_KEY not set — skipping Gemini.");
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    groqClient = new Groq({ apiKey: groqKey });
    console.log("[Groq] Client initialized (fallback).");
  } else {
    console.warn("[Groq] GROQ_API_KEY not set — no fallback available.");
  }

  if (!geminiClient && !groqClient) {
    console.warn("[AI] No AI providers configured — revival messages will be skipped.");
  }
}

const BASE_RULES = `Hard rules:
- Must be phrased as a question, not a statement
- Sound like a real person typing casually, not a bot or a journalist
- Ask something people will genuinely disagree on and want to argue about
- Never a yes/no question — it must require a real opinion or explanation
- No emojis
- No "hot take:" or "unpopular opinion:" prefixes — just ask it
- No labels, no A/B choices, no structured formats
- Max 20 words
- Reply with just the message, nothing else`;

function recentList() {
  return recentlyUsed.length > 0 ? recentlyUsed.join(" | ") : "none yet";
}

function cleanText(text) {
  return text.replace(/^["']|["']$/g, "").trim();
}

function trackUsed(msg) {
  recentlyUsed.push(msg);
  if (recentlyUsed.length > RECENT_LIMIT) recentlyUsed.shift();
}

/**
 * Try Gemini first — grounded in live Google Search, so it can draw on
 * genuinely current events (a live tournament, recent news, what's
 * trending right now) rather than a fixed topic list.
 * @returns {Promise<string|null>}
 */
async function generateWithGemini() {
  if (!geminiClient) return null;

  const isGaming = Math.random() < 0.2;
  const focus = isGaming
    ? "gaming (a current game, esports scene, or gaming news/drama)"
    : "something genuinely happening right now — could be sports (e.g. an ongoing tournament or big match), world news, pop culture, or something currently trending online";

  const prompt = `You are a person in a Discord server who wants to start a heated debate.
Use Google Search to check what's actually happening right now, then write ONE controversial, casual question about ${focus}.
The question must reference something real and current — not a generic timeless topic.
${BASE_RULES}

Avoid repeating these recent questions: ${recentList()}`;

  try {
    console.log(`[Gemini] Requesting (${isGaming ? "gaming" : "general"} focus)...`);
    const response = await geminiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 1.2,
        // Generous budget: gemini-2.5-flash can spend tokens on internal
        // "thinking" before producing visible output. Too low a cap here
        // can exhaust the budget on reasoning alone, leaving zero visible
        // text even though the call technically succeeded.
        maxOutputTokens: 512,
      },
    });

    const text = response?.text?.trim();
    if (!text) {
      // Surface *why* it was empty instead of a bare "empty response" —
      // finishReason (e.g. MAX_TOKENS, SAFETY, RECITATION) tells us the
      // real cause.
      const candidate = response?.candidates?.[0];
      console.error(
        "[Gemini] Empty response. finishReason:", candidate?.finishReason,
        "| candidate:", JSON.stringify(candidate)?.slice(0, 500)
      );
      throw new Error(`Empty response from Gemini (finishReason: ${candidate?.finishReason ?? "unknown"})`);
    }

    // Log grounding info so it's easy to confirm search actually ran
    const grounding = response?.candidates?.[0]?.groundingMetadata;
    if (grounding?.webSearchQueries?.length) {
      console.log("[Gemini] Search queries used:", grounding.webSearchQueries);
    } else {
      console.log("[Gemini] No grounding metadata returned — model may have answered without searching.");
    }
    if (grounding?.groundingChunks?.length) {
      const sources = grounding.groundingChunks.map((c) => c.web?.title).filter(Boolean);
      console.log("[Gemini] Sources:", sources);
    }

    return cleanText(text);
  } catch (err) {
    console.error("[Gemini] API error — falling back:", err.message);
    if (err.response?.data) {
      console.error("[Gemini] Error details:", JSON.stringify(err.response.data));
    }
    return null;
  }
}

/**
 * Fallback: Groq, using the original static topic-pool prompts.
 * No live web access — used only if Gemini fails or isn't configured.
 * @returns {Promise<string|null>}
 */
async function generateWithGroq() {
  if (!groqClient) return null;

  const isGaming = Math.random() < 0.2;
  const gamingPrompt = `You are a person in a Discord server who wants to start a heated debate about gaming.
Write one controversial gaming question that demands a real answer — e.g. "why do people still defend X when Y clearly did it better?", "am I the only one who thinks X is overrated trash?", "how is X considered a classic when Y exists?"
${BASE_RULES}`;
  const generalPrompt = `You are a person in a Discord server who wants to start a heated debate or discussion.
Pick ONE of these topic areas at random and write a spicy controversial question about it:
- Success and hustle culture
- Social media and clout chasing
- Money, wealth, and class
- Loyalty and friendships
- Education and school
- Freedom and lifestyle choices
- Dating and relationships
- Mental health culture
- Work ethic and laziness
- Fame and celebrity
${BASE_RULES}`;
  const systemPrompt = isGaming ? gamingPrompt : generalPrompt;

  try {
    const completion = await groqClient.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Write one controversial question to spark debate. Make it different from these recent ones: ${recentList()}. Under 20 words.`,
        },
      ],
      max_tokens: 60,
      temperature: 1.3,
    });
    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty response from Groq");
    return cleanText(text);
  } catch (err) {
    console.error("[Groq] API error — skipping revival:", err.message);
    return null;
  }
}

/**
 * Generate a chat revival message.
 * Tries Gemini (grounded, time-relevant) first, falls back to Groq
 * (static topics, no web access) if Gemini fails or isn't configured.
 * Returns null if both fail — caller skips sending.
 * @returns {Promise<string|null>}
 */
export async function generateRevivalMessage() {
  let text = await generateWithGemini();
  let source = "Gemini";

  if (!text) {
    text = await generateWithGroq();
    source = "Groq";
  }

  if (!text) return null;

  trackUsed(text);
  console.log(`[AI] Generated (${source}):`, text);
  return text;
}
