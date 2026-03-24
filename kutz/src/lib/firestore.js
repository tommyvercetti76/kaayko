/**
 * KaleKutz Firestore operations
 *
 * Collections (all under users/{uid}/)
 *   kutzProfile/data            -- BMR, targets, gender, activity, autoEntries
 *   kutzDays/{YYYY-MM-DD}       -- daily log metadata + denormalized totals
 *   kutzDays/{date}/foods/      -- individual food entries
 *   kutzFrequentFoods/{key}     -- quick-add bar data
 *   kutzProductDB/{key}         -- branded product overrides (label-accurate macros)
 *   kutzWeightLog/{YYYY-MM-DD}  -- daily weight entries
 */

import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { calcBMR } from './calculations';
import { DEFAULT_AUTO_ENTRIES } from './constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function totalsIncrement(food, sign = 1) {
  return {
    'totals.calories': increment(sign * (Number(food.calories) || 0)),
    'totals.protein':  increment(sign * (Number(food.protein)  || 0)),
    'totals.carbs':    increment(sign * (Number(food.carbs)    || 0)),
    'totals.fat':      increment(sign * (Number(food.fat)      || 0)),
    'totals.fiber':    increment(sign * (Number(food.fiber)    || 0)),
    updatedAt: serverTimestamp(),
  };
}

function sumFoods(foods) {
  return foods.reduce(
    (acc, f) => ({
      calories: acc.calories + (Number(f.calories) || 0),
      protein:  acc.protein  + (Number(f.protein)  || 0),
      carbs:    acc.carbs    + (Number(f.carbs)     || 0),
      fat:      acc.fat      + (Number(f.fat)       || 0),
      fiber:    acc.fiber    + (Number(f.fiber)     || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(uid) {
  const ref  = doc(db, 'users', uid, 'kutzProfile', 'data');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveProfile(uid, data) {
  const ref  = doc(db, 'users', uid, 'kutzProfile', 'data');
  const bmr  = calcBMR(data.weight, data.height, data.age, data.gender || 'female');
  const snap = await getDoc(ref);
  // profileStartDate is set once on first save — never overwritten — acts as data-start boundary
  const profileStartDate = snap.exists()
    ? (snap.data().profileStartDate || todayKey())
    : todayKey();
  await setDoc(ref, { ...data, bmr, profileStartDate, updatedAt: serverTimestamp() }, { merge: true });
  return bmr;
}

// ─── Days ─────────────────────────────────────────────────────────────────────

/** Local-timezone today key — matches the user's calendar date, not UTC */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getOrCreateDay(uid, dateKey) {
  const dayRef = doc(db, 'users', uid, 'kutzDays', dateKey);
  const snap   = await getDoc(dayRef);
  if (snap.exists()) return { id: snap.id, ...snap.data() };

  // Guard: only today's document can be auto-created. Past/future dates
  // must already exist (via copy or manual entry) to prevent phantom data.
  if (dateKey !== todayKey()) return null;

  const profile    = await getProfile(uid);
  const bmr        = profile?.bmr || 1450;
  const autoEntries = profile?.autoEntries ?? DEFAULT_AUTO_ENTRIES;

  const batch = writeBatch(db);

  const initTotals = sumFoods(autoEntries);
  const newDay = {
    date:           dateKey,
    locked:         false,
    steps:          0,
    fitbitCalories: null,
    bmr,
    totals:         initTotals,
    createdAt:      serverTimestamp(),
    updatedAt:      serverTimestamp(),
  };
  batch.set(dayRef, newDay);

  const foodsRef = collection(dayRef, 'foods');
  autoEntries.forEach(entry => {
    batch.set(doc(foodsRef), {
      ...entry,
      source:    'manual',
      auto:      true,
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
  return { id: dateKey, ...newDay };
}

export async function updateDay(uid, dateKey, data) {
  const ref = doc(db, 'users', uid, 'kutzDays', dateKey);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

// ─── Foods ────────────────────────────────────────────────────────────────────

export async function addFood(uid, dateKey, food) {
  const dayRef   = doc(db, 'users', uid, 'kutzDays', dateKey);
  const foodsRef = collection(dayRef, 'foods');
  const batch    = writeBatch(db);
  batch.set(doc(foodsRef), { ...food, createdAt: serverTimestamp() });
  batch.update(dayRef, totalsIncrement(food, +1));
  await batch.commit();

  if (['voice', 'quick', 'manual', 'barcode'].includes(food.source)) {
    trackFrequentFood(uid, food).catch(() => {});
  }
}

export async function addFoods(uid, dateKey, foods) {
  const dayRef   = doc(db, 'users', uid, 'kutzDays', dateKey);
  const foodsRef = collection(dayRef, 'foods');
  const sum      = sumFoods(foods);

  const batch = writeBatch(db);
  foods.forEach(food => batch.set(doc(foodsRef), { ...food, createdAt: serverTimestamp() }));
  batch.update(dayRef, {
    'totals.calories': increment(sum.calories),
    'totals.protein':  increment(sum.protein),
    'totals.carbs':    increment(sum.carbs),
    'totals.fat':      increment(sum.fat),
    'totals.fiber':    increment(sum.fiber),
    updatedAt:         serverTimestamp(),
  });
  await batch.commit();

  foods.forEach(f => trackFrequentFood(uid, f).catch(() => {}));
}

export async function deleteFood(uid, dateKey, foodId) {
  const dayRef  = doc(db, 'users', uid, 'kutzDays', dateKey);
  const foodRef = doc(db, 'users', uid, 'kutzDays', dateKey, 'foods', foodId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(foodRef);
    if (!snap.exists()) return;
    tx.delete(foodRef);
    tx.update(dayRef, totalsIncrement(snap.data(), -1));
  });
}

export async function updateFood(uid, dateKey, foodId, updates) {
  const dayRef  = doc(db, 'users', uid, 'kutzDays', dateKey);
  const foodRef = doc(db, 'users', uid, 'kutzDays', dateKey, 'foods', foodId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(foodRef);
    if (!snap.exists()) return;
    const old  = snap.data();
    const diff = {
      calories: (Number(updates.calories) || 0) - (Number(old.calories) || 0),
      protein:  (Number(updates.protein)  || 0) - (Number(old.protein)  || 0),
      carbs:    (Number(updates.carbs)    || 0) - (Number(old.carbs)    || 0),
      fat:      (Number(updates.fat)      || 0) - (Number(old.fat)      || 0),
      fiber:    (Number(updates.fiber)    || 0) - (Number(old.fiber)    || 0),
    };
    tx.update(foodRef, { ...updates, updatedAt: serverTimestamp() });
    tx.update(dayRef, {
      'totals.calories': increment(diff.calories),
      'totals.protein':  increment(diff.protein),
      'totals.carbs':    increment(diff.carbs),
      'totals.fat':      increment(diff.fat),
      'totals.fiber':    increment(diff.fiber),
      updatedAt:         serverTimestamp(),
    });
  });
}

export async function copyMeal(uid, fromDateKey, toDateKey, meal) {
  const foodsRef = collection(db, 'users', uid, 'kutzDays', fromDateKey, 'foods');
  const snap     = await getDocs(foodsRef);
  const foods    = snap.docs
    .map(d => ({ ...d.data(), id: d.id }))
    .filter(f => f.meal === meal && !f.auto);
  if (foods.length === 0) return 0;

  const dayRef    = doc(db, 'users', uid, 'kutzDays', toDateKey);
  const targetRef = collection(db, 'users', uid, 'kutzDays', toDateKey, 'foods');
  const sum       = sumFoods(foods);

  const batch = writeBatch(db);
  foods.forEach(({ id: _id, createdAt: _c, ...food }) => {
    batch.set(doc(targetRef), { ...food, source: 'manual', createdAt: serverTimestamp() });
  });
  batch.update(dayRef, {
    'totals.calories': increment(sum.calories),
    'totals.protein':  increment(sum.protein),
    'totals.carbs':    increment(sum.carbs),
    'totals.fat':      increment(sum.fat),
    'totals.fiber':    increment(sum.fiber),
    updatedAt:         serverTimestamp(),
  });
  await batch.commit();
  return foods.length;
}

/** Copy ALL meals from one day to another */
export async function copyDay(uid, fromDateKey, toDateKey) {
  const foodsRef = collection(db, 'users', uid, 'kutzDays', fromDateKey, 'foods');
  const snap     = await getDocs(foodsRef);
  const foods    = snap.docs
    .map(d => ({ ...d.data(), id: d.id }))
    .filter(f => !f.auto);
  if (foods.length === 0) return 0;

  const dayRef    = doc(db, 'users', uid, 'kutzDays', toDateKey);
  const targetRef = collection(db, 'users', uid, 'kutzDays', toDateKey, 'foods');
  const sum       = sumFoods(foods);

  const batch = writeBatch(db);
  foods.forEach(({ id: _id, createdAt: _c, ...food }) => {
    batch.set(doc(targetRef), { ...food, source: 'manual', createdAt: serverTimestamp() });
  });
  batch.update(dayRef, {
    'totals.calories': increment(sum.calories),
    'totals.protein':  increment(sum.protein),
    'totals.carbs':    increment(sum.carbs),
    'totals.fat':      increment(sum.fat),
    'totals.fiber':    increment(sum.fiber),
    updatedAt:         serverTimestamp(),
  });
  await batch.commit();
  return foods.length;
}

// ─── Real-time listeners ──────────────────────────────────────────────────────

export function onDaySnapshot(uid, dateKey, callback, onError) {
  const ref = doc(db, 'users', uid, 'kutzDays', dateKey);
  return onSnapshot(
    ref,
    snap => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    err => { console.error('[onDaySnapshot]', err.message); onError?.(err); }
  );
}

export function onFoodsSnapshot(uid, dateKey, callback, onError) {
  const ref = collection(db, 'users', uid, 'kutzDays', dateKey, 'foods');
  return onSnapshot(
    ref,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('[onFoodsSnapshot]', err.message); onError?.(err); }
  );
}

export function onFrequentFoodsSnapshot(uid, callback) {
  const ref = query(
    collection(db, 'users', uid, 'kutzFrequentFoods'),
    orderBy('useCount', 'desc'),
    limit(6)
  );
  return onSnapshot(ref, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

// ─── Charts data ──────────────────────────────────────────────────────────────

/** A day counts as "real" if it has manual food entries beyond auto-entries */
function isRealDay(day) {
  // If they locked it, they intentionally used it
  if (day.locked) return true;
  // If water was logged, they interacted
  if ((day.water || 0) > 0) return true;
  // If totals exceed auto-entry baseline (fish oil = 70 kcal), real food was added
  const cal = day.totals?.calories || 0;
  if (cal > 100) return true;
  // If steps or fitbit data were synced, it's a real day
  if ((day.steps || 0) > 0 || day.fitbitCalories) return true;
  return false;
}

export async function getRecentDays(uid, count = 30) {
  const ref  = query(
    collection(db, 'users', uid, 'kutzDays'),
    orderBy('date', 'desc'),
    limit(count)
  );
  const snap = await getDocs(ref);
  const days = [];

  for (const dayDoc of snap.docs) {
    const day = dayDoc.data();
    if (day.totals) {
      days.push({
        id:       dayDoc.id,
        ...day,
        calories: Math.round(day.totals.calories || 0),
        protein:  Math.round(day.totals.protein  || 0),
        carbs:    Math.round(day.totals.carbs     || 0),
        fat:      Math.round(day.totals.fat       || 0),
        fiber:    Math.round(day.totals.fiber     || 0),
      });
    } else {
      // Legacy fallback: aggregate from foods subcollection
      const foodsSnap = await getDocs(collection(dayDoc.ref, 'foods'));
      const foods     = foodsSnap.docs.map(d => d.data());
      const totals    = foods.reduce(
        (acc, f) => ({
          calories: acc.calories + (Number(f.calories) || 0),
          protein:  acc.protein  + (Number(f.protein)  || 0),
          carbs:    acc.carbs    + (Number(f.carbs)     || 0),
          fat:      acc.fat      + (Number(f.fat)       || 0),
          fiber:    acc.fiber    + (Number(f.fiber)     || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      );
      days.push({ id: dayDoc.id, ...day, ...totals });
    }
  }
  const today = todayKey();
  // Never show future-date docs (can appear due to timezone edge cases or dev testing)
  // Then filter phantom days (auto-created but never used)
  return days.filter(d => d.date <= today).filter(isRealDay);
}

export async function getStreakDays(uid, count = 28) {
  const ref  = query(
    collection(db, 'users', uid, 'kutzDays'),
    orderBy('date', 'desc'),
    limit(count)
  );
  const snap = await getDocs(ref);
  // Return date + whether it has non-auto foods (for streak quality check)
  return snap.docs.map(d => ({
    date:          d.data().date,
    hasManualFood: (d.data().totals?.calories || 0) > (d.data().totals?.autoCalories || 70),
  }));
}

// ─── Frequent foods ───────────────────────────────────────────────────────────

async function trackFrequentFood(uid, food) {
  if (!food.name) return;
  const key = food.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 50);
  const ref  = doc(db, 'users', uid, 'kutzFrequentFoods', key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { useCount: increment(1) });
  } else {
    await setDoc(ref, {
      name:            food.name,
      calories:        food.calories        || 0,
      protein:         food.protein         || 0,
      carbs:           food.carbs           || 0,
      fat:             food.fat             || 0,
      fiber:           food.fiber           || 0,
      // Micronutrients — persist when available (0 when absent)
      iron:            food.iron            || 0,
      calcium:         food.calcium         || 0,
      b12:             food.b12             || 0,
      zinc:            food.zinc            || 0,
      defaultQuantity: food.quantity        || '1 serving',
      useCount:        1,
    });
  }
}

// ─── Water log ────────────────────────────────────────────────────────────────

/**
 * Increment (or decrement) water intake for a day.
 * @param {string} uid
 * @param {string} dateKey  YYYY-MM-DD
 * @param {number} ml       positive to add, negative to subtract (clamped on display)
 */
export async function logWater(uid, dateKey, ml) {
  const ref = doc(db, 'users', uid, 'kutzDays', dateKey);
  await updateDoc(ref, { water: increment(ml), updatedAt: serverTimestamp() });
}

// ─── Weight log ───────────────────────────────────────────────────────────────

export async function logWeight(uid, weight) {
  const dateKey = new Date().toISOString().split('T')[0];
  const ref     = doc(db, 'users', uid, 'kutzWeightLog', dateKey);
  await setDoc(ref, { date: dateKey, weight: Number(weight), createdAt: serverTimestamp() }, { merge: true });
}

export async function getWeightHistory(uid, count = 60) {
  const ref  = query(
    collection(db, 'users', uid, 'kutzWeightLog'),
    orderBy('date', 'desc'),
    limit(count)
  );
  const snap = await getDocs(ref);
  return snap.docs.map(d => d.data()).reverse(); // oldest first for chart
}

// ─── Product DB ───────────────────────────────────────────────────────────────

export function onProductsSnapshot(uid, callback) {
  const ref = query(
    collection(db, 'users', uid, 'kutzProductDB'),
    orderBy('name', 'asc')
  );
  return onSnapshot(ref, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function saveProduct(uid, product) {
  const key = product.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 60);
  const ref = doc(db, 'users', uid, 'kutzProductDB', key);
  await setDoc(ref, { ...product, updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteProduct(uid, productId) {
  const ref = doc(db, 'users', uid, 'kutzProductDB', productId);
  await deleteDoc(ref);
}

// ─── Exercises ────────────────────────────────────────────────────────────────

// cal/min estimates per exercise type
const EXERCISE_BURN = {
  walk:     4,
  run:      10,
  yoga:     3,
  gym:      6,
  cycling:  9,
  swimming: 11,
  hiit:     12,
  dance:    7,
  other:    5,
};

export function estimateBurn(type, durationMin) {
  const rate = EXERCISE_BURN[type] || 5;
  return Math.round(rate * durationMin);
}

export async function addExercise(uid, dateKey, exercise) {
  const ref = collection(db, 'users', uid, 'kutzDays', dateKey, 'exercises');
  await addDoc(ref, {
    type:          exercise.type     || 'other',
    durationMin:   exercise.durationMin || 30,
    caloriesBurned: exercise.caloriesBurned
                   ?? estimateBurn(exercise.type, exercise.durationMin),
    notes:         exercise.notes    || '',
    createdAt:     serverTimestamp(),
  });
}

export async function deleteExercise(uid, dateKey, exerciseId) {
  const ref = doc(db, 'users', uid, 'kutzDays', dateKey, 'exercises', exerciseId);
  await deleteDoc(ref);
}

export function onExercisesSnapshot(uid, dateKey, callback) {
  const ref = query(
    collection(db, 'users', uid, 'kutzDays', dateKey, 'exercises'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(ref, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

// ─── Recipes ──────────────────────────────────────────────────────────────────
//
// Collection: users/{uid}/kutzRecipes/{recipeId}
// Each doc: { name, servings, ingredients[], macrosPerServing{}, createdAt, updatedAt }

function calcMacrosPerServing(ingredients, servings) {
  const s = Math.max(1, servings);
  const sum = ingredients.reduce(
    (acc, f) => ({
      calories: acc.calories + (Number(f.calories) || 0),
      protein:  acc.protein  + (Number(f.protein)  || 0),
      carbs:    acc.carbs    + (Number(f.carbs)     || 0),
      fat:      acc.fat      + (Number(f.fat)       || 0),
      fiber:    acc.fiber    + (Number(f.fiber)     || 0),
      iron:     acc.iron     + (Number(f.iron)      || 0),
      calcium:  acc.calcium  + (Number(f.calcium)   || 0),
      b12:      acc.b12      + (Number(f.b12)       || 0),
      zinc:     acc.zinc     + (Number(f.zinc)      || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, iron: 0, calcium: 0, b12: 0, zinc: 0 }
  );
  return {
    calories: Math.round(sum.calories / s),
    protein:  Math.round(sum.protein  / s * 10) / 10,
    carbs:    Math.round(sum.carbs    / s * 10) / 10,
    fat:      Math.round(sum.fat      / s * 10) / 10,
    fiber:    Math.round(sum.fiber    / s * 10) / 10,
    iron:     Math.round(sum.iron     / s * 10) / 10,
    calcium:  Math.round(sum.calcium  / s * 10) / 10,
    b12:      Math.round(sum.b12      / s * 10) / 10,
    zinc:     Math.round(sum.zinc     / s * 10) / 10,
  };
}

export async function addRecipe(uid, { name, servings, ingredients }) {
  const ref              = collection(db, 'users', uid, 'kutzRecipes');
  const macrosPerServing = calcMacrosPerServing(ingredients, servings);
  await addDoc(ref, {
    name,
    servings: Math.max(1, servings),
    ingredients,
    macrosPerServing,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateRecipe(uid, recipeId, { name, servings, ingredients }) {
  const ref              = doc(db, 'users', uid, 'kutzRecipes', recipeId);
  const macrosPerServing = calcMacrosPerServing(ingredients, servings);
  await updateDoc(ref, {
    name,
    servings: Math.max(1, servings),
    ingredients,
    macrosPerServing,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRecipe(uid, recipeId) {
  const ref = doc(db, 'users', uid, 'kutzRecipes', recipeId);
  await deleteDoc(ref);
}

export function onRecipesSnapshot(uid, callback) {
  const ref = query(
    collection(db, 'users', uid, 'kutzRecipes'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(ref, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}
