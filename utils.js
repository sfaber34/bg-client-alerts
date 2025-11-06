const { getDb } = require('./firebase');
const admin = require('firebase-admin');

/**
 * Generate a random 6-character alphanumeric token
 * @returns {string} 6-character token (e.g., "A1B2C3")
 */
function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Generate a unique token that doesn't exist in the database
 * @returns {Promise<string>} Unique 6-character token
 */
async function generateUniqueToken() {
  const db = getDb();
  let token;
  let exists = true;

  // Keep generating until we find a unique token
  // With 36^6 = 2.1B combinations, collisions are extremely rare
  let attempts = 0;
  const maxAttempts = 10;

  while (exists && attempts < maxAttempts) {
    token = generateToken();
    const snapshot = await db.collection('bgClientAlertTokens').where('token', '==', token).get();
    exists = !snapshot.empty;
    attempts++;
  }

  if (exists) {
    throw new Error('Failed to generate unique token after ' + maxAttempts + ' attempts');
  }

  return token;
}

/**
 * Save token and chatId to Firebase
 * @param {string} token - 6-character token
 * @param {number} chatId - Telegram chat ID
 * @returns {Promise<void>}
 */
async function saveToken(token, chatId) {
  const db = getDb();
  await db.collection('bgClientAlertTokens').doc(token).set({
    token,
    chatId,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log(`💾 Token ${token} saved for chatId ${chatId}`);
}

/**
 * Get chatId by token
 * @param {string} token - 6-character token
 * @returns {Promise<number|null>} Chat ID or null if not found
 */
async function getChatIdByToken(token) {
  const db = getDb();
  const doc = await db.collection('bgClientAlertTokens').doc(token).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data().chatId;
}

/**
 * Get token by chatId
 * @param {number} chatId - Telegram chat ID
 * @returns {Promise<string|null>} Token or null if not found
 */
async function getTokenByChatId(chatId) {
  const db = getDb();
  const snapshot = await db.collection('bgClientAlertTokens').where('chatId', '==', chatId).limit(1).get();
  
  if (snapshot.empty) {
    return null;
  }
  
  return snapshot.docs[0].data().token;
}

/**
 * Validate token format (6 uppercase alphanumeric characters)
 * @param {string} token - Token to validate
 * @returns {boolean} True if valid format
 */
function isValidTokenFormat(token) {
  return typeof token === 'string' && /^[A-Z0-9]{6}$/.test(token);
}

/**
 * Get current UTC timestamp as formatted string
 * @returns {string} Formatted timestamp (e.g., "2025-11-04 15:30:45 UTC")
 */
function getUTCTimestamp() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

module.exports = {
  generateToken,
  generateUniqueToken,
  saveToken,
  getChatIdByToken,
  getTokenByChatId,
  isValidTokenFormat,
  getUTCTimestamp
};

