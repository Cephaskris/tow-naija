import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, phoneEmail, normPhone, friendlyError, select } from './supabase';

const AuthCtx = createContext(null);
const MODE_KEY = 'townaija.mode';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [operator, setOperator] = useState(null);
  const [settings, setSettings] = useState(null);
  const [mode, setModeState] = useState('customer');
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(async () => {
    try { await supabase.rpc('set_online', { p_online: false }); } catch (e) { /* not an operator */ }
    setProfile(null);
    setOperator(null);
    await supabase.auth.signOut();
  }, []);

  const loadUser = useCallback(async (uid) => {
    if (!uid) { setProfile(null); setOperator(null); return; }
    try {
      const [p, o, s] = await Promise.all([
        select(supabase.from('profiles').select('*').eq('id', uid).maybeSingle()),
        select(supabase.from('operators').select('*').eq('id', uid).maybeSingle()),
        select(supabase.from('app_settings').select('*').maybeSingle()),
      ]);
      if (p) {
        setProfile(p);
        if (o) setOperator(o);
        if (s) setSettings(s);
      }
    } catch (e) {
      console.warn('loadUser error:', e);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(MODE_KEY);
        if (saved === 'operator' || saved === 'customer') setModeState(saved);
      } catch (e) { /* ignore */ }

      try {
        const sessionRes = await Promise.race([
          supabase.auth.getSession(),
          new Promise((resolve) => setTimeout(() => resolve({ data: { session: null } }), 1500)),
        ]);
        if (!mounted) return;
        const s = sessionRes?.data?.session || null;
        setSession(s);
        if (s?.user) {
          // Immediately populate profile with cached user from local storage
          setProfile(s.user);
        }
        if (s?.user?.id) {
          // Sync fresh profile/operator details in the background
          loadUser(s.user.id).catch(() => {});
        }
      } catch (err) {
        console.warn('Auth init failed:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user) setProfile(s.user);
      if (event === 'SIGNED_IN') loadUser(s?.user?.id);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setOperator(null);
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [loadUser]);

  const setMode = useCallback(async (m) => {
    setModeState(m);
    try { await AsyncStorage.setItem(MODE_KEY, m); } catch (e) { /* ignore */ }
  }, []);

  const signUp = useCallback(async ({ fullName, phone, password }) => {
    const p = normPhone(phone);
    if (fullName.trim().length < 2) throw new Error('Enter your full name.');
    if (!/^0[789][01]\d{8}$/.test(p)) throw new Error('Enter a valid Nigerian phone number, e.g. 0803 123 4567.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');
    const { data, error } = await supabase.auth.signUp({
      email: phoneEmail(p), password, options: { data: { full_name: fullName.trim(), phone: p } },
    });
    if (error) throw new Error(friendlyError(error.message));
    if (!data.session) throw new Error('Account created, but sign-in is waiting for email confirmation. Ask the admin to turn off "Confirm email" in Supabase.');
  }, []);

  const signIn = useCallback(async ({ phone, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email: phoneEmail(phone), password });
    if (error) throw new Error(friendlyError(error.message));
  }, []);

  const refresh = useCallback(() => loadUser(session?.user?.id), [loadUser, session]);

  return (
    <AuthCtx.Provider value={{ session, profile, operator, settings, mode, setMode, loading, signUp, signIn, signOut, refresh, uid: session?.user?.id }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
