import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAxbudofAkh4BDu0SPnXW7mEAOMRzb-F_o",
  authDomain: "roomvision-f14d7.firebaseapp.com",
  projectId: "roomvision-f14d7",
  storageBucket: "roomvision-f14d7.firebasestorage.app"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'furniture3d'));
  snap.forEach(d => console.log(d.id, d.data()));
  process.exit(0);
}
run();
