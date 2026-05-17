import { initializeApp } from 'firebase/app';
import { getAuth, PhoneAuthProvider, signInWithCredential } from 'firebase/auth';

// Firebase config - Using a test project
// Replace with your own Firebase project config from console.firebase.google.com
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'YOUR_FIREBASE_API_KEY',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'your-project.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'your-project-id',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'your-project.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abcdef',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// For testing without Firebase, use mock auth
export const isMockAuth = !firebaseConfig.apiKey || firebaseConfig.apiKey === 'YOUR_FIREBASE_API_KEY';

export { PhoneAuthProvider, signInWithCredential };
