import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

/**
 * Custom hook that subscribes to Firebase auth state changes.
 * Returns { user, loading } where:
 *   user === undefined  → still resolving initial state
 *   user === null       → not signed in
 *   user === object     → signed in Firebase user
 */
export function useAuth() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
    });
    return unsubscribe;
  }, []);

  return { user, loading: user === undefined };
}
