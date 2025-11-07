const TelegramBot = require('node-telegram-bot-api');
const { resolveENS, isENS, normalizeAddress, saveAddress, getAddressByChatId, deleteAddress } = require('./utils');

let bot = null;

// Store pending registrations (chatId -> waiting for ENS/address)
const pendingRegistrations = new Map();

// Store pending address changes (chatId -> { oldAddress, oldEns })
const pendingChanges = new Map();

// Store pending deletions (chatId -> { address, ens })
const pendingDeletions = new Map();

/**
 * Initialize and start the Telegram bot
 * @param {string} botToken - Telegram bot token
 * @param {string} webhookUrl - Optional webhook URL (if not provided, uses polling)
 */
async function initializeBot(botToken, webhookUrl = null) {
  if (webhookUrl) {
    // Use webhooks
    bot = new TelegramBot(botToken, { webHook: false });
    
    try {
      // Delete any existing webhook first
      await bot.deleteWebHook();
      
      // Set new webhook
      const webhookPath = `/webhook/${botToken}`;
      const fullWebhookUrl = `${webhookUrl}${webhookPath}`;
      
      await bot.setWebHook(fullWebhookUrl);
      console.log(`🔗 Webhook set to: ${fullWebhookUrl}`);
      
      // Store the webhook path for the API to use
      bot.webhookPath = webhookPath;
    } catch (error) {
      console.error('❌ Failed to set webhook:', error);
      throw error;
    }
  } else {
    // Use polling (fallback)
    bot = new TelegramBot(botToken, { polling: true });

    // Handle polling errors
    bot.on('polling_error', (error) => {
      console.error('[polling_error]', JSON.stringify({
        code: error.code,
        message: error.message
      }));
      
      // Only log details for non-network errors
      if (error.code !== 'EFATAL' && error.code !== 'ECONNRESET') {
        console.error('Full error:', error);
      }
    });
  }

  // /start command - Ask for ENS or address
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`📱 /start command received from chatId ${chatId}`);

    try {
      // Check if user already registered
      const existingAddress = await getAddressByChatId(chatId);

      if (existingAddress) {
        // User already has an address registered
        const identifier = existingAddress.ens || existingAddress.address;
        await bot.sendMessage(
          chatId,
          `✅ *Welcome back!*\n\n` +
          `Your registered identifier: \`${identifier}\`\n\n` +
          `To use it, start your node with:\n` +
          `\`node index.js --owner ${identifier}\`\n\n` +
          `Use /help for more commands.`,
          { parse_mode: 'Markdown' }
        );
        console.log(`🔑 Showed existing identifier ${identifier} to chatId ${chatId}`);
      } else {
        // New user - ask for ENS or address
        pendingRegistrations.set(chatId, true);
        await bot.sendMessage(
          chatId,
          `🎉 *Welcome to BuidlGuidl Client Alert Bot!*\n\n` +
          `Please send me your ENS name or Ethereum address to get started.\n\n` +
          `Examples:\n` +
          `• \`vitalik.eth\`\n` +
          `• \`0x1234...abcd\``,
          { parse_mode: 'Markdown' }
        );
        console.log(`⏳ Waiting for ENS/address from chatId ${chatId}`);
      }
    } catch (error) {
      console.error('❌ Error in /start command:', error);
      await bot.sendMessage(
        chatId,
        '❌ Sorry, something went wrong. Please try again later.'
      );
    }
  });

  // /showAddress command - Display current registered address
  bot.onText(/\/show/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`📱 /show command received from chatId ${chatId}`);

    try {
      const addressInfo = await getAddressByChatId(chatId);

      if (addressInfo) {
        const identifier = addressInfo.ens || addressInfo.address;
        await bot.sendMessage(
          chatId,
          `🔑 *Your Registered Identifier*\n\n` +
          `\`${identifier}\`\n\n` +
          `Use this when starting your node:\n` +
          `\`node index.js --owner ${identifier}\``,
          { parse_mode: 'Markdown' }
        );
        console.log(`🔑 Showed identifier ${identifier} to chatId ${chatId}`);
      } else {
        await bot.sendMessage(
          chatId,
          `❌ You haven't registered yet.\n\n` +
          `Use /start to register your ENS or address.`
        );
        console.log(`⚠️  No address found for chatId ${chatId}`);
      }
    } catch (error) {
      console.error('❌ Error in /show command:', error);
      await bot.sendMessage(
        chatId,
        '❌ Sorry, something went wrong. Please try again later.'
      );
    }
  });

  // /change command - Change registered address/ENS
  bot.onText(/\/change/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`📱 /change command received from chatId ${chatId}`);

    try {
      const addressInfo = await getAddressByChatId(chatId);

      if (!addressInfo) {
        await bot.sendMessage(
          chatId,
          `❌ You haven't registered yet.\n\n` +
          `Use /start to register your ENS or address first.`
        );
        return;
      }

      const currentIdentifier = addressInfo.ens || addressInfo.address;
      
      // Store old address info for cleanup
      pendingChanges.set(chatId, {
        oldAddress: addressInfo.docId,
        oldEns: addressInfo.ens
      });

      await bot.sendMessage(
        chatId,
        `🔄 *Change Your Identifier*\n\n` +
        `Currently registered: \`${currentIdentifier}\`\n\n` +
        `Please send me your new ENS name or Ethereum address.\n\n` +
        `⚠️ Your old registration will be removed once the new one is confirmed.`,
        { parse_mode: 'Markdown' }
      );
      console.log(`⏳ Waiting for new identifier from chatId ${chatId}`);
    } catch (error) {
      console.error('❌ Error in /change command:', error);
      await bot.sendMessage(
        chatId,
        '❌ Sorry, something went wrong. Please try again later.'
      );
    }
  });

  // /stop command - Delete user data (requires confirmation)
  bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`📱 /stop command received from chatId ${chatId}`);

    try {
      const addressInfo = await getAddressByChatId(chatId);

      if (!addressInfo) {
        await bot.sendMessage(
          chatId,
          `❌ You haven't registered yet.\n\n` +
          `There's no data to delete.`
        );
        return;
      }

      const currentIdentifier = addressInfo.ens || addressInfo.address;
      
      // Store address info for deletion
      pendingDeletions.set(chatId, {
        address: addressInfo.docId,
        ens: addressInfo.ens
      });

      await bot.sendMessage(
        chatId,
        `⚠️ *Stop Alert Service*\n\n` +
        `You are about to be opted-out of the Telegram alert service.\n\n` +
        `Your registered identifier: \`${currentIdentifier}\`\n\n` +
        `You will no longer receive alerts.\n\n` +
        `To confirm, please type: \`y\` or \`yes\`\n` +
        `To cancel, type anything else or use /start`,
        { parse_mode: 'Markdown' }
      );
      console.log(`⏳ Waiting for deletion confirmation from chatId ${chatId}`);
    } catch (error) {
      console.error('❌ Error in /stop command:', error);
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
        `/start - Register your ENS or Ethereum address\n` +
        `/show - Display your registered identifier\n` +
        `/change - Change your registered identifier\n` +
        `/stop - Delete your data and opt-out of alerts\n` +
        `/help - Show this help message\n\n` +
        `*Setup Instructions:*\n` +
        `1️⃣ Use /start and provide your ENS or address\n` +
        `2️⃣ Start your node with:\n` +
        `   \`node index.js --owner YOUR_ENS_OR_ADDRESS\`\n` +
        `3️⃣ You'll receive alerts when your clients crash`,
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

  // Handle all text messages (for ENS/address input)
  bot.on('message', async (msg) => {
    const text = msg.text;
    const chatId = msg.chat.id;

    // Ignore if it's a command
    if (text && text.startsWith('/')) {
      const knownCommands = ['/start', '/show', '/change', '/stop', '/help'];
      if (!knownCommands.some(cmd => text.startsWith(cmd))) {
        await bot.sendMessage(
          chatId,
          `❓ Unknown command. Use /help to see available commands.`
        );
      }
      return;
    }

    // Check if we're waiting for deletion confirmation
    if (pendingDeletions.has(chatId)) {
      await handleDeletionConfirmation(chatId, text);
      return;
    }

    // Check if we're waiting for new address (change command)
    if (pendingChanges.has(chatId)) {
      await handleAddressChange(chatId, text);
      return;
    }

    // Check if we're waiting for ENS/address from this user (new registration)
    if (pendingRegistrations.has(chatId)) {
      await handleIdentifierInput(chatId, text);
    }
  });

  console.log('🤖 Telegram bot started successfully');
}

/**
 * Handle ENS or address input from user
 * @param {number} chatId - Telegram chat ID
 * @param {string} identifier - ENS name or Ethereum address
 */
async function handleIdentifierInput(chatId, identifier) {
  try {
    if (!identifier || typeof identifier !== 'string') {
      await bot.sendMessage(
        chatId,
        '❌ Invalid input. Please send a valid ENS name or Ethereum address.'
      );
      return;
    }

    const trimmed = identifier.trim();
    
    // Check if it's an ENS
    if (isENS(trimmed)) {
      console.log(`🔍 Resolving ENS ${trimmed} for chatId ${chatId}`);
      await bot.sendMessage(chatId, `🔍 Resolving ENS: \`${trimmed}\`...`, { parse_mode: 'Markdown' });
      
      const address = await resolveENS(trimmed);
      
      if (!address) {
        await bot.sendMessage(
          chatId,
          `❌ Failed to resolve ENS: \`${trimmed}\`\n\n` +
          `Please check the ENS name and try again, or use your Ethereum address instead.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // Save with ENS and resolved address
      await saveAddress(trimmed, address, chatId);
      pendingRegistrations.delete(chatId);
      
      await bot.sendMessage(
        chatId,
        `✅ *Successfully registered!*\n\n` +
        `ENS: \`${trimmed}\`\n` +
        `Address: \`${address}\`\n\n` +
        `Start your node with:\n` +
        `\`node index.js --owner ${trimmed}\`\n\n`,
        { parse_mode: 'Markdown' }
      );
      console.log(`✅ Registered ENS ${trimmed} (${address}) for chatId ${chatId}`);
      
    } else {
      // Try to validate as address
      const normalized = normalizeAddress(trimmed);
      
      if (!normalized) {
        await bot.sendMessage(
          chatId,
          `❌ Invalid Ethereum address: \`${trimmed}\`\n\n` +
          `Please send a valid ENS name or Ethereum address.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // Save with just address (no ENS)
      await saveAddress(null, normalized, chatId);
      pendingRegistrations.delete(chatId);
      
      await bot.sendMessage(
        chatId,
        `✅ *Successfully registered!*\n\n` +
        `Address: \`${normalized}\`\n\n` +
        `Start your node with:\n` +
        `\`node index.js --owner ${normalized}\``,
        { parse_mode: 'Markdown' }
      );
      console.log(`✅ Registered address ${normalized} for chatId ${chatId}`);
    }
    
  } catch (error) {
    console.error('❌ Error handling identifier input:', error);
    pendingRegistrations.delete(chatId);
    await bot.sendMessage(
      chatId,
      '❌ Sorry, something went wrong. Please try /start again.'
    );
  }
}

/**
 * Handle address/ENS change from user
 * @param {number} chatId - Telegram chat ID
 * @param {string} identifier - New ENS name or Ethereum address
 */
async function handleAddressChange(chatId, identifier) {
  try {
    if (!identifier || typeof identifier !== 'string') {
      await bot.sendMessage(
        chatId,
        '❌ Invalid input. Please send a valid ENS name or Ethereum address.'
      );
      return;
    }

    const trimmed = identifier.trim();
    const oldInfo = pendingChanges.get(chatId);
    
    if (!oldInfo) {
      await bot.sendMessage(
        chatId,
        '❌ Session expired. Please use /change again.'
      );
      return;
    }

    // Check if it's an ENS
    if (isENS(trimmed)) {
      console.log(`🔍 Resolving new ENS ${trimmed} for chatId ${chatId}`);
      await bot.sendMessage(chatId, `🔍 Resolving ENS: \`${trimmed}\`...`, { parse_mode: 'Markdown' });
      
      const address = await resolveENS(trimmed);
      
      if (!address) {
        await bot.sendMessage(
          chatId,
          `❌ Failed to resolve ENS: \`${trimmed}\`\n\n` +
          `Please check the ENS name and try again, or use your Ethereum address instead.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // Delete old registration
      await deleteAddress(oldInfo.oldAddress);
      
      // Save new registration with ENS and resolved address
      await saveAddress(trimmed, address, chatId);
      pendingChanges.delete(chatId);
      
      await bot.sendMessage(
        chatId,
        `✅ *Successfully changed!*\n\n` +
        `Old: \`${oldInfo.oldEns || oldInfo.oldAddress}\`\n` +
        `New ENS: \`${trimmed}\`\n` +
        `New Address: \`${address}\`\n\n` +
        `Start your node with:\n` +
        `\`node index.js --owner ${trimmed}\`\n\n`,
        { parse_mode: 'Markdown' }
      );
      console.log(`✅ Changed from ${oldInfo.oldAddress} to ${trimmed} (${address}) for chatId ${chatId}`);
      
    } else {
      // Try to validate as address
      const normalized = normalizeAddress(trimmed);
      
      if (!normalized) {
        await bot.sendMessage(
          chatId,
          `❌ Invalid Ethereum address: \`${trimmed}\`\n\n` +
          `Please send a valid ENS name or Ethereum address.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // Delete old registration
      await deleteAddress(oldInfo.oldAddress);
      
      // Save new registration with just address (no ENS)
      await saveAddress(null, normalized, chatId);
      pendingChanges.delete(chatId);
      
      await bot.sendMessage(
        chatId,
        `✅ *Successfully changed!*\n\n` +
        `Old: \`${oldInfo.oldEns || oldInfo.oldAddress}\`\n` +
        `New Address: \`${normalized}\`\n\n` +
        `Start your node with:\n` +
        `\`node index.js --owner ${normalized}\``,
        { parse_mode: 'Markdown' }
      );
      console.log(`✅ Changed from ${oldInfo.oldAddress} to ${normalized} for chatId ${chatId}`);
    }
    
  } catch (error) {
    console.error('❌ Error handling address change:', error);
    pendingChanges.delete(chatId);
    await bot.sendMessage(
      chatId,
      '❌ Sorry, something went wrong. Please try /change again.'
    );
  }
}

/**
 * Handle deletion confirmation from user
 * @param {number} chatId - Telegram chat ID
 * @param {string} response - User's response
 */
async function handleDeletionConfirmation(chatId, response) {
  try {
    const deletionInfo = pendingDeletions.get(chatId);
    
    if (!deletionInfo) {
      await bot.sendMessage(
        chatId,
        '❌ Session expired. Please use /stop again if you want to delete your data.'
      );
      return;
    }

    const normalizedResponse = response.trim().toLowerCase();
    
    if (normalizedResponse === 'y' || normalizedResponse === 'yes') {
      // User confirmed - delete the data
      await deleteAddress(deletionInfo.address);
      pendingDeletions.delete(chatId);
      
      const identifier = deletionInfo.ens || deletionInfo.address;
      
      await bot.sendMessage(
        chatId,
        `✅ *Successfully Opted Out*\n\n` +
        `Your registration has been deleted: \`${identifier}\`\n\n` +
        `You will no longer receive alerts. If you change your mind, use /start to register again.`,
        { parse_mode: 'Markdown' }
      );
      console.log(`🗑️  Deleted registration ${identifier} for chatId ${chatId}`);
    } else {
      // User cancelled
      pendingDeletions.delete(chatId);
      
      await bot.sendMessage(
        chatId,
        `✅ *Deletion Cancelled*\n\n` +
        `Your registration is still active. You will continue to receive alerts.`
      );
      console.log(`❌ Deletion cancelled by chatId ${chatId}`);
    }
    
  } catch (error) {
    console.error('❌ Error handling deletion confirmation:', error);
    pendingDeletions.delete(chatId);
    await bot.sendMessage(
      chatId,
      '❌ Sorry, something went wrong. Please try /stop again.'
    );
  }
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
  
  const formattedMessage = 
    `${message}\n\n` +
    `Time: ${timestamp}`;

  await bot.sendMessage(chatId, formattedMessage, { parse_mode: 'Markdown' });
  console.log(`📤 Alert sent to chatId ${chatId}: ${alertType}`);
}

/**
 * Process incoming webhook update
 * @param {object} update - Telegram update object
 */
function processWebhookUpdate(update) {
  if (!bot) {
    throw new Error('Bot not initialized');
  }
  bot.processUpdate(update);
}

/**
 * Get the webhook path for the bot
 * @returns {string|null} Webhook path or null if using polling
 */
function getWebhookPath() {
  return bot ? bot.webhookPath : null;
}

/**
 * Stop the Telegram bot
 */
function stopBot() {
  if (bot) {
    // Only stop polling if it was started
    if (bot.isPolling()) {
      bot.stopPolling();
      console.log('🛑 Telegram bot polling stopped');
    } else {
      console.log('🛑 Telegram bot webhook closed');
    }
  }
}

module.exports = {
  initializeBot,
  sendAlert,
  stopBot,
  processWebhookUpdate,
  getWebhookPath
};
