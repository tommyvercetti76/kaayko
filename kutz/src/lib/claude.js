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

/** Parse a food description via Claude. */
export async function parseFoods(transcript, dietType = 'lacto-ovo-vegetarian') {
  const { data } = await authFetch('/kutz/parseFoods', {
    method: 'POST',
    body:   JSON.stringify({ text: transcript, dietType }),
  });
  return data;
}

/** Parse a food photo via Claude vision. */
export async function parsePhoto(imageBase64, mimeType, dietType = 'lacto-ovo-vegetarian') {
  const { data } = await authFetch('/kutz/parsePhoto', {
    method: 'POST',
    body:   JSON.stringify({ imageBase64, mimeType, dietType }),
  });
  return data;
}

/** Search Open Food Facts via backend proxy (avoids CORS). */
export async function searchFoods(query) {
  if (!query || query.trim().length < 2) return [];
  const { data } = await authFetch(
    `/kutz/searchFoods?q=${encodeURIComponent(query.trim())}`,
    { method: 'GET' }
  );
  return data.foods || [];
}

/** Weekly nutrition report */
export async function getWeeklyReport() {
  const { data } = await authFetch('/kutz/weeklyReport', { method: 'POST' });
  return data;
}

/** Today-aware meal suggestions based on eating history */
export async function getSuggestions() {
  const { data } = await authFetch('/kutz/suggest', { method: 'POST' });
  return data;
}

// ── Fitbit ────────────────────────────────────────────────────────────────────

/** Check whether Fitbit is connected for this user */
export async function getFitbitStatus() {
  const { data } = await authFetch('/kutz/fitbit/status', { method: 'GET' });
  return data;
}

/**
 * Fix #20 — return the auth URL so the caller can open a popup instead of
 * navigating the whole page away (losing app state).
 */
export async function getFitbitAuthUrl() {
  const { data } = await authFetch('/kutz/fitbit/initiate', { method: 'GET' });
  return data?.authUrl || null;
}

/** @deprecated Use getFitbitAuthUrl() and open a popup instead */
export async function connectFitbit() {
  const url = await getFitbitAuthUrl();
  if (url) window.location.href = url;
  else throw new Error('Could not get Fitbit auth URL');
}

/** Sync today's Fitbit data. Returns { steps, fitbitCalories, activeMinutes, date } */
export async function syncFitbit() {
  const { data } = await authFetch('/kutz/fitbit/sync', { method: 'POST' });
  return data;
}

/** Remove stored Fitbit tokens */
export async function disconnectFitbit() {
  await authFetch('/kutz/fitbit/disconnect', { method: 'POST' });
}
