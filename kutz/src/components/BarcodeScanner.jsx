import { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { COLORS } from '../lib/constants';

// Error names that fire on every frame with no barcode — intentionally silent
const SILENT_ERRORS = new Set(['NotFoundException', 'ChecksumException', 'FormatException']);

function friendlyError(e) {
  if (!e) return 'Camera unavailable.';
  if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')
    return 'Camera permission denied. Tap Allow when prompted, then try again.';
  if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError')
    return 'No camera found on this device.';
  if (e.name === 'NotReadableError' || e.name === 'TrackStartError')
    return 'Camera is in use by another app. Close it and try again.';
  if (e.name === 'OverconstrainedError')
    return 'Camera constraints not supported. Try again.';
  return e.message || 'Camera unavailable.';
}

/**
 * Full-screen barcode scanner overlay.
 *
 * @zxing/browser is lazy-imported (never in the initial bundle).
 * Fires onResult(barcodeText) once on first scan, then closes.
 * Fires onClose() when user taps ×.
 */
export default function BarcodeScanner({ onResult, onClose }) {
  const videoRef    = useRef(null);
  const controlsRef = useRef(null);   // IScannerControls from zxing
  const doneRef     = useRef(false);  // prevents double-fire
  const [status, setStatus] = useState('loading'); // 'loading' | 'scanning' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let unmounted = false;

    async function start() {
      try {
        // Dynamic import — keeps zxing (~700KB) out of the initial bundle
        const { BrowserMultiFormatReader } = await import('@zxing/browser');

        if (unmounted) return;

        const reader = new BrowserMultiFormatReader();

        // Enumerate cameras; fall back gracefully if enumeration fails
        let deviceId;
        try {
          const devices = await BrowserMultiFormatReader.listVideoInputDevices();
          const back    = devices.find(d => /back|rear|environment/i.test(d.label));
          deviceId      = (back ?? devices[0])?.deviceId;
        } catch {
          deviceId = undefined; // let browser choose
        }

        if (unmounted) return;

        setStatus('scanning');

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, err) => {
            // Success
            if (result && !doneRef.current && !unmounted) {
              doneRef.current = true;
              try { controls?.stop(); } catch {}
              onResult(result.getText());
              return;
            }

            // Suppress per-frame "no barcode found" errors — they're expected
            if (err) {
              const name = err?.name ?? '';
              if (!SILENT_ERRORS.has(name)) {
                console.warn('[BarcodeScanner] scan error:', err);
              }
            }
          }
        );

        controlsRef.current = controls;
      } catch (e) {
        if (!unmounted) {
          console.error('[BarcodeScanner] init error:', e);
          setErrorMsg(friendlyError(e));
          setStatus('error');
        }
      }
    }

    start();

    return () => {
      unmounted = true;
      try { controlsRef.current?.stop(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#020617' }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #1e293b' }}
      >
        <span className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
          Scan barcode
        </span>
        <button
          onClick={onClose}
          className="p-2 rounded-lg active:opacity-60"
          style={{ color: COLORS.textMuted }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Camera / state area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">

        {/* Loading */}
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin" style={{ color: COLORS.green }} />
            <p className="text-sm" style={{ color: COLORS.textSecondary }}>Starting camera…</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-4 px-8 text-center">
            <p className="text-sm leading-relaxed" style={{ color: COLORS.red }}>{errorMsg}</p>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: '#1e293b', color: COLORS.textPrimary }}
            >
              Close
            </button>
          </div>
        )}

        {/* Camera feed (always mounted so the ref is ready before start() runs) */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: status === 'scanning' ? 1 : 0, transition: 'opacity 0.3s' }}
          muted
          playsInline
          autoPlay
        />

        {/* Viewfinder guide — only visible while scanning */}
        {status === 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* dark vignette outside the box */}
            <div
              className="w-72 h-40 rounded-2xl relative"
              style={{
                border: `2px solid ${COLORS.green}`,
                boxShadow: `0 0 0 9999px rgba(2,6,23,0.55)`,
              }}
            >
              {/* corner accents */}
              {[
                'top-0 left-0 border-t-2 border-l-2 rounded-tl-xl',
                'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
                'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl',
                'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl',
              ].map((cls, i) => (
                <span
                  key={i}
                  className={`absolute w-5 h-5 ${cls}`}
                  style={{ borderColor: COLORS.green }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div
        className="flex-shrink-0 pb-safe py-4 text-center"
        style={{ borderTop: '1px solid #1e293b' }}
      >
        <p className="text-xs" style={{ color: COLORS.textMuted }}>
          {status === 'scanning'
            ? 'Align barcode inside the box'
            : status === 'loading'
            ? 'Requesting camera access…'
            : ''}
        </p>
      </div>
    </div>
  );
}
