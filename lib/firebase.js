// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAUvOWcm1hvyQ25UfPsRXc7gB4aG8Hhkj8",
  authDomain: "website-livestreaming-15db7.firebaseapp.com",
  projectId: "website-livestreaming-15db7",
  storageBucket: "website-livestreaming-15db7.firebasestorage.app",
  messagingSenderId: "432251830237",
  appId: "1:432251830237:web:387ac4f96faddfe7530034",
  measurementId: "G-EGR7PKX533"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);

export { app, analytics, database };
