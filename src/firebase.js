import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBnlkGJvtqXOuFbSs8yZ97Ae3I_J6eeX8U",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "calendarweb-programari.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "calendarweb-programari",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "calendarweb-programari.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "353509269021",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:353509269021:web:ce22221860024efc6730f4",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-EPPTF8N9HQ"
};

console.log("Firebase config:", firebaseConfig);

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore (varianta simplă)
const db = getFirestore(app);
console.log("Firestore initialized (standard).");

const auth = getAuth(app);

// Initialize Analytics if supported
let analytics = null;
try {
  if (typeof window !== 'undefined') {
    analytics = getAnalytics(app);
  }
} catch (error) {
  console.error("Analytics nu a putut fi inițializat:", error);
}

export { db, auth, analytics }; 