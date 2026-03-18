import { auth } from './firebase';

/**
 * Parse a food description via KaleKutz backend → Claude API
 * @param {string} transcript
 * @returns {Promise<{ foods: Array }>}
 */
export async function parseFoods(transcript) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const token = await user.getIdToken();

  const resp = await fetch('/api/kutz/parseFoods', {
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

  const resp = await fetch('/api/kutz/weeklyReport', {
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
