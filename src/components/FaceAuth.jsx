import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  loadFaceApiModels,
  getFaceDescriptor,
  saveFaceDescriptor,
  findMatchingUser,
  hasFaceRegistered,
  removeFaceDescriptor,
} from "../utils/faceAuth";

/**
 * FaceAuth – webcam-based face registration and face login.
 *
 * Props:
 *  mode        "register" | "login"
 *  currentUser Firebase user object (required for "register" mode)
 *  onMatch     (entry) => void – called after successful face login match
 *  onCancel    () => void – called when user closes the component
 */
export default function FaceAuth({ mode, currentUser, onMatch, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [status, setStatus] = useState("idle"); // idle | loading | ready | detecting | success | error
  const [message, setMessage] = useState("");
  const [registered, setRegistered] = useState(false);

  // ── helpers ────────────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setStatus("loading");
    setMessage("Loading face recognition models…");

    try {
      await loadFaceApiModels();
    } catch {
      setStatus("error");
      setMessage("Failed to load face recognition models. Check your connection.");
      return;
    }

    setMessage("Requesting camera access…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("ready");
      setMessage(
        mode === "register"
          ? "Position your face in the frame and click Register."
          : "Position your face in the frame and click Scan."
      );
    } catch {
      setStatus("error");
      setMessage("Camera access denied. Please allow camera permissions and try again.");
    }
  }, [mode]);

  // Check registration status on mount
  useEffect(() => {
    if (mode === "register" && currentUser) {
      setRegistered(hasFaceRegistered(currentUser.uid));
    }
  }, [mode, currentUser]);

  // Start camera when component mounts
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // ── actions ────────────────────────────────────────────────────────────────

  const handleRegister = async () => {
    if (!videoRef.current || !currentUser) return;
    setStatus("detecting");
    setMessage("Detecting face…");

    const descriptor = await getFaceDescriptor(videoRef.current);
    if (!descriptor) {
      setStatus("ready");
      setMessage("No face detected. Make sure your face is visible and well-lit.");
      return;
    }

    saveFaceDescriptor(
      currentUser.uid,
      currentUser.email,
      currentUser.displayName,
      descriptor
    );
    setRegistered(true);
    setStatus("success");
    setMessage("Face registered successfully! You can now use Face Login.");
  };

  const handleRemove = () => {
    if (!currentUser) return;
    removeFaceDescriptor(currentUser.uid);
    setRegistered(false);
    setMessage("Face data removed.");
  };

  const handleScan = async () => {
    if (!videoRef.current) return;
    setStatus("detecting");
    setMessage("Scanning your face…");

    const descriptor = await getFaceDescriptor(videoRef.current);
    if (!descriptor) {
      setStatus("ready");
      setMessage("No face detected. Ensure good lighting and try again.");
      return;
    }

    const match = await findMatchingUser(descriptor);
    if (match) {
      setStatus("success");
      setMessage(`Recognised as ${match.displayName || match.email}!`);
      stopCamera();
      onMatch(match);
    } else {
      setStatus("ready");
      setMessage("Face not recognised. Please use another sign-in method.");
    }
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  // ── render ─────────────────────────────────────────────────────────────────

  const isDetecting = status === "detecting";
  const isReady = status === "ready" || status === "success" || status === "error";

  return (
    <div className="face-auth-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">
          {mode === "register" ? "Register Your Face" : "Face Login"}
        </h3>
        <button
          onClick={handleCancel}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          aria-label="Close face auth"
        >
          ✕
        </button>
      </div>

      {/* Status message */}
      <p
        className={`text-sm mb-3 text-center ${
          status === "success"
            ? "text-green-600"
            : status === "error"
            ? "text-red-500"
            : "text-gray-500"
        }`}
      >
        {message}
      </p>

      {/* Webcam feed */}
      <div className="face-video-wrapper">
        <video
          ref={videoRef}
          className="face-video"
          muted
          playsInline
          aria-label="Webcam feed for face recognition"
        />
        {isDetecting && (
          <div className="face-scanning-overlay">
            <div className="face-scan-ring" />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-4">
        {mode === "register" && (
          <>
            <button
              onClick={handleRegister}
              disabled={!isReady || status === "success" || isDetecting}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {isDetecting ? "Detecting…" : registered ? "Update Face" : "Register"}
            </button>
            {registered && (
              <button
                onClick={handleRemove}
                className="px-4 py-2 rounded-lg border border-red-400 text-red-500 text-sm hover:bg-red-50"
              >
                Remove
              </button>
            )}
          </>
        )}
        {mode === "login" && (
          <button
            onClick={handleScan}
            disabled={!isReady || isDetecting}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {isDetecting ? "Scanning…" : "Scan My Face"}
          </button>
        )}
      </div>
    </div>
  );
}
