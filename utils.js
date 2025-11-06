const { getDb } = require('./firebase');
const admin = require('firebase-admin');
const { ethers } = require('ethers');

// Use a public RPC provider for ENS resolution
const provider = new ethers.JsonRpcProvider('https://mainnet.rpc.buidlguidl.com');

/**
 * Validate and normalize Ethereum address
 * @param {string} address - Ethereum address
 * @returns {string|null} Normalized address or null if invalid
 */
function normalizeAddress(address) {
  try {
    return ethers.getAddress(address).toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Check if string is an ENS name
 * @param {string} identifier - ENS or address
 * @returns {boolean} True if it looks like an ENS name
 */
function isENS(identifier) {
  return typeof identifier === 'string' && identifier.includes('.');
}

/**
 * Resolve ENS to address
 * @param {string} ens - ENS name (e.g., "vitalik.eth")
 * @returns {Promise<string|null>} Resolved address or null if failed
 */
async function resolveENS(ens) {
  try {
    const address = await provider.resolveName(ens);
    if (address) {
      return address.toLowerCase();
    }
    return null;
  } catch (error) {
    console.error(`Failed to resolve ENS ${ens}:`, error.message);
    return null;
  }
}

/**
 * Save ENS/address and chatId to Firebase
 * @param {string} ens - ENS name (can be null if user provided address)
 * @param {string} address - Ethereum address (normalized, lowercase)
 * @param {number} chatId - Telegram chat ID
 * @returns {Promise<void>}
 */
async function saveAddress(ens, address, chatId) {
  const db = getDb();
  await db.collection('bgClientAlertAddresses').doc(address).set({
    ens: ens || null,
    address,
    chatId,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log(`💾 Address ${address} saved for chatId ${chatId}${ens ? ` (ENS: ${ens})` : ''}`);
}

/**
 * Get chatId by ENS or address
 * @param {string} identifier - ENS name or Ethereum address
 * @returns {Promise<number|null>} Chat ID or null if not found
 */
async function getChatIdByIdentifier(identifier) {
  const db = getDb();
  
  // If it's an ENS, resolve it first
  if (isENS(identifier)) {
    const address = await resolveENS(identifier);
    if (!address) {
      return null;
    }
    identifier = address;
  } else {
    // Normalize address
    identifier = normalizeAddress(identifier);
    if (!identifier) {
      return null;
    }
  }
  
  // Look up by address (document ID)
  const doc = await db.collection('bgClientAlertAddresses').doc(identifier).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data().chatId;
}

/**
 * Get address info by chatId
 * @param {number} chatId - Telegram chat ID
 * @returns {Promise<object|null>} Address info (with document ID) or null if not found
 */
async function getAddressByChatId(chatId) {
  const db = getDb();
  const snapshot = await db.collection('bgClientAlertAddresses').where('chatId', '==', chatId).limit(1).get();
  
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0];
  const data = doc.data();
  return {
    ens: data.ens,
    address: data.address,
    docId: doc.id  // Include document ID for deletion
  };
}

/**
 * Delete address registration by document ID (address)
 * @param {string} address - Ethereum address (document ID)
 * @returns {Promise<void>}
 */
async function deleteAddress(address) {
  const db = getDb();
  await db.collection('bgClientAlertAddresses').doc(address).delete();
  console.log(`🗑️  Deleted address ${address} from Firebase`);
}

/**
 * Validate identifier (ENS or address)
 * @param {string} identifier - ENS name or Ethereum address
 * @returns {boolean} True if valid format
 */
function isValidIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    return false;
  }
  
  // Check if it's an ENS name (contains a dot)
  if (isENS(identifier)) {
    return identifier.length > 3; // Basic ENS validation
  }
  
  // Check if it's a valid Ethereum address
  return normalizeAddress(identifier) !== null;
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
  normalizeAddress,
  isENS,
  resolveENS,
  saveAddress,
  getChatIdByIdentifier,
  getAddressByChatId,
  deleteAddress,
  isValidIdentifier,
  getUTCTimestamp
};
