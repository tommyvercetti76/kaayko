/**
 * Accuracy — how close the forecast came to what actually happened, and what
 * paddlers said about the score. Built 14 Oct 2026: before this nothing
 * measured either.
 *
 *   GET /paddlingOut/admin/accuracy → forecast_verification_summary/latest
 *
 * Filled daily at 03:00 PT by kaayko-api scheduled/forecastVerification.js:
 * each spot's forecast is saved, then checked hour by hour against an NWS
 * station once the day has happened. NWS is the yardstick only.
 */

import { apiFetch } from '../../js/config.js';
import { escapeHtml } from '../../js/utils.js';

const LEADS = [
  { key: '0', label: 'Same day', note: 'made at 3 AM that morning' },
  { key: '1', label: 'Next day', note: 'made the day before' },
  { key: '2', label: '2 days ahead', note: 'made two days before' }
];

const n1 = (v) => (v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1));
const signed = (v) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 10) / 10).toFixed(1)}`);
// Error sizes in both unit systems: a °C difference is 1.8 °F, a km/h is 0.62 mph.
const temp = (v, f = n1) => (v == null ? '—' : `${f(v)} °C <span class="ac-alt">(${f(v * 1.8)} °F)</span>`);
const wind = (v, f = n1) => (v == null ? '—' : `${f(v)} km/h <span class="ac-alt">(${f(v * 0.621371)} mph)</span>`);

export async function init() {
  const el = document.getElementById('accuracy-view');
  if (!el) return;
  el.innerHTML = '<div class="loading">Loading…</div>';
  let summary = null;
  try {
    const res = await apiFetch('/paddlingOut/admin/accuracy');
    if (!res) return;
    if (!res.ok) throw new Error(`Failed to load (${res.status})`);
    summary = (await res.json()).summary;
  } catch (err) {
    el.innerHTML = `<div class="submissions-error">${escapeHtml(err.message)}</div>`;
    return;
  }
  el.innerHTML = render(summary);
}

function render(s) {
  const head = `
    <header class="view-header">
      <div>
        <h1>Forecast accuracy</h1>
        <p class="view-subtitle">How close the forecast came to what weather stations observed, and what paddlers said about the score. Checked daily at 3 AM Pacific.</p>
      </div>
    </header>`;
  const started = !s || !s.overall || LEADS.every(l => !(s.overall[l.key] && s.overall[l.key].days));
  if (started) {
    return `${head}<div class="card ac-card"><p class="ac-empty">
      No results yet. Each spot's forecast is saved at 3 AM and checked once the day has happened:
      same-day numbers appear after the first full day, next-day after two, two-days-ahead after three.
    </p>${votes(s && s.votes)}</div>`;
  }
  const overall = LEADS.map(l => {
    const o = s.overall[l.key] || {};
    return `<tr><th>${escapeHtml(l.label)}<span class="ac-sub">${escapeHtml(l.note)}</span></th>
      <td>${o.days || 0} days · ${o.hours || 0} h</td>
      <td>${temp(o.tempMae)}</td><td>${temp(o.tempBias, signed)}</td>
      <td>${wind(o.windMae)}</td><td>${wind(o.windBias, signed)}</td></tr>`;
  }).join('');

  const spots = Object.entries(s.perSpot || {})
    .map(([id, v]) => ({ id, ...v, lead: v['1'] && v['1'].hours ? v['1'] : v['0'] }))
    .filter(v => v.lead && v.lead.hours)
    .sort((a, b) => (b.lead.tempMae || 0) - (a.lead.tempMae || 0));
  const spotRows = spots.map(v => `<tr>
      <th>${escapeHtml(v.title || v.id)}<span class="ac-sub">${escapeHtml(v.station ? `${v.station.id} · ${v.station.km} km` : '')}</span></th>
      <td>${v.lead.days} days</td>
      <td>${temp(v.lead.tempMae)}</td><td>${temp(v.lead.tempBias, signed)}</td>
      <td>${wind(v.lead.windMae)}</td><td>${wind(v.lead.windBias, signed)}</td></tr>`).join('');

  return `${head}
    <div class="card ac-card">
      <h2>All spots, last ${escapeHtml(String(s.windowDays || 14))} days</h2>
      <div class="ac-scroll"><table class="ac-table">
        <thead><tr><th>Forecast</th><th>Checked</th><th>Temp off by</th><th>Temp lean</th><th>Wind off by</th><th>Wind lean</th></tr></thead>
        <tbody>${overall}</tbody>
      </table></div>
      <p class="ac-hint">"Off by" is the average size of the miss. "Lean" is its direction: + means the forecast ran warmer or windier than what was observed.</p>
    </div>
    <div class="card ac-card">
      <h2>By spot <span class="ac-sub">next-day forecast where available, worst temperature first</span></h2>
      <div class="ac-scroll"><table class="ac-table">
        <thead><tr><th>Spot · station</th><th>Checked</th><th>Temp off by</th><th>Temp lean</th><th>Wind off by</th><th>Wind lean</th></tr></thead>
        <tbody>${spotRows || '<tr><td colspan="6">No spot has a full day checked yet.</td></tr>'}</tbody>
      </table></div>
    </div>
    <div class="card ac-card">${votes(s.votes)}</div>
    <div class="card ac-card"><h2>How to read this</h2><ul class="ac-notes">${(s.notes || []).map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>`;
}

function votes(v) {
  if (!v) return '';
  const body = v.n
    ? `${v.n} vote${v.n === 1 ? '' : 's'} · ${v.aboutRight} said "about right" · on average paddlers found it ${v.meanDiff > 0 ? 'better' : v.meanDiff < 0 ? 'worse' : 'the same'} than we said (${signed(v.meanDiff)} points)`
    : 'No votes yet. The "Was this score accurate?" buttons were never shown on the page until 14 Oct 2026, so there is no history.';
  return `<h2>What paddlers said about the score</h2><p class="ac-votes">${escapeHtml(body)}</p>`;
}
