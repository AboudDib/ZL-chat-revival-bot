// scripts/clearGlobalCommands.js
// One-off cleanup: wipes ALL globally-registered slash commands.
// Use this if you switched from global to guild-scoped registration
// (via DISCORD_GUILD_ID) and are now seeing duplicate commands in
// Discord — the old global ones don't auto-remove themselves.
//
// Safe to run any time; it only touches GLOBAL commands, never
// guild-specific ones, so your guild-scoped commands are untouched.
//
// Usage: node scripts/clearGlobalCommands.js

import { REST, Routes } from "discord.js";
import "dotenv/config";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error("[ClearGlobalCommands] Missing DISCORD_TOKEN or DISCORD_CLIENT_ID.");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

console.log("[ClearGlobalCommands] Wiping all global slash commands...");

try {
  // Setting an empty array on the global route deletes every globally
  // registered command for this application.
  await rest.put(Routes.applicationCommands(clientId), { body: [] });
  console.log("[ClearGlobalCommands] ✅ Global commands cleared.");
  console.log("[ClearGlobalCommands] Note: Discord can take a few minutes to reflect this client-side.");
} catch (err) {
  console.error("[ClearGlobalCommands] Failed:", err.message);
  process.exit(1);
}
