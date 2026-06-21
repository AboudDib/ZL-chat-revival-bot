# 🔥 ReviveBot — Discord Chat Revival Bot

A Discord bot that monitors channels for inactivity and revives dead chats using **Gemini AI grounded in live Google Search** — so revival questions can reference what's actually happening right now (sports, news, trending topics), not a static topic list.

**Stack:** Node.js · Discord.js v14 · sql.js (pure-JS SQLite) · Gemini API (`@google/genai`)
**No audio/voice dependencies** — safe for all Node.js environments.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📡 Channel Monitoring | Tracks last message time per channel |
| ⏱️ Inactivity Detection | Triggers revival after configurable timeout (default 30 min) |
| 🤖 AI Messages | Gemini-powered debate questions, grounded in live Google Search for current-events relevance |
| 🎮 Mini-games | Optional toggle for fun framing in revival messages |
| 🔔 Role Pinging | Pings a configurable role (e.g. `@chatting`) |
| 🛡️ Spam Protection | Per-channel cooldown (60 min) prevents message flooding |
| 💾 Persistence | SQLite via sql.js, with debounced disk writes — survives restarts without rewriting the whole DB on every message |
| ⚡ Slash Commands | Modern Discord slash command interface, auto-registered on every deploy |

---

## 📁 Project Structure

```
discord-revival-bot/
├── bot.js                       # Entry point
├── commands/
│   └── reviveCommands.js        # All slash command definitions + handlers
├── services/
│   ├── geminiService.js         # Gemini AI integration (search-grounded)
│   └── inactivityTracker.js     # Background polling loop
├── db/
│   └── database.js              # SQLite schema + query functions (debounced writes)
├── scripts/
│   ├── registerCommands.js      # Slash command registration (runs on every build)
│   ├── clearGlobalCommands.js   # One-off cleanup for leftover global commands
│   └── testAI.js                # Manual test for Gemini generation, no Discord needed
├── data/                        # Auto-created — SQLite database lives here
├── .env.example
├── render.yaml
└── package.json
```

---

## 🚀 Quick Start (Local)

### 1. Prerequisites

- **Node.js 18+** (tested on 18, 20, 22)
- A Discord bot application ([create one here](https://discord.com/developers/applications))
- A [Gemini API key](https://aistudio.google.com/apikey) (free tier, no credit card)

### 2. Clone & Install

```bash
git clone <your-repo-url>
cd discord-revival-bot
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
```

Required values:
```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
GEMINI_API_KEY=your_gemini_api_key
```

Optional:
```env
DISCORD_GUILD_ID=your_server_id   # instant command registration to one server, see below
```

### 4. Discord Bot Setup

In the [Discord Developer Portal](https://discord.com/developers/applications):

1. **Bot → Privileged Gateway Intents:**
   Enable ✅ **Message Content Intent**

2. **OAuth2 → URL Generator:**
   Scopes: `bot`, `applications.commands`
   Bot Permissions: `Send Messages`, `View Channels`, `Mention Everyone`

3. Copy the invite URL and add the bot to your server.

### 5. Register Slash Commands

```bash
node scripts/registerCommands.js
```

> ⏳ **Global** commands take up to an hour to appear in Discord. For instant propagation during development, set `DISCORD_GUILD_ID` in your `.env` first — the script automatically registers to that one guild instead of globally when it's set.

### 6. Run the Bot

```bash
npm start
```

---

## 🎮 Slash Commands

All commands require **Manage Server** permission.

| Command | Description |
|---|---|
| `/set_channel #channel` | Set the channel to monitor |
| `/set_role @role` | Set the role to ping on inactivity |
| `/set_timer 30` | Set inactivity threshold in minutes (5–1440) |
| `/toggle_minigames on` | Enable/disable mini-game framing in revival messages |
| `/revival_status` | Show current configuration |
| `/revive_now` | Manually trigger a revival immediately |

---

## ☁️ Render Deployment

This is deployed as a **Web Service** (not a Background Worker) — the free tier spins down web services after 15 minutes of no HTTP traffic, so `bot.js` runs a small HTTP server plus a self-ping every 5 minutes to stay alive. See `render.yaml` and the `/healthz` route in `bot.js`.

### Option A: render.yaml (Recommended)

1. Push your code to GitHub
2. In Render: **New → Blueprint** → connect your repo
3. Render reads `render.yaml` automatically, including the build command that installs deps **and** registers slash commands on every deploy
4. Set secret env vars in the Render dashboard:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `GEMINI_API_KEY`
   - `DISCORD_GUILD_ID` (optional, for instant command propagation)

### Option B: Manual Setup

1. **New → Web Service**
2. Connect your GitHub repo
3. Build command: `npm install && node scripts/registerCommands.js`
4. Start command: `node bot.js`
5. Health check path: `/healthz`
6. Add environment variables (see above)
7. **Important:** Add a Disk (`/data`, 1GB) for SQLite persistence — otherwise the database resets on every deploy

### Render-Specific Notes

- Free tier **Web Services** sleep after 15 minutes of no HTTP traffic — the built-in self-ping in `bot.js` (every 5 min, hitting `/healthz`) keeps it awake. If you ever redeploy as a Background Worker instead, the self-ping becomes unnecessary (workers don't sleep on idle HTTP), but harmless either way as long as `render.yaml`'s `type` matches what's actually deployed.
- The persistent disk ensures SQLite survives deploys and restarts
- The DB path auto-adjusts to `/data/revival.db` when the disk is mounted at `/data`
- Disk writes are debounced (batched every 30s) instead of happening on every Discord message, to reduce I/O on busy servers

---

## 🔧 Configuration

### Inactivity Logic

```
Last message > timer_minutes ago → trigger revival
Revival sent → start 60-min cooldown → no repeat messages
Cooldown expired → ready to trigger again
```

The background checker runs every **2 minutes**, so the actual trigger time may be up to 2 minutes later than the configured threshold.

### Gemini AI

The bot uses `gemini-2.5-flash` with **Google Search grounding** enabled — each revival message is generated after the model checks what's actually happening right now, so questions can reference real current events instead of a fixed topic list. If Gemini is unavailable or `GEMINI_API_KEY` isn't set, the bot logs a warning and skips that revival rather than sending a generic fallback.

Free tier limits are generous (well over 1,000 requests/day as of writing) — at the bot's typical usage (a couple dozen revivals per day at most), you're nowhere near the cap. Check [Google's current rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) since these can change.

---

## 🛠️ Development Tips

### Test Gemini generation directly (no Discord needed)

```bash
npm run test:ai
```

Generates a few sample messages and logs the actual search queries Gemini ran and sources it used — useful for confirming grounding is working and your key is valid.

### Register commands to a specific guild (instant, for testing)

Set `DISCORD_GUILD_ID` in your environment, then run:
```bash
node scripts/registerCommands.js
```
Guild-scoped commands appear within seconds. Unset the variable and re-run to switch back to global registration once the bot's in multiple servers.

### Clean up leftover global commands

If you switched from global to guild-scoped registration (or vice versa) and see duplicate commands in Discord:
```bash
npm run clear:global-commands
```
This wipes only the global command set — guild-scoped commands are untouched.

### Reset the database

```bash
rm -rf data/
```

### Watch mode (auto-restart on changes)

```bash
npm run dev
```

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `discord.js` | Discord API client (text-only) |
| `@google/genai` | Gemini API client, with Google Search grounding support |
| `sql.js` | Pure-JS SQLite — no native compilation needed |
| `dotenv` | Environment variable loading |

**No audio dependencies.** No `@discordjs/voice`, no `ffmpeg`, no `sodium`, no `nacl`.

---

## 🐛 Troubleshooting

**Bot doesn't respond to commands:**
→ Check the build logs for `[RegisterCommands] ✅ Registered successfully.` If using global registration, wait up to an hour for propagation, or set `DISCORD_GUILD_ID` for instant registration.

**Duplicate slash commands:**
→ Run `npm run clear:global-commands` to wipe leftover global commands after switching to guild-scoped registration.

**"Missing Access" errors:**
→ Re-invite the bot with correct scopes/permissions: `bot` + `applications.commands` scopes, Send Messages + View Channel + Mention Everyone permissions.

**SQLite errors on Render:**
→ Make sure you've added a Disk at `/data` in the Render dashboard.

**"AI is unavailable right now" / Gemini errors:**
→ Check Render's Logs tab for the actual `[Gemini]` error line — it'll show the real cause (invalid key, rate limit, empty response with a `finishReason`, etc.) rather than the generic message shown in Discord. Run `npm run test:ai` to test directly.

**Revival not triggering:**
→ Use `/revival_status` to verify channel/role are set. Use `/revive_now` to test manually.
