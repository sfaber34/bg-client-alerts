# BuidlGuidl Telegram Alert Service

A Node.js backend service that enables buidlguidl-client users to receive Telegram alerts when their Ethereum clients (Reth/Lighthouse) crash.

## 🎯 Features

- **Telegram Bot Interface** - Simple bot commands for token management
- **REST API** - Receive alerts from buidlguidl-client
- **Firebase Firestore** - Persistent token storage
- **Rate Limiting** - 20 alerts per hour per token
- **Graceful Shutdown** - Proper cleanup on SIGINT/SIGTERM
- **Error Handling** - Comprehensive error handling throughout

## 📋 Prerequisites

- Node.js (v16 or higher)
- Yarn package manager
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Firebase project with Firestore enabled
- Firebase service account JSON file
- AWS EC2 instance (for production deployment, optional)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd buidlguidl-client-alerts
yarn install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Create .env file
cat > .env << 'EOF'
TELEGRAM_BOT_TOKEN=your_bot_token_here
PORT=3000
EOF
```

Required variables:
- `TELEGRAM_BOT_TOKEN` - Get from [@BotFather](https://t.me/BotFather)
- `PORT` - Port to run the API server (default: 3000)

### 3. Get Telegram Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Follow the prompts to create your bot
4. Copy the bot token provided
5. Paste it in your `.env` file

### 4. Setup Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable Firestore Database
4. Go to Project Settings → Service Accounts
5. Click "Generate New Private Key"
6. Download the JSON file
7. Save it as `firebase-service-account.json` in the project root directory
   ```bash
   # The file should be in the same directory as alerts.js
   # It's already in .gitignore so it won't be committed
   ```

### 5. Create Firestore Indexes

In Firebase Console → Firestore Database → Indexes, create these indexes:

**Collection: `tokens`**
- Index on `token` (Ascending)
- Index on `chatId` (Ascending)

### 6. Verify Setup

Make sure you have both required files:
- `.env` with your Telegram bot token and port
- `firebase-service-account.json` with your Firebase credentials

### 7. Start the Service

```bash
yarn start
```

You should see:
```
✅ All services started successfully!
🤖 Telegram bot is ready
🌐 API server is running on port 3000
```

## 📱 User Flow

### For End Users

1. **Open Telegram** and search for your bot (e.g., `@BuidlGuidlAlertBot`)
2. **Send `/start`** command
3. **Receive your token** (e.g., `XYZ789`)
4. **Start your node** with the token:
   ```bash
   node alerts.js --telegram-token XYZ789
   ```
5. **Receive alerts** when your clients crash!

### Bot Commands

- `/start` - Generate your unique token (or show existing one)
- `/showToken` - Display your current token
- `/help` - Show help message with setup instructions

## 🔌 API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok"
}
```

### Send Alert

```bash
POST /api/alert
Content-Type: application/json

{
  "token": "ABC123",
  "message": "Reth client exited with code 1",
  "alertType": "RETH CRASH"
}
```

Success Response (200):
```json
{
  "success": true,
  "message": "Alert sent successfully"
}
```

Error Response (404):
```json
{
  "error": "Token not found",
  "details": "This token is not registered. Use /start in Telegram to generate a token."
}
```

Error Response (429 - Rate Limited):
```json
{
  "error": "Too many alerts from this token. Maximum 20 alerts per hour."
}
```

### Alert Message Format

Telegram messages are formatted like this:

```
🔴 RETH CRASH

Reth client exited with code 1

Time: 2025-11-04 15:30:45 UTC
```

## 🏗️ Project Structure

```
bg-client-alerts/
├── alerts.js                          # Entry point, env validation, startup
├── bot.js                             # Telegram bot command handlers
├── api.js                             # Express REST API
├── firebase.js                        # Firebase initialization
├── utils.js                           # Token generation and helpers
├── package.json                       # Dependencies and scripts
├── .gitignore                         # Git ignore rules
├── firebase-service-account.json      # Firebase credentials (git-ignored)
├── firebase-service-account.json.example  # Template for Firebase credentials
└── README.md                          # This file
```

## 🗄️ Firebase Schema

### Collection: `tokens`

```json
{
  "token": "ABC123",
  "chatId": 123456789,
  "createdAt": "2025-11-04T15:30:45.123Z"
}
```

- `token` (string) - 6-character alphanumeric token
- `chatId` (number) - Telegram chat ID
- `createdAt` (timestamp) - When the token was created

## 🔒 Security Features

- All sensitive data stored in `.env` and `firebase-service-account.json` (both git-ignored)
- Firebase credentials never exposed in environment variables
- Token validation (format and existence)
- Rate limiting (20 alerts per hour per token)
- Input validation on all endpoints
- Message length limits (1000 chars)
- No hardcoded secrets

## 🚨 Rate Limiting

To prevent spam and abuse:
- **20 alerts per hour** per token
- Tracked by token value
- Returns 429 status when exceeded
- Window resets after 1 hour

## 🎨 Alert Types & Emojis

- 🔴 Crash alerts (contains "crash")
- ⚠️  Warning alerts (contains "warning")
- ℹ️  Info alerts (contains "info")
- ⚠️  Custom alerts (default)

## 🐛 Troubleshooting

### Bot not responding

1. Check your `TELEGRAM_BOT_TOKEN` in `.env`
2. Ensure bot is running (check console for "Telegram bot started")
3. Try stopping and restarting the service

### Alerts not being sent

1. Verify token exists: `/showToken` in Telegram
2. Check API endpoint is accessible: `curl http://localhost:3000/health`
3. Check rate limiting (max 20/hour)
4. Check logs for error messages

### Firebase errors

1. Verify `firebase-service-account.json` exists in project root
2. Verify the JSON file is valid (download again if needed)
3. Check Firestore is enabled in Firebase Console
4. Verify service account has Firestore permissions
5. Check indexes are created

### Port already in use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change PORT in .env
PORT=3001
```

## 🌐 Production Deployment (AWS EC2)

### 1. Setup EC2 Instance

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install yarn
npm install -g yarn

# Clone repository
git clone <your-repo-url>
cd buidlguidl-client-alerts
```

### 2. Configure Environment

```bash
# Create .env file
nano .env
```

Add your configuration:
```
TELEGRAM_BOT_TOKEN=your_actual_bot_token
PORT=3000
```

### 3. Upload Firebase Credentials

Upload your `firebase-service-account.json` to the project directory:
```bash
# From your local machine, use scp to upload the file
scp firebase-service-account.json ubuntu@your-ec2-ip:/home/ubuntu/bg-client-alerts/

# Or create it directly on the server
nano firebase-service-account.json
# Paste the JSON content from Firebase Console
```

### 4. Install Dependencies

```bash
yarn install
```

### 5. Setup as System Service (Optional)

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/buidlguidl-alerts.service
```

Add:
```ini
[Unit]
Description=BuidlGuidl Telegram Alert Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/buidlguidl-client-alerts
ExecStart=/usr/bin/node alerts.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable buidlguidl-alerts
sudo systemctl start buidlguidl-alerts
sudo systemctl status buidlguidl-alerts
```

### 6. Setup Firewall

```bash
# Allow HTTP (if needed)
sudo ufw allow 3000/tcp

# Or use nginx as reverse proxy (recommended)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 7. Monitor Logs

```bash
# View service logs
sudo journalctl -u buidlguidl-alerts -f

# Or if running manually
tail -f nohup.out
```

## 📊 Monitoring

### Check Service Health

```bash
curl http://localhost:3000/health
```

### View Logs

The service logs important events:
- ✅ Successful operations
- ❌ Errors
- 📱 Bot commands received
- 📤 Alerts sent
- 🔑 Token operations

### Example Log Output

```
🚀 Starting BuidlGuidl Telegram Alert Service...

✅ Firebase initialized successfully
🤖 Telegram bot started successfully
🚀 API server listening on port 3000

✅ All services started successfully!
📱 /start command received from chatId 123456789
✨ Generated new token ABC123 for chatId 123456789
📤 Alert sent to chatId 123456789: RETH CRASH
```

## 🧪 Testing

### Test Health Endpoint

```bash
curl http://localhost:3000/health
```

### Test Alert Endpoint

```bash
curl -X POST http://localhost:3000/api/alert \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN",
    "message": "Test alert from curl",
    "alertType": "TEST ALERT"
  }'
```

### Test Bot Commands

1. Open Telegram
2. Search for your bot
3. Send `/start`
4. Send `/showToken`
5. Send `/help`

## 📝 Development

### Install Dependencies

```bash
yarn install
```

### Run in Development Mode

```bash
yarn dev
```

### Code Structure

- `alerts.js` - Entry point with env validation and startup logic
- `bot.js` - Telegram bot with command handlers
- `api.js` - Express server with endpoints
- `firebase.js` - Firebase initialization
- `utils.js` - Helper functions (token generation, lookups, validation)

## 🤝 Integration with buidlguidl-client

Your client application should send alerts like this:

```javascript
const axios = require('axios');

async function sendAlert(token, message, alertType) {
  try {
    const response = await axios.post('http://your-server:3000/api/alert', {
      token,
      message,
      alertType
    });
    console.log('Alert sent:', response.data);
  } catch (error) {
    console.error('Failed to send alert:', error.message);
  }
}

// Example usage
sendAlert('ABC123', 'Reth client exited with code 1', 'RETH CRASH');
```

## 📄 License

MIT

## 🙋 Support

For issues or questions:
1. Check the troubleshooting section
2. Review logs for error messages
3. Verify environment variables are correct
4. Check Firebase and Telegram bot configuration

## 🎉 Success Criteria Checklist

- ✅ Bot responds to `/start`, `/showToken`, `/help`
- ✅ Tokens stored in Firebase and retrievable
- ✅ API endpoint receives alerts and sends Telegram messages
- ✅ Invalid tokens return 404 error
- ✅ Rate limiting prevents spam (20/hour)
- ✅ Service validates `.env` on startup
- ✅ Graceful error handling throughout
- ✅ Graceful shutdown on SIGINT/SIGTERM

---

Built with ❤️ for the BuidlGuidl community

