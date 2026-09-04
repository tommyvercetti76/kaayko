/* Kortex views: four ways of looking at any set of scans, shared by the
   landing page dashboard and the samples page. Table, graphs, spider, sky,
   plus what a link is a report of and the insights read off its scans.
   Every mark carries a hover tip. Defines window.KortexViews. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = iso => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); };
  const stripScheme = url => String(url || '').replace(/^https?:\/\//, '');

  // ── hover tips: one element, positioned near the pointer ──
  let tip = null;
  function ensureTip() {
    if (tip) return tip;
    const style = document.createElement('style');
    style.textContent = '.k-tip{position:fixed;z-index:400;pointer-events:none;max-width:260px;padding:7px 10px;font:12px/1.4 ui-monospace,Menlo,monospace;color:#ede8df;background:rgba(6,9,20,0.94);border:1px solid rgba(181,147,90,0.45);box-shadow:0 10px 30px rgba(0,0,0,0.45)}.k-tip b{color:#d9bd7b;font-weight:600}[data-tip]{cursor:default}';
    document.head.appendChild(style);
    tip = document.createElement('div'); tip.className = 'k-tip'; tip.hidden = true; document.body.appendChild(tip);
    return tip;
  }
  function showTip(html, x, y) {
    const t = ensureTip(); t.innerHTML = html; t.hidden = false;
    const pad = 14, w = t.offsetWidth, h = t.offsetHeight;
    let left = x + pad, top = y - h - pad;
    if (left + w > window.innerWidth - 8) left = x - w - pad;
    if (top < 8) top = y + pad;
    t.style.left = Math.max(8, left) + 'px'; t.style.top = top + 'px';
  }
  function hideTip() { if (tip) tip.hidden = true; }
  function attachTips(root) {
    if (!root || root.dataset.tipsBound) return;
    root.dataset.tipsBound = '1';
    root.addEventListener('pointermove', e => { const el = e.target.closest('[data-tip]'); if (el) showTip(el.dataset.tip, e.clientX, e.clientY); else hideTip(); });
    root.addEventListener('pointerleave', hideTip);
    root.addEventListener('click', e => { const el = e.target.closest('[data-tip]'); if (el && e.pointerType === 'touch') showTip(el.dataset.tip, e.clientX, e.clientY); });
  }

/* ── FOUR WAYS OF LOOKING AT ANY SET OF SCANS ──
   Table, graphs, a spider chart of the mix, and the sky: every scan a star
   placed by the hour it happened (around the clock) and how many days ago
   (out from the centre), joined in the order they arrived. Points arrive as
   [ms, platform, device, country, source, window, referrerHost], with a
   leading link code on workspace-wide sets. */
function localHour(ms) { const d = new Date(ms); return d.getHours() + d.getMinutes() / 60; }
function localDow(ms) { return new Date(ms).getDay(); }
const ptOf = (p, hasCode) => hasCode ? { code: p[0], ms: p[1], platform: p[2], device: p[3], country: p[4], source: p[5], win: p[6], ref: p[7] } : { code: null, ms: p[0], platform: p[1], device: p[2], country: p[3], source: p[4], win: p[5], ref: p[6] };
function tallyOf(points, key) {
  const m = new Map(); points.forEach(p => { const v = p[key] || '—'; m.set(v, (m.get(v) || 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, clicks]) => ({ value, clicks }));
}
function radarAxes(points, uniquePeople) {
  const n = points.length || 1;
  const share = f => points.filter(f).length / n;
  const top = tallyOf(points, 'country')[0];
  const repeat = uniquePeople != null ? Math.max(0, 1 - uniquePeople / n) : share(() => false);
  return [
    { label: 'Mobile', value: share(p => p.device === 'mobile'), hint: 'scans from phones' },
    { label: 'QR', value: share(p => p.source === 'qr'), hint: 'scans of the printed code rather than taps on the link' },
    { label: 'Evening', value: share(p => { const h = localHour(p.ms); return h >= 18 || h < 6; }), hint: 'between 6 pm and 6 am, your time' },
    { label: 'Repeat', value: repeat, hint: 'visits from people who had scanned before' },
    { label: 'Abroad', value: top ? share(p => p.country !== top.value) : 0, hint: top ? `outside ${top.value}` : 'outside the top country' },
    { label: 'Weekend', value: share(p => { const d = localDow(p.ms); return d === 0 || d === 6; }), hint: 'Saturday and Sunday' }
  ];
}
function pct(v) { return `${Math.round(v * 100)}%`; }
function viewsHtml(id) {
  const names = [['table', 'Table'], ['graphs', 'Graphs'], ['spider', 'Spider'], ['sky', 'Sky']];
  return `<div class="views" id="${id}-views">
    <div class="views-nav" role="group" aria-label="Ways of looking at it">${names.map(([k, l], i) => `<button type="button" data-view="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>
    ${names.map(([k], i) => `<div class="view-pane" data-pane="${k}" ${i ? 'hidden' : ''}></div>`).join('')}
  </div>`;
}
function mountViews(id, ds) {
  const root = $(`${id}-views`); if (!root) return;
  const panes = Object.fromEntries([...root.querySelectorAll('.view-pane')].map(p => [p.dataset.pane, p]));
  panes.table.innerHTML = renderTables(ds);
  panes.graphs.innerHTML = renderGraphs(ds);
  panes.spider.innerHTML = renderRadar(ds);
  panes.sky.innerHTML = `<div class="sky-wrap"><h5>${esc(ds.skyTitle || 'Every scan, as a star')}</h5><canvas></canvas><div class="sky-legend"><span><i style="background:#d9bd7b"></i>QR scan</span><span><i style="background:#cdd6ec"></i>tap on the link</span><span>clock: hour of the day, your time · rings: days ago, today outermost · lines: the order they arrived</span></div></div>`;
  attachTips(root);
  let skyDrawn = false;
  const drawSkyNow = () => { if (skyDrawn) return; skyDrawn = true; drawSky(panes.sky.querySelector('canvas'), ds.points, ds.hasCode); };
  root.querySelectorAll('.views-nav button').forEach(btn => btn.addEventListener('click', () => {
    root.querySelectorAll('.views-nav button').forEach(b => b.setAttribute('aria-pressed', b === btn));
    Object.entries(panes).forEach(([k, pane]) => { pane.hidden = k !== btn.dataset.view; });
    if (btn.dataset.view === 'sky') drawSkyNow();
  }));
}
function tableHtml(title, rows, total, unit = 'scans') {
  const max = Math.max(1, ...rows.map(r => r.clicks));
  return `<div><h5 style="font-style:italic;font-size:0.78rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold);margin-bottom:6px;font-weight:500">${esc(title)}</h5>
  <table class="k-table"><thead><tr><th>${esc(title)}</th><th class="n">${unit}</th><th class="n">share</th><th></th></tr></thead><tbody>
  ${rows.slice(0, 8).map(r => `<tr data-tip="<b>${esc(String(r.value))}</b> · ${r.clicks} of ${total} (${pct(r.clicks / Math.max(1, total))})"><td><b>${esc(String(r.value))}</b></td><td class="n">${r.clicks}</td><td class="n">${pct(r.clicks / Math.max(1, total))}</td><td class="bar-cell"><i style="width:${Math.round(r.clicks / max * 100)}%"></i></td></tr>`).join('') || '<tr><td colspan="4">Nothing yet</td></tr>'}
  </tbody></table></div>`;
}
function renderTables(ds) {
  if (ds.linkRows) {
    return `<div class="k-scroll"><table class="k-table"><thead><tr><th>Link</th><th class="n">7 days</th><th class="n">QR</th><th class="n">taps</th><th class="n">people</th><th>top country</th><th>state</th><th class="n">lifetime</th></tr></thead><tbody>
      ${ds.linkRows.map(r => `<tr><td><b>${esc(r.title)}</b><br><span class="mono" style="font-size:0.78rem">${esc(r.code)}</span></td><td class="n">${r.events}</td><td class="n">${r.qr}</td><td class="n">${r.taps}</td><td class="n">${r.unique}</td><td>${esc(r.topCountry || '—')}</td><td>${r.status !== 'active' ? esc(r.status) : r.enabled ? 'live' : 'paused'}</td><td class="n">${r.lifetime}</td></tr>`).join('')}
    </tbody></table></div>`;
  }
  const t = ds.points.length;
  return `<div class="k-tables">${tableHtml('Source', tallyOf(ds.points, 'source').map(r => ({ ...r, value: r.value === 'qr' ? 'QR scan' : 'tap on the link' })), t)}${tableHtml('Device', tallyOf(ds.points, 'device'), t)}${tableHtml('Country', tallyOf(ds.points, 'country'), t)}${tableHtml('Platform', tallyOf(ds.points, 'platform'), t)}${tableHtml('Referrer', tallyOf(ds.points.filter(p => p.ref), 'ref'), t, 'taps')}${ds.windowRows ? tableHtml('Destination', ds.windowRows, t) : ''}</div>`;
}
function barsHtml(values, labels, dense) {
  const max = Math.max(1, ...values);
  return `<div class="bars${dense ? ' dense' : ''}">${values.map((v, i) => `<div class="bar" data-tip="<b>${esc(labels[i])}</b> · ${v} scan${v === 1 ? '' : 's'}"><i style="height:${Math.max(2, Math.round(v / max * 100))}%"></i><span>${esc(labels[i])}</span></div>`).join('')}</div>`;
}
function renderGraphs(ds) {
  const hours = new Array(24).fill(0); ds.points.forEach(p => { hours[Math.floor(localHour(p.ms))]++; });
  const dows = new Array(7).fill(0); ds.points.forEach(p => { dows[localDow(p.ms)]++; });
  const days = new Map(); ds.points.forEach(p => { const k = new Date(p.ms).toISOString().slice(5, 10); days.set(k, (days.get(k) || 0) + 1); });
  const dayKeys = [...days.keys()].sort();
  const perLink = ds.linkRows ? `<div><h5>Scans per link, 7 days</h5>${barsHtml(ds.linkRows.map(r => r.events), ds.linkRows.map(r => r.title.split(' · ')[0].slice(0, 12)))}</div>` : '';
  return `<div class="graph-grid">
    ${perLink || `<div><h5>By day</h5>${barsHtml(dayKeys.map(k => days.get(k)), dayKeys)}</div>`}
    <div><h5>By hour of the day, your time</h5>${barsHtml(hours, hours.map((_, h) => String(h).padStart(2, '0')), true)}</div>
    <div><h5>By day of the week</h5>${barsHtml(dows, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])}</div>
    ${perLink ? `<div><h5>By day</h5>${barsHtml(dayKeys.map(k => days.get(k)), dayKeys)}</div>` : `<div><h5>Where they were sent</h5>${barsHtml((ds.windowRows || tallyOf(ds.points, 'win').map(r => ({ ...r, value: r.value === '—' ? 'day' : r.value }))).map(r => r.clicks), (ds.windowRows || tallyOf(ds.points, 'win').map(r => ({ ...r, value: r.value === '—' ? 'day' : r.value }))).map(r => String(r.value).slice(0, 14)))}</div>`}
  </div>`;
}
function renderRadar(ds) {
  const axes = radarAxes(ds.points, ds.uniquePeople);
  const cx = 180, cy = 180, R = 130, n = axes.length;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  const rings = [0.25, 0.5, 0.75, 1].map(f => `<polygon points="${axes.map((_, i) => pt(i, R * f).join(',')).join(' ')}" fill="none" stroke="rgba(181,147,90,0.18)" stroke-width="0.8"/>`).join('');
  const spokes = axes.map((_, i) => { const [x, y] = pt(i, R); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(181,147,90,0.18)" stroke-width="0.8"/>`; }).join('');
  const poly = axes.map((a, i) => pt(i, R * Math.max(0.02, a.value)).join(',')).join(' ');
  const dots = axes.map((a, i) => { const [x, y] = pt(i, R * Math.max(0.02, a.value)); return `<circle cx="${x}" cy="${y}" r="3" fill="#f3e6c8"/><circle cx="${x}" cy="${y}" r="11" fill="rgba(217,189,123,0.18)" data-tip="<b>${esc(a.label)}</b> ${pct(a.value)} · ${esc(a.hint)}"/>`; }).join('');
  const labels = axes.map((a, i) => { const [x, y] = pt(i, R + 22); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="11" letter-spacing="1.5" fill="#d9bd7b" font-style="italic" font-family="Cormorant Garamond, Georgia, serif">${esc(a.label.toUpperCase())}</text>`; }).join('');
  return `<div class="radar-wrap"><div><h5>The mix, six ways at once</h5><svg viewBox="0 0 360 360" role="img" aria-label="Spider chart of the scan mix">${rings}${spokes}<polygon points="${poly}" fill="rgba(217,189,123,0.16)" stroke="#d9bd7b" stroke-width="1.2"/>${dots}${labels}</svg></div>
    <ul class="radar-legend">${axes.map(a => `<li><span>${esc(a.label)} <small style="color:var(--dim)">· ${esc(a.hint)}</small></span><b>${pct(a.value)}</b></li>`).join('')}</ul></div>`;
}
function drawSky(canvas, points, hasCode) {
  if (!canvas) return;
  const size = Math.min(560, canvas.parentElement.clientWidth || 560), dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = size * dpr; canvas.height = size * dpr; canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
  const x = canvas.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = size / 2, cy = size / 2, R = size * 0.44, r0 = size * 0.08, TAU = Math.PI * 2;
  const now = Date.now(), spanDays = 7;
  x.clearRect(0, 0, size, size);
  // Hour histogram as a faint ring, then the clock.
  const hours = new Array(24).fill(0); points.forEach(p => { hours[Math.floor(localHour(p.ms))]++; });
  const hmax = Math.max(1, ...hours);
  hours.forEach((v, h) => { const a0 = -Math.PI / 2 + h / 24 * TAU, a1 = a0 + TAU / 24; const rr = R + 6 + (v / hmax) * size * 0.05; x.beginPath(); x.arc(cx, cy, rr, a0, a1); x.arc(cx, cy, R + 6, a1, a0, true); x.closePath(); x.fillStyle = 'rgba(181,147,90,0.16)'; x.fill(); });
  x.strokeStyle = 'rgba(181,147,90,0.28)'; x.lineWidth = 0.8;
  [0.25, 0.5, 0.75, 1].forEach(f => { x.beginPath(); x.arc(cx, cy, r0 + (R - r0) * f, 0, TAU); x.stroke(); });
  for (let h = 0; h < 24; h++) { const a = -Math.PI / 2 + h / 24 * TAU; x.beginPath(); x.moveTo(cx + Math.cos(a) * (R + 2), cy + Math.sin(a) * (R + 2)); x.lineTo(cx + Math.cos(a) * (R + (h % 6 === 0 ? 14 : 6)), cy + Math.sin(a) * (R + (h % 6 === 0 ? 14 : 6))); x.stroke(); }
  x.fillStyle = 'rgba(217,189,123,0.9)'; x.font = 'italic 12px "Cormorant Garamond", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  [['00', 0], ['06', 6], ['12', 12], ['18', 18]].forEach(([l, h]) => { const a = -Math.PI / 2 + h / 24 * TAU; x.fillText(l, cx + Math.cos(a) * (R + 26), cy + Math.sin(a) * (R + 26)); });
  const place = p => { const a = -Math.PI / 2 + (localHour(p.ms) / 24) * TAU; const age = Math.min(spanDays, Math.max(0, (now - p.ms) / 86400000)); const rr = r0 + (R - r0) * (1 - age / spanDays); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; };
  const byCode = new Map(); points.forEach(p => { const k = p.code || '_'; if (!byCode.has(k)) byCode.set(k, []); byCode.get(k).push(p); });
  x.lineWidth = 0.6;
  byCode.forEach(list => { list.sort((a, b) => a.ms - b.ms); x.strokeStyle = 'rgba(217,189,123,0.13)'; x.beginPath(); list.forEach((p, i) => { const [px, py] = place(p); if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.stroke(); });
  points.forEach(p => { const [px, py] = place(p); const qr = p.source === 'qr'; const g = x.createRadialGradient(px, py, 0, px, py, 5); g.addColorStop(0, qr ? 'rgba(232,206,150,0.55)' : 'rgba(205,214,236,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, 5, 0, TAU); x.fill(); x.fillStyle = qr ? '#f3e6c8' : '#e2e8f7'; x.beginPath(); x.arc(px, py, 1.4, 0, TAU); x.fill(); });
  const busiest = hours.indexOf(hmax);
  x.fillStyle = 'rgba(237,232,223,0.72)'; x.font = '11px ui-monospace, Menlo, monospace';
  x.fillText(`${points.length} scans · busiest hour ${String(busiest).padStart(2, '0')}:00`, cx, cy);
  // Hover a star: the scan behind it.
  const placed = points.map(p => { const [px, py] = place(p); return { px, py, p }; });
  canvas.onpointermove = (e) => {
    const r = canvas.getBoundingClientRect(); const mx = (e.clientX - r.left) * (size / r.width), my = (e.clientY - r.top) * (size / r.height);
    let best = null, bd = 100;
    for (const q of placed) { const d = (q.px - mx) ** 2 + (q.py - my) ** 2; if (d < bd) { bd = d; best = q; } }
    if (best) { const d = new Date(best.p.ms); const ago = Math.max(0, (now - best.p.ms) / 86400000); showTip(`<b>${esc(d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }))}</b> · ${esc(best.p.source === 'qr' ? 'QR scan' : 'tap')} · ${esc(best.p.device || '')} · ${esc(best.p.country || '')}${best.p.win ? ' · ' + esc(best.p.win) : ''} · ${ago < 1 ? 'today' : Math.round(ago) + ' days ago'}${best.p.code ? ' · ' + esc(best.p.code) : ''}`, e.clientX, e.clientY); } else hideTip();
  };
  canvas.onpointerleave = hideTip;
}

/* What each link is a report of, read off its own settings. */
function variationOf(link) {
  const d = link.destinations || {};
  if (link.safety && link.safety.review) return { name: 'Safety review', blurb: 'This destination was held on first sight and released by a reviewer. The link kept its QR through the whole thing.' };
  if (link.schedule && link.schedule.windows && link.schedule.windows.length) return { name: 'Night and day routing', blurb: 'One QR, two addresses: our clock in the link\'s time zone decides where a scan lands. Nothing a visitor sends can change it.' };
  if (d.ios || d.android) return { name: 'Device routing', blurb: 'iPhones, Androids and everyone else each go to their own address. One QR on the card.' };
  if (link.limits && link.limits.maxClicks) return { name: 'Scan cap with a fallback', blurb: 'After the cap, scans go to the fallback address instead of a dead end. The counter below shows how much is left.' };
  if (link.expiresAt) return { name: 'End date with a fallback', blurb: 'After the date, scans go to the fallback address. Printed flyers never point at a 404.' };
  if (link.utm && Object.keys(link.utm).length) return { name: 'Campaign tags', blurb: 'Every visit arrives tagged, so the destination\'s own analytics know it came from this link.' };
  return { name: 'Plain dynamic link', blurb: 'A short kaayko.com link behind the QR: re-point it after printing and count every scan.' };
}
function insightsFor(link, a, points) {
  const out = [];
  const n = points.length;
  const src = tallyOf(points, 'source'); const qr = (src.find(r => r.value === 'qr') || {}).clicks || 0;
  if (n) out.push(`<b>${qr}</b> of ${n} visits this week were QR scans; the rest were taps on the link.`);
  if (link.schedule && link.schedule.windows && link.schedule.windows.length) { const night = points.filter(p => p.win === 'night').length; out.push(`<b>${pct(night / Math.max(1, n))}</b> of scans came in the night window and went to ${esc(stripScheme(link.schedule.windows[0].url))}.`); }
  if (link.limits && link.limits.maxClicks) { const used = link.clickCount || 0; out.push(`<b>${used} of ${link.limits.maxClicks}</b> scans used${link.limits.fallbackUrl ? `; after that, ${esc(stripScheme(link.limits.fallbackUrl))}` : ''}.`); }
  if (link.expiresAt) { const days = Math.ceil((new Date(link.expiresAt) - Date.now()) / 86400000); out.push(days >= 0 ? `Ends in <b>${days} day${days === 1 ? '' : 's'}</b>${link.limits && link.limits.fallbackUrl ? `, then ${esc(stripScheme(link.limits.fallbackUrl))}` : ''}.` : `Ended <b>${-days} day${days === -1 ? '' : 's'} ago</b>.`); }
  const d = link.destinations || {};
  if (d.ios || d.android) { const plat = tallyOf(points, 'platform'); const ios = (plat.find(r => r.value === 'ios') || {}).clicks || 0, and = (plat.find(r => r.value === 'android') || {}).clicks || 0; out.push(`<b>${pct(ios / Math.max(1, n))}</b> iPhone, <b>${pct(and / Math.max(1, n))}</b> Android: each went to its own address.`); }
  if (link.utm && Object.keys(link.utm).length) out.push(`Tags on every visit: ${Object.entries(link.utm).map(([k, v]) => `<b>${esc(k.replace('utm_', ''))}</b> ${esc(v)}`).join(' · ')}.`);
  if (link.safety && link.safety.review) out.push(`Held on ${fmtDate(new Date(link.safety.review.heldAtMs).toISOString())}, approved ${fmtDate(new Date(link.safety.review.approvedAtMs).toISOString())} by a reviewer.`);
  if (a.unique && a.unique.distinctVisitors) out.push(`<b>${a.unique.distinctVisitors}</b> different people${a.unique.clicksPerVisitor ? `, ${a.unique.clicksPerVisitor} scans each on average` : ''}.`);
  const country = tallyOf(points, 'country')[0]; if (country && country.value !== '—') out.push(`Most scans from <b>${esc(country.value)}</b> (${pct(country.clicks / Math.max(1, n))}).`);
  return out;
}


  window.KortexViews = { ptOf, tallyOf, radarAxes, pct, viewsHtml, mountViews, drawSky, variationOf, insightsFor, localHour, localDow, esc, fmtDate, stripScheme, showTip, hideTip, attachTips };
})();
