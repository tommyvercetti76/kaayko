import { auth } from './firebase';

// In dev, Vite proxy handles /api/** → emulator (stripping /api/).
// In prod, call the Cloud Run URL directly (same pattern as the rest of kaayko).
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

/**
 * Parse a food description via KaleKutz backend → Claude API
 * @param {string} transcript
 * @returns {Promise<{ foods: Array }>}
 */
export async function parseFoods(transcript) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const token = await user.getIdToken();

  const resp = await fetch(`${API_BASE}/kutz/parseFoods`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text: transcript }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to parse foods');
  }

  const { data } = await resp.json();
  return data; // { foods: [...] }
}

/**
 * Get weekly nutrition report
 * @returns {Promise<{ report: string, weekData: Array }>}
 */
export async function getWeeklyReport() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const token = await user.getIdToken();

  const resp = await fetch(`${API_BASE}/kutz/weeklyReport`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to generate report');
  }

  const { data } = await resp.json();
  return data; // { report, weekData }
}

/**
 * Get AI-powered meal suggestions based on 30-day history
 * @returns {Promise<{ insights: string[], suggestions: Array }>}
 */
export async function getSuggestions() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const token = await user.getIdToken();

  const resp = await fetch(`${API_BASE}/kutz/suggest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to get suggestions');
  }

  const { data } = await resp.json();
  return data; // { insights, suggestions }
}
