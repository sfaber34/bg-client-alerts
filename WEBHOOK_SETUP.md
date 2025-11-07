# Telegram Bot Webhook Setup

## Overview

The bot now supports both **polling** (default/fallback) and **webhooks** (recommended for production).

## Webhook Benefits

- ✅ No connection reset errors (ECONNRESET)
- ✅ More reliable and efficient
- ✅ Lower latency for message delivery
- ✅ Better for production environments

## Setup Instructions

### 1. Add Webhook URL to Environment Variables

Add this to your `.env` file:

```env
WEBHOOK_URL=https://your-domain.com
```

**Important:** 
- Use `https://` (SSL required by Telegram)
- Don't include the port if using standard HTTPS port (443)
- Don't include a trailing slash
- The webhook path will be automatically generated as `/webhook/{YOUR_BOT_TOKEN}`

### 2. Ensure Your Server is Accessible

Your HTTPS server must be:
- Publicly accessible from the internet
- Using a valid SSL certificate (self-signed won't work with Telegram)
- Running on the port specified in your `.env` file

### 3. Restart the Service

```bash
pm2 restart alerts
# or
npm start
```

### 4. Verify Webhook is Set

Check the startup logs for:
```
✅ Webhook URL configured - will use webhooks instead of polling
🔗 Webhook set to: https://your-domain.com/webhook/YOUR_BOT_TOKEN
🔗 Webhook endpoint registered: /webhook/YOUR_BOT_TOKEN
🤖 Telegram bot is ready (webhook mode)
```

## Fallback to Polling

If `WEBHOOK_URL` is not set or commented out, the bot will automatically fall back to polling mode:

```env
# WEBHOOK_URL=https://your-domain.com
```

This is useful for:
- Local development
- Testing
- When you don't have a public domain

## Troubleshooting

### Webhook not receiving updates

1. **Check Telegram's webhook info:**
   ```bash
   curl "https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getWebhookInfo"
   ```

2. **Verify your domain is accessible:**
   ```bash
   curl https://your-domain.com/health
   ```

3. **Check the logs** for any errors during webhook setup

### Switch back to polling

Simply remove or comment out `WEBHOOK_URL` in your `.env` file and restart.

## Security Notes

- The webhook path includes your bot token for security
- Only Telegram's servers should know this path
- Don't expose this path publicly in documentation
- The webhook endpoint automatically validates requests

## Example .env Configuration

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Webhook URL (optional - remove to use polling)
WEBHOOK_URL=https://alerts.yourdomain.com

# Server Configuration
PORT=3001
```

