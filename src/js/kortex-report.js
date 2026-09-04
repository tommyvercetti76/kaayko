/* Kortex shared report: the page at /kortex/r/<token> rendering the public
   report served by /kortex/shared/<token>. Only aggregates arrive here (no
   scan-level points exist in the public shape), so nothing is drawn per
   event and none of the owner's views are loaded. Every string that reaches
   the page is escaped; the token lives in the path and is sent nowhere else. */
(function () {
  'use strict';
  const API_BASE = (localStorage.getItem('kaayko_environment') || 'production') === 'production'
    ? 'https://api-vwcc5j4qda-uc.a.run.app' : 'http://127.0.0.1:5001/kaaykostore/us-central1/api';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = v => { if (v === null || v === undefined || v === '') return '—'; const d = new Date(v); return isNaN(d) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); };
  const pct = v => `${Math.round((Number(v) || 0) * 100)}%`;
  const stripScheme = url => String(url || '').replace(/^https?:\/\//, '');
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } })();
  const token = (location.pathname.match(/^\/kortex\/r\/([A-Za-z0-9_.-]+)/) || [])[1] || '';

  $('year').textContent = new Date().getFullYear();

  function showError(title, text, canRetry) {
    $('report').hidden = true;
    $('r-title').textContent = title; $('r-sub').textContent = '';
    $('r-error-text').textContent = text; $('r-retry').hidden = !canRetry; $('r-error').hidden = false;
  }
  function fill(id, html) { const el = $(id); el.innerHTML = html; el.hidden = !html; }

  function statHtml(value, label, cls) { return `<div class="stat${cls ? ` ${cls}` : ''}"><b>${esc(value)}</b><span>${esc(label)}</span></div>`; }
  function totalsHtml(t, days) {
    return `<div class="stat-row">${statHtml(t.useful, `useful visits, ${days} days`, 'useful')}${statHtml(t.lost, 'lost', 'lost')}${statHtml(t.rescued, 'rescued', 'rescued')}${statHtml(pct(t.usefulRate), 'useful rate')}</div>
      <p class="note">${plural(t.observed, 'scan')} observed: <b>${t.delivered}</b> reached the destination, <b>${t.rescued}</b> went to the fallback, <b>${t.lost}</b> reached nothing.</p>`;
  }
  function findingsHtml(findings) {
    if (!findings || !findings.length) return '';
    return `<h5>What the scans say</h5><ul class="findings">${findings.map(f => `<li class="finding ${esc(f.status)}"><i aria-hidden="true"></i><div><h6>${esc(f.title)}</h6><p>${esc(f.headline)}</p></div></li>`).join('')}</ul>`;
  }
  function splitHtml(split) {
    if (!split) return '';
    return `<h5>QR scans and link taps</h5><div class="split"><div><b>${esc(split.qr)}</b><span>QR scans · ${esc(pct(split.qrShare))}</span></div><div><b>${esc(split.tap)}</b><span>taps on the link</span></div></div>`;
  }
  function timelineHtml(timeline) {
    if (!timeline || !timeline.length) return '';
    const max = Math.max(1, ...timeline.map(d => d.useful));
    return `<h5>Useful visits by day</h5><div class="bars${timeline.length > 10 ? ' dense' : ''}">${timeline.map(d => `<div class="bar" title="${esc(d.date)}: ${plural(d.useful, 'useful visit')}"><i style="height:${Math.max(2, Math.round(d.useful / max * 100))}%"></i><span>${esc(String(d.date).slice(5))}</span></div>`).join('')}</div>`;
  }
  function rowsHtml(title, rows) {
    if (!rows || !rows.length) return '';
    const total = rows.reduce((s, r) => s + r.count, 0), max = Math.max(1, ...rows.map(r => r.count));
    return `<h5>${esc(title)}</h5><ul class="rows">${rows.map(r => `<li><span>${esc(r.value)}</span><b>${esc(r.count)}</b><small>${esc(pct(r.count / Math.max(1, total)))}</small><em style="width:${Math.round(r.count / max * 100)}%"></em></li>`).join('')}</ul>`;
  }
  /* Each campaign period arrives as useful visits per day, or null while that period has no length yet. */
  function campaignHtml(campaign) {
    if (!campaign) return '';
    const cells = [['before', 'before the campaign'], ['during', 'during the campaign'], ['after', 'after the campaign']]
      .map(([k, label]) => statHtml(typeof campaign[k] === 'number' ? campaign[k] : '—', `useful visits a day ${label}`));
    return `<h5>Campaign window</h5><div class="stat-row">${cells.join('')}</div>`;
  }

  function render(report) {
    const { link, window: win, totals } = report;
    const name = link.title || link.code;
    document.title = `${name} · Kortex report`;
    $('r-title').textContent = name;
    $('r-sub').textContent = `${win.days}-day window · ${fmtDate(win.from)} to ${fmtDate(win.to)} · ${win.timeZone || tz}`;
    $('r-qr').src = link.qrUrl; $('r-qr').alt = `QR code for ${name}`;
    $('r-meta').innerHTML = `<b>${esc(stripScheme(link.shortUrl))}</b><br><span style="color:var(--faint)">scan it: it really goes there</span>`;
    $('r-placement').innerHTML = link.placement ? `<span class="tag">${esc(link.placement)}</span>` : '';
    $('r-window').textContent = `Counts cover the ${win.days} days ending ${fmtDate(win.to)}, in the ${win.timeZone || tz} time zone.`;
    $('r-shared').textContent = `Shared ${fmtDate(report.sharedAtMs)}${report.expiresAtMs ? `; this address stops working on ${fmtDate(report.expiresAtMs)}.` : '; the owner can withdraw it at any time.'}`;
    if (report.notEnoughActivity || !totals) {
      fill('r-totals', '<div class="quiet"><p class="note"><b>Not enough activity yet.</b> This report opens up once the link has been scanned about ten times in the window, so that no single person can be picked out of the numbers.</p></div>');
      ['r-findings', 'r-split', 'r-timeline', 'r-devices', 'r-countries', 'r-campaign'].forEach(id => fill(id, ''));
    } else {
      fill('r-totals', totalsHtml(totals, win.days));
      fill('r-findings', findingsHtml(report.findings));
      fill('r-split', splitHtml(report.qrSplit));
      fill('r-timeline', timelineHtml(report.timeline));
      fill('r-devices', rowsHtml('Devices', report.devices));
      fill('r-countries', rowsHtml('Countries', report.countries));
      fill('r-campaign', campaignHtml(report.campaign));
    }
    $('r-error').hidden = true; $('report').hidden = false;
  }

  async function load() {
    if (!token) { showError('No report here', 'This address needs the share token the owner was given. Ask them for the full link.', false); return; }
    $('r-title').textContent = 'Loading…'; $('r-error').hidden = true;
    let res;
    try {
      res = await fetch(`${API_BASE}/kortex/shared/${encodeURIComponent(token)}?tz=${encodeURIComponent(tz)}`, { referrerPolicy: 'no-referrer' });
    } catch (e) { showError('Could not reach the report', 'Check your connection and try again.', true); return; }
    const data = await res.json().catch(() => ({}));
    if (res.status === 404) { showError('This report is no longer shared', 'The owner may have stopped sharing it, or the address expired. Ask them for a fresh one.', false); return; }
    if (res.status === 429) { showError('Too many requests for now', 'Wait a minute and try again.', true); return; }
    if (!res.ok || !data.success || !data.report) { showError('Report unavailable', data.error || 'Something went wrong on our side. Try again in a moment.', true); return; }
    render(data.report);
  }
  $('r-retry').addEventListener('click', load);
  load();
})();
