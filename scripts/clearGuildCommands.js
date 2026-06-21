// scripts/clearGuildCommands.js
// Wipes ALL guild-scoped slash commands for this application.
// Use when you see duplicate commands in Discord after re-registering.
//
// Usage: node scripts/clearGuildCommands.js

import { REST, Routes } from "discord.js";
import "dotenv/config";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error("[ClearGuildCommands] Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID.");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

console.log(`[ClearGuildCommands] Wiping all guild slash commands for guild ${guildId}...`);

try {
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
  console.log("[ClearGuildCommands] ✅ Guild commands cleared.");
  console.log("[ClearGuildCommands] Redeploy now to re-register clean commands.");
} catch (err) {
  console.error("[ClearGuildCommands] Failed:", err.message);
  process.exit(1);
}
