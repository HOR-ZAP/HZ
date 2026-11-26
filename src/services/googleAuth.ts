import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Strict in-memory token cache — never persisted to localStorage, sessionStorage, or IndexedDB
let cachedAccessToken: string | null = null;

export type GoogleUserInfo = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

function mapUser(user: User | null): GoogleUserInfo | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export function initAuth(onAuthChanged: (user: GoogleUserInfo | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedAccessToken = null;
    }
    onAuthChanged(mapUser(user));
  });
}

export async function googleSignIn(): Promise<{ user: GoogleUserInfo; accessToken: string }> {
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_FILE_SCOPE);
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken || null;

  if (!token) {
    throw new Error(
      'Nepodařilo se získat přístupový token pro Google Disk. Zkuste se prosím přihlásit znovu.'
    );
  }

  cachedAccessToken = token;
  const userInfo = mapUser(result.user);
  if (!userInfo) {
    throw new Error('Přihlášení se nezdařilo.');
  }

  return { user: userInfo, accessToken: token };
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearAccessToken(): void {
  cachedAccessToken = null;
}

export async function logout(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}
