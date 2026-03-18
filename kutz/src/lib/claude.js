import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function authFetch(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  const resp  = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `Request failed: ${resp.status}`);
  }
  return resp.json();
}

/**
 * Parse a food description via Claude.
 * @param {string} transcript
 * @param {string} [dietType] — from ProfileContext.dietType
 */
export async function parseFoods(transcript, dietType = 'lacto-ovo-vegetarian') {
  const { data } = await authFetch('/kutz/parseFoods', {
    method: 'POST',
    body:   JSON.stringify({ text: transcript, dietType }),
  });
  return data; // { foods: [...] }
}

/**
 * Parse a food photo via Claude vision.
 * @param {string} imageBase64  — base64-encoded image data (no data: prefix)
 * @param {string} mimeType     — 'image/jpeg' | 'image/png' | 'image/webp'
 * @param {string} [dietType]   — from ProfileContext.dietType
 */
export async function parsePhoto(imageBase64, mimeType, dietType = 'lacto-ovo-vegetarian') {
  const { data } = await authFetch('/kutz/parsePhoto', {
    method: 'POST',
    body:   JSON.stringify({ imageBase64, mimeType, dietType }),
  });
  return data; // { foods: [...] }
}

/** Weekly nutrition report */
export async function getWeeklyReport() {
  const { data } = await authFetch('/kutz/weeklyReport', { method: 'POST' });
  return data; // { report, weekData }
}

/** Today-aware meal suggestions based on eating history */
export async function getSuggestions() {
  const { data } = await authFetch('/kutz/suggest', { method: 'POST' });
  return data; // { insights, suggestions }
}

// ── Fitbit ────────────────────────────────────────────────────────────────────

/** Check whether Fitbit is connected for this user */
export async function getFitbitStatus() {
  const { data } = await authFetch('/kutz/fitbit/status', { method: 'GET' });
  return data; // { connected, tokenExpired?, connectedAt? }
}

/**
 * Redirect the browser to Fitbit OAuth.
 * The backend returns the auth URL; we navigate the page there.
 */
export async function connectFitbit() {
  const { data } = await authFetch('/kutz/fitbit/initiate', { method: 'GET' });
  if (data?.authUrl) {
    window.location.href = data.authUrl;
  } else {
    throw new Error('Could not get Fitbit auth URL');
  }
}

/**
 * Sync today's Fitbit data (steps, calories, active minutes).
 * Returns { steps, fitbitCalories, activeMinutes, date }
 */
export async function syncFitbit() {
  const { data } = await authFetch('/kutz/fitbit/sync', { method: 'POST' });
  return data;
}

/** Remove stored Fitbit tokens */
export async function disconnectFitbit() {
  await authFetch('/kutz/fitbit/disconnect', { method: 'POST' });
}
