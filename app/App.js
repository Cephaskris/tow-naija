import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from './src/auth';
import { Navigator, useNav } from './src/nav';
import { useNotificationWatcher } from './src/hooks';
import { onBackendChange } from './src/supabase';
import { C, F } from './src/theme';
import { Icon, Loading, ToastProvider } from './src/ui';
import { Welcome, Signup, Login } from './src/screens/AuthScreens';
import { CustomerHome, NewRequest, PickLocation, RequestLive, Report, History } from './src/screens/CustomerScreens';
import { OperatorOnboard, OperatorStatus, OperatorHome, OperatorJob, OperatorActive, Wallet } from './src/screens/OperatorScreens';
import { Menu, Notifications, Blocked } from './src/screens/CommonScreens';

SplashScreen.preventAutoHideAsync().catch(() => {});

const SCREENS = {
  Welcome, Signup, Login,
  CustomerHome, NewRequest, PickLocation, RequestLive, Report, History,
  OperatorOnboard, OperatorStatus, OperatorHome, OperatorJob, OperatorActive, Wallet,
  Menu, Notifications,
};

function Banner() {
  const nav = useNav();
  const ins = useSafeAreaInsets();
  const { uid, mode, refresh } = useAuth();
  const [n, setN] = useState(null);
  const y = useRef(new Animated.Value(-160)).current;
  const timer = useRef();

  useNotificationWatcher(uid, (item) => {
    setN(item);
    if (['operator_status', 'wallet', 'completed'].includes(item.data?.type)) refresh();
    Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
    clearTimeout(timer.current);
    timer.current = setTimeout(hide, 6000);
  });
  const hide = () => Animated.timing(y, { toValue: -160, duration: 200, useNativeDriver: true }).start(() => setN(null));
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!n) return null;

  const open = () => {
    hide();
    const rid = n.data?.request_id;
    if (!rid) return;
    if (mode === 'operator') {
      if (n.data.type === 'new_request') nav.reset('OperatorHome');
      else nav.push('OperatorActive', { id: rid });
    } else nav.push('RequestLive', { id: rid });
  };
  return (
    <Animated.View style={[styles.banner, { top: ins.top + 8, transform: [{ translateY: y }] }]}>
      <Pressable onPress={open} style={styles.bannerInner} accessibilityRole="alert">
        <View style={styles.bannerIcon}><Icon name="bell" size={16} color={C.ink} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>{n.title}</Text>
          {n.body ? <Text style={styles.bannerBody} numberOfLines={2}>{n.body}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Root() {
  const { loading, session, profile, operator, mode } = useAuth();
  useEffect(() => { if (!loading) SplashScreen.hideAsync().catch(() => {}); }, [loading]);

  if (loading) return <Loading />;
  if (!session) return <Navigator key="guest" initial={{ name: 'Welcome' }} screens={SCREENS} />;
  if (!profile) return <Loading text="Setting up your account…" />;
  if (profile.status === 'blocked') return <Blocked />;

  let initial = 'CustomerHome';
  if (mode === 'operator') {
    if (!operator) initial = 'OperatorOnboard';
    else if (operator.status === 'approved' || operator.status === 'suspended') initial = 'OperatorHome';
    else initial = 'OperatorStatus';
  }
  return (
    <Navigator
      key={`${session.user.id}-${mode}-${initial}`}
      initial={{ name: initial }}
      screens={SCREENS}
      overlay={<Banner />}
    />
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const [backend, setBackend] = useState(0);
  useEffect(() => onBackendChange(() => setBackend((n) => n + 1)), []);
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={C.bg} />
      <ToastProvider>
        <AuthProvider key={`backend-${backend}`}>
          <Root />
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', left: 12, right: 12, zIndex: 50, elevation: 30 },
  bannerInner: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.ink, borderRadius: 24, padding: 12 },
  bannerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { color: C.white, fontFamily: F.bold, fontSize: 15 },
  bannerBody: { color: '#BDBDBD', fontFamily: F.regular, fontSize: 13, marginTop: 2 },
});
