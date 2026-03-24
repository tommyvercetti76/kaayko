import { useState, useRef } from 'react';
import { Plus, Trash2, Loader2, ChevronUp, ChevronDown, X, Check } from 'lucide-react';
import { parseFoods } from '../lib/claude';
import { addRecipe, updateRecipe } from '../lib/firestore';
import { COLORS } from '../lib/constants';
import { useProfile } from '../context/ProfileContext';

/** Sum ingredients and divide by servings to get per-serving macros */
function macrosPerServing(ingredients, servings) {
  const s = Math.max(1, servings);
  const sum = ingredients.reduce(
    (acc, f) => ({
      calories: acc.calories + (Number(f.calories) || 0),
      protein:  acc.protein  + (Number(f.protein)  || 0),
      carbs:    acc.carbs    + (Number(f.carbs)     || 0),
      fat:      acc.fat      + (Number(f.fat)       || 0),
      fiber:    acc.fiber    + (Number(f.fiber)     || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
  return {
    calories: Math.round(sum.calories / s),
    protein:  Math.round(sum.protein  / s * 10) / 10,
    carbs:    Math.round(sum.carbs    / s * 10) / 10,
    fat:      Math.round(sum.fat      / s * 10) / 10,
    fiber:    Math.round(sum.fiber    / s * 10) / 10,
  };
}

export default function RecipeBuilder({ uid, recipe = null, onSave, onCancel }) {
  const { dietType } = useProfile();
  const isEdit = !!recipe;

  const [name,        setName]        = useState(recipe?.name        || '');
  const [servings,    setServings]    = useState(recipe?.servings     || 1);
  const [ingredients, setIngredients] = useState(recipe?.ingredients || []);
  const [ingInput,    setIngInput]    = useState('');
  const [parsing,     setParsing]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [ingError,    setIngError]    = useState('');
  const [nameError,   setNameError]   = useState(false);
  const ingRef = useRef(null);

  const perServing = macrosPerServing(ingredients, servings);

  async function addIngredients() {
    const text = ingInput.trim();
    if (!text) return;
    setParsing(true);
    setIngError('');
    try {
      const { foods } = await parseFoods(text, dietType);
      if (!foods?.length) {
        setIngError('Could not parse — be more specific (e.g. "200g paneer")');
        return;
      }
      // Strip meal/source — irrelevant for recipe ingredients
      const cleaned = foods.map(({ meal: _m, source: _s, ...f }) => f);
      setIngredients(prev => [...prev, ...cleaned]);
      setIngInput('');
      ingRef.current?.focus();
    } catch (e) {
      setIngError(e.message || 'Parse failed');
    } finally {
      setParsing(false);
    }
  }

  function removeIngredient(idx) {
    setIngredients(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!name.trim()) { setNameError(true); return; }
    if (!ingredients.length) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updateRecipe(uid, recipe.id, { name: name.trim(), servings, ingredients });
      } else {
        await addRecipe(uid, { name: name.trim(), servings, ingredients });
      }
      onSave?.();
    } catch (e) {
      console.error('[RecipeBuilder] save error:', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl p-4 space-y-4" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
          {isEdit ? 'Edit Recipe' : 'New Recipe'}
        </p>
        <button onClick={onCancel} className="p-1">
          <X size={16} style={{ color: COLORS.textMuted }} />
        </button>
      </div>

      {/* Recipe name */}
      <div>
        <input
          value={name}
          onChange={e => { setName(e.target.value); setNameError(false); }}
          placeholder="Recipe name (e.g. Dal Makhani)"
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{
            background: '#020617',
            border: `1px solid ${nameError ? COLORS.red : '#1e293b'}`,
            color: COLORS.textPrimary,
          }}
        />
        {nameError && <p className="text-xs mt-1" style={{ color: COLORS.red }}>Name is required</p>}
      </div>

      {/* Servings */}
      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: COLORS.textMuted }}>Servings (portions this recipe makes)</span>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setServings(s => Math.max(1, s - 1))}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: '#1e293b' }}
          >
            <ChevronDown size={14} style={{ color: COLORS.textSecondary }} />
          </button>
          <span className="tabular text-sm font-semibold w-6 text-center" style={{ color: COLORS.textPrimary }}>{servings}</span>
          <button
            onClick={() => setServings(s => Math.min(20, s + 1))}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: '#1e293b' }}
          >
            <ChevronUp size={14} style={{ color: COLORS.textSecondary }} />
          </button>
        </div>
      </div>

      {/* Ingredient entry */}
      <div className="space-y-2">
        <p className="text-xs font-medium" style={{ color: COLORS.textSecondary }}>Ingredients</p>
        <div className="flex gap-2">
          <input
            ref={ingRef}
            value={ingInput}
            onChange={e => setIngInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIngredients(); } }}
            placeholder='e.g. "200g paneer, 2 tbsp ghee, 1 cup cream"'
            className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#020617', border: '1px solid #1e293b', color: COLORS.textPrimary }}
            disabled={parsing}
          />
          <button
            onClick={addIngredients}
            disabled={!ingInput.trim() || parsing}
            className="px-3 rounded-xl flex items-center gap-1.5 text-sm font-medium"
            style={{
              background: COLORS.green,
              color: '#020617',
              opacity: !ingInput.trim() || parsing ? 0.4 : 1,
            }}
          >
            {parsing
              ? <Loader2 size={14} className="animate-spin" />
              : <Plus size={14} />
            }
          </button>
        </div>
        {ingError && <p className="text-xs" style={{ color: COLORS.red }}>{ingError}</p>}
        <p className="text-xs" style={{ color: COLORS.textMuted }}>
          Type all ingredients at once — Claude parses them together
        </p>
      </div>

      {/* Ingredient list */}
      {ingredients.length > 0 && (
        <div className="space-y-1.5">
          {ingredients.map((ing, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: '#020617', border: '1px solid #1e293b' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: COLORS.textPrimary }}>{ing.name}</p>
                <p className="text-xs tabular" style={{ color: COLORS.textMuted }}>
                  {ing.quantity} · <span style={{ color: COLORS.amber }}>{ing.calories} kcal</span>
                  {' '}· <span style={{ color: COLORS.green }}>{ing.protein}g P</span>
                  {ing.carbs > 0 && ` · ${ing.carbs}g C`}
                  {ing.fat   > 0 && ` · ${ing.fat}g F`}
                </p>
              </div>
              <button onClick={() => removeIngredient(idx)} className="ml-2 p-1 flex-shrink-0">
                <Trash2 size={13} style={{ color: COLORS.textMuted }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Per-serving summary */}
      {ingredients.length > 0 && (
        <div
          className="px-3 py-2.5 rounded-xl"
          style={{ background: '#020617', border: `1px solid ${COLORS.green}33` }}
        >
          <p className="text-xs mb-1" style={{ color: COLORS.textMuted }}>Per serving ({servings} serving{servings !== 1 ? 's' : ''} total)</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs tabular">
            <span style={{ color: COLORS.amber }}>{perServing.calories} kcal</span>
            <span style={{ color: COLORS.green }}>{perServing.protein}g protein</span>
            <span style={{ color: COLORS.textSecondary }}>{perServing.carbs}g carbs</span>
            <span style={{ color: COLORS.textSecondary }}>{perServing.fat}g fat</span>
            {perServing.fiber > 0 && <span style={{ color: COLORS.textSecondary }}>{perServing.fiber}g fiber</span>}
          </div>
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || !name.trim() || !ingredients.length}
        className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
        style={{
          background: COLORS.green,
          color: '#020617',
          opacity: saving || !name.trim() || !ingredients.length ? 0.4 : 1,
        }}
      >
        {saving
          ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
          : <><Check size={15} /> {isEdit ? 'Save Changes' : 'Save Recipe'}</>
        }
      </button>
    </div>
  );
}
