// bot.js
// Entry point for ReviveBot — a production-ready Discord chat revival bot.
// Text-only, no voice/audio dependencies. Compatible with Node.js 20.x

import "dotenv/config";
import { Client, GatewayIntentBits, Events } from "discord.js";

import { initDatabase, recordMessage, flushDatabase } from "./db/database.js";
import { initGroq } from "./services/groqService.js";
import { startInactivityTracker, stopInactivityTracker } from "./services/inactivityTracker.js";
import { handleCommand } from "./commands/reviveCommands.js";

// ─── Validate Environment ─────────────────────────────────────────────────────

const REQUIRED_ENV = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);

if (missing.length > 0) {
  console.error(`[Startup] Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

// ─── Discord Client ───────────────────────────────────────────────────────────
// Text-only intents — no voice, no audio, no audioop.

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ─── Events ───────────────────────────────────────────────────────────────────

client.once(Events.ClientReady, (readyClient) => {
  console.log(`[Bot] Logged in as ${readyClient.user.tag}`);
  console.log(`[Bot] Serving ${readyClient.guilds.cache.size} guild(s).`);

  readyClient.user.setPresence({
    activities: [{ name: "for dead chats 👀", type: 3 }],
    status: "online",
  });

  startInactivityTracker(readyClient);
});

client.on(Events.MessageCreate, (message) => {
  if (!message.guild || message.author.bot) return;
  try {
    recordMessage(message.channelId, message.guildId);
  } catch (err) {
    console.error("[Bot] Failed to record message:", err.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleCommand(interaction, client);
  } catch (err) {
    console.error("[Bot] Unhandled command error:", err.message);
    const errorMsg = { content: "An error occurred. Please try again.", ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(errorMsg).catch(() => {});
    } else {
      await interaction.reply(errorMsg).catch(() => {});
    }
  }
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

function shutdown(signal) {
  console.log(`[Bot] ${signal} received — shutting down...`);
  stopInactivityTracker();
  flushDatabase();
  client.destroy();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  console.error("[Bot] Unhandled rejection:", reason);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[Bot] Initializing ReviveBot...");

  // HTTP server to satisfy Render free tier port requirement
  const { createServer } = await import("http");
  const port = process.env.PORT || 3000;
  createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    res.end("Bot is running");
  }).listen(port, () => {
    console.log(`[Bot] HTTP server listening on port ${port}`);
  });

  // Self-ping every 5 minutes to prevent Render free tier (web service) sleep.
  // Hits /healthz specifically — cheapest possible handler, no logic, no DB.
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
  if (RENDER_URL) {
    const { default: https } = await import("https");
    const healthUrl = `${RENDER_URL.replace(/\/$/, "")}/healthz`;
    setInterval(() => {
      https.get(healthUrl, (res) => {
        console.log(`[KeepAlive] Pinged self — status ${res.statusCode}`);
      }).on("error", (err) => {
        console.warn("[KeepAlive] Self-ping failed:", err.message);
      });
    }, 5 * 60 * 1000);
    console.log(`[KeepAlive] Self-ping enabled for ${healthUrl}`);
  } else {
    console.warn("[KeepAlive] RENDER_EXTERNAL_URL not set — self-ping disabled.");
  }

  await initDatabase();
  initGroq();
  await client.login(process.env.DISCORD_TOKEN);
}

main().catch((err) => {
  console.error("[Bot] Fatal startup error:", err.message);
  process.exit(1);
});
