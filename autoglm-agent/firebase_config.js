const admin = require("firebase-admin");

// ELITE SPECIALIST: To enable Cloud Sync, generate a new private key from Firebase Project Settings -> Service Accounts.
// Save the downloaded JSON file as `firebase-service-account.json` in this folder (autoglm-agent).
// Once saved, set ENABLE_CLOUD_SYNC to true.

const ENABLE_CLOUD_SYNC = true;

let db = null;

if (ENABLE_CLOUD_SYNC) {
  try {
    const serviceAccount = require("./firebase-service-account.json");
    
    // REPLACE THIS URL with your actual database URL
    const DATABASE_URL = "https://elite-arbitrage-vault-default-rtdb.firebaseio.com";

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: DATABASE_URL
    });

    db = admin.database();
    console.log("[Elite Cloud] Connected to Firebase Realtime Database.");
  } catch (err) {
    console.error("[Elite Cloud] Failed to initialize Firebase:", err.message);
  }
}

// ELITE SPECIALIST: PASTE YOUR DISCORD WEBHOOK URL HERE
const DISCORD_WEBHOOK_URL = "";

module.exports = { db, DISCORD_WEBHOOK_URL };
