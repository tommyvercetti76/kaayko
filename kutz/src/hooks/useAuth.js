import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

// Optional: set VITE_ALLOWED_EMAIL in .env.local to restrict access to one address.
// If not set, all signed-in users are allowed (fine for dev / single-user deploys).
const ALLOWED_EMAIL = import.meta.env.VITE_ALLOWED_EMAIL || null;

function isAllowed(user) {
  if (!user) return false;
  if (!ALLOWED_EMAIL) return true;
  return user.email?.toLowerCase() === ALLOWED_EMAIL.toLowerCase();
}

export function useAuth() {
  const [user,         setUser]         = useState(undefined); // undefined = loading
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u && !isAllowed(u)) {
        // Sign them out immediately and show the not-authorised screen
        await signOut(auth);
        setUnauthorized(true);
        setUser(null);
      } else {
        setUnauthorized(false);
        setUser(u);
      }
    });
  }, []);

  async function signIn() {
    const result = await signInWithPopup(auth, googleProvider);
    if (!isAllowed(result.user)) {
      await signOut(auth);
      setUnauthorized(true);
      setUser(null);
    }
  }

  async function logOut() {
    setUnauthorized(false);
    await signOut(auth);
  }

  return { user, signIn, logOut, loading: user === undefined, unauthorized };
}
