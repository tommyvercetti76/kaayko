// scripts/kaayko_firebaseConfig.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyC59ECKLt3rowOoavF76hV_djb--W4jekA",
  authDomain: "kaaykostore.firebaseapp.com",
  projectId: "kaaykostore",
  storageBucket: "kaaykostore.firebasestorage.app",
  messagingSenderId: "87383373015",
  appId: "1:87383373015:web:ee1ce56d4f5192ec67ec92",
  measurementId: "G-W7WN2NXM8M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Enable offline persistence to reduce repeated reads and Firestore costs.
enableIndexedDbPersistence(db)
  .then(() => console.log("Firestore offline persistence enabled"))
  .catch(err => console.error("Error enabling persistence:", err));

export { db, storage };