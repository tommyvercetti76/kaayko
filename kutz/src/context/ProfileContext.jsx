import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getProfile, saveProfile } from '../lib/firestore';
import { TARGETS as DEFAULT_TARGETS } from '../lib/constants';

const ProfileContext = createContext(null);

/**
 * Wraps the authenticated app. Loads profile once, exposes dynamic targets app-wide.
 * Components call useProfile() instead of importing TARGETS from constants.
 */
export function ProfileProvider({ uid, children }) {
  const [profile, setProfile] = useState(null);

  const load = useCallback(() => {
    if (!uid) return;
    getProfile(uid).then(setProfile).catch(console.error);
  }, [uid]);

  useEffect(load, [load]);

  // Merge saved targets with defaults (so missing keys fall back gracefully)
  const targets = {
    calories: profile?.targets?.calories ?? DEFAULT_TARGETS.calories,
    protein:  profile?.targets?.protein  ?? DEFAULT_TARGETS.protein,
    fiber:    profile?.targets?.fiber    ?? DEFAULT_TARGETS.fiber,
  };

  async function updateProfile(data) {
    const bmr = await saveProfile(uid, data);
    setProfile(prev => ({ ...prev, ...data, bmr }));
    return bmr;
  }

  return (
    <ProfileContext.Provider value={{ profile, targets, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  // Safety-net for components accidentally rendered outside provider
  return ctx ?? { profile: null, targets: DEFAULT_TARGETS, updateProfile: async () => {} };
}
