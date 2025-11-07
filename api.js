const express = require('express');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { getChatIdByIdentifier, isValidIdentifier } = require('./utils');
const { sendAlert, processWebhookUpdate, getWebhookPath } = require('./bot');

/**
 * Create and configure Express API
 * @param {number} port - Port to listen on
 * @returns {object} Express app and server
 */
function createAPI(port) {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Rate limiting: 100 requests per day per identifier
  const alertLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours (1 day)
    max: 100, // 100 requests per day
    keyGenerator: (req) => {
      // Use ens from request body for rate limiting
      return req.body.ens || req.ip;
    },
    message: {
      error: 'Too many alerts from this identifier. Maximum 100 alerts per day.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Telegram webhook endpoint
  const webhookPath = getWebhookPath();
  if (webhookPath) {
    app.post(webhookPath, (req, res) => {
      try {
        processWebhookUpdate(req.body);
        res.sendStatus(200);
      } catch (error) {
        console.error('❌ Error processing webhook:', error);
        res.sendStatus(500);
      }
    });
    console.log(`🔗 Webhook endpoint registered: ${webhookPath}`);
  }

  // Alert endpoint
  app.post('/api/alert', alertLimiter, async (req, res) => {
    try {
      const { ens, message, alertType } = req.body;

      // Validate required fields
      if (!ens || !message || !alertType) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['ens', 'message', 'alertType']
        });
      }

      // Validate identifier format
      if (!isValidIdentifier(ens)) {
        return res.status(400).json({
          error: 'Invalid identifier format',
          details: 'Must be a valid ENS name or Ethereum address'
        });
      }

      // Validate message length (max 1000 characters)
      if (message.length > 1000) {
        return res.status(400).json({
          error: 'Message too long',
          details: 'Message must be 1000 characters or less'
        });
      }

      // Validate alertType length
      if (alertType.length > 100) {
        return res.status(400).json({
          error: 'Alert type too long',
          details: 'Alert type must be 100 characters or less'
        });
      }

      // Look up chatId from ENS or address
      const chatId = await getChatIdByIdentifier(ens);

      if (!chatId) {
        console.log(`⚠️  Alert attempt with unregistered identifier: ${ens}`);
        return res.status(404).json({
          error: 'Identifier not found',
          details: 'This ENS/address is not registered. Use /start in Telegram to register.'
        });
      }

      // Send alert via Telegram
      await sendAlert(chatId, alertType, message);

      console.log(`✅ Alert sent successfully for identifier ${ens}`);
      res.json({
        success: true,
        message: 'Alert sent successfully'
      });

    } catch (error) {
      console.error('❌ Error in /api/alert endpoint:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: 'Failed to send alert. Please try again later.'
      });
    }
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      details: 'The requested endpoint does not exist'
    });
  });

  // Create HTTPS server with SSL certificates
  const server = https.createServer(
    {
      key: fs.readFileSync("/home/ubuntu/shared/server.key"),
      cert: fs.readFileSync("/home/ubuntu/shared/server.cert"),
    },
    app
  );

  server.listen(port, () => {
    console.log(`🚀 HTTPS API server listening on port ${port}`);
  });

  return { app, server };
}

module.exports = {
  createAPI
};
