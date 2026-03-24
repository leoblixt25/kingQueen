import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB59VBp3g79K0yYxcCmxwdp0mvgGTbdxxU",
  authDomain: "kingqueen-c3543.firebaseapp.com",
  projectId: "kingqueen-c3543",
  storageBucket: "kingqueen-c3543.firebasestorage.app",
  messagingSenderId: "243756782404",
  appId: "1:243756782404:web:98d91f75b0e0c11d607d11"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');

// Configure Google provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Configure Apple provider
appleProvider.setCustomParameters({
  locale: 'en' // Optional, forces English interface
});
