/**
 * PinPicker.destroy() — the map can be mounted more than once (a modal, a
 * re-rendered panel) without leaking listeners, timers or a second Leaflet map,
 * and a timer that fires after destroy never touches the removed map.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SRC = fs.readFileSync(fileURLToPath(new URL('../src/js/components/PinPicker.js', import.meta.url)), 'utf8');

function fakeLeaflet(log) {
  const map = {
    handlers: 0,
    setView() { return this; }, on(ev) { this.handlers += ev.split(' ').length; return this; },
    off() { log.push('off'); this.handlers = 0; return this; }, remove() { log.push('remove'); },
    invalidateSize() { log.push('invalidateSize'); }, fitBounds() { log.push('fitBounds'); },
    flyTo() { log.push('flyTo'); }, getZoom: () => 4, removeLayer() {},
    getCenter: () => ({ lat: 1, lng: 2 }), distance: () => 1000, getBounds: () => ({ getNorthEast: () => ({}) })
  };
  const layer = () => ({ addTo() { return this; }, on() { return this; }, off() { log.push('marker.off'); return this; },
    bindTooltip() { return this; }, setLatLng() {}, getLatLng: () => ({ lat: 1, lng: 2 }) });
  const group = { layers: [], addTo() { return this; }, clearLayers() { this.layers = []; }, addLayer(m) { this.layers.push(m); },
    eachLayer(fn) { this.layers.forEach(fn); } };
  return { map, L: { map: () => map, tileLayer: () => ({ addTo() {} }), layerGroup: () => group,
    marker: () => layer(), icon: () => ({}), divIcon: () => ({}) } };
}

function load(log) {
  const { map, L } = fakeLeaflet(log);
  const ctx = { window: {}, L, setTimeout, clearTimeout, Set, Number, Math, console };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { PinPicker: ctx.window.PinPicker, map };
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

test('destroy cancels pending timers, removes listeners and the map, once', async () => {
  const log = [];
  const { PinPicker, map } = load(log);
  const pp = PinPicker.create({}, { pickable: true, onMove() {} });
  assert.ok(map.handlers >= 3, 'click + moveend + zoomend attached');
  pp.setResults([{ lat: 1, lng: 2, onClick() {} }]);
  pp.fitResults();          // schedules invalidateSize + fitBounds at 60 ms
  pp.destroy();
  pp.destroy();             // twice is harmless
  await wait(150);          // past every scheduled delay (80 ms invalidate, 60 ms fit)
  assert.deepEqual(log.filter(x => x === 'invalidateSize' || x === 'fitBounds'), [], 'no late call reached the removed map');
  assert.equal(log.filter(x => x === 'remove').length, 1);
  assert.equal(log.filter(x => x === 'off').length, 1);
  assert.equal(map.handlers, 0);
  assert.equal(pp.isDestroyed(), true);
});

test('after destroy every method is a no-op', () => {
  const log = [];
  const { PinPicker } = load(log);
  const pp = PinPicker.create({}, {});
  pp.destroy();
  log.length = 0;
  assert.equal(pp.setPin(1, 2, { fly: true }), null);
  pp.flyTo(1, 2); pp.setResults([{ lat: 1, lng: 2 }]); pp.fitResults(); pp.clearResults(); pp.invalidate(); pp.clearPin();
  assert.equal(pp.center(), null);
  assert.deepEqual(log, []);
});

test('a live picker still does its job', async () => {
  const log = [];
  const { PinPicker } = load(log);
  const pp = PinPicker.create({}, {});
  pp.setResults([{ lat: 1, lng: 2 }]);
  pp.fitResults();
  await wait(120);
  assert.ok(log.includes('fitBounds'));
  assert.ok(log.includes('invalidateSize'));
  pp.destroy();
});
