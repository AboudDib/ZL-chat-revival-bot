// scripts/testAI.js
// Quick manual test for AI revival message generation — no Discord needed.
// Run locally or on Render's shell:
//   node scripts/testAI.js
//
// Make sure GEMINI_API_KEY (and optionally GROQ_API_KEY) are set in your
// environment or .env file first.

import "dotenv/config";
import { initGroq, generateRevivalMessage } from "../services/groqService.js";

console.log("=== AI Revival Message Test ===");
console.log("GEMINI_API_KEY set:", Boolean(process.env.GEMINI_API_KEY));
console.log("GROQ_API_KEY set:", Boolean(process.env.GROQ_API_KEY));
console.log("");

initGroq();

const COUNT = 3;
console.log(`\nGenerating ${COUNT} test messages...\n`);

for (let i = 1; i <= COUNT; i++) {
  console.log(`--- Message ${i} ---`);
  const msg = await generateRevivalMessage();
  console.log("Result:", msg ?? "(null — generation failed, check logs above)");
  console.log("");
}
