import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

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
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
