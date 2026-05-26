// services/groqService.js
import Groq from "groq-sdk";

/** @type {Groq | null} */
let groqClient = null;
const recentlyUsed = [];
const RECENT_LIMIT = 10;

export function initGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn("[Groq] GROQ_API_KEY not set — revival messages will be skipped.");
    return;
  }
  groqClient = new Groq({ apiKey });
  console.log("[Groq] Client initialized.");
}

/**
 * Generate a chat revival message using Groq AI.
 * Returns null if generation fails — caller skips sending.
 * @returns {Promise<string|null>}
 */
export async function generateRevivalMessage() {
  if (!groqClient) return null;

  const isGaming = Math.random() < 0.2;

  const gamingPrompt = `You are a person in a Discord server who wants to start a heated debate about gaming.
Write one controversial gaming opinion — e.g. which game is overrated, why a hyped game was mid, which franchise went downhill, console wars, PC vs console, why people are wrong about a popular game.
Hard rules:
- Sound like a real person typing casually, not a bot or a journalist
- Say something people will genuinely disagree with and want to argue about
- Never ask a yes/no question — make a statement or ask something that needs a real opinion
- No emojis
- No "hot take:" or "unpopular opinion:" prefixes — just say it
- No labels, no A/B choices, no structured formats
- Max 20 words
- Reply with just the message, nothing else`;

  const generalPrompt = `You are a person in a Discord server who wants to start a heated debate or discussion.
Pick ONE of these topic areas at random and write a spicy controversial take about it:
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
Hard rules:
- Sound like a real person typing casually, not a bot or a journalist
- Say something people will genuinely disagree with and want to argue about
- Never ask a yes/no question — make a statement or ask something that needs a real opinion
- No emojis
- No "hot take:" or "unpopular opinion:" prefixes — just say it
- No labels, no A/B choices, no structured formats
- Max 20 words
- Reply with just the message, nothing else`;

  const systemPrompt = isGaming ? gamingPrompt : generalPrompt;

  try {
    const completion = await groqClient.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Write one controversial statement or debate opener. Make it different from these recent ones: ${
            recentlyUsed.length > 0 ? recentlyUsed.join(" | ") : "none yet"
          }. Under 20 words.`,
        },
      ],
      max_tokens: 60,
      temperature: 1.3,
    });

    let text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty response from Groq");

    text = text.replace(/^["']|["']$/g, "").trim();
    trackUsed(text);
    console.log(`[Groq] Generated (${isGaming ? "gaming" : "general"}):`, text);
    return text;
  } catch (err) {
    console.error("[Groq] API error — skipping revival:", err.message);
    return null;
  }
}

function trackUsed(msg) {
  recentlyUsed.push(msg);
  if (recentlyUsed.length > RECENT_LIMIT) recentlyUsed.shift();
}
