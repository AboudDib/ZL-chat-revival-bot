// scripts/registerCommands.js
// Run this ONCE to register slash commands with Discord.
// Usage: node scripts/registerCommands.js

import { REST, Routes } from "discord.js";
import { commands } from "../commands/reviveCommands.js";
import "dotenv/config";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment.");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

console.log(`Registering ${commands.length} slash command(s) globally...`);

try {
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log("✅ Slash commands registered successfully.");
  console.log(
    "Note: Global commands can take up to 1 hour to appear in Discord."
  );
} catch (err) {
  console.error("Failed to register commands:", err.message);
  process.exit(1);
}
