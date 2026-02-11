import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAxbudofAkh4BDu0SPnXW7mEAOMRzb-F_o",
  authDomain: "roomvision-f14d7.firebaseapp.com",
  projectId: "roomvision-f14d7",
  storageBucket: "roomvision-f14d7.firebasestorage.app",
  messagingSenderId: "514472197494",
  appId: "1:514472197494:web:4178a4124edabb1c514e57",
  measurementId: "G-8881NMGFN9"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
