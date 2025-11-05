const admin = require('firebase-admin');
const path = require('path');

let db = null;

/**
 * Initialize Firebase Admin SDK
 * @returns {object} Firestore database instance
 */
function initializeFirebase() {
  if (db) {
    return db;
  }

  try {
    // Load the service account JSON from file
    const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    db = admin.firestore();
    console.log('✅ Firebase initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    throw error;
  }
}

/**
 * Get Firestore database instance
 * @returns {object} Firestore database instance
 */
function getDb() {
  if (!db) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return db;
}

module.exports = {
  initializeFirebase,
  getDb
};

