const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { getChatIdByToken, isValidTokenFormat } = require('./utils');
const { sendAlert } = require('./bot');

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

  // Rate limiting: 20 requests per hour per token
  const alertLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 requests per hour
    keyGenerator: (req) => {
      // Use token from request body for rate limiting
      return req.body.token || req.ip;
    },
    message: {
      error: 'Too many alerts from this token. Maximum 20 alerts per hour.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Alert endpoint
  app.post('/api/alert', alertLimiter, async (req, res) => {
    try {
      const { token, message, alertType } = req.body;

      // Validate required fields
      if (!token || !message || !alertType) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['token', 'message', 'alertType']
        });
      }

      // Validate token format
      if (!isValidTokenFormat(token)) {
        return res.status(400).json({
          error: 'Invalid token format',
          details: 'Token must be 6 uppercase alphanumeric characters'
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

      // Look up chatId from token
      const chatId = await getChatIdByToken(token);

      if (!chatId) {
        console.log(`⚠️  Alert attempt with invalid token: ${token}`);
        return res.status(404).json({
          error: 'Token not found',
          details: 'This token is not registered. Use /start in Telegram to generate a token.'
        });
      }

      // Send alert via Telegram
      await sendAlert(chatId, alertType, message);

      console.log(`✅ Alert sent successfully for token ${token}`);
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

  // Start server
  const server = app.listen(port, () => {
    console.log(`🚀 API server listening on port ${port}`);
  });

  return { app, server };
}

module.exports = {
  createAPI
};

