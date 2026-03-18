import { useState, useCallback, useRef } from 'react';
import { Mic, MicOff, Loader2, Send, X, Sparkles } from 'lucide-react';
import { useVoice } from '../hooks/useVoice';
import { parseFoods } from '../lib/claude';
import { COLORS, MEAL_COLORS } from '../lib/constants';

/**
 * Voice input component.
 *
 * Flow:
 *  1. Tap mic → Web Speech API starts, live transcript appears in text field
 *  2. Stop speaking → transcript locks into text field (editable)
 *  3. Auto-parse fires after 800ms (or tap ➤ to parse immediately)
 *  4. Preview cards show up → tap × to remove items → "Add All"
 */
export default function VoiceInput({ onAdd, disabled }) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const autoParseTimer = useRef(null);

  // When speech recognition finishes, put the result in the text field
  // and auto-parse after a short delay (user can still edit/cancel)
  const handleVoiceResult = useCallback((transcript) => {
    setText(transcript);
    setError('');
    setPreview(null);

    // Auto-parse after 800ms — user can tap mic / edit to cancel
    clearTimeout(autoParseTimer.current);
    autoParseTimer.current = setTimeout(() => {
      doParse(transcript);
    }, 800);
  }, []);

  const { listening, liveTranscript, supported, start, stop } = useVoice(handleVoiceResult);

  // The text field shows live interim transcript while mic is active,
  // then the final editable transcript once speech ends
  const displayText = listening ? liveTranscript : text;

  async function doParse(input) {
    const trimmed = (input || text).trim();
    if (!trimmed) return;
    clearTimeout(autoParseTimer.current);
    setParsing(true);
    setError('');
    setPreview(null);
    try {
      const { foods } = await parseFoods(trimmed);
      setPreview(foods);
    } catch (e) {
      setError(e.message || 'Parse failed. Try again.');
    } finally {
      setParsing(false);
    }
  }

  function handleMicToggle() {
    if (listening) {
      stop();
    } else {
      clearTimeout(autoParseTimer.current);
      setPreview(null);
      setError('');
      setText('');
      start();
    }
  }

  function removePreviewItem(idx) {
    setPreview(prev => prev.filter((_, i) => i !== idx));
  }

  async function confirmAdd() {
    if (!preview?.length) return;
    await onAdd(preview.map(f => ({ ...f, source: 'voice' })));
    setPreview(null);
    setText('');
  }

  function cancel() {
    clearTimeout(autoParseTimer.current);
    setPreview(null);
    setText('');
    setError('');
  }

  const micColor = listening ? '#f87171' : '#34d399';
  const canSend = displayText.trim() && !parsing && !listening;

  return (
    <div className="px-4 space-y-4">
      {/* Mic + text row */}
      <div className="flex gap-3 items-start">
        {/* Mic button */}
        {supported && (
          <button
            onClick={handleMicToggle}
            disabled={disabled || parsing}
            className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95"
            style={{ background: micColor, opacity: disabled ? 0.5 : 1 }}
          >
            {listening
              ? <MicOff size={22} color="#020617" />
              : <Mic size={22} color="#020617" />
            }
          </button>
        )}

        {/* Text field — shows live transcript while listening, editable after */}
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <textarea
              rows={2}
              value={displayText}
              onChange={e => {
                if (!listening) {
                  setText(e.target.value);
                  clearTimeout(autoParseTimer.current);
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  doParse();
                }
              }}
              placeholder={listening ? '' : 'Speak or type what you ate…'}
              readOnly={listening}
              disabled={disabled || parsing}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none leading-snug"
              style={{
                background: '#0a0f1a',
                border: `1px solid ${listening ? micColor + '88' : '#1e293b'}`,
                color: listening ? '#94a3b8' : '#e2e8f0',
                transition: 'border-color 0.2s',
              }}
            />
            {listening && (
              <span
                className="absolute bottom-2 right-3 text-xs animate-pulse"
                style={{ color: micColor }}
              >
                ● listening
              </span>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={() => doParse()}
            disabled={!canSend || disabled}
            className="flex-shrink-0 w-12 h-14 rounded-xl flex items-center justify-center"
            style={{
              background: '#34d399',
              opacity: canSend && !disabled ? 1 : 0.3,
              transition: 'opacity 0.2s',
            }}
          >
            {parsing
              ? <Loader2 size={16} color="#020617" className="animate-spin" />
              : <Send size={16} color="#020617" />
            }
          </button>
        </div>
      </div>

      {/* Parsing state */}
      {parsing && (
        <div className="flex items-center gap-2 text-sm" style={{ color: COLORS.textSecondary }}>
          <Loader2 size={13} className="animate-spin" />
          Understanding what you ate…
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm" style={{ color: COLORS.red }}>{error}</p>
      )}

      {/* Preview cards */}
      {preview && preview.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>
              Review — tap × to remove
            </span>
            <button onClick={cancel} className="text-xs" style={{ color: COLORS.textMuted }}>
              Cancel
            </button>
          </div>

          {preview.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between rounded-xl px-4 py-3"
              style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles size={12} style={{ color: COLORS.green, flexShrink: 0 }} />
                  <span className="text-sm font-medium truncate" style={{ color: COLORS.textPrimary }}>
                    {item.name}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs tabular" style={{ color: COLORS.textSecondary }}>
                  <span>{item.quantity}</span>
                  <span style={{ color: COLORS.amber }}>{item.calories} kcal</span>
                  <span style={{ color: COLORS.green }}>{item.protein}g prot</span>
                  <span style={{ color: COLORS.blue }}>{item.fiber}g fiber</span>
                </div>
                <span
                  className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: MEAL_COLORS[item.meal] + '22', color: MEAL_COLORS[item.meal] }}
                >
                  {item.meal}
                </span>
              </div>
              <button onClick={() => removePreviewItem(idx)} className="ml-2 mt-0.5 flex-shrink-0 p-1">
                <X size={14} style={{ color: COLORS.textMuted }} />
              </button>
            </div>
          ))}

          <button
            onClick={confirmAdd}
            className="w-full py-3 rounded-xl font-semibold text-sm active:scale-98 transition-transform"
            style={{ background: '#34d399', color: '#020617' }}
          >
            Add All ({preview.length} item{preview.length !== 1 ? 's' : ''})
          </button>
        </div>
      )}

      {preview && preview.length === 0 && (
        <p className="text-sm text-center py-2" style={{ color: COLORS.textSecondary }}>
          Nothing parsed — try describing it differently, then tap ➤
        </p>
      )}
    </div>
  );
}
