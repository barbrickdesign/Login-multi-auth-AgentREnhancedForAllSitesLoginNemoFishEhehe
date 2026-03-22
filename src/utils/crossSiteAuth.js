import { auth } from "../firebase";

/** Sites that share the same Firebase project for cross-site SSO. */
export const PARTNER_SITES = [
  { name: "Barbrick Design", url: "https://barbrickdesign.github.io/" },
  {
    name: "Consciousness Revolution",
    url: "https://consciousnessrevolution.io/",
  },
];

/** URL parameter names used during cross-site token handoff. */
const SSO_PARAM = "ssoToken";

/**
 * Build a link to a partner site that carries the current user's Firebase ID
 * token.  The token is valid for 1 hour; the receiving site verifies it via
 * the Firebase REST API so no backend is required.
 */
export async function buildSSOLink(targetBaseUrl) {
  const user = auth.currentUser;
  if (!user) return targetBaseUrl;

  try {
    const idToken = await user.getIdToken();
    const url = new URL(targetBaseUrl);
    url.searchParams.set(SSO_PARAM, idToken);
    return url.toString();
  } catch {
    return targetBaseUrl;
  }
}

/**
 * Check the current page URL for an incoming SSO token.
 * If found, validate it against the Firebase Identity Toolkit REST endpoint.
 * Returns the verified user record from Firebase, or null on failure.
 *
 * The token parameter is removed from the URL after extraction so it is not
 * kept in browser history.
 */
export async function consumeIncomingSSOToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get(SSO_PARAM);
  if (!token) return null;

  // Strip the token from the address bar immediately.
  params.delete(SSO_PARAM);
  const cleanUrl =
    window.location.pathname +
    (params.toString() ? "?" + params.toString() : "") +
    window.location.hash;
  window.history.replaceState({}, "", cleanUrl);

  // Verify via Firebase Identity Toolkit (no backend required).
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.users?.[0] ?? null;
  } catch {
    return null;
  }
}
