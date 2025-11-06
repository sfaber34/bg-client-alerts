const TelegramBot = require('node-telegram-bot-api');
const { generateUniqueToken, saveToken, getTokenByChatId } = require('./utils');

let bot = null;

/**
 * Initialize and start the Telegram bot
 * @param {string} botToken - Telegram bot token
 */
function initializeBot(botToken) {
  bot = new TelegramBot(botToken, { polling: true });

  // /start command - Generate or show existing token
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`📱 /start command received from chatId ${chatId}`);

    try {
      // Check if user already has a token
      let token = await getTokenByChatId(chatId);

      if (token) {
        // User already has a token, show it
        await bot.sendMessage(
          chatId,
          `✅ *Welcome back!*\n\n` +
          `Your token: \`${token}\`\n\n` +
          `To use it, start your node with:\n` +
          `\`node index.js --tg-alert-token ${token}\`\n\n` +
          `Use /help for more commands.`,
          { parse_mode: 'Markdown' }
        );
        console.log(`🔑 Showed existing token ${token} to chatId ${chatId}`);
      } else {
        // Generate new token
        token = await generateUniqueToken();
        await saveToken(token, chatId);

        await bot.sendMessage(
          chatId,
          `🎉 *Welcome to BuidlGuidl Alert Bot!*\n\n` +
          `Your unique token: \`${token}\`\n\n` +
          `To receive alerts, start your node with:\n` +
          `\`node index.js --tg-alert-token ${token}\`\n\n` +
          `Use /help for more commands.`,
          { parse_mode: 'Markdown' }
        );
        console.log(`✨ Generated new token ${token} for chatId ${chatId}`);
      }
    } catch (error) {
      console.error('❌ Error in /start command:', error);
      await bot.sendMessage(
        chatId,
        '❌ Sorry, something went wrong. Please try again later.'
      );
    }
  });

  // /showToken command - Display existing token
  bot.onText(/\/showToken/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`📱 /showToken command received from chatId ${chatId}`);

    try {
      const token = await getTokenByChatId(chatId);

      if (token) {
        await bot.sendMessage(
          chatId,
          `🔑 *Your Token*\n\n` +
          `\`${token}\`\n\n` +
          `Use this token when starting your node:\n` +
          `\`node index.js --tg-alert-token ${token}\``,
          { parse_mode: 'Markdown' }
        );
        console.log(`🔑 Showed token ${token} to chatId ${chatId}`);
      } else {
        await bot.sendMessage(
          chatId,
          `❌ You don't have a token yet.\n\n` +
          `Use /start to generate one.`
        );
        console.log(`⚠️  No token found for chatId ${chatId}`);
      }
    } catch (error) {
      console.error('❌ Error in /showToken command:', error);
      await bot.sendMessage(
        chatId,
        '❌ Sorry, something went wrong. Please try again later.'
      );
    }
  });

  // /help command - Show available commands
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`📱 /help command received from chatId ${chatId}`);

    try {
      await bot.sendMessage(
        chatId,
        `📚 *BuidlGuidl Alert Bot - Help*\n\n` +
        `*Available Commands:*\n` +
        `/start - Generate your unique token (or show existing)\n` +
        `/showToken - Display your current token\n` +
        `/help - Show this help message\n\n` +
        `*Setup Instructions:*\n` +
        `1️⃣ Use /start to get your token\n` +
        `2️⃣ Start your node with the token:\n` +
        `   \`node index.js --tg-alert-token YOUR_TOKEN\`\n` +
        `3️⃣ You'll receive alerts when your clients crash\n\n` +
        `*Alert Types:*\n` +
        `🔴 RETH CRASH - Reth client crashed\n` +
        `🔴 LIGHTHOUSE CRASH - Lighthouse client crashed\n` +
        `⚠️  CUSTOM ALERT - Other important events\n\n` +
        `Need more help? Check the documentation.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('❌ Error in /help command:', error);
      await bot.sendMessage(
        chatId,
        '❌ Sorry, something went wrong. Please try again later.'
      );
    }
  });

  // Handle unknown commands
  bot.on('message', async (msg) => {
    const text = msg.text;
    const chatId = msg.chat.id;

    // Ignore if it's a known command
    if (text && text.startsWith('/')) {
      const knownCommands = ['/start', '/showToken', '/help'];
      if (!knownCommands.some(cmd => text.startsWith(cmd))) {
        await bot.sendMessage(
          chatId,
          `❓ Unknown command. Use /help to see available commands.`
        );
      }
    }
  });

  console.log('🤖 Telegram bot started successfully');
}

/**
 * Send alert message to user via Telegram
 * @param {number} chatId - Telegram chat ID
 * @param {string} alertType - Type of alert (e.g., "RETH CRASH")
 * @param {string} message - Alert message
 * @returns {Promise<void>}
 */
async function sendAlert(chatId, alertType, message) {
  if (!bot) {
    throw new Error('Bot not initialized');
  }

  const timestamp = require('./utils').getUTCTimestamp();
  
  // Determine emoji based on alert type
  let emoji = '⚠️';
  if (alertType.toLowerCase().includes('crash')) {
    emoji = '🔴';
  } else if (alertType.toLowerCase().includes('warning')) {
    emoji = '⚠️';
  } else if (alertType.toLowerCase().includes('info')) {
    emoji = 'ℹ️';
  }

  const formattedMessage = 
    `${emoji} *${alertType.toUpperCase()}*\n\n` +
    `${message}\n\n` +
    `Time: ${timestamp}`;

  await bot.sendMessage(chatId, formattedMessage, { parse_mode: 'Markdown' });
  console.log(`📤 Alert sent to chatId ${chatId}: ${alertType}`);
}

/**
 * Stop the Telegram bot
 */
function stopBot() {
  if (bot) {
    bot.stopPolling();
    console.log('🛑 Telegram bot stopped');
  }
}

module.exports = {
  initializeBot,
  sendAlert,
  stopBot
};

