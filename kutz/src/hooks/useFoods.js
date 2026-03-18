import { useState, useEffect } from 'react';
import { onFoodsSnapshot } from '../lib/firestore';

/**
 * Real-time listener for the foods subcollection of a day.
 */
export function useFoods(uid, dateKey) {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !dateKey) return;
    setLoading(true);

    const unsub = onFoodsSnapshot(uid, dateKey, (items) => {
      setFoods(items);
      setLoading(false);
    });

    return unsub;
  }, [uid, dateKey]);

  return { foods, loading };
}
