import { useState, useRef, useCallback } from 'react';

/**
 * Web Speech API hook — cross-browser safe.
 *
 * Key problems solved:
 * - Safari/iOS never sets isFinal=true before onend, so we track the last
 *   seen transcript (interim or final) as a fallback.
 * - onend fires after onresult, so we fire onResult from onend (single place).
 * - React 18 batches the state resets + onResult call in the same tick.
 */
export function useVoice(onResult) {
  const [listening, setListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');

  const recognitionRef = useRef(null);
  const finalRef  = useRef('');   // isFinal=true text (Chrome)
  const lastRef   = useRef('');   // any text seen — fallback for Safari
  const firedRef  = useRef(false);

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const supported = Boolean(SpeechRecognition);

  const start = useCallback(() => {
    if (!SpeechRecognition) return;

    // Reset all refs
    finalRef.current  = '';
    lastRef.current   = '';
    firedRef.current  = false;
    setLiveTranscript('');

    const recognition = new SpeechRecognition();
    recognition.continuous      = false;
    recognition.interimResults  = true;
    recognition.lang            = 'en-US';
    recognitionRef.current      = recognition;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      let interim = '';
      let final   = '';

      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final   += t;
        else                          interim += t;
      }

      const displayed = final || interim;
      setLiveTranscript(displayed);
      lastRef.current = displayed;          // always track last seen text
      if (final) finalRef.current = final;  // track confirmed-final text
    };

    recognition.onend = () => {
      setListening(false);
      setLiveTranscript('');

      // Prefer isFinal text; fall back to last interim (covers Safari)
      const text = (finalRef.current || lastRef.current).trim();
      if (text && !firedRef.current) {
        firedRef.current = true;
        onResult(text);
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.warn('[useVoice]', event.error);
      }
      setListening(false);
      setLiveTranscript('');
    };

    recognition.start();
  }, [SpeechRecognition, onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { listening, liveTranscript, supported, start, stop };
}
