import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, EmailAuthProvider } from "firebase/auth";
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

// Configure Google provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Email link authentication settings
export const actionCodeSettings = {
  // URL you want to redirect back to. Must be whitelisted in Firebase Console
  url: window.location.origin + '/auth/callback',
  handleCodeInApp: true,
};
