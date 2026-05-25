// db/database.js
// SQLite persistence using sql.js (pure JavaScript — no native compilation needed).
// Data is saved to disk as a binary file and loaded on startup.

import { createRequire } from "module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_DIR = join(__dirname, "..", "data");
const DB_PATH = join(DATA_DIR, "revival.db");

/** @type {import("sql.js").Database} */
let db;

/**
 * Save the in-memory database to disk.
 */
function persist() {
  const data = db.export();
  writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * Initialize the sql.js database, loading from disk if it exists.
 */
export async function initDatabase() {
  mkdirSync(DATA_DIR, { recursive: true });

  const initSqlJs = require("sql.js");
  const SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log("[DB] Loaded existing database from", DB_PATH);
  } else {
    db = new SQL.Database();
    console.log("[DB] Created new database at", DB_PATH);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id      TEXT PRIMARY KEY,
      channel_id    TEXT,
      role_id       TEXT,
      timer_minutes INTEGER NOT NULL DEFAULT 30,
      minigames     INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS channel_activity (
      channel_id              TEXT PRIMARY KEY,
      guild_id                TEXT NOT NULL,
      last_message_at         INTEGER NOT NULL,
      last_revival_at         INTEGER,
      revival_cooldown_minutes INTEGER NOT NULL DEFAULT 60
    );
  `);

  persist();
  console.log("[DB] Schema ready.");
}

/**
 * Get the db instance (throws if not initialized).
 */
function getDb() {
  if (!db) throw new Error("Database not initialized. Call initDatabase() first.");
  return db;
}

// ─── Guild Settings ───────────────────────────────────────────────────────────

/**
 * @param {string} guildId
 * @returns {object|null}
 */
export function getGuildSettings(guildId) {
  const res = getDb().exec(
    "SELECT * FROM guild_settings WHERE guild_id = ?",
    [guildId]
  );
  if (!res.length || !res[0].values.length) return null;
  const [cols, vals] = [res[0].columns, res[0].values[0]];
  return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
}

/**
 * @param {string} guildId
 * @param {object} fields
 */
export function upsertGuildSettings(guildId, fields) {
  const existing = getGuildSettings(guildId);
  const d = getDb();

  if (!existing) {
    d.run(
      `INSERT INTO guild_settings (guild_id, channel_id, role_id, timer_minutes, minigames)
       VALUES (?, ?, ?, ?, ?)`,
      [
        guildId,
        fields.channel_id ?? null,
        fields.role_id ?? null,
        fields.timer_minutes ?? 30,
        fields.minigames !== undefined ? (fields.minigames ? 1 : 0) : 1,
      ]
    );
  } else {
    for (const [key, val] of Object.entries(fields)) {
      d.run(
        `UPDATE guild_settings SET ${key} = ? WHERE guild_id = ?`,
        [key === "minigames" ? (val ? 1 : 0) : val, guildId]
      );
    }
  }
  persist();
}

// ─── Channel Activity ─────────────────────────────────────────────────────────

/**
 * Record a new message (updates last_message_at to now).
 * @param {string} channelId
 * @param {string} guildId
 */
export function recordMessage(channelId, guildId) {
  getDb().run(
    `INSERT INTO channel_activity (channel_id, guild_id, last_message_at)
     VALUES (?, ?, ?)
     ON CONFLICT(channel_id) DO UPDATE SET
       last_message_at = excluded.last_message_at,
       guild_id = excluded.guild_id`,
    [channelId, guildId, Date.now()]
  );
  persist();
}

/**
 * Record that a revival was triggered.
 * @param {string} channelId
 */
export function recordRevival(channelId) {
  getDb().run(
    `UPDATE channel_activity SET last_revival_at = ? WHERE channel_id = ?`,
    [Date.now(), channelId]
  );
  persist();
}

/**
 * Get all monitored channels (joined with guild settings).
 * @returns {Array<object>}
 */
export function getMonitoredChannels() {
  const res = getDb().exec(`
    SELECT
      ca.channel_id,
      ca.guild_id,
      ca.last_message_at,
      ca.last_revival_at,
      ca.revival_cooldown_minutes,
      gs.timer_minutes,
      gs.minigames,
      gs.role_id
    FROM channel_activity ca
    JOIN guild_settings gs
      ON ca.guild_id = gs.guild_id
      AND ca.channel_id = gs.channel_id
  `);

  if (!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map((row) =>
    Object.fromEntries(cols.map((c, i) => [c, row[i]]))
  );
}
