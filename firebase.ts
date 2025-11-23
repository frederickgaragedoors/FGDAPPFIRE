import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Helper to get env vars from Vite or LocalStorage (for preview support)
const getEnvVar = (key: string): string => {
  // 1. Try Vite injected env vars
  const metaEnv = (import.meta as any).env?.[key];
  if (metaEnv) return metaEnv;

  // 2. Try LocalStorage override (set via UI)
  if (typeof window !== 'undefined') {
    try {
      const overrides = JSON.parse(localStorage.getItem('firebase_config_override') || '{}');
      return overrides[key] || '';
    } catch (e) {
      return '';
    }
  }
  return '';
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID')
};

// Export types for use in other files
import type { User } from 'firebase/auth';
export type FirebaseUser = User;

let app;
let auth: ReturnType<typeof getAuth> | undefined;
let db: ReturnType<typeof getFirestore> | undefined;
let storage: ReturnType<typeof getStorage> | undefined;
let googleProvider: GoogleAuthProvider | undefined;

// Check if config is valid (basic check for apiKey)
export const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.apiKey.length > 0);

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    googleProvider = new GoogleAuthProvider();

    // Enable offline persistence
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn("Firestore persistence failed: Multiple tabs open.");
        } else if (err.code == 'unimplemented') {
            console.warn("Firestore persistence not supported by this browser.");
        }
    });
  } catch (error) {
    console.error("Firebase Initialization Error:", error);
  }
} else {
  console.warn("Firebase API keys are missing. App entering setup mode.");
}

export { auth, db, storage, googleProvider };