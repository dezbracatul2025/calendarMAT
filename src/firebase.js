import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBnlkGJvtqXOuFbSs8yZ97Ae3I_J6eeX8U",
  authDomain: "calendarweb-programari.firebaseapp.com",
  projectId: "calendarweb-programari",
  storageBucket: "calendarweb-programari.firebasestorage.app",
  messagingSenderId: "353509269021",
  appId: "1:353509269021:web:ce22221860024efc6730f4",
  measurementId: "G-EPPTF8N9HQ"
};

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