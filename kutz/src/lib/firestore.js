/**
 * KaleKutz Firestore operations
 *
 * Collections (all under users/{uid}/):
 *   kutzProfile/          — BMR, targets
 *   kutzDays/{YYYY-MM-DD} — daily log metadata
 *   kutzDays/{date}/foods/{foodId} — individual food entries
 *   kutzFrequentFoods/{foodId} — quick-add bar data
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
} from 'firebase/firestore';
import { db } from './firebase';
import { calcBMR } from './calculations';

// ─── Profile ────────────────────────────────────────────────────────────────

export async function getProfile(uid) {
  const ref = doc(db, 'users', uid, 'kutzProfile', 'data');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveProfile(uid, data) {
  const ref = doc(db, 'users', uid, 'kutzProfile', 'data');
  const bmr = calcBMR(data.weight, data.height, data.age);
  await setDoc(ref, { ...data, bmr, updatedAt: serverTimestamp() }, { merge: true });
  return bmr;
}

// ─── Days ────────────────────────────────────────────────────────────────────

/**
 * Load a day document. Creates it with fish oil entry if it doesn't exist.
 */
export async function getOrCreateDay(uid, dateKey) {
  const dayRef = doc(db, 'users', uid, 'kutzDays', dateKey);
  const snap = await getDoc(dayRef);

  if (snap.exists()) return { id: snap.id, ...snap.data() };

  const profile = await getProfile(uid);
  const bmr = profile?.bmr || 1450;

  const batch = writeBatch(db);

  const newDay = {
    date: dateKey,
    locked: false,
    steps: 0,
    fitbitCalories: null,
    bmr,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  batch.set(dayRef, newDay);

  // Auto-add fish oil entry
  const fishOilRef = doc(collection(dayRef, 'foods'));
  batch.set(fishOilRef, {
    name: 'Fish Oil (4 caps)',
    calories: 70,
    protein: 0,
    fiber: 0,
    quantity: '4 capsules',
    meal: 'snacks',
    source: 'manual',
    auto: true,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return { id: dateKey, ...newDay };
}

export async function updateDay(uid, dateKey, data) {
  const ref = doc(db, 'users', uid, 'kutzDays', dateKey);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

// ─── Foods ───────────────────────────────────────────────────────────────────

export async function addFood(uid, dateKey, food) {
  const foodsRef = collection(db, 'users', uid, 'kutzDays', dateKey, 'foods');
  await addDoc(foodsRef, { ...food, createdAt: serverTimestamp() });
  // Track frequency for quick bar
  if (food.source === 'voice' || food.source === 'quick' || food.source === 'manual') {
    trackFrequentFood(uid, food).catch(() => {});
  }
}

export async function addFoods(uid, dateKey, foods) {
  const batch = writeBatch(db);
  const foodsRef = collection(db, 'users', uid, 'kutzDays', dateKey, 'foods');
  foods.forEach(food => {
    const ref = doc(foodsRef);
    batch.set(ref, { ...food, createdAt: serverTimestamp() });
  });
  await batch.commit();
  // Track frequencies
  foods.forEach(f => trackFrequentFood(uid, f).catch(() => {}));
}

export async function deleteFood(uid, dateKey, foodId) {
  const ref = doc(db, 'users', uid, 'kutzDays', dateKey, 'foods', foodId);
  await deleteDoc(ref);
}

/**
 * Copy all foods from a source day into the target day for a given meal.
 */
export async function copyMeal(uid, fromDateKey, toDateKey, meal) {
  const foodsRef = collection(db, 'users', uid, 'kutzDays', fromDateKey, 'foods');
  const snap = await getDocs(foodsRef);
  const foods = snap.docs
    .map(d => ({ ...d.data(), id: d.id }))
    .filter(f => f.meal === meal && !f.auto);

  if (foods.length === 0) return 0;

  const batch = writeBatch(db);
  const targetRef = collection(db, 'users', uid, 'kutzDays', toDateKey, 'foods');
  foods.forEach(({ id: _id, createdAt: _c, ...food }) => {
    batch.set(doc(targetRef), { ...food, source: 'manual', createdAt: serverTimestamp() });
  });
  await batch.commit();
  return foods.length;
}

// ─── Real-time listeners ─────────────────────────────────────────────────────

export function onDaySnapshot(uid, dateKey, callback) {
  const ref = doc(db, 'users', uid, 'kutzDays', dateKey);
  return onSnapshot(ref, snap => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export function onFoodsSnapshot(uid, dateKey, callback) {
  const ref = collection(db, 'users', uid, 'kutzDays', dateKey, 'foods');
  return onSnapshot(ref, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export function onFrequentFoodsSnapshot(uid, callback) {
  const ref = query(
    collection(db, 'users', uid, 'kutzFrequentFoods'),
    orderBy('useCount', 'desc'),
    limit(6)
  );
  return onSnapshot(ref, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ─── Charts data ─────────────────────────────────────────────────────────────

export async function getRecentDays(uid, count = 30) {
  const ref = query(
    collection(db, 'users', uid, 'kutzDays'),
    orderBy('date', 'desc'),
    limit(count)
  );
  const snap = await getDocs(ref);
  const days = [];

  for (const dayDoc of snap.docs) {
    const foodsSnap = await getDocs(collection(dayDoc.ref, 'foods'));
    const foods = foodsSnap.docs.map(d => d.data());
    const totals = foods.reduce(
      (acc, f) => ({
        calories: acc.calories + (Number(f.calories) || 0),
        protein: acc.protein + (Number(f.protein) || 0),
        fiber: acc.fiber + (Number(f.fiber) || 0),
      }),
      { calories: 0, protein: 0, fiber: 0 }
    );
    days.push({ id: dayDoc.id, ...dayDoc.data(), ...totals });
  }

  return days;
}

export async function getStreakDays(uid, count = 28) {
  const ref = query(
    collection(db, 'users', uid, 'kutzDays'),
    orderBy('date', 'desc'),
    limit(count)
  );
  const snap = await getDocs(ref);
  return snap.docs.map(d => ({ date: d.data().date }));
}

// ─── Frequent foods ──────────────────────────────────────────────────────────

async function trackFrequentFood(uid, food) {
  if (!food.name) return;
  const key = food.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 50);
  const ref = doc(db, 'users', uid, 'kutzFrequentFoods', key);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await updateDoc(ref, { useCount: increment(1) });
  } else {
    await setDoc(ref, {
      name: food.name,
      calories: food.calories || 0,
      protein: food.protein || 0,
      fiber: food.fiber || 0,
      defaultQuantity: food.quantity || '1 serving',
      useCount: 1,
    });
  }
}
