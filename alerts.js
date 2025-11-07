const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

/**
 * Validate that all required environment variables and files are present
 * @returns {boolean} True if all required vars and files are present
 */
function validateEnvVars() {
  const required = [
    'TELEGRAM_BOT_TOKEN',
    'PORT'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n📝 Please update your .env file with the required values.');
    return false;
  }

  // Check for webhook URL (optional, but recommended for production)
  if (process.env.WEBHOOK_URL) {
    console.log('✅ Webhook URL configured - will use webhooks instead of polling');
  } else {
    console.log('⚠️  No WEBHOOK_URL configured - will use polling (not recommended for production)');
  }

  // Check for Firebase service account file
  const firebasePath = path.join(__dirname, 'firebase-service-account.json');
  if (!fs.existsSync(firebasePath)) {
    console.error('❌ Missing firebase-service-account.json file');
    console.error('📝 Please add your Firebase service account JSON file to the project root.');
    console.error('   Download it from: Firebase Console → Project Settings → Service Accounts');
    return false;
  }

  return true;
}

/**
 * Check if .env file exists, if not, copy from .env.example
 */
function ensureEnvFile() {
  const envPath = path.join(__dirname, '.env');
  const examplePath = path.join(__dirname, '.env.example');

  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
      console.log('✅ Created .env file from .env.example');
      console.log('📝 Please edit .env with your actual values and restart the service.');
      process.exit(0);
    } else {
      console.error('❌ Neither .env nor .env.example found!');
      console.error('📝 Please create a .env file with the required variables.');
      process.exit(1);
    }
  }
}

/**
 * Main function to start the service
 */
async function main() {
  console.log('🚀 Starting BuidlGuidl Telegram Alert Service...\n');

  // Ensure .env file exists
  ensureEnvFile();

  // Validate environment variables
  if (!validateEnvVars()) {
    process.exit(1);
  }

  try {
    // Initialize Firebase
    const { initializeFirebase } = require('./firebase');
    initializeFirebase();

    // Initialize Telegram bot with webhook support
    const { initializeBot, stopBot } = require('./bot');
    const webhookUrl = process.env.WEBHOOK_URL || null;
    await initializeBot(process.env.TELEGRAM_BOT_TOKEN, webhookUrl);

    // Start API server (after bot initialization so webhook path is available)
    const { createAPI } = require('./api');
    const port = parseInt(process.env.PORT) || 3000;
    const { server } = createAPI(port);

    console.log('\n✅ All services started successfully!');
    console.log(`🤖 Telegram bot is ready (${webhookUrl ? 'webhook mode' : 'polling mode'})`);
    console.log(`🌐 API server is running on port ${port}`);
    console.log('\n📊 Service Status:');
    console.log('   - Health Check: https://localhost:' + port + '/health');
    console.log('   - Alert Endpoint: https://localhost:' + port + '/api/alert');
    if (webhookUrl) {
      console.log('   - Webhook URL: ' + webhookUrl);
    }
    console.log('\n⏹️  Press Ctrl+C to stop the service\n');

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n\n🛑 Received ${signal}, shutting down gracefully...`);
      
      // Stop accepting new connections
      server.close(() => {
        console.log('✅ API server closed');
      });

      // Stop Telegram bot (polling or webhook)
      stopBot();

      console.log('✅ Shutdown complete. Goodbye! 👋\n');
      process.exit(0);
    };

    // Handle shutdown signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start service:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Start the service
main();

