import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth, type User } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, type Firestore, type QuerySnapshot, type DocumentData, type DocumentSnapshot } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Export types for use in other files, aliased to match previous usage
export type FirebaseUser = User;
export type FirebaseQuerySnapshot<T = DocumentData> = QuerySnapshot<T>;
export type FirebaseDocumentData = DocumentData;
export type FirebaseDocumentSnapshot<T = DocumentData> = DocumentSnapshot<T>;

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

// Export these as let variables so they can be conditionally assigned
let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let googleProvider: GoogleAuthProvider | undefined;
let db: Firestore | undefined;
let storageInstance: FirebaseStorage | undefined;

// Check if config is valid (basic check for apiKey)
export const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.apiKey.length > 0);

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    db = getFirestore(app);
    storageInstance = getStorage(app);

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

// Components should check `isFirebaseConfigured` before using these.
export { authInstance as auth, googleProvider, db, storageInstance as storage };