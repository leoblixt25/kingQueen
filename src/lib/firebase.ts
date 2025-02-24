
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDHWYq3UvzqbPu39e5kjrk0qfvZMB4K0Pg",
  authDomain: "king-queen-of-the-beach.firebaseapp.com",
  databaseURL: "https://king-queen-of-the-beach-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "king-queen-of-the-beach",
  storageBucket: "king-queen-of-the-beach.firebasestorage.app",
  messagingSenderId: "612744328741",
  appId: "1:612744328741:web:f8b136960dd2f30005f1cc"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
