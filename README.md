# 🔥 ReviveBot — Discord Chat Revival Bot

A production-ready Discord bot that monitors channels for inactivity and revives dead chats using **Groq AI**, role pings, and optional mini-games.

**Stack:** Node.js · Discord.js v14 · better-sqlite3 · Groq SDK  
**No audio/voice dependencies** — safe for all Node.js environments.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📡 Channel Monitoring | Tracks last message time per channel |
| ⏱️ Inactivity Detection | Triggers revival after configurable timeout (default 30 min) |
| 🤖 AI Messages | Groq-powered fun revival messages via LLaMA 3.1 |
| 🎮 Mini-games | Trivia, would-you-rather, word games embedded in revival messages |
| 🔔 Role Pinging | Pings a configurable role (e.g. `@chatting`) |
| 🛡️ Spam Protection | Per-channel cooldown (60 min) prevents message flooding |
| 💾 Persistence | SQLite via better-sqlite3 — survives restarts |
| ⚡ Slash Commands | Modern Discord slash command interface |

---

## 📁 Project Structure

```
discord-revival-bot/
├── bot.js                    # Entry point
├── commands/
│   └── reviveCommands.js     # All slash command definitions + handlers
├── services/
│   ├── groqService.js        # Groq AI integration + fallback messages
│   └── inactivityTracker.js  # Background polling loop
├── db/
│   └── database.js           # SQLite schema + query functions
├── scripts/
│   └── registerCommands.js   # One-time slash command registration
├── data/                     # Auto-created — SQLite database lives here
├── .env.example
├── render.yaml
└── package.json
```

---

## 🚀 Quick Start (Local)

### 1. Prerequisites

- **Node.js 18+** (tested on 18, 20, 22)
- A Discord bot application ([create one here](https://discord.com/developers/applications))
- Optional: [Groq API key](https://console.groq.com) (free tier is generous)

### 2. Clone & Install

```bash
git clone <your-repo-url>
cd discord-revival-bot
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values:
nano .env
```

Required values:
```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
GROQ_API_KEY=your_groq_key   # optional
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

> ⏳ Global commands take up to 1 hour to appear in Discord. For instant registration, modify the script to use guild-specific registration during development.

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
| `/toggle_minigames on` | Enable/disable mini-games in revival messages |
| `/revival_status` | Show current configuration |
| `/revive_now` | Manually trigger a revival immediately |

---

## ☁️ Render Deployment

### Option A: render.yaml (Recommended)

1. Push your code to GitHub
2. In Render: **New → Blueprint** → connect your repo
3. Render reads `render.yaml` automatically
4. Set secret env vars in the Render dashboard:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`  
   - `GROQ_API_KEY` (optional)

### Option B: Manual Setup

1. **New → Background Worker**
2. Connect your GitHub repo
3. Build command: `npm install`
4. Start command: `node bot.js`
5. Add environment variables
6. **Important:** Add a Disk (`/data`, 1GB) for SQLite persistence — otherwise the database resets on every deploy

### Render-Specific Notes

- Use **Background Worker** type, not Web Service (no HTTP port needed)
- Free tier workers sleep after inactivity — upgrade to **Starter ($7/mo)** for always-on
- The persistent disk ensures SQLite survives deploys and restarts
- The DB path auto-adjusts to `/data/revival.db` when the disk is mounted at `/data`

---

## 🔧 Configuration

### Inactivity Logic

```
Last message > timer_minutes ago → trigger revival
Revival sent → start 60-min cooldown → no repeat messages
Cooldown expired → ready to trigger again
```

The background checker runs every **2 minutes**, so the actual trigger time may be up to 2 minutes later than the configured threshold.

### Groq AI

The bot uses `llama-3.1-8b-instant` by default — it's fast and free.  
If the Groq API is unavailable, the bot falls back to 7 built-in messages.

---

## 🛠️ Development Tips

### Register commands to a specific guild (instant, for testing)

Edit `scripts/registerCommands.js`, replace:
```js
Routes.applicationCommands(clientId)
```
with:
```js
Routes.applicationGuildCommands(clientId, 'YOUR_GUILD_ID')
```

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

| Package | Version | Purpose |
|---|---|---|
| `discord.js` | ^14.16 | Discord API client (text-only) |
| `groq-sdk` | ^0.9 | Groq AI API client |
| `better-sqlite3` | ^11.5 | SQLite — synchronous, fast, reliable |
| `dotenv` | ^16.4 | Environment variable loading |

**No audio dependencies.** No `@discordjs/voice`, no `ffmpeg`, no `sodium`, no `nacl`.

---

## 🐛 Troubleshooting

**Bot doesn't respond to commands:**  
→ Run `node scripts/registerCommands.js` and wait up to 1 hour for global propagation.

**"Missing Access" errors:**  
→ Re-invite the bot with correct permissions: Send Messages + View Channel.

**SQLite errors on Render:**  
→ Make sure you've added a Disk at `/data` in the Render dashboard.

**Groq API errors:**  
→ Bot falls back gracefully. Check your `GROQ_API_KEY` is correct.

**Revival not triggering:**  
→ Use `/revival_status` to verify channel/role are set. Use `/revive_now` to test manually.
