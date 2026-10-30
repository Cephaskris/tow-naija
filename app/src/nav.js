import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

// A tiny stack navigator: no extra native libraries, Android back button supported.
// Screens underneath stay mounted (hidden) so forms keep their state while you pick a location.
const NavCtx = createContext(null);
const FocusCtx = createContext(true);
let keySeq = 0;

export function Navigator({ initial, screens, overlay }) {
  const [stack, setStack] = useState(() => [{ ...initial, key: ++keySeq }]);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const api = useMemo(() => ({
    push: (name, params) => setStack((s) => [...s, { name, params, key: ++keySeq }]),
    replace: (name, params) => setStack((s) => [...s.slice(0, -1), { name, params, key: ++keySeq }]),
    reset: (name, params) => setStack([{ name, params, key: ++keySeq }]),
    resetTo: (entries) => setStack(entries.map(([name, params]) => ({ name, params, key: ++keySeq }))),
    pop: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    canGoBack: () => stackRef.current.length > 1,
  }), []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stackRef.current.length > 1) { api.pop(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [api]);

  return (
    <NavCtx.Provider value={api}>
      <View style={{ flex: 1 }}>
        {stack.map((entry, i) => {
          const Screen = screens[entry.name];
          const focused = i === stack.length - 1;
          return (
            <FocusCtx.Provider key={entry.key} value={focused}>
              <View style={[StyleSheet.absoluteFill, !focused && styles.hidden]} pointerEvents={focused ? 'auto' : 'none'}>
                <Screen params={entry.params || {}} />
              </View>
            </FocusCtx.Provider>
          );
        })}
        {overlay}
      </View>
    </NavCtx.Provider>
  );
}

const styles = StyleSheet.create({ hidden: { display: 'none' } });

export const useNav = () => useContext(NavCtx);
export const useFocused = () => useContext(FocusCtx);

// Run fn every `ms` while enabled (used for polling as a fallback to realtime).
export function useInterval(fn, ms, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}

export function useAlive() {
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  return useCallback(() => alive.current, []);
}
