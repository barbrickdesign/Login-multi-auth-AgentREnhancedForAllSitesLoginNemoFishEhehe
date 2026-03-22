import React, { useState, useEffect } from "react";
import {
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  auth,
  googleProvider,
  githubProvider,
  facebookProvider,
  twitterProvider,
  microsoftProvider,
  appleProvider,
} from "./firebase";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "./hooks/useAuth";
import FaceAuth from "./components/FaceAuth";
import {
  PARTNER_SITES,
  buildSSOLink,
  consumeIncomingSSOToken,
} from "./utils/crossSiteAuth";
import { loadAllDescriptors, hasFaceRegistered } from "./utils/faceAuth";

function App() {
  const { user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  // Face auth UI state
  const [faceMode, setFaceMode] = useState(null); // null | "login" | "register"

  // Cross-site SSO: incoming verified user record from partner site
  const [ssoGuest, setSsoGuest] = useState(null);

  // Whether at least one face descriptor is stored locally
  const hasFaceUsers = Object.keys(loadAllDescriptors()).length > 0;

  // ── On mount: consume any incoming SSO token ────────────────────────────
  useEffect(() => {
    consumeIncomingSSOToken().then((record) => {
      if (record) {
        setSsoGuest(record);
        toast(
          `Welcome back, ${record.displayName || record.email}! Sign in to continue.`,
          { icon: "🔗", duration: 6000 }
        );
      }
    });
  }, []);

  // ── Social provider login ───────────────────────────────────────────────
  const handleLogin = async (provider, providerName) => {
    try {
      await signInWithPopup(auth, provider);
      toast.success(`Logged in using ${providerName}`);
      setSsoGuest(null);
    } catch (error) {
      let message;
      switch (error.code) {
        case "auth/invalid-credential":
          message = `Could not authenticate with ${providerName}. Please try again.`;
          break;
        case "auth/operation-not-allowed":
          message = `${providerName} login is not enabled. Please contact support.`;
          break;
        case "auth/cancelled-popup-request":
          message = "Login was canceled. Please try again.";
          break;
        case "auth/popup-closed-by-user":
          message = "You closed the login window before completing the process.";
          break;
        case "auth/network-request-failed":
          message = "Network error. Check your internet connection and try again.";
          break;
        case "auth/account-exists-with-different-credential":
          message =
            "This email is already linked to another sign-in method. Use the method you signed up with.";
          break;
        default:
          message = "Something went wrong. Please try again later.";
      }
      toast.error(message);
    }
  };

  // ── Logout ──────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await signOut(auth);
    setSsoGuest(null);
    toast("Logged out successfully", { icon: "👋" });
  };

  // ── Email / password auth ────────────────────────────────────────────────
  const handleEmailAuth = async () => {
    try {
      if (isSignUp) {
        if (!name || !email || !password) {
          toast.error("Please fill in all fields");
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(auth.currentUser, { displayName: name });
        toast.success("Account created successfully ✅");
      } else {
        if (!email || !password) {
          toast.error("Please enter your email and password");
          return;
        }
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Logged in successfully ✅");
      }
      setSsoGuest(null);
    } catch (error) {
      let message;
      switch (error.code) {
        case "auth/invalid-email":
          message = "Invalid email address. Please enter a valid email.";
          break;
        case "auth/missing-password":
          message = "Password is required.";
          break;
        case "auth/weak-password":
          message = "Password is too weak. It should be at least 6 characters.";
          break;
        case "auth/email-already-in-use":
          message = "This email is already registered. Try logging in.";
          break;
        case "auth/user-not-found":
          message = "No account found with this email.";
          break;
        case "auth/wrong-password":
          message = "Incorrect password. Please try again.";
          break;
        default:
          message = "Something went wrong. Please try again.";
      }
      toast.error(message);
    }
  };

  // ── Face login callback ──────────────────────────────────────────────────
  const handleFaceMatch = (matchEntry) => {
    setFaceMode(null);
    toast.success(
      `Face recognised as ${matchEntry.displayName || matchEntry.email}! Sign in to confirm.`,
      { duration: 6000 }
    );
    // Pre-fill email so the user can confirm with email/password or a social provider.
    if (matchEntry.email) {
      setEmail(matchEntry.email);
    }
    setSsoGuest(null);
  };

  // ── Open partner site with SSO token ─────────────────────────────────────
  const openPartnerSite = async (site) => {
    const link = await buildSSOLink(site.url);
    window.open(link, "_blank", "noopener,noreferrer");
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center flex-col w-full">
      <Toaster position="bottom-center" />

      {/* ── Logged-in dashboard ── */}
      {user ? (
        <div className="bg-white shadow-lg rounded-xl p-6 m-6 sm:m-8 sm:p-8 sm:w-[100vw] w-full max-w-md text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Hello, {user.displayName || "User"} 👋
          </h2>
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt="Profile"
              className="w-16 h-16 rounded-full mx-auto mb-2 object-cover"
            />
          )}
          <p className="text-gray-500 text-sm mb-6">{user.email}</p>

          {/* Face recognition management */}
          {faceMode === "register" ? (
            <FaceAuth
              mode="register"
              currentUser={user}
              onMatch={() => {}}
              onCancel={() => setFaceMode(null)}
            />
          ) : (
            <button
              onClick={() => setFaceMode("register")}
              className="w-full mb-4 flex items-center justify-center gap-2 border border-purple-400 text-purple-600 py-2 rounded-lg font-semibold hover:bg-purple-50 transition text-sm"
            >
              <span>🪪</span>
              {hasFaceRegistered(user.uid)
                ? "Manage Face Recognition"
                : "Register Face for Quick Login"}
            </button>
          )}

          {/* Cross-site SSO links */}
          <div className="mt-2">
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
              Open on partner sites (one-click SSO)
            </p>
            <div className="flex flex-col gap-2">
              {PARTNER_SITES.map((site) => (
                <button
                  key={site.url}
                  onClick={() => openPartnerSite(site)}
                  className="flex items-center justify-center gap-2 border border-gray-300 text-gray-600 py-2 rounded-lg hover:border-purple-400 hover:text-purple-600 transition text-sm"
                >
                  <span>🔗</span>
                  {site.name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="mt-6 w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-semibold"
          >
            Logout
          </button>
        </div>
      ) : (
        /* ── Login / Sign-up form ── */
        <div className="bg-white shadow-lg rounded-xl p-6 m-6 sm:m-8 sm:p-8 sm:w-[100vw] w-full max-w-md text-center">

          {/* Cross-site SSO guest banner */}
          {ssoGuest && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-left">
              <p className="text-sm text-blue-700 font-medium">
                🔗 Cross-site session detected
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Recognised as{" "}
                <strong>{ssoGuest.displayName || ssoGuest.email}</strong>.
                Sign in below to continue.
              </p>
            </div>
          )}

          <h2 className="text-2xl font-bold mb-6 text-gray-800">
            {isSignUp ? "Create a New Account" : "Log In"}
          </h2>

          {/* Face login shortcut (only shown when descriptors are stored and not signing up) */}
          {faceMode === null && !isSignUp && hasFaceUsers && (
            <button
              onClick={() => setFaceMode("login")}
              className="w-full mb-4 flex items-center justify-center gap-2 border-2 border-purple-500 text-purple-600 py-2 rounded-lg font-semibold hover:bg-purple-50 transition"
            >
              <span>🪪</span> Continue with Face Recognition
            </button>
          )}

          {/* Inline face login panel */}
          {faceMode === "login" && (
            <div className="mb-4">
              <FaceAuth
                mode="login"
                currentUser={null}
                onMatch={handleFaceMatch}
                onCancel={() => setFaceMode(null)}
              />
              <div className="flex items-center my-4">
                <hr className="flex-grow border-gray-200" />
                <span className="px-3 text-gray-400 text-xs">or use another method</span>
                <hr className="flex-grow border-gray-200" />
              </div>
            </div>
          )}

          {/* Social login buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => handleLogin(googleProvider, "Google")}
              className="btn-social"
            >
              <img src="assets/icons/google-icon-logo-svgrepo-com.svg" alt="Google" className="icon" />
              Google
            </button>
            <button
              onClick={() => handleLogin(githubProvider, "GitHub")}
              className="btn-social"
            >
              <img src="assets/icons/github-142-svgrepo-com.svg" alt="GitHub" className="icon" />
              GitHub
            </button>
            <button
              onClick={() => handleLogin(twitterProvider, "Twitter")}
              className="btn-social"
            >
              <img src="assets/icons/twitter-color-svgrepo-com.svg" alt="Twitter" className="icon" />
              Twitter / X
            </button>
            <button
              onClick={() => handleLogin(facebookProvider, "Facebook")}
              className="btn-social"
            >
              <img src="assets/icons/facebook-svgrepo-com.svg" alt="Facebook" className="icon" />
              Facebook
            </button>
            <button
              onClick={() => handleLogin(microsoftProvider, "Microsoft")}
              className="btn-social"
            >
              <img src="assets/icons/microsoft-svgrepo-com.svg" alt="Microsoft" className="icon" />
              Microsoft
            </button>
            <button
              onClick={() => handleLogin(appleProvider, "Apple")}
              className="btn-social"
            >
              <img src="assets/icons/apple-173-svgrepo-com.svg" alt="Apple" className="icon" />
              Apple
            </button>
          </div>

          <div className="flex items-center my-6">
            <hr className="flex-grow border-gray-300" />
            <span className="px-3 text-gray-500 text-sm">Or continue with</span>
            <hr className="flex-grow border-gray-300" />
          </div>

          {isSignUp && (
            <>
              <label
                htmlFor="name"
                className="block mb-1 text-sm font-medium text-gray-700 text-left"
              >
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Enter your name"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </>
          )}

          <label
            htmlFor="email"
            className="block mb-1 text-sm font-medium text-gray-700 text-left"
          >
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Enter your email"
            autoComplete="email"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="mb-4">
            <label
              htmlFor="password"
              className="block mb-1 text-sm font-medium text-gray-700 text-left"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className="input-field pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1 transform-translate-y-1 focus:outline-none"
              >
                <img
                  src={
                    showPassword
                      ? "assets/icons/eye-off-svgrepo-com.svg"
                      : "assets/icons/eye-svgrepo-com.svg"
                  }
                  alt="Toggle password visibility"
                  className="w-5 h-5"
                />
              </button>
            </div>
          </div>

          <button onClick={handleEmailAuth} className="btn-primary">
            {isSignUp ? "Sign Up" : "Log In"}
          </button>

          <p className="mt-4 text-sm text-gray-600">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-purple-600 font-semibold hover:underline underline-offset-4"
            >
              {isSignUp ? "Log In" : "Sign Up"}
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
