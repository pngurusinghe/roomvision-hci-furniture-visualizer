import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';

// Try to find a service account key
const files = fs.readdirSync('.');
const keyFile = files.find(f => f.includes('firebase-adminsdk') && f.endsWith('.json'));

if (!keyFile) {
    console.log("No service account key found. I need a service account key to set CORS via Admin SDK.");
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyFile, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'roomvision-f14d7.firebasestorage.app'
});

const bucket = getStorage().bucket();

async function setCors() {
  await bucket.setCorsConfiguration([
    {
      maxAgeSeconds: 3600,
      method: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
      origin: ['*'],
      responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
    },
  ]);
  console.log("CORS configuration successfully updated!");
}
setCors().catch(console.error);
