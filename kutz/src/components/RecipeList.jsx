import { useState, useEffect } from 'react';
import { Plus, ChefHat, Pencil, Trash2, Loader2, X } from 'lucide-react';
import { onRecipesSnapshot, deleteRecipe } from '../lib/firestore';
import { COLORS, MEALS } from '../lib/constants';
import RecipeBuilder from './RecipeBuilder';

function inferMeal() {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snacks';
  return 'dinner';
}

export default function RecipeList({ uid, onAdd, onClose }) {
  const [recipes,      setRecipes]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [builderMode,  setBuilderMode]  = useState(null); // null | 'new' | recipe object (edit)
  const [confirmId,    setConfirmId]    = useState(null);
  const [addedId,      setAddedId]      = useState(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = onRecipesSnapshot(uid, data => {
      setRecipes(data);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  function handleAdd(recipe) {
    const meal = inferMeal();
    const m    = recipe.macrosPerServing || {};
    onAdd([{
      name:     recipe.name,
      quantity: `1 serving (recipe: ${recipe.name})`,
      calories: m.calories || 0,
      protein:  m.protein  || 0,
      carbs:    m.carbs    || 0,
      fat:      m.fat      || 0,
      fiber:    m.fiber    || 0,
      iron:     m.iron     || 0,
      calcium:  m.calcium  || 0,
      b12:      m.b12      || 0,
      zinc:     m.zinc     || 0,
      meal,
      source: 'recipe',
    }]);
    setAddedId(recipe.id);
    setTimeout(() => setAddedId(null), 2000);
  }

  async function handleDelete(id) {
    if (confirmId !== id) {
      setConfirmId(id);
      setTimeout(() => setConfirmId(null), 2500);
      return;
    }
    setConfirmId(null);
    await deleteRecipe(uid, id);
  }

  if (builderMode !== null) {
    return (
      <RecipeBuilder
        uid={uid}
        recipe={builderMode === 'new' ? null : builderMode}
        onSave={() => setBuilderMode(null)}
        onCancel={() => setBuilderMode(null)}
      />
    );
  }

  return (
    <div className="rounded-2xl" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1e293b' }}>
        <div className="flex items-center gap-2">
          <ChefHat size={15} style={{ color: COLORS.green }} />
          <span className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>My Recipes</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBuilderMode('new')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: COLORS.green + '18', border: `1px solid ${COLORS.green}44`, color: COLORS.green }}
          >
            <Plus size={12} /> New
          </button>
          <button onClick={onClose} className="p-1">
            <X size={15} style={{ color: COLORS.textMuted }} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 size={18} className="animate-spin" style={{ color: COLORS.textMuted }} />
          </div>
        )}

        {!loading && recipes.length === 0 && (
          <div className="py-8 text-center space-y-2">
            <ChefHat size={32} className="mx-auto" style={{ color: COLORS.textMuted }} />
            <p className="text-sm" style={{ color: COLORS.textSecondary }}>No recipes yet</p>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              Save your home-cooked meals once,<br />log them in one tap forever.
            </p>
            <button
              onClick={() => setBuilderMode('new')}
              className="mt-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: COLORS.green, color: '#020617' }}
            >
              Create first recipe
            </button>
          </div>
        )}

        {!loading && recipes.map(recipe => {
          const m       = recipe.macrosPerServing || {};
          const isAdded = addedId === recipe.id;
          const isConfirm = confirmId === recipe.id;

          return (
            <div
              key={recipe.id}
              className="flex items-center gap-3 px-3 py-3 rounded-xl"
              style={{ background: '#020617', border: '1px solid #1e293b' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: COLORS.textPrimary }}>
                  {recipe.name}
                </p>
                <div className="flex flex-wrap gap-x-3 text-xs tabular mt-0.5">
                  <span style={{ color: COLORS.amber }}>{m.calories || 0} kcal</span>
                  <span style={{ color: COLORS.green }}>{m.protein  || 0}g P</span>
                  {(m.carbs || 0) > 0 && <span style={{ color: COLORS.textMuted }}>{m.carbs}g C</span>}
                  {(m.fat   || 0) > 0 && <span style={{ color: COLORS.textMuted }}>{m.fat}g F</span>}
                  <span style={{ color: COLORS.textMuted }}>· {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Edit */}
                <button
                  onClick={() => setBuilderMode(recipe)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: '#1e293b' }}
                >
                  <Pencil size={13} style={{ color: COLORS.textSecondary }} />
                </button>

                {/* Delete — double-tap confirm */}
                <button
                  onClick={() => handleDelete(recipe.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: isConfirm ? COLORS.red + '22' : '#1e293b', border: isConfirm ? `1px solid ${COLORS.red}55` : 'none' }}
                  title={isConfirm ? 'Tap again to delete' : 'Delete'}
                >
                  <Trash2 size={13} style={{ color: isConfirm ? COLORS.red : COLORS.textMuted }} />
                </button>

                {/* Log */}
                <button
                  onClick={() => handleAdd(recipe)}
                  className="px-3 h-8 rounded-lg text-xs font-semibold"
                  style={{
                    background: isAdded ? COLORS.green + '22' : COLORS.green,
                    color:      isAdded ? COLORS.green : '#020617',
                    border:     isAdded ? `1px solid ${COLORS.green}55` : 'none',
                    minWidth:   '48px',
                    transition: 'all 0.2s',
                  }}
                >
                  {isAdded ? '✓' : 'Log'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
