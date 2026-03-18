import { useState, useRef, useCallback } from 'react';

/**
 * Web Speech API hook.
 * - Shows live interim transcript while speaking
 * - On speech end, calls onResult(finalText) once with the complete utterance
 * - Works in Chrome (desktop + Android) and Safari (iOS 14.5+)
 */
export function useVoice(onResult) {
  const [listening, setListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');

  const recognitionRef = useRef(null);
  const accumulatedRef = useRef('');   // tracks final text across result events
  const firedRef = useRef(false);      // prevents double-firing

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const supported = Boolean(SpeechRecognition);

  const start = useCallback(() => {
    if (!SpeechRecognition) return;

    // Reset state
    accumulatedRef.current = '';
    firedRef.current = false;
    setLiveTranscript('');

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      // Build the full transcript from all results so far
      let interim = '';
      let final = '';

      for (let i = 0; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      const displayed = final + interim;
      setLiveTranscript(displayed);

      if (final) {
        accumulatedRef.current = final;
      }
    };

    recognition.onend = () => {
      setListening(false);
      setLiveTranscript('');

      // Fire once with whatever we accumulated
      const text = accumulatedRef.current.trim();
      if (text && !firedRef.current) {
        firedRef.current = true;
        onResult(text);
      }
    };

    recognition.onerror = (event) => {
      // 'no-speech' is normal — just means silence, not a real error
      if (event.error !== 'no-speech') {
        console.warn('[useVoice] error:', event.error);
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
