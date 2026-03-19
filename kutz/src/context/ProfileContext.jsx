import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getProfile, saveProfile } from '../lib/firestore';
import { TARGETS as DEFAULT_TARGETS, DIET_TYPES } from '../lib/constants';

const DEFAULT_DIET = DIET_TYPES[0].value; // 'lacto-ovo-vegetarian'

const ProfileContext = createContext(null);

export function ProfileProvider({ uid, children }) {
  const [profile, setProfile] = useState(null);

  const load = useCallback(() => {
    if (!uid) return;
    getProfile(uid).then(setProfile).catch(console.error);
  }, [uid]);

  useEffect(load, [load]);

  const targets = {
    calories: profile?.targets?.calories ?? DEFAULT_TARGETS.calories,
    protein:  profile?.targets?.protein  ?? DEFAULT_TARGETS.protein,
    carbs:    profile?.targets?.carbs    ?? DEFAULT_TARGETS.carbs,
    fat:      profile?.targets?.fat      ?? DEFAULT_TARGETS.fat,
    fiber:    profile?.targets?.fiber    ?? DEFAULT_TARGETS.fiber,
  };

  async function updateProfile(data) {
    const bmr = await saveProfile(uid, data);
    setProfile(prev => ({ ...prev, ...data, bmr }));
    return bmr;
  }

  const dietType    = profile?.dietType    ?? DEFAULT_DIET;
  const waterTarget = profile?.waterTarget ?? 2500;

  return (
    <ProfileContext.Provider value={{ profile, targets, dietType, waterTarget, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  return ctx ?? { profile: null, targets: DEFAULT_TARGETS, dietType: DEFAULT_DIET, waterTarget: 2500, updateProfile: async () => {} };
}
