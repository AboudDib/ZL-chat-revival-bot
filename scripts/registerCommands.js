// scripts/registerCommands.js
// Registers slash commands with Discord. Runs automatically on every
// Render build (see render.yaml buildCommand) so commands stay in sync
// without a manual step. Re-registering with the same commands is a
// no-op on Discord's side, so this is safe to run on every deploy.
//
// Manual usage: node scripts/registerCommands.js

import { REST, Routes } from "discord.js";
import { commands } from "../commands/reviveCommands.js";
import "dotenv/config";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.warn(
    "[RegisterCommands] Missing DISCORD_TOKEN or DISCORD_CLIENT_ID — skipping " +
    "command registration. Set these env vars on Render, then redeploy."
  );
  // Exit 0, not 1: missing env vars here shouldn't fail the build.
  // bot.js performs its own strict check and will refuse to start without them.
  process.exit(0);
}

const rest = new REST({ version: "10" }).setToken(token);

console.log(`[RegisterCommands] Registering ${commands.length} slash command(s) globally...`);

try {
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log("[RegisterCommands] ✅ Registered successfully.");
  console.log("[RegisterCommands] Note: global commands can take up to 1 hour to appear in Discord.");
} catch (err) {
  console.error("[RegisterCommands] Failed to register commands:", err.message);
  // Exit 0, not 1: don't fail the whole build/deploy over command
  // registration — the bot can still run and serve existing commands.
  process.exit(0);
}
