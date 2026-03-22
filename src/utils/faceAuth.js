/** Lazily-loaded face-api module (code-split to keep the initial bundle small). */
let faceapi = null;

async function getFaceApi() {
  if (!faceapi) {
    faceapi = await import("@vladmandic/face-api");
  }
  return faceapi;
}

// Serve models from the npm package via jsDelivr CDN so no binary files
// need to be committed to the repository.
const MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/";

let modelsLoaded = false;
let modelsLoading = null;

/** Load the three face-api models needed for recognition (idempotent). */
export async function loadFaceApiModels() {
  if (modelsLoaded) return;
  if (modelsLoading) return modelsLoading;

  modelsLoading = (async () => {
    const fa = await getFaceApi();
    await Promise.all([
      fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      fa.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
  })();

  await modelsLoading;
  modelsLoaded = true;
}

/**
 * Detect a single face in a <video> element and return its 128-D descriptor.
 * Returns null if no face is detected.
 */
export async function getFaceDescriptor(videoEl) {
  const fa = await getFaceApi();
  const detection = await fa
    .detectSingleFace(videoEl, new fa.TinyFaceDetectorOptions())
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  return detection ? detection.descriptor : null;
}

/** Compute the euclidean distance between two face descriptors. */
export async function faceDistance(a, b) {
  const fa = await getFaceApi();
  return fa.euclideanDistance(a, b);
}

/** Return true if two descriptors are close enough to be the same person. */
export async function isSameFace(a, b, threshold = 0.55) {
  return (await faceDistance(a, b)) < threshold;
}

// ─── LocalStorage helpers ────────────────────────────────────────────────────

const LS_KEY = "faceauth_descriptors";

/** Persist a face descriptor for a signed-in user. */
export function saveFaceDescriptor(uid, email, displayName, descriptor) {
  const all = loadAllDescriptors();
  all[uid] = {
    uid,
    email,
    displayName,
    descriptor: Array.from(descriptor),
    savedAt: Date.now(),
  };
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

/** Return the stored descriptor Float32Array for a given uid, or null. */
export function loadDescriptorForUid(uid) {
  const all = loadAllDescriptors();
  const entry = all[uid];
  return entry ? new Float32Array(entry.descriptor) : null;
}

/** Return all stored descriptor entries as an array. */
export function loadAllDescriptors() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

/** Remove the stored descriptor for a given uid. */
export function removeFaceDescriptor(uid) {
  const all = loadAllDescriptors();
  delete all[uid];
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

/**
 * Compare a live descriptor against all stored ones and return the best
 * matching entry (or null if no match exceeds the threshold).
 */
export async function findMatchingUser(liveDescriptor) {
  const all = loadAllDescriptors();
  let bestEntry = null;
  let bestDistance = Infinity;

  for (const entry of Object.values(all)) {
    const stored = new Float32Array(entry.descriptor);
    const dist = await faceDistance(liveDescriptor, stored);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestEntry = entry;
    }
  }

  if (bestEntry && await isSameFace(liveDescriptor, new Float32Array(bestEntry.descriptor))) {
    return bestEntry;
  }
  return null;
}

/** Return true if the current user has a registered face. */
export function hasFaceRegistered(uid) {
  return loadDescriptorForUid(uid) !== null;
}
