import { useState, useCallback, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Send, X, Sparkles, ScanBarcode, Camera, Search, ChefHat } from 'lucide-react';
import { useVoice } from '../hooks/useVoice';
import { parseFoods, parsePhoto } from '../lib/claude';
import { lookupBarcode } from '../lib/openFoodFacts';
import { COLORS, MEAL_COLORS } from '../lib/constants';
import { useProfile } from '../context/ProfileContext';
import BarcodeScanner from './BarcodeScanner';
import FoodSearch from './FoodSearch';
import RecipeList from './RecipeList';

export default function VoiceInput({ onAdd, disabled, uid }) {
  const { dietType } = useProfile();

  // Fix #15 — searchKey increment unmounts/remounts FoodSearch on each open,
  // giving it a clean slate (query, results, errors all reset)
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchKey,   setSearchKey]   = useState(0);
  const [recipeOpen,  setRecipeOpen]  = useState(false);

  const [text,         setText]         = useState('');
  const [parsing,      setParsing]      = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [preview,      setPreview]      = useState(null);
  const [error,        setError]        = useState('');
  const [showScanner,  setShowScanner]  = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const photoInputRef = useRef(null);

  // Fix #7 — removed auto-parse timer from voice results.
  // Voice fills the text field; user must tap Send explicitly.
  // This prevents surprise parses when the transcript is wrong.
  const handleVoiceResult = useCallback((transcript) => {
    setText(transcript);
    setError('');
    setPreview(null);
  }, []);

  const { listening, liveTranscript, supported, start, stop } = useVoice(handleVoiceResult);
  const displayText = listening ? liveTranscript : text;

  async function doParse(input) {
    const trimmed = (input || text).trim();
    if (!trimmed) return;
    setParsing(true);
    setError('');
    setPreview(null);
    try {
      const { foods } = await parseFoods(trimmed, dietType);
      setPreview(foods);
    } catch (e) {
      setError(e.message || 'Parse failed. Try again.');
    } finally {
      setParsing(false);
    }
  }

  // Fix #22 — subtle haptic feedback on mic press
  function handleMicToggle() {
    if (navigator.vibrate) navigator.vibrate(40);
    if (listening) {
      stop();
    } else {
      setPreview(null);
      setError('');
      setText('');
      setSearchOpen(false);
      start();
    }
  }

  function toggleSearch() {
    if (searchOpen) {
      setSearchOpen(false);
    } else {
      setSearchKey(k => k + 1);
      setSearchOpen(true);
      setRecipeOpen(false);
      cancel();
    }
  }

  function toggleRecipes() {
    setRecipeOpen(o => !o);
    if (!recipeOpen) { setSearchOpen(false); cancel(); }
  }

  function removePreviewItem(idx) {
    setPreview(prev => prev.filter((_, i) => i !== idx));
  }

  async function confirmAdd() {
    if (!preview?.length) return;
    await onAdd(preview.map(f => ({ ...f, source: f.source || 'voice' })));
    setPreview(null);
    setText('');
  }

  function cancel() {
    setPreview(null);
    setText('');
    setError('');
  }

  async function handleBarcodeResult(barcode) {
    setShowScanner(false);
    setBarcodeLoading(true);
    setError('');
    try {
      const food = await lookupBarcode(barcode);
      if (!food) {
        setError(`Barcode ${barcode} not found in Open Food Facts. Try typing the name.`);
      } else {
        setPreview([food]);
      }
    } catch {
      setError('Barcode lookup failed. Check your connection.');
    } finally {
      setBarcodeLoading(false);
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setPhotoLoading(true);
    setError('');
    setPreview(null);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => { resolve(reader.result.split(',')[1]); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { foods } = await parsePhoto(base64, file.type || 'image/jpeg', dietType);
      setPreview(foods);
    } catch (e) {
      setError(e.message || 'Could not read photo. Please try again.');
    } finally {
      setPhotoLoading(false);
    }
  }

  const micColor   = listening ? COLORS.red : COLORS.green;
  const canSend    = displayText.trim() && !parsing && !listening;
  const anyLoading = parsing || photoLoading || barcodeLoading;

  const iconBtnStyle = (active = false) => ({
    background: active ? COLORS.green + '18' : '#1e293b',
    border:     `1px solid ${active ? COLORS.green + '55' : '#334155'}`,
    transition: 'all 0.15s',
    minHeight:  '2.75rem',
  });

  return (
    <div className="px-4 space-y-3">
      {showScanner && (
        <BarcodeScanner onResult={handleBarcodeResult} onClose={() => setShowScanner(false)} />
      )}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handlePhotoChange}
      />

      {/* Main input row */}
      <div className="flex gap-3 items-start">
        {/* Mic — primary CTA */}
        {supported && (
          <button
            onClick={handleMicToggle}
            disabled={disabled || anyLoading}
            className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            style={{ background: micColor, opacity: disabled ? 0.5 : 1 }}
          >
            {listening ? <MicOff size={22} color="#020617" /> : <Mic size={22} color="#020617" />}
          </button>
        )}

        {/* Text field */}
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <textarea
              rows={2}
              value={displayText}
              onChange={e => {
                if (!listening) setText(e.target.value);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doParse(); }
              }}
              placeholder={listening ? '' : 'Speak or type what you ate…'}
              readOnly={listening}
              disabled={disabled || anyLoading}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none leading-snug"
              style={{
                background:  '#0a0f1a',
                border:      `1px solid ${listening ? COLORS.red + '88' : '#1e293b'}`,
                color:       listening ? COLORS.textSecondary : COLORS.textPrimary,
                transition:  'border-color 0.2s',
              }}
            />
            {listening && (
              <span className="absolute bottom-2 right-3 text-xs animate-pulse" style={{ color: COLORS.red }}>
                ● listening
              </span>
            )}
          </div>

          {/* Action column */}
          <div className="flex flex-col gap-1.5">
            {/* Send — only accent button */}
            <button
              onClick={() => doParse()}
              disabled={!canSend || disabled}
              className="flex-shrink-0 w-12 rounded-xl flex items-center justify-center flex-1"
              style={{ background: COLORS.green, opacity: canSend && !disabled ? 1 : 0.25, transition: 'opacity 0.2s', minHeight: '2.75rem' }}
            >
              {parsing
                ? <Loader2 size={16} color="#020617" className="animate-spin" />
                : <Send    size={16} color="#020617" />
              }
            </button>

            {/* Search toggle */}
            <button
              onClick={toggleSearch}
              disabled={disabled || listening}
              className="flex-shrink-0 w-12 rounded-xl flex items-center justify-center"
              style={{ ...iconBtnStyle(searchOpen), minHeight: '2.75rem' }}
              title="Search food database"
            >
              <Search size={16} style={{ color: searchOpen ? COLORS.green : COLORS.textSecondary }} />
            </button>

            {/* Barcode */}
            <button
              onClick={() => setShowScanner(true)}
              disabled={disabled || anyLoading || listening}
              className="flex-shrink-0 w-12 rounded-xl flex items-center justify-center"
              style={{ ...iconBtnStyle(false), opacity: disabled || barcodeLoading ? 0.35 : 1, minHeight: '2.75rem' }}
              title="Scan barcode"
            >
              {barcodeLoading
                ? <Loader2     size={16} style={{ color: COLORS.textSecondary }} className="animate-spin" />
                : <ScanBarcode size={16} style={{ color: COLORS.textSecondary }} />
              }
            </button>

            {/* Camera */}
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={disabled || anyLoading || listening}
              className="flex-shrink-0 w-12 rounded-xl flex items-center justify-center"
              style={{ ...iconBtnStyle(false), opacity: disabled || photoLoading ? 0.35 : 1, minHeight: '2.75rem' }}
              title="Log from photo"
            >
              {photoLoading
                ? <Loader2 size={16} style={{ color: COLORS.textSecondary }} className="animate-spin" />
                : <Camera  size={16} style={{ color: COLORS.textSecondary }} />
              }
            </button>

            {/* Recipes */}
            <button
              onClick={toggleRecipes}
              disabled={disabled || listening}
              className="flex-shrink-0 w-12 rounded-xl flex items-center justify-center"
              style={{ ...iconBtnStyle(recipeOpen), minHeight: '2.75rem' }}
              title="My recipes"
            >
              <ChefHat size={16} style={{ color: recipeOpen ? COLORS.green : COLORS.textSecondary }} />
            </button>
          </div>
        </div>
      </div>

      {/* Fix #2, #15 — key forces fresh mount each time search opens */}
      {searchOpen && <FoodSearch key={searchKey} onAdd={onAdd} disabled={disabled} />}

      {recipeOpen && (
        <RecipeList uid={uid} onAdd={onAdd} onClose={() => setRecipeOpen(false)} />
      )}

      {parsing && (
        <div className="flex items-center gap-2 text-xs" style={{ color: COLORS.textSecondary }}>
          <Loader2 size={12} className="animate-spin" /> Understanding what you ate…
        </div>
      )}
      {photoLoading && (
        <div className="flex items-center gap-2 text-xs" style={{ color: COLORS.textSecondary }}>
          <Loader2 size={12} className="animate-spin" /> Analysing your photo…
        </div>
      )}

      {error && <p className="text-xs" style={{ color: COLORS.red }}>{error}</p>}

      {preview && preview.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: COLORS.textSecondary }}>Review — tap × to remove</span>
            <button onClick={cancel} className="text-xs" style={{ color: COLORS.textMuted }}>Cancel</button>
          </div>

          {preview.map((item, idx) => (
            <div key={idx} className="flex items-start justify-between rounded-xl px-4 py-3" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles size={11} style={{ color: COLORS.green, flexShrink: 0 }} />
                  <span className="text-sm font-medium truncate" style={{ color: COLORS.textPrimary }}>{item.name}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs tabular" style={{ color: COLORS.textSecondary }}>
                  <span>{item.quantity}</span>
                  <span style={{ color: COLORS.amber }}>{item.calories} kcal</span>
                  <span style={{ color: COLORS.green }}>{item.protein}g P</span>
                  {item.carbs > 0 && <span>{item.carbs}g C</span>}
                  {item.fat   > 0 && <span>{item.fat}g F</span>}
                  {item.fiber > 0 && <span>{item.fiber}g fiber</span>}
                </div>
                {(item.iron > 0 || item.calcium > 0 || item.b12 > 0 || item.zinc > 0) && (
                  <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs tabular" style={{ color: COLORS.textMuted }}>
                    {item.iron    > 0 && <span>Fe {item.iron}mg</span>}
                    {item.calcium > 0 && <span>Ca {item.calcium}mg</span>}
                    {item.b12     > 0 && <span>B12 {item.b12}mcg</span>}
                    {item.zinc    > 0 && <span>Zn {item.zinc}mg</span>}
                  </div>
                )}
                <span
                  className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: MEAL_COLORS[item.meal] + '22', color: MEAL_COLORS[item.meal] }}
                >
                  {item.meal}
                </span>
              </div>
              <button onClick={() => removePreviewItem(idx)} className="ml-2 mt-0.5 flex-shrink-0 p-1.5">
                <X size={14} style={{ color: COLORS.textMuted }} />
              </button>
            </div>
          ))}

          <button
            onClick={confirmAdd}
            className="w-full py-3 rounded-xl font-semibold text-sm active:scale-98 transition-transform"
            style={{ background: COLORS.green, color: '#020617' }}
          >
            Add All ({preview.length} item{preview.length !== 1 ? 's' : ''})
          </button>
        </div>
      )}

      {preview && preview.length === 0 && (
        <p className="text-xs text-center py-2" style={{ color: COLORS.textSecondary }}>
          Nothing parsed — try describing it differently, then tap ➤
        </p>
      )}
    </div>
  );
}
