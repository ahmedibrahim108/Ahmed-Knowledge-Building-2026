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
import {
  Firestore,
  doc,
  getDocFromServer,
  getFirestore,
} from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

export const OWNER_ADMIN_EMAIL = 'farrag34567@gmail.com';

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let storageInstance: FirebaseStorage | null = null;
export let firebaseInitError: string | null = null;

try {
  appInstance = initializeApp(firebaseConfig);
  dbInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId);
  authInstance = getAuth(appInstance);
  storageInstance = getStorage(appInstance);
} catch (err) {
  firebaseInitError =
    err instanceof Error ? err.message : 'تعذر تهيئة الاتصال السحابي.';
  console.error('Firebase initialization failed:', err);
}

export const db = dbInstance as Firestore;
export const auth = authInstance as Auth;
export const storage = storageInstance as FirebaseStorage;
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

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = authInstance?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  if (!dbInstance) return;
  try {
    await getDocFromServer(doc(dbInstance, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (dbInstance) {
  void testConnection();
}
