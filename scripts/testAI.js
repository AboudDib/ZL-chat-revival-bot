// scripts/testAI.js
// Quick manual test for Gemini revival message generation — no Discord needed.
// Run locally or on Render's shell:
//   node scripts/testAI.js
//
// Make sure GEMINI_API_KEY is set in your environment or .env file first.

import "dotenv/config";
import { initGemini, generateRevivalMessage } from "../services/geminiService.js";

console.log("=== Gemini Revival Message Test ===");
console.log("GEMINI_API_KEY set:", Boolean(process.env.GEMINI_API_KEY));
console.log("");

initGemini();

const COUNT = 3;
console.log(`\nGenerating ${COUNT} test messages...\n`);

for (let i = 1; i <= COUNT; i++) {
  console.log(`--- Message ${i} ---`);
  const msg = await generateRevivalMessage();
  console.log("Result:", msg ?? "(null — generation failed, check logs above)");
  console.log("");
}
