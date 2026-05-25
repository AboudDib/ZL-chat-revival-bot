// commands/reviveCommands.js
// Slash command definitions and handlers for the Revival bot.

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from "discord.js";
import {
  getGuildSettings,
  upsertGuildSettings,
  recordMessage,
} from "../db/database.js";

// ─── Command Definitions ──────────────────────────────────────────────────────

export const commands = [
  new SlashCommandBuilder()
    .setName("set_channel")
    .setDescription("Set the channel to monitor for inactivity")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("The text channel to monitor")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("set_role")
    .setDescription("Set the role to ping when chat is dead")
    .addRoleOption((opt) =>
      opt
        .setName("role")
        .setDescription("The role to ping (e.g. @chatting)")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("set_timer")
    .setDescription("Set inactivity threshold in minutes (default: 30)")
    .addIntegerOption((opt) =>
      opt
        .setName("minutes")
        .setDescription("Minutes of inactivity before revival triggers (min: 5)")
        .setMinValue(5)
        .setMaxValue(1440)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("toggle_minigames")
    .setDescription("Enable or disable mini-games in revival messages")
    .addStringOption((opt) =>
      opt
        .setName("state")
        .setDescription("Turn mini-games on or off")
        .addChoices(
          { name: "on", value: "on" },
          { name: "off", value: "off" }
        )
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("revival_status")
    .setDescription("Show current revival bot settings for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("revive_now")
    .setDescription("Manually trigger a chat revival right now")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),
];

// ─── Command Handlers ─────────────────────────────────────────────────────────

/**
 * Route an incoming interaction to the correct handler.
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {import("discord.js").Client} client
 */
export async function handleCommand(interaction, client) {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId } = interaction;

  if (!guildId) {
    return interaction.reply({ content: "This bot only works in servers.", ephemeral: true });
  }

  switch (commandName) {
    case "set_channel":
      return handleSetChannel(interaction, guildId);
    case "set_role":
      return handleSetRole(interaction, guildId);
    case "set_timer":
      return handleSetTimer(interaction, guildId);
    case "toggle_minigames":
      return handleToggleMinigames(interaction, guildId);
    case "revival_status":
      return handleStatus(interaction, guildId);
    case "revive_now":
      return handleReviveNow(interaction, guildId, client);
    default:
      return interaction.reply({ content: "Unknown command.", ephemeral: true });
  }
}

// ─── Individual Handlers ──────────────────────────────────────────────────────

/**
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {string} guildId
 */
async function handleSetChannel(interaction, guildId) {
  const channel = interaction.options.getChannel("channel", true);

  upsertGuildSettings(guildId, { channel_id: channel.id });

  // Seed the activity record so the tracker picks it up immediately
  recordMessage(channel.id, guildId);

  return interaction.reply({
    embeds: [
      successEmbed(
        "Channel Set ✅",
        `Now monitoring ${channel} for inactivity.\nI'll start watching it right away!`
      ),
    ],
    ephemeral: true,
  });
}

/**
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {string} guildId
 */
async function handleSetRole(interaction, guildId) {
  const role = interaction.options.getRole("role", true);

  upsertGuildSettings(guildId, { role_id: role.id });

  return interaction.reply({
    embeds: [
      successEmbed(
        "Role Set ✅",
        `${role} will be pinged when chat goes quiet.`
      ),
    ],
    ephemeral: true,
  });
}

/**
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {string} guildId
 */
async function handleSetTimer(interaction, guildId) {
  const minutes = interaction.options.getInteger("minutes", true);

  upsertGuildSettings(guildId, { timer_minutes: minutes });

  return interaction.reply({
    embeds: [
      successEmbed(
        "Timer Set ✅",
        `Revival will trigger after **${minutes} minutes** of inactivity.`
      ),
    ],
    ephemeral: true,
  });
}

/**
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {string} guildId
 */
async function handleToggleMinigames(interaction, guildId) {
  const state = interaction.options.getString("state", true);
  const enabled = state === "on";

  upsertGuildSettings(guildId, { minigames: enabled ? 1 : 0 });

  return interaction.reply({
    embeds: [
      successEmbed(
        `Mini-games ${enabled ? "Enabled" : "Disabled"} ${enabled ? "🎮" : "🔕"}`,
        enabled
          ? "Revival messages will now include fun mini-games!"
          : "Revival messages will be simple prompts only."
      ),
    ],
    ephemeral: true,
  });
}

/**
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {string} guildId
 */
async function handleStatus(interaction, guildId) {
  const settings = getGuildSettings(guildId);

  if (!settings || !settings.channel_id) {
    return interaction.reply({
      embeds: [
        infoEmbed(
          "No Configuration Found",
          "Use `/set_channel` to start monitoring a channel."
        ),
      ],
      ephemeral: true,
    });
  }

  const channelStr = settings.channel_id ? `<#${settings.channel_id}>` : "Not set";
  const roleStr = settings.role_id ? `<@&${settings.role_id}>` : "Not set";

  const embed = new EmbedBuilder()
    .setTitle("📊 Revival Bot Status")
    .setColor(0x5865f2)
    .addFields(
      { name: "📡 Monitored Channel", value: channelStr, inline: true },
      { name: "🔔 Ping Role", value: roleStr, inline: true },
      { name: "⏱️ Inactivity Timer", value: `${settings.timer_minutes} minutes`, inline: true },
      {
        name: "🎮 Mini-games",
        value: settings.minigames ? "Enabled ✅" : "Disabled ❌",
        inline: true,
      }
    )
    .setFooter({ text: "ReviveBot • Chat Never Dies" })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {string} guildId
 * @param {import("discord.js").Client} client
 */
async function handleReviveNow(interaction, guildId, client) {
  const settings = getGuildSettings(guildId);

  if (!settings?.channel_id) {
    return interaction.reply({
      content: "No channel configured. Use `/set_channel` first.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const { generateRevivalMessage } = await import("../services/groqService.js");
    const { recordRevival } = await import("../db/database.js");

    const channel = await client.channels.fetch(settings.channel_id);
    if (!channel?.isTextBased()) throw new Error("Channel not found");

    const message = await generateRevivalMessage({
      minigames: Boolean(settings.minigames),
    });

    if (!message) {
      return interaction.editReply({ content: "AI is unavailable right now. Try again in a moment." });
    }

    const rolePing = settings.role_id ? `<@&${settings.role_id}> ` : "";
    await channel.send(`${rolePing}${message}`);
    recordRevival(channel.id);

    return interaction.editReply({
      embeds: [successEmbed("Revival Triggered! 🚀", `Sent a revival message to ${channel}.`)],
    });
  } catch (err) {
    console.error("[Command] revive_now error:", err.message);
    return interaction.editReply({ content: "Failed to send revival message. Check bot permissions." });
  }
}

// ─── Embed Helpers ────────────────────────────────────────────────────────────

function successEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0x57f287)
    .setFooter({ text: "ReviveBot • Chat Never Dies" })
    .setTimestamp();
}

function infoEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0xfee75c)
    .setFooter({ text: "ReviveBot • Chat Never Dies" })
    .setTimestamp();
}
