import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// ELITE SPECIALIST: PASTE YOUR FIREBASE PROJECT CONFIGURATION HERE
// Example:
// const firebaseConfig = {
//   apiKey: "AIzaSyDOCAbC123...",
//   authDomain: "elite-arbitrage.firebaseapp.com",
//   databaseURL: "https://elite-arbitrage-default-rtdb.firebaseio.com",
//   projectId: "elite-arbitrage",
//   storageBucket: "elite-arbitrage.appspot.com",
//   messagingSenderId: "123456789",
//   appId: "1:123456789:web:abcdef123456"
// };

const firebaseConfig = {
  apiKey: "AIzaSyB71cDR24C5X-R3DIqjTbPZZDeJEHRF8gM",
  authDomain: "elite-arbitrage-vault.firebaseapp.com",
  databaseURL: "https://elite-arbitrage-vault-default-rtdb.firebaseio.com",
  projectId: "elite-arbitrage-vault",
  storageBucket: "elite-arbitrage-vault.firebasestorage.app",
  messagingSenderId: "314088347615",
  appId: "1:314088347615:web:6895e0ee47af8b67f5966a"
};

let app = null;
let db = null;

// Only initialize if the user actually pasted the config
if (firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
}

export { db };
