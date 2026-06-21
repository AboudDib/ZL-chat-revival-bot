// services/geminiService.js
// AI-powered revival message generation using Gemini, grounded in live
// Google Search — questions can reference what's actually happening
// today (sports, news, internet discourse) instead of a static topic
// list or stale training data.

import { GoogleGenAI } from "@google/genai";

/** @type {GoogleGenAI | null} */
let geminiClient = null;

const recentlyUsed = [];
const RECENT_LIMIT = 10;

export function initGemini() {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    geminiClient = new GoogleGenAI({ apiKey: geminiKey });
    console.log("[Gemini] Client initialized (with search grounding).");
  } else {
    console.warn("[Gemini] GEMINI_API_KEY not set — revival messages will be skipped.");
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
 * Generate a chat revival message using Gemini, grounded in live Google
 * Search — can draw on genuinely current events (a live tournament,
 * recent news, what's trending right now) rather than a fixed topic list.
 * Returns null if generation fails — caller skips sending.
 * @returns {Promise<string|null>}
 */
export async function generateRevivalMessage() {
  if (!geminiClient) return null;

  const isGaming = Math.random() < 0.2;
  const focus = isGaming
    ? "gaming — a current game, esports scene, recent patch/release, or gaming community drama people are actively arguing about"
    : "sports rivalries, a live tournament or big match, celebrity/internet drama, pop culture takes, or something people are actively arguing about online right now";

  const prompt = `You are a person in a Discord server who wants to start a heated, fun debate.
Use Google Search to check what's actually happening right now, then write ONE controversial, casual question about ${focus}.

The question must reference something real and current that people would actually want to argue about — a rivalry, a take, a "who's better" debate, a recent drama or controversy in sports/gaming/entertainment.

Hard NO — do not use:
- Politics, government policy, military/defense news, diplomacy, or geopolitics
- Dry factual/procedural news (deals, donations, official statements, legal proceedings)
- Tragedies, disasters, deaths, or anything somber
- Anything that isn't fun to argue about over Discord

Think: the kind of debate people have in a group chat, not the news desk.
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

    const cleaned = cleanText(text);
    trackUsed(cleaned);
    console.log("[Gemini] Generated:", cleaned);
    return cleaned;
  } catch (err) {
    console.error("[Gemini] API error — skipping revival:", err.message);
    if (err.response?.data) {
      console.error("[Gemini] Error details:", JSON.stringify(err.response.data));
    }
    return null;
  }
}
