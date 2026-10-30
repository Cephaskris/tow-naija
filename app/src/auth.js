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

  const loadUser = useCallback(async (uid) => {
    if (!uid) { setProfile(null); setOperator(null); return; }
    try {
      const [p, o, s] = await Promise.all([
        select(supabase.from('profiles').select('*').eq('id', uid).maybeSingle()),
        select(supabase.from('operators').select('*').eq('id', uid).maybeSingle()),
        select(supabase.from('app_settings').select('*').maybeSingle()),
      ]);
      setProfile(p); setOperator(o); setSettings(s);
    } catch (e) {
      // Keep whatever we had; screens show their own errors.
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(MODE_KEY);
        if (saved === 'operator' || saved === 'customer') setModeState(saved);
      } catch (e) { /* ignore */ }
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      await loadUser(data.session?.user?.id);
      if (mounted) setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') loadUser(s?.user?.id);
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

  const signOut = useCallback(async () => {
    try { await supabase.rpc('set_online', { p_online: false }); } catch (e) { /* not an operator */ }
    await supabase.auth.signOut();
  }, []);

  const refresh = useCallback(() => loadUser(session?.user?.id), [loadUser, session]);

  return (
    <AuthCtx.Provider value={{ session, profile, operator, settings, mode, setMode, loading, signUp, signIn, signOut, refresh, uid: session?.user?.id }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
