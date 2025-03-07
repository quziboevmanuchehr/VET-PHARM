import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA7tFFHyMnjKcuUpbJdY8M4weOH0Cxvpew",
  authDomain: "vetpharma-f9d98.firebaseapp.com",
  projectId: "vetpharma-f9d98",
  storageBucket: "vetpharma-f9d98.firebasestorage.app",
  messagingSenderId: "19286549590",
  appId: "1:19286549590:web:fa207098e8123500d507f7",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };