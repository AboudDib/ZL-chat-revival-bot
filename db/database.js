// db/database.js
// Pure in-memory store — no SQLite, no disk I/O.
// Data resets on restart, which is fine: settings are re-entered via slash commands
// and last_message_at just seeds from "now" when the tracker first picks up the channel.

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * guild_id → { channel_id, role_id, timer_minutes, minigames }
 * @type {Map<string, object>}
 */
const guildSettings = new Map();

/**
 * channel_id → { channel_id, guild_id, last_message_at, last_revival_at, revival_cooldown_minutes }
 * @type {Map<string, object>}
 */
const channelActivity = new Map();

// ─── No-op lifecycle (kept so bot.js imports don't break) ────────────────────

export async function initDatabase() {
  console.log("[DB] Using in-memory store (no disk persistence).");
}

export function flushDatabase() {
  // nothing to flush
}

// ─── Guild Settings ───────────────────────────────────────────────────────────

/**
 * @param {string} guildId
 * @returns {object|null}
 */
export function getGuildSettings(guildId) {
  return guildSettings.get(guildId) ?? null;
}

/**
 * @param {string} guildId
 * @param {object} fields
 */
export function upsertGuildSettings(guildId, fields) {
  const existing = guildSettings.get(guildId) ?? {
    guild_id: guildId,
    channel_id: null,
    role_id: null,
    timer_minutes: 30,
    minigames: 1,
  };
  guildSettings.set(guildId, { ...existing, ...fields });
}

// ─── Channel Activity ─────────────────────────────────────────────────────────

/**
 * Record a new message in a channel (upsert last_message_at).
 * @param {string} channelId
 * @param {string} guildId
 */
export function recordMessage(channelId, guildId) {
  const existing = channelActivity.get(channelId);
  channelActivity.set(channelId, {
    channel_id: channelId,
    guild_id: guildId,
    last_message_at: Date.now(),
    last_revival_at: existing?.last_revival_at ?? null,
    revival_cooldown_minutes: existing?.revival_cooldown_minutes ?? 60,
  });
}

/**
 * Record that a revival was just triggered for a channel.
 * @param {string} channelId
 */
export function recordRevival(channelId) {
  const existing = channelActivity.get(channelId);
  if (!existing) return;
  channelActivity.set(channelId, { ...existing, last_revival_at: Date.now() });
}

/**
 * Get all channels that are actively monitored (i.e. have both activity data
 * and a matching guild setting pointing at them).
 * @returns {Array<object>}
 */
export function getMonitoredChannels() {
  const results = [];

  for (const [channelId, activity] of channelActivity) {
    const settings = guildSettings.get(activity.guild_id);
    // Only include channels that are the configured channel for their guild
    if (!settings || settings.channel_id !== channelId) continue;

    results.push({
      channel_id: channelId,
      guild_id: activity.guild_id,
      last_message_at: activity.last_message_at,
      last_revival_at: activity.last_revival_at,
      revival_cooldown_minutes: activity.revival_cooldown_minutes,
      timer_minutes: settings.timer_minutes,
      minigames: settings.minigames,
      role_id: settings.role_id,
    });
  }

  return results;
}
