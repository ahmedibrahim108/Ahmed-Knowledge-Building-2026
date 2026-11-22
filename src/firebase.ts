import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

export const OWNER_ADMIN_EMAIL = 'farrag34567@gmail.com';

export const FIREBASE_PROJECT_INFO = {
  projectId: firebaseConfig.projectId,
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
  storageBucket: firebaseConfig.storageBucket,
};

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
export let firebaseInitError: string | null = null;

try {
  appInstance = initializeApp(firebaseConfig);
  authInstance = getAuth(appInstance);
} catch (err) {
  firebaseInitError =
    err instanceof Error ? err.message : 'تعذر تهيئة خدمة تسجيل الدخول.';
  console.error('Firebase Auth initialization failed:', err);
}

export const firebaseApp = appInstance;
export const auth = authInstance as Auth;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function completeGoogleRedirectIfAny() {
  if (!authInstance) return null;
  try {
    return await getRedirectResult(authInstance);
  } catch (err) {
    console.warn('Redirect sign-in check:', err);
    return null;
  }
}

export async function signInWithGoogle() {
  if (!authInstance) {
    throw new Error(firebaseInitError || 'تعذرت تهيئة تسجيل الدخول السحابي.');
  }
  const isTopWindow =
    typeof window !== 'undefined' && window.self === window.top;
  try {
    return await signInWithPopup(authInstance, googleProvider);
  } catch (err) {
    const code =
      (err as { code?: string } | null)?.code ||
      (err instanceof Error ? err.message : '');
    const popupBlockedOrUnsupported =
      code.includes('popup-blocked') ||
      code.includes('operation-not-supported-in-this-environment') ||
      code.includes('cancelled-popup-request');

    // On real mobile browsers/PWAs (top-level window), seamlessly fall back to full-page redirect login
    if (isTopWindow && popupBlockedOrUnsupported) {
      await signInWithRedirect(authInstance, googleProvider);
      return null;
    }
    throw err;
  }
}

export async function signOutUser() {
  if (!authInstance) return;
  return signOut(authInstance);
}
