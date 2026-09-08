import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBmLIUYNdvR1DIlVPjVpkU003zC6UyRzgY",
  authDomain: "kingqueen-eu.firebaseapp.com",
  projectId: "kingqueen-eu",
  storageBucket: "kingqueen-eu.firebasestorage.app",
  messagingSenderId: "431999738299",
  appId: "1:431999738299:web:6ef4c7c76ab4171740249e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
