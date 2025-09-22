// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC5FfekMX6N8wuVInoXmEMHlIobrPp45Hg",
  authDomain: "chat-app-1b420.firebaseapp.com",
  databaseURL: "https://chat-app-1b420-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chat-app-1b420",
  storageBucket: "chat-app-1b420.firebasestorage.app",
  messagingSenderId: "592738076834",
  appId: "1:592738076834:web:cb03de0235fb6ede2faffb",
  measurementId: "G-6Q1K6YZ2VD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Initialize Analytics only on client side
let analytics;
if (typeof window !== 'undefined') {
  import('firebase/analytics').then(({ getAnalytics }) => {
    analytics = getAnalytics(app);
  });
}

export { app, analytics, database };
