/* Kortex views: five ways of looking at any set of scans, shared by the
   landing page dashboard, the samples page and the admin. Table, graphs,
   spider, field map, sky, plus what a link is a report of, the Action Center
   and findings read off its scans, and the workspace queue.
   Every mark carries a hover tip. Defines window.KortexViews. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = iso => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); };
  const stripScheme = url => String(url || '').replace(/^https?:\/\//, '');
  const scans = n => `${n} scan${n === 1 ? '' : 's'}`;
  function pct(v) { return `${Math.round(v * 100)}%`; }

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
  /** Delegate tips for every [data-tip] under `root`; a root inside an already-bound ancestor is covered by it. */
  function attachTips(root) {
    if (!root || root.closest('[data-tips-bound]')) return;
    root.dataset.tipsBound = '1';
    root.addEventListener('pointermove', e => { const el = e.target.closest('[data-tip]'); if (el) showTip(el.dataset.tip, e.clientX, e.clientY); else hideTip(); });
    root.addEventListener('pointerleave', hideTip);
    root.addEventListener('click', e => { const el = e.target.closest('[data-tip]'); if (el && e.pointerType === 'touch') showTip(el.dataset.tip, e.clientX, e.clientY); });
  }

/* ── FIVE WAYS OF LOOKING AT ANY SET OF SCANS ──
   Table, graphs, a spider chart of the mix, the field map (every scan traced
   from its source to the place it was scanned) and the sky: every scan a star
   placed by the hour it happened (around the clock) and how many days ago
   (out from the centre), joined in the order they arrived. Delivered and
   rescued scans arrive as [ms, platform, device, country, source, window,
   referrerHost, outcome], with a leading link code on workspace-wide sets;
   lost scans as [ms, outcome, platform, country]. */
function localHour(ms) { const d = new Date(ms); return d.getHours() + d.getMinutes() / 60; }
function localDow(ms) { return new Date(ms).getDay(); }
const ptOf = (p, hasCode) => { const o = hasCode ? 1 : 0; return { code: hasCode ? p[0] : null, ms: p[o], platform: p[o + 1], device: p[o + 2], country: p[o + 3], source: p[o + 4], win: p[o + 5], ref: p[o + 6], outcome: p[o + 7] || 'delivered' }; };
const ptOfLost = p => ({ ms: p[0], outcome: p[1], platform: p[2], country: p[3] });
function tallyOf(points, key) {
  const m = new Map(); points.forEach(p => { const v = p[key] || '—'; m.set(v, (m.get(v) || 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, clicks]) => ({ value, clicks }));
}
function radarAxes(points, uniquePeople) {
  const n = points.length || 1;
  const share = f => points.filter(f).length / n;
  const top = tallyOf(points, 'country')[0];
  const repeat = uniquePeople != null
    ? { label: 'Repeat', value: Math.max(0, 1 - uniquePeople / n), hint: 'visits from people who had scanned before' }
    : { label: 'Repeat', value: 0, hint: 'not summed: one person may scan several links', na: true };
  return [
    { label: 'Mobile', value: share(p => p.device === 'mobile'), hint: 'scans from phones' },
    { label: 'QR', value: share(p => p.source === 'qr'), hint: 'scans of the printed code rather than taps on the link' },
    { label: 'Evening', value: share(p => { const h = localHour(p.ms); return h >= 18 || h < 6; }), hint: 'between 6 pm and 6 am, your time' },
    repeat,
    { label: 'Abroad', value: top ? share(p => p.country !== top.value) : 0, hint: top ? `outside ${top.value}` : 'outside the top country' },
    { label: 'Weekend', value: share(p => { const d = localDow(p.ms); return d === 0 || d === 6; }), hint: 'Saturday and Sunday' }
  ];
}
const VIEW_TABS = [['table', 'Table'], ['graphs', 'Graphs'], ['spider', 'Spider'], ['map', 'Field Map'], ['sky', 'Sky']];
function viewsHtml(id) {
  return `<div class="views" id="${id}-views">
    <div class="views-nav" role="group" aria-label="Ways of looking at it">${VIEW_TABS.map(([k, l], i) => `<button type="button" data-view="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>
    ${VIEW_TABS.map(([k], i) => `<div class="view-pane" data-pane="${k}" ${i ? 'hidden' : ''}></div>`).join('')}
  </div>`;
}
/** ds = { points, lostPoints, hasCode, uniquePeople, windowRows, linkRows, skyTitle, mapTitle }. */
function mountViews(id, ds) {
  const root = $(`${id}-views`); if (!root) return;
  const d = { ...ds, points: ds.points || [], lostPoints: ds.lostPoints || [] };
  const panes = Object.fromEntries([...root.querySelectorAll('.view-pane')].map(p => [p.dataset.pane, p]));
  panes.table.innerHTML = renderTables(d);
  panes.graphs.innerHTML = renderGraphs(d);
  panes.spider.innerHTML = renderRadar(d);
  panes.map.innerHTML = `<div class="fm-wrap"><h5>${esc(d.mapTitle || 'Where every scan went')}</h5><div class="fm" data-fm></div></div>`;
  panes.sky.innerHTML = `<div class="sky-wrap"><h5>${esc(d.skyTitle || 'Every scan, as a star')}</h5><canvas></canvas><div class="sky-legend"><span><i style="background:#d9bd7b"></i>QR scan</span><span><i style="background:#cdd6ec"></i>tap on the link</span><span>clock: hour of the day, your time · rings: days ago, today outermost · lines: the order they arrived</span></div></div>`;
  attachTips(root);
  // The map and the sky measure their container, so they draw once their pane is visible.
  const pending = { map: () => mountFieldMap(panes.map.querySelector('[data-fm]'), d.points, d.lostPoints), sky: () => drawSky(panes.sky.querySelector('canvas'), d.points) };
  root.querySelectorAll('.views-nav button').forEach(btn => btn.addEventListener('click', () => {
    root.querySelectorAll('.views-nav button').forEach(b => b.setAttribute('aria-pressed', b === btn));
    Object.entries(panes).forEach(([k, pane]) => { pane.hidden = k !== btn.dataset.view; });
    const draw = pending[btn.dataset.view];
    if (draw) { delete pending[btn.dataset.view]; draw(); }
  }));
}

/* ── Field Map: Source → Device → Route → Outcome → Place, as ribbons whose
   width is the number of scans that took that step. Delivered and rescued
   scans walk every column; lost scans never reached a device route, so they
   run straight from their source to the reason they were lost. ── */
const FM_COLUMNS = [['source', 'Source'], ['device', 'Device'], ['route', 'Route'], ['outcome', 'Outcome'], ['place', 'Place']];
const FM_MAX_NODES = { source: 9, device: 9, route: 9, outcome: 9, place: 6 };
const FM_MIN_H = 22, FM_GAP = 8, FM_PAD_TOP = 30, FM_PAD_BOTTOM = 10, FM_CHAR = 6.7, FM_LIST_BELOW = 640, FM_LIST_ROWS = 8;
const OUTCOME_RANK = { delivered: 0, rescued: 1 };
const FM_LEGEND = [['source', 'QR scan'], ['tap', 'link tap'], ['device', 'device'], ['route', 'route'], ['delivered', 'delivered'], ['rescued', 'rescued'], ['lost', 'lost'], ['place', 'place']];
const outcomeLabel = o => String(o || 'lost').replace(/_/g, ' ');
const r1 = v => Math.round(v * 10) / 10;

/** One row per scan with a label per column (null where a lost scan skipped it); rare labels fold into 'other'. */
function fieldRows(points, lostPoints) {
  const routeOf = p => p.outcome === 'fallback' ? 'fallback route' : p.win ? `${p.win} route` : 'day route';
  const rows = points.map(p => ({ source: p.source === 'qr' ? 'QR scan' : 'Link tap', device: p.device || 'unknown', route: routeOf(p), outcome: p.outcome === 'fallback' ? 'rescued' : 'delivered', place: p.country || 'unknown' }))
    .concat(lostPoints.map(p => ({ source: 'source unknown', device: null, route: null, outcome: outcomeLabel(p.outcome), place: p.country || 'unknown' })));
  FM_COLUMNS.forEach(([key]) => {
    const tally = tallyOf(rows.filter(r => r[key]), key);
    if (tally.length <= FM_MAX_NODES[key]) return;
    const keep = new Set(tally.slice(0, FM_MAX_NODES[key] - 1).map(r => r.value));
    rows.forEach(r => { if (r[key] && !keep.has(r[key])) r[key] = 'other'; });
  });
  return rows;
}
/** Identical chains merged: [{ steps: [[column, label]…], count }], busiest first. */
function fieldPaths(rows) {
  const m = new Map();
  rows.forEach(r => {
    const steps = FM_COLUMNS.filter(([key]) => r[key]).map(([key]) => [key, r[key]]);
    const id = steps.map(s => s.join(':')).join('>');
    const cur = m.get(id) || { steps, count: 0 };
    cur.count++; m.set(id, cur);
  });
  return [...m.values()].sort((a, b) => b.count - a.count);
}
/** Heights proportional to counts inside `space`, none below the minimum; the rest share what remains. */
function allocateHeights(counts, space) {
  const pinned = new Set();
  const h = counts.map(() => 0);
  for (;;) {
    const free = space - pinned.size * FM_MIN_H;
    const freeCount = counts.reduce((s, c, i) => pinned.has(i) ? s : s + c, 0) || 1;
    counts.forEach((c, i) => { h[i] = pinned.has(i) ? FM_MIN_H : c / freeCount * free; });
    const small = h.map((v, i) => !pinned.has(i) && v < FM_MIN_H ? i : -1).filter(i => i >= 0);
    if (!small.length) return h;
    small.forEach(i => pinned.add(i));
  }
}
function nodeClass(n) {
  if (n.col === 'outcome') return OUTCOME_RANK[n.label] === undefined ? 'lost' : n.label;
  if (n.col === 'source') return n.label === 'Link tap' ? 'tap' : n.label === 'QR scan' ? 'source' : 'lost';
  return n.col;
}
const nodeRank = n => nodeClass(n) === 'lost' ? 2 : (OUTCOME_RANK[n.label] ?? 0);
const nodeOrder = (a, b) => nodeRank(a) - nodeRank(b) || b.count - a.count || a.label.localeCompare(b.label);
/** Nodes, ribbons and their geometry for a given container width. */
function fieldModel(paths, width) {
  const nodes = new Map(), edges = new Map();
  const nodeOf = (col, label) => { const id = `${col}:${label}`; if (!nodes.has(id)) nodes.set(id, { id, col, label, count: 0, paths: [], out: [], in: [] }); return nodes.get(id); };
  paths.forEach((path, pi) => {
    const chain = path.steps.map(([col, label]) => nodeOf(col, label));
    chain.forEach(n => { n.count += path.count; n.paths.push(pi); });
    path.nodes = chain.map(n => n.id);
    path.edges = chain.slice(1).map((b, i) => {
      const a = chain[i], id = `${a.id}>${b.id}`;
      if (!edges.has(id)) { const e = { id, a, b, count: 0, paths: [] }; edges.set(id, e); a.out.push(e); b.in.push(e); }
      const e = edges.get(id); e.count += path.count; e.paths.push(pi);
      return id;
    });
  });
  const total = paths.reduce((s, p) => s + p.count, 0);
  const columns = FM_COLUMNS.map(([key, title], i) => ({ key, title, i, nodes: [...nodes.values()].filter(n => n.col === key).sort(nodeOrder) }));
  const maxNodes = Math.max(1, ...columns.map(c => c.nodes.length));
  const height = Math.max(320, Math.min(640, 60 + maxNodes * 58));
  const nodeW = Math.round(Math.min(150, Math.max(96, width * 0.15)));
  const colGap = (width - nodeW * FM_COLUMNS.length) / (FM_COLUMNS.length - 1);
  const avail = height - FM_PAD_TOP - FM_PAD_BOTTOM;
  const block = Math.min(avail, Math.max(maxNodes * FM_MIN_H + (maxNodes - 1) * FM_GAP, 60 + total * 6));
  const top = FM_PAD_TOP + (avail - block) / 2;
  columns.forEach(c => {
    c.x = c.i * (nodeW + colGap);
    const heights = allocateHeights(c.nodes.map(n => n.count), block - (c.nodes.length - 1) * FM_GAP);
    let y = top;
    c.nodes.forEach((n, i) => { n.x = c.x; n.y = y; n.h = heights[i]; n.w = nodeW; y += heights[i] + FM_GAP; });
  });
  nodes.forEach(n => {
    let off = 0; n.out.sort((p, q) => p.b.y - q.b.y).forEach(e => { e.y0 = n.y + off; e.h0 = n.h * e.count / n.count; off += e.h0; });
    off = 0; n.in.sort((p, q) => p.a.y - q.a.y).forEach(e => { e.y1 = n.y + off; e.h1 = n.h * e.count / n.count; off += e.h1; });
  });
  return { width, height, nodeW, colGap, columns, nodes, edges, paths, total };
}
function edgePath(e) {
  const x0 = r1(e.a.x + e.a.w), x1 = r1(e.b.x), cx = r1((x0 + x1) / 2);
  const [t0, b0, t1, b1] = [e.y0, e.y0 + e.h0, e.y1, e.y1 + e.h1].map(r1);
  return `M${x0},${t0} C${cx},${t0} ${cx},${t1} ${x1},${t1} L${x1},${b1} C${cx},${b1} ${cx},${b0} ${x0},${b0} Z`;
}
const clipText = (s, maxWidth) => { const n = Math.floor(maxWidth / FM_CHAR); return s.length <= n ? s : `${s.slice(0, Math.max(1, n - 1))}…`; };
/** Label and count inside the node when they fit; otherwise wherever there is more room (beside it in a
    wide gap, else inside with the label clipped and the count kept). Clipped text keeps its full form in the tip. */
function nodeText(n, model) {
  const inner = n.w - 12, tail = ` · ${n.count}`, one = n.label + tail, mid = r1(n.y + n.h / 2), x = r1(n.x + 6);
  if (n.h >= 34) return `<text x="${x}" y="${mid - 6}" dominant-baseline="middle">${esc(clipText(n.label, inner))}</text><text class="fm-count" x="${x}" y="${mid + 8}" dominant-baseline="middle">${scans(n.count)}</text>`;
  if (one.length * FM_CHAR <= inner) return `<text x="${x}" y="${mid}" dominant-baseline="middle">${esc(one)}</text>`;
  const sideRoom = model.colGap - 12;
  if (sideRoom <= inner) return `<text x="${x}" y="${mid}" dominant-baseline="middle">${esc(clipText(n.label, inner - tail.length * FM_CHAR) + tail)}</text>`;
  const side = esc(clipText(one, sideRoom));
  return n.col === FM_COLUMNS[FM_COLUMNS.length - 1][0]
    ? `<text class="out" x="${r1(n.x - 6)}" y="${mid}" text-anchor="end" dominant-baseline="middle">${side}</text>`
    : `<text class="out" x="${r1(n.x + n.w + 6)}" y="${mid}" dominant-baseline="middle">${side}</text>`;
}
function nodeSvg(n, model) {
  const title = FM_COLUMNS.find(c => c[0] === n.col)[1];
  return `<g class="fm-node fm-c-${nodeClass(n)}" data-node="${esc(n.id)}" tabindex="0" role="button" aria-pressed="false" aria-label="${esc(n.label)}, ${scans(n.count)}" data-tip="<b>${esc(n.label)}</b> · ${n.count} of ${scans(model.total)} through ${title}"><rect x="${r1(n.x)}" y="${r1(n.y)}" width="${n.w}" height="${r1(n.h)}" rx="3"/>${nodeText(n, model)}</g>`;
}
function fieldMapHtml(model) {
  const titles = model.columns.map(c => `<text class="fm-col" x="${r1(c.x + model.nodeW / 2)}" y="14" text-anchor="middle">${c.title.toUpperCase()}</text>`).join('');
  const ribbons = [...model.edges.values()].map(e => `<path class="fm-edge fm-c-${nodeClass(e.a)}" data-edge="${esc(e.id)}" d="${edgePath(e)}" data-tip="<b>${esc(e.a.label)} → ${esc(e.b.label)}</b> · ${scans(e.count)}"/>`).join('');
  const boxes = model.columns.flatMap(c => c.nodes).map(n => nodeSvg(n, model)).join('');
  return `<div class="fm-head"><span>hover a node to trace its paths · click to pin</span><span class="fm-chip" hidden><b></b> · <button type="button" class="fm-clear">clear</button></span></div>
    <svg viewBox="0 0 ${model.width} ${model.height}" role="group" aria-label="Field map: ${scans(model.total)} traced from source to place">${titles}${ribbons}${boxes}</svg>
    <div class="fm-legend">${FM_LEGEND.map(([c, l]) => `<span><i class="fm-c-${c}"></i>${l}</span>`).join('')}</div>`;
}
/** Hover traces every path through a node or ribbon; click, Enter or Space pins that trace as a filter. */
function bindFieldMap(box, model, state) {
  const svg = box.querySelector('svg'), chip = box.querySelector('.fm-chip');
  const marks = new Map([...svg.querySelectorAll('[data-node],[data-edge]')].map(el => [el.dataset.node || el.dataset.edge, el]));
  const itemOf = el => { const m = el && el.closest('[data-node],[data-edge]'); return m ? (model.nodes.get(m.dataset.node) || model.edges.get(m.dataset.edge)) : null; };
  const connected = item => { const ids = new Set(); item.paths.forEach(pi => { const p = model.paths[pi]; p.nodes.forEach(id => ids.add(id)); p.edges.forEach(id => ids.add(id)); }); return ids; };
  const light = ids => { marks.forEach((el, id) => el.classList.toggle('is-on', ids.has(id))); svg.classList.toggle('is-focus', ids.size > 0); };
  const pinnedNode = () => model.nodes.get(state.pinned);
  const settle = () => light(pinnedNode() ? connected(pinnedNode()) : new Set());
  const pin = id => {
    state.pinned = state.pinned === id ? null : id;
    marks.forEach((el, key) => { if (el.dataset.node) el.setAttribute('aria-pressed', String(key === state.pinned)); });
    const n = pinnedNode();
    chip.hidden = !n;
    if (n) chip.querySelector('b').textContent = `${n.count} of ${scans(model.total)}`;
    settle();
  };
  svg.addEventListener('pointerover', e => { const it = itemOf(e.target); if (it && !state.pinned) light(connected(it)); });
  svg.addEventListener('pointerout', e => { if (!state.pinned && !itemOf(e.relatedTarget)) settle(); });
  svg.addEventListener('focusin', e => { const it = itemOf(e.target); if (it && !state.pinned) light(connected(it)); });
  svg.addEventListener('focusout', () => { if (!state.pinned) settle(); });
  svg.addEventListener('click', e => { const it = itemOf(e.target); if (it && it.col) pin(it.id); });
  svg.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; const it = itemOf(e.target); if (it && it.col) { e.preventDefault(); pin(it.id); } });
  box.querySelector('.fm-clear').addEventListener('click', () => pin(state.pinned));
  const kept = state.pinned; state.pinned = null;
  if (kept && model.nodes.has(kept)) pin(kept);
}
/** Narrow containers get the commonest paths as a list instead of a graph. */
function fieldListHtml(paths, total) {
  const top = paths.slice(0, FM_LIST_ROWS);
  const note = paths.length > top.length ? `the ${top.length} commonest of ${paths.length} paths` : `${paths.length} path${paths.length === 1 ? '' : 's'}`;
  return `<ol class="fm-list">${top.map(p => `<li><span>${p.steps.map(s => esc(s[1])).join(' → ')}</span><b>${p.count}</b><small>${pct(p.count / total)}</small></li>`).join('')}</ol><p class="fm-note">${scans(total)} · ${note}</p>`;
}
function mountFieldMap(box, points, lostPoints) {
  if (!box) return;
  const paths = fieldPaths(fieldRows(points, lostPoints));
  const total = paths.reduce((s, p) => s + p.count, 0);
  const state = { pinned: null, width: 0, mode: null };
  const draw = () => {
    const width = box.clientWidth, mode = width < FM_LIST_BELOW ? 'list' : 'map';
    if (!width || (mode === state.mode && Math.abs(width - state.width) < 24)) return;
    state.width = width; state.mode = mode;
    if (!total) box.innerHTML = '<p class="fm-note">No scans to trace yet.</p>';
    else if (mode === 'list') box.innerHTML = fieldListHtml(paths, total);
    else { const model = fieldModel(paths, width); box.innerHTML = fieldMapHtml(model); bindFieldMap(box, model, state); }
  };
  draw();
  if (window.ResizeObserver) new ResizeObserver(draw).observe(box);
}

function tableHtml(title, rows, total, unit = 'scans') {
  const max = Math.max(1, ...rows.map(r => r.clicks));
  return `<div><h5>${esc(title)}</h5>
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
  const outcomes = tallyOf(ds.points.map(p => ({ outcome: p.outcome === 'fallback' ? 'rescued' : 'delivered' })).concat(ds.lostPoints.map(p => ({ outcome: outcomeLabel(p.outcome) }))), 'outcome');
  return `<div class="k-tables">${tableHtml('Outcome', outcomes, t + ds.lostPoints.length)}${tableHtml('Source', tallyOf(ds.points, 'source').map(r => ({ ...r, value: r.value === 'qr' ? 'QR scan' : 'tap on the link' })), t)}${tableHtml('Device', tallyOf(ds.points, 'device'), t)}${tableHtml('Country', tallyOf(ds.points, 'country'), t)}${tableHtml('Platform', tallyOf(ds.points, 'platform'), t)}${tableHtml('Referrer', tallyOf(ds.points.filter(p => p.ref), 'ref'), t, 'taps')}${ds.windowRows ? tableHtml('Destination', ds.windowRows, t) : ''}</div>`;
}
function barsHtml(values, labels, dense) {
  const max = Math.max(1, ...values);
  return `<div class="bars${dense ? ' dense' : ''}">${values.map((v, i) => `<div class="bar" data-tip="<b>${esc(labels[i])}</b> · ${scans(v)}"><i style="height:${Math.max(2, Math.round(v / max * 100))}%"></i><span>${esc(labels[i])}</span></div>`).join('')}</div>`;
}
function renderGraphs(ds) {
  const hours = new Array(24).fill(0); ds.points.forEach(p => { hours[Math.floor(localHour(p.ms))]++; });
  const dows = new Array(7).fill(0); ds.points.forEach(p => { dows[localDow(p.ms)]++; });
  const days = new Map(); ds.points.forEach(p => { const k = new Date(p.ms).toISOString().slice(5, 10); days.set(k, (days.get(k) || 0) + 1); });
  const dayKeys = [...days.keys()].sort();
  const perLink = ds.linkRows ? `<div><h5>Scans per link, 7 days</h5>${barsHtml(ds.linkRows.map(r => r.events), ds.linkRows.map(r => r.title.split(' · ')[0].slice(0, 12)))}</div>` : '';
  const sentTo = ds.windowRows || tallyOf(ds.points, 'win').map(r => ({ ...r, value: r.value === '—' ? 'day' : r.value }));
  return `<div class="graph-grid">
    ${perLink || `<div><h5>By day</h5>${barsHtml(dayKeys.map(k => days.get(k)), dayKeys)}</div>`}
    <div><h5>By hour of the day, your time</h5>${barsHtml(hours, hours.map((_, h) => String(h).padStart(2, '0')), true)}</div>
    <div><h5>By day of the week</h5>${barsHtml(dows, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])}</div>
    ${perLink ? `<div><h5>By day</h5>${barsHtml(dayKeys.map(k => days.get(k)), dayKeys)}</div>` : `<div><h5>Where they were sent</h5>${barsHtml(sentTo.map(r => r.clicks), sentTo.map(r => String(r.value).slice(0, 14)))}</div>`}
  </div>`;
}
function renderRadar(ds) {
  const axes = radarAxes(ds.points, ds.uniquePeople);
  const shown = a => a.na ? 'not summed' : pct(a.value);
  const cx = 180, cy = 180, R = 130, n = axes.length;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  const rings = [0.25, 0.5, 0.75, 1].map(f => `<polygon points="${axes.map((_, i) => pt(i, R * f).join(',')).join(' ')}" fill="none" stroke="rgba(181,147,90,0.18)" stroke-width="0.8"/>`).join('');
  const spokes = axes.map((_, i) => { const [x, y] = pt(i, R); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(181,147,90,0.18)" stroke-width="0.8"/>`; }).join('');
  const poly = axes.map((a, i) => pt(i, R * Math.max(0.02, a.value)).join(',')).join(' ');
  const dots = axes.map((a, i) => { const [x, y] = pt(i, R * Math.max(0.02, a.value)); return `<circle cx="${x}" cy="${y}" r="3" fill="#f3e6c8"/><circle cx="${x}" cy="${y}" r="11" fill="rgba(217,189,123,0.18)" data-tip="<b>${esc(a.label)}</b> ${shown(a)} · ${esc(a.hint)}"/>`; }).join('');
  const labels = axes.map((a, i) => { const [x, y] = pt(i, R + 22); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="11" letter-spacing="1.5" fill="#d9bd7b" font-style="italic" font-family="Cormorant Garamond, Georgia, serif">${esc(a.label.toUpperCase())}</text>`; }).join('');
  return `<div class="radar-wrap"><div><h5>The mix, six ways at once</h5><svg viewBox="0 0 360 360" role="img" aria-label="Spider chart of the scan mix">${rings}${spokes}<polygon points="${poly}" fill="rgba(217,189,123,0.16)" stroke="#d9bd7b" stroke-width="1.2"/>${dots}${labels}</svg></div>
    <ul class="radar-legend">${axes.map(a => `<li><span>${esc(a.label)} <small style="color:var(--dim)">· ${esc(a.hint)}</small></span><b>${shown(a)}</b></li>`).join('')}</ul></div>`;
}
function drawSky(canvas, points) {
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
  x.fillText(`${scans(points.length)} · busiest hour ${String(busiest).padStart(2, '0')}:00`, cx, cy);
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
  /* ── the plain-language layer, rendered from what the server computed ── */
  const INSIGHT_ORDER = ['qualityScore', 'bestWindow', 'rhythm', 'trend', 'qrSplit', 'deviceMatch', 'missed', 'fallbackUsage', 'repeatPattern', 'newVsReturning', 'channelMix', 'geoDrift', 'utmHealth', 'safetyImpact', 'anomalies', 'campaignLift', 'roi', 'placement', 'replay'];
  const CONFIDENCE_LABEL = { high: 'high confidence', medium: 'medium confidence', early: 'early signal' };
  const PROVENANCE_SHOWN = new Set(['estimated', 'assumption', 'heuristic']);
  const DISMISS_REASONS = [['not_relevant', 'Not relevant'], ['known_event', 'Known event'], ['bad_data', 'Bad data'], ['remind_later', 'Remind me later']];
  function chipHtml(confidence) {
    return CONFIDENCE_LABEL[confidence] ? `<span class="ki-chip ki-chip-${esc(confidence)}">${CONFIDENCE_LABEL[confidence]}</span>` : '';
  }
  function metaHtml(f) {
    const bits = [];
    if (f.sampleSize) bits.push(scans(f.sampleSize));
    if (PROVENANCE_SHOWN.has(f.provenance)) bits.push(esc(f.provenance));
    if (f.insufficient) bits.push(`<span class="ki-need">${f.insufficient.have} of ${f.insufficient.needed} needed${f.insufficient.note ? ` · ${esc(f.insufficient.note)}` : ''}</span>`);
    return bits.length ? `<div class="ki-meta">${bits.join('<i>·</i>')}</div>` : '';
  }
  function extraHtml(f) {
    const d = f.detail;
    if (!d) return '';
    if (f.key === 'replay' && d.lines) return `<ul class="ki-lines">${d.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`;
    if (f.key === 'channelMix' && d.channels) return `<div class="ki-bars">${d.channels.slice(0, 6).map(c => `<span data-tip="<b>${esc(c.channel)}</b> · ${c.count} visits"><i style="width:${Math.max(3, c.share)}%"></i>${esc(c.channel)} ${c.share}%</span>`).join('')}</div>`;
    if (f.key === 'repeatPattern' && d.people) return `<div class="ki-bars">${[['once', d.once], ['twice', d.twice], ['3+', d.more]].map(([l, v]) => `<span data-tip="<b>${l}</b> · ${v} people"><i style="width:${Math.max(3, Math.round(v / Math.max(1, d.people) * 100))}%"></i>${l} ${v}</span>`).join('')}</div>`;
    if (f.key === 'geoDrift' && d.movers && d.movers.length) return `<div class="ki-bars">${d.movers.slice(0, 4).map(m => `<span data-tip="<b>${esc(m.country)}</b> · ${m.before}% → ${m.after}%"><i style="width:${Math.max(3, m.after)}%"></i>${esc(m.country)} ${m.after}%${m.change ? ` (${m.change > 0 ? '+' : ''}${m.change})` : ''}</span>`).join('')}</div>`;
    return '';
  }
  /** The CTA (a link when the action points at a page, else a button) and the Dismiss menu; a finding without an action offers neither. */
  function actionsHtml(f) {
    const a = f.action;
    if (!a || !a.label) return '';
    const cta = a.href ? `<a class="ki-cta" href="${esc(a.href)}" target="_blank" rel="noopener">${esc(a.label)}</a>` : `<button type="button" class="ki-cta">${esc(a.label)}</button>`;
    const menu = `<details class="ki-menu"><summary>Dismiss</summary><div role="menu">${DISMISS_REASONS.map(([k, l]) => `<button type="button" role="menuitem" data-dismiss="${k}">${l}</button>`).join('')}</div></details>`;
    return `<div class="ki-actions">${cta}${menu}</div>`;
  }
  /** One finding as a card; `actions` adds the CTA and the Dismiss menu. */
  function insightCard(f, actions = false) {
    const score = f.key === 'qualityScore' && f.detail && f.detail.score != null ? `<b class="ki-score">${f.detail.score}</b>` : '';
    return `<article class="ki ki-${esc(f.status)}${f.severity ? ` ki-sev-${esc(f.severity)}` : ''}" data-key="${esc(f.key)}"><div class="ki-head"><span class="ki-dot" aria-hidden="true"></span><h5>${esc(f.title)}</h5>${chipHtml(f.confidence)}${score}</div><p>${esc(f.headline)}</p>${metaHtml(f)}${extraHtml(f)}${actions ? actionsHtml(f) : ''}</article>`;
  }
  /** Render the findings into a container: `keys` limits and orders them; omitted = all. */
  function renderInsights(container, insights, { keys = INSIGHT_ORDER, compact = false } = {}) {
    if (!container) return;
    if (!insights) { container.innerHTML = ''; return; }
    const list = keys.map(k => insights[k]).filter(Boolean);
    container.innerHTML = list.length ? `<div class="ki-grid${compact ? ' ki-compact' : ''}">${list.map(f => insightCard(f)).join('')}</div>` : '<p class="ki-empty">Nothing to show here yet.</p>';
    attachTips(container);
  }
  /* ── Action Center: the numbers first, then what needs a fix, what is
     working, what the last change did, and the rest to explore ── */
  const EXPLORE_TABS = [['placement', 'Placement'], ['routing', 'Routing'], ['audience', 'Audience'], ['campaign', 'Campaign'], ['trust', 'Trust']];
  const EXPLORE_DEFAULT = {
    placement: ['qrSplit', 'placement', 'trend', 'bestWindow', 'rhythm', 'roi', 'campaignLift'],
    routing: ['deviceMatch', 'missed', 'fallbackUsage', 'replay'],
    audience: ['repeatPattern', 'newVsReturning', 'geoDrift'],
    campaign: ['utmHealth', 'channelMix', 'anomalies'],
    trust: ['safetyImpact', 'qualityScore']
  };
  const ACTION_DONE = { ADD_FALLBACK: 'fallback added', RAISE_CAP: 'cap raised', REMOVE_CAP: 'cap removed', EXTEND_END_DATE: 'end date extended', REMOVE_END_DATE: 'end date removed', ADD_IOS_DESTINATION: 'iPhone destination added', ADD_ANDROID_DESTINATION: 'Android destination added', FIX_SCHEDULE: 'schedule fixed', ADD_UTM: 'campaign tags added', ADD_PLACEMENT: 'placement set', PAUSE_LINK: 'link paused', REQUEST_REVIEW: 'review requested' };
  const SINCE_STATE = { pending: 'Measuring', improved: 'Improved', unchanged: 'Unchanged', regressed: 'Regressed' };
  function sinceHtml(s) {
    const what = ACTION_DONE[s.type] || String(s.type || 'change').toLowerCase().replace(/_/g, ' ');
    const before = s.before || {}, after = s.after || {};
    const text = s.state === 'pending'
      ? `${scans(after.observed || 0)} since the change; a comparison needs ten scans and a full day.`
      : `Useful rate ${pct(before.usefulRate || 0)} → ${pct(after.usefulRate || 0)}: ${scans(after.observed || 0)} since, against ${before.observed || 0} before.`;
    return `<div class="ac-since ac-since-${esc(s.state)}"><b>${SINCE_STATE[s.state] || esc(s.state)}</b><span>${esc(what)} · ${fmtDate(s.atMs)}</span><p>${text}</p></div>`;
  }
  function peopleLine(unique) {
    return unique && unique.distinctVisitors != null ? `about ${unique.distinctVisitors} people (${unique.coveragePct ?? 0}% of scans covered)` : 'people: not enough coverage yet';
  }
  function sectionHtml(title, findings, empty, actions) {
    return `<section class="ac-section"><h5>${title}</h5>${findings.length ? `<div class="ki-grid">${findings.map(f => insightCard(f, actions)).join('')}</div>` : `<p class="ac-none">${empty}</p>`}</section>`;
  }
  /** `onAction(finding)` for a CTA button, `onAction(finding, { dismissed })` for the Dismiss menu; a CTA link navigates on its own; `readOnly` hides all three. */
  function renderActionCenter(container, analytics, { onAction, readOnly = false } = {}) {
    if (!container) return;
    const a = analytics || {}, t = a.totals || {}, ac = a.actionCenter || {}, insights = a.insights || {};
    const observed = t.observed ?? t.events ?? 0;
    const useful = t.useful ?? observed, lost = t.lost ?? 0, rescued = t.rescued ?? 0;
    const usefulRate = t.usefulRate ?? (observed ? useful / observed : 0);
    if (!observed) {
      container.innerHTML = '<div class="ac"><div class="ac-empty"><h5>No scans observed yet</h5><p>Print one test copy and scan it with a phone. It should land where you expect and show up here within a minute, with the device, country and route it took.</p></div></div>';
      return;
    }
    const metrics = `<div class="ac-metrics"><div class="ac-metric"><b>${useful}</b><span>Useful visits</span></div><div class="ac-metric ac-m-lost"><b>${lost}</b><span>Lost</span></div><div class="ac-metric ac-m-rescued"><b>${rescued}</b><span>Rescued</span></div><div class="ac-metric"><b>${pct(usefulRate)}</b><span>Useful rate</span></div></div>
      <p class="ac-support">${scans(observed)} observed · ${peopleLine(a.unique)}</p>`;
    if (observed < 5) {
      container.innerHTML = `<div class="ac">${metrics}<p class="ac-low">Counts only for now: findings begin at five scans, timing and trend reads at thirty across several days.</p></div>`;
      return;
    }
    const pick = keys => (keys || []).map(k => insights[k]).filter(Boolean);
    const explore = ac.explore || EXPLORE_DEFAULT;
    container.innerHTML = `<div class="ac">${metrics}
      ${sectionHtml('Needs attention', pick(ac.needsAttention).slice(0, 3), 'Nothing needs a fix right now.', !readOnly)}
      ${sectionHtml("What's working", pick(ac.working).slice(0, 2), 'Nothing stands out as working yet.', false)}
      ${ac.sinceLastChange ? `<section class="ac-section"><h5>Result since last change</h5>${sinceHtml(ac.sinceLastChange)}</section>` : ''}
      <section class="ac-section"><h5>Explore</h5><div class="ac-tabs" role="group" aria-label="Explore the findings">${EXPLORE_TABS.map(([k, l], i) => `<button type="button" data-tab="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>${EXPLORE_TABS.map(([k], i) => `<div class="ac-pane" data-pane="${k}" ${i ? 'hidden' : ''}></div>`).join('')}</section>
    </div>`;
    attachTips(container);
    EXPLORE_TABS.forEach(([k]) => renderInsights(container.querySelector(`.ac-pane[data-pane="${k}"]`), insights, { keys: explore[k] || [], compact: true }));
    const tabs = [...container.querySelectorAll('.ac-tabs button')], panes = [...container.querySelectorAll('.ac-pane')];
    tabs.forEach(btn => btn.addEventListener('click', () => {
      tabs.forEach(b => b.setAttribute('aria-pressed', b === btn));
      panes.forEach(pane => { pane.hidden = pane.dataset.pane !== btn.dataset.tab; });
    }));
    const findingOf = el => insights[el.closest('[data-key]').dataset.key];
    container.querySelectorAll('button.ki-cta').forEach(b => b.addEventListener('click', () => { if (onAction) onAction(findingOf(b)); }));
    container.querySelectorAll('[data-dismiss]').forEach(b => b.addEventListener('click', () => {
      b.closest('details').open = false;
      if (onAction) onAction(findingOf(b), { dismissed: b.dataset.dismiss });
    }));
  }

  /* ── Workspace queue: links in the order the server ranked them, one action each ── */
  function renderWorkspaceQueue(container, data, { onOpen } = {}) {
    if (!container) return;
    const links = (data && data.links) || [];
    const byCode = new Map(links.map(l => [l.code, l]));
    const rows = ((data && data.queue) || links.map(l => l.code)).map(c => byCode.get(c)).filter(Boolean);
    if (!rows.length) { container.innerHTML = '<p class="kq-empty">No links to queue yet.</p>'; return; }
    const change = v => v == null ? '—' : `${v > 0 ? '+' : ''}${Math.round(v * 100)} pts`;
    const rowHtml = r => {
      const placement = r.placementLabel || r.placement;
      return `<tr><td><b>${esc(r.title || r.code)}</b><br><span class="mono kq-sub">${esc(r.code)}${placement ? ` · ${esc(placement)}` : ''}</span></td><td class="n">${r.useful ?? r.events ?? 0}</td><td class="n">${r.lost ?? 0}</td><td class="n">${r.usefulRate == null ? '—' : pct(r.usefulRate)}</td><td class="n">${change(r.changeVsPrevious)}</td><td class="kq-issue">${r.topIssue ? esc(r.topIssue.headline) : '—'}</td><td>${chipHtml(r.confidence) || '—'}</td><td class="n"><button type="button" class="kq-open" data-code="${esc(r.code)}">${r.topIssue && r.topIssue.action ? esc(r.topIssue.action.label) : 'Open'}</button></td></tr>`;
    };
    container.innerHTML = `<div class="k-scroll"><table class="k-table kq"><thead><tr><th>Link · placement</th><th class="n">Useful</th><th class="n">Lost</th><th class="n">Useful rate</th><th class="n">Change</th><th>Top issue</th><th>Confidence</th><th></th></tr></thead><tbody>${rows.map(rowHtml).join('')}</tbody></table></div>${data.droppedLinks ? `<p class="kq-note">${data.droppedLinks} more link${data.droppedLinks === 1 ? '' : 's'} not shown.</p>` : ''}`;
    container.querySelectorAll('.kq-open').forEach(b => b.addEventListener('click', () => { const r = byCode.get(b.dataset.code); if (onOpen) onOpen(r.code, r.topIssue || null); }));
  }

  window.KortexViews = {
    renderInsights, renderActionCenter, renderWorkspaceQueue, ptOf, ptOfLost, tallyOf, radarAxes, pct, viewsHtml, mountViews, drawSky, variationOf, localHour, localDow, esc, fmtDate, stripScheme, showTip, hideTip, attachTips };
})();
