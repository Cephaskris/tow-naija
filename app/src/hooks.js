import { useEffect, useRef, useState } from 'react';
import { AppState, Vibration } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from './supabase';
import { useInterval } from './nav';

/** Live position of this phone while `enabled`; pushes it to the server every ~15s (operators). */
export function useOperatorTracking(enabled) {
  const [pos, setPos] = useState(null);
  const lastSent = useRef(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let sub = null;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 25 },
        (p) => {
          const next = { lat: p.coords.latitude, lng: p.coords.longitude };
          setPos(next);
          const now = Date.now();
          if (now - lastSent.current > 15000) {
            lastSent.current = now;
            supabase.rpc('update_location', { p_lat: next.lat, p_lng: next.lng }).then(() => {}, () => {});
          }
        },
      );
      if (cancelled && sub) sub.remove();
    })();
    return () => { cancelled = true; if (sub) sub.remove(); };
  }, [enabled]);

  // Heartbeat so the server knows the operator is still around even when parked.
  useInterval(() => {
    if (pos) supabase.rpc('update_location', { p_lat: pos.lat, p_lng: pos.lng }).then(() => {}, () => {});
  }, 60000, enabled && !!pos);
  return pos;
}

/** Subscribe to row changes and also poll, so screens stay fresh even on flaky networks. */
export function useLiveRefresh(channelName, tables, reload, pollMs = 8000, focused = true) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => {
    if (!channelName) return undefined;
    let ch = supabase.channel(channelName);
    tables.forEach(({ table, filter }) => {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => reloadRef.current());
    });
    ch.subscribe();
    const appSub = AppState.addEventListener('change', (s) => { if (s === 'active') reloadRef.current(); });
    return () => { supabase.removeChannel(ch); appSub.remove(); };
  }, [channelName]);
  useInterval(() => { if (AppState.currentState === 'active') reloadRef.current(); }, pollMs, !!channelName && focused);
}

/** Watches the in-app notification inbox and surfaces new items as banners. */
export function useNotificationWatcher(uid, onNew) {
  const lastId = useRef(null);
  const cb = useRef(onNew);
  cb.current = onNew;
  const check = async () => {
    if (!uid) return;
    const { data } = await supabase.from('notifications').select('*').eq('user_id', uid).order('id', { ascending: false }).limit(5);
    if (!data || !data.length) { if (lastId.current === null) lastId.current = 0; return; }
    if (lastId.current === null) { lastId.current = data[0].id; return; } // first load: don't replay old ones
    const fresh = data.filter((n) => n.id > lastId.current);
    if (fresh.length) {
      lastId.current = data[0].id;
      Vibration.vibrate([0, 250, 120, 250]);
      cb.current(fresh[0]);
    }
  };
  useEffect(() => {
    lastId.current = null;
    if (!uid) return undefined;
    check();
    const ch = supabase.channel(`notif-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => check())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid]);
  useInterval(() => { if (AppState.currentState === 'active') check(); }, 15000, !!uid);
}
