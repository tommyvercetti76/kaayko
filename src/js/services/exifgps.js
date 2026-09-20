/**
 * services/exifgps.js — read the GPS fix out of a photo, in the browser.
 *
 * A ramp photo is taken standing on the ramp, so its EXIF GPS IS the launch
 * point. This reads that fix before anything else touches the file: the
 * canvas resize in submitentry.js re-encodes and drops EXIF, and the API
 * strips it from pass-through files too, so the coordinate has to be lifted
 * here or it is gone. Nothing is uploaded — the bytes stay local and the
 * photo that goes to the server is still metadata-free.
 *
 * No dependency. EXIF lives in a JPEG APP1 segment as a TIFF structure, and
 * that is ~120 lines to walk directly. iOS transcodes HEIC to JPEG on its way
 * through a file input, so JPEG covers phones as well as desktops; a genuine
 * .heic that reaches us (desktop drag-drop) returns null and the flow falls
 * back to the map.
 *
 * Exposes window.KaaykoExif.readGps(file) -> Promise<fix|null>
 *   fix = { lat, lng, accuracyM|null, altitudeM|null, takenAt|null }
 */
(function () {
  'use strict';

  // EXIF sits at the front of the file. 512 KB is far more than any real
  // header needs and avoids pulling a 12 MB photo into memory to read it.
  var HEAD_BYTES = 512 * 1024;

  var TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

  var TAG = {
    EXIF_IFD:  0x8769,
    GPS_IFD:   0x8825,
    DATE_ORIG: 0x9003,
    GPS_LAT_REF: 0x0001,
    GPS_LAT:     0x0002,
    GPS_LNG_REF: 0x0003,
    GPS_LNG:     0x0004,
    GPS_ALT_REF: 0x0005,
    GPS_ALT:     0x0006,
    GPS_HPOS_ERR: 0x001F
  };

  function readHead(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(new DataView(reader.result)); };
      reader.onerror = function () { reject(reader.error || new Error('read failed')); };
      reader.readAsArrayBuffer(file.slice(0, HEAD_BYTES));
    });
  }

  /** Byte offset of the TIFF header inside a JPEG, or -1. */
  function findTiffStart(view) {
    if (view.byteLength < 4 || view.getUint16(0) !== 0xFFD8) return -1;   // not a JPEG
    var offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xFF) return -1;                      // desynced
      var marker = view.getUint8(offset + 1);
      if (marker === 0xD8 || (marker >= 0xD0 && marker <= 0xD9)) { offset += 2; continue; }
      if (marker === 0xDA) return -1;                                     // image data; no EXIF
      var size = view.getUint16(offset + 2);
      if (size < 2) return -1;
      if (marker === 0xE1 && offset + 10 <= view.byteLength) {
        // "Exif\0\0"
        if (view.getUint32(offset + 4) === 0x45786966 && view.getUint16(offset + 8) === 0x0000) {
          return offset + 10;
        }
      }
      offset += 2 + size;
    }
    return -1;
  }

  function entryValue(view, tiff, entry, little) {
    var type = view.getUint16(entry + 2, little);
    var count = view.getUint32(entry + 4, little);
    var unit = TYPE_SIZE[type];
    if (!unit) return null;
    var total = unit * count;
    var at = total > 4 ? tiff + view.getUint32(entry + 8, little) : entry + 8;
    if (at < 0 || at + total > view.byteLength) return null;

    var out = [];
    for (var i = 0; i < count; i++) {
      var p = at + i * unit;
      if (type === 1 || type === 7) out.push(view.getUint8(p));
      else if (type === 2) out.push(String.fromCharCode(view.getUint8(p)));
      else if (type === 3) out.push(view.getUint16(p, little));
      else if (type === 4) out.push(view.getUint32(p, little));
      else if (type === 9) out.push(view.getInt32(p, little));
      else if (type === 5 || type === 10) {
        var num = type === 5 ? view.getUint32(p, little) : view.getInt32(p, little);
        var den = type === 5 ? view.getUint32(p + 4, little) : view.getInt32(p + 4, little);
        out.push(den === 0 ? 0 : num / den);
      }
    }
    if (type === 2) return out.join('').replace(/\0+$/, '');
    return out;
  }

  /** Walk one IFD, returning { tag: value } for the tags asked for. */
  function readIfd(view, tiff, ifd, little, wanted) {
    var found = {};
    if (ifd + 2 > view.byteLength) return found;
    var count = view.getUint16(ifd, little);
    // A corrupt count can point anywhere; bound it to what we actually hold.
    var max = Math.min(count, Math.floor((view.byteLength - ifd - 2) / 12));
    for (var i = 0; i < max; i++) {
      var entry = ifd + 2 + i * 12;
      var tag = view.getUint16(entry, little);
      if (wanted.indexOf(tag) === -1) continue;
      found[tag] = entryValue(view, tiff, entry, little);
    }
    return found;
  }

  function toDecimal(parts, ref) {
    if (!parts || parts.length < 3) return null;
    var value = parts[0] + parts[1] / 60 + parts[2] / 3600;
    if (!isFinite(value)) return null;
    if (ref === 'S' || ref === 'W') value = -value;
    return value;
  }

  // "2026:09:14 07:31:02" — EXIF's own format, local time, no zone.
  function toDate(raw) {
    if (typeof raw !== 'string') return null;
    var m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    return isNaN(d.getTime()) ? null : d;
  }

  async function readGps(file) {
    if (!file || !file.slice) return null;
    var view;
    try { view = await readHead(file); } catch { return null; }

    var tiff = findTiffStart(view);
    if (tiff < 0 || tiff + 8 > view.byteLength) return null;

    var order = view.getUint16(tiff);
    if (order !== 0x4949 && order !== 0x4D4D) return null;
    var little = order === 0x4949;
    if (view.getUint16(tiff + 2, little) !== 42) return null;

    var ifd0 = tiff + view.getUint32(tiff + 4, little);
    var roots = readIfd(view, tiff, ifd0, little, [TAG.GPS_IFD, TAG.EXIF_IFD]);

    var gpsPtr = roots[TAG.GPS_IFD] && roots[TAG.GPS_IFD][0];
    if (!gpsPtr) return null;                                  // no GPS block at all

    var gps = readIfd(view, tiff, tiff + gpsPtr, little, [
      TAG.GPS_LAT_REF, TAG.GPS_LAT, TAG.GPS_LNG_REF, TAG.GPS_LNG,
      TAG.GPS_ALT_REF, TAG.GPS_ALT, TAG.GPS_HPOS_ERR
    ]);

    var lat = toDecimal(gps[TAG.GPS_LAT], gps[TAG.GPS_LAT_REF]);
    var lng = toDecimal(gps[TAG.GPS_LNG], gps[TAG.GPS_LNG_REF]);
    if (lat === null || lng === null) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    // Null Island is what a cleared GPS block looks like, not a boat ramp.
    if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return null;

    var altitude = null;
    if (gps[TAG.GPS_ALT] && gps[TAG.GPS_ALT].length) {
      altitude = gps[TAG.GPS_ALT][0];
      var altRef = gps[TAG.GPS_ALT_REF];
      if (altRef && altRef[0] === 1) altitude = -altitude;     // below sea level
    }

    var takenAt = null;
    var exifPtr = roots[TAG.EXIF_IFD] && roots[TAG.EXIF_IFD][0];
    if (exifPtr) {
      var sub = readIfd(view, tiff, tiff + exifPtr, little, [TAG.DATE_ORIG]);
      takenAt = toDate(sub[TAG.DATE_ORIG]);
    }

    return {
      lat: lat,
      lng: lng,
      accuracyM: gps[TAG.GPS_HPOS_ERR] && gps[TAG.GPS_HPOS_ERR].length ? gps[TAG.GPS_HPOS_ERR][0] : null,
      altitudeM: altitude,
      takenAt: takenAt
    };
  }

  /** First file in the list that carries a usable fix, or null. */
  async function firstGps(files) {
    for (var i = 0; i < files.length; i++) {
      var fix = await readGps(files[i]);
      if (fix) return { fix: fix, file: files[i], index: i };
    }
    return null;
  }

  window.KaaykoExif = { readGps: readGps, firstGps: firstGps };
})();
