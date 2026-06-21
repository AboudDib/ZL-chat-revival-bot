// services/inactivityTracker.js
// Background task that periodically checks for inactive channels and triggers revivals.

import { getMonitoredChannels, recordRevival } from "../db/database.js";
import { generateRevivalMessage } from "./geminiService.js";

let trackerInterval = null;
const CHECK_INTERVAL_MS = 2 * 60 * 1000; // every 2 minutes

/**
 * Start the inactivity tracker background loop.
 * @param {import("discord.js").Client} client
 */
export function startInactivityTracker(client) {
  if (trackerInterval) {
    console.warn("[Tracker] Already running — skipping duplicate start.");
    return;
  }

  console.log("[Tracker] Starting inactivity tracker (checks every 2 minutes).");

  trackerInterval = setInterval(async () => {
    await checkInactiveChannels(client);
  }, CHECK_INTERVAL_MS);

  // Run once shortly after startup
  setTimeout(() => checkInactiveChannels(client), 10_000);
}

/**
 * Stop the inactivity tracker.
 */
export function stopInactivityTracker() {
  if (trackerInterval) {
    clearInterval(trackerInterval);
    trackerInterval = null;
    console.log("[Tracker] Stopped.");
  }
}

/**
 * Check all monitored channels for inactivity.
 * @param {import("discord.js").Client} client
 */
async function checkInactiveChannels(client) {
  let monitored;
  try {
    monitored = getMonitoredChannels();
  } catch (err) {
    console.error("[Tracker] Failed to fetch monitored channels:", err.message);
    return;
  }

  if (monitored.length === 0) return;

  const now = Date.now();

  for (const row of monitored) {
    try {
      await evaluateChannel(client, row, now);
    } catch (err) {
      console.error(`[Tracker] Error evaluating channel ${row.channel_id}:`, err.message);
    }
  }
}

/**
 * Evaluate a single channel and trigger revival if thresholds are met.
 * @param {import("discord.js").Client} client
 * @param {object} row
 * @param {number} now
 */
async function evaluateChannel(client, row, now) {
  // last_message_at is stored as ms timestamp (integer)
  const inactiveMs = now - row.last_message_at;
  const thresholdMs = row.timer_minutes * 60 * 1000;

  if (inactiveMs < thresholdMs) return;

  // Check cooldown
  if (row.last_revival_at) {
    const cooldownMs = row.revival_cooldown_minutes * 60 * 1000;
    if (now - row.last_revival_at < cooldownMs) {
      console.log(`[Tracker] Channel ${row.channel_id} in cooldown — skipping.`);
      return;
    }
  }

  const channel = await client.channels.fetch(row.channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.warn(`[Tracker] Channel ${row.channel_id} not found or not text-based.`);
    return;
  }

  const inactiveMinutes = Math.round(inactiveMs / 60_000);
  console.log(`[Tracker] #${channel.name} inactive ${inactiveMinutes}m — triggering revival.`);

  await triggerRevival(channel, row);
}

/**
 * Send the revival message.
 * @param {import("discord.js").TextChannel} channel
 * @param {object} settings
 */
async function triggerRevival(channel, settings) {
  const aiMessage = await generateRevivalMessage({
    minigames: Boolean(settings.minigames),
  });

  // If AI generation failed, skip this revival entirely — no fallbacks
  if (!aiMessage) {
    console.log(`[Tracker] Skipping revival for #${channel.name} — AI unavailable.`);
    return;
  }

  const rolePing = settings.role_id ? `<@&${settings.role_id}> ` : "";
  await channel.send(`${rolePing}${aiMessage}`);

  recordRevival(channel.id);
  console.log(`[Tracker] Revival sent to #${channel.name}.`);
}
