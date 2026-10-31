import React, { useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../auth';
import { useNav } from '../nav';
import { hasLiveBackend, isDemo, setDemoBackend, friendlyError, getConvexHttpClient } from '../supabase';
import { C, R } from '../theme';
import { ArrowBtn, Badge, Btn, Dots, Field, Gap, Icon, Screen, T, Title, TopBar } from '../ui';

const SLIDES = [
  { icon: 'mc:tow-truck', badges: [['tag', 'You set the price'], ['map-pin', 'Near you']], title: 'Request a tow', sub: 'Pickup to your mechanic' },
  { icon: 'mc:account-group-outline', badges: [['users', 'Real offers'], ['star', 'Rated operators']], title: 'Compare operators', sub: 'Price, rating and arrival time' },
  { icon: 'mc:shield-check-outline', badges: [['lock', 'Start code'], ['camera', 'Photo record']], title: 'Tow with confidence', sub: 'Nothing moves without your code' },
];

export function Welcome() {
  const nav = useNav();
  const [i, setI] = useState(0);
  const width = Dimensions.get('window').width - 36;
  const ref = useRef(null);
  return (
    <Screen footer={
      <>
        <Btn title="Get started" onPress={() => nav.push('Signup')} />
        <Btn title="I already have an account" variant="secondary" onPress={() => nav.push('Login')} />
        <T v="small" muted center>Tow trucks on demand · Across Nigerian roads</T>
      </>
    }>
      <StatusBar style="dark" />
      <TopBar
        onBack={null}
        middle={<View style={styles.logo}><Icon name="mc:tow-truck" size={22} /><T v="h3">Townaija</T></View>}
      />
      <Gap h={10} />
      <Title title="Welcome!" sub="Stuck on the road? Get towed." />
      <Gap h={20} />
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ marginHorizontal: -18 }}
        contentContainerStyle={{ paddingHorizontal: 18 }}
        snapToInterval={width}
        decelerationRate="fast"
      >
        {SLIDES.map((s, k) => (
          <View key={s.title} style={{ width }}>
            <View style={styles.heroInner}>
              <View style={styles.badges}>
                {s.badges.map(([ic, tx]) => <Badge key={tx} icon={ic} text={tx} />)}
              </View>
              <View style={styles.heroArt}>
                <View style={styles.heroCircle} />
                <Icon name={s.icon} size={118} color={C.ink} />
              </View>
              <View style={styles.heroFoot}>
                <View style={{ flex: 1 }}>
                  <T v="h3">{s.title}</T>
                  <T v="small" muted>{s.sub}</T>
                </View>
                <ArrowBtn label="Next" onPress={() => {
                  if (k < SLIDES.length - 1) { ref.current?.scrollTo({ x: (k + 1) * width, animated: true }); setI(k + 1); } else nav.push('Signup');
                }} />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      <Gap h={14} />
      <Dots count={SLIDES.length} index={i} />
    </Screen>
  );
}

export function Signup() {
  const nav = useNav();
  const { signUp } = useAuth();
  const [f, setF] = useState({ fullName: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr(''); setBusy(true);
    try { await signUp(f); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Screen footer={<Btn title="Create account" onPress={submit} loading={busy} />}>
      <TopBar onBack={nav.pop} title="Create account" sub="Use the number operators can reach you on" />
      <Gap h={8} />
      <View style={{ gap: 14 }}>
        <Field label="Full name" icon="user" value={f.fullName} onChangeText={(v) => setF({ ...f, fullName: v })} placeholder="Ada Okafor" autoCapitalize="words" autoComplete="name" />
        <Field label="Phone number" icon="phone" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} placeholder="0803 123 4567" keyboardType="phone-pad" autoComplete="tel" />
        <Field label="Password" icon="lock" value={f.password} onChangeText={(v) => setF({ ...f, password: v })} placeholder="At least 6 characters" secureTextEntry autoComplete="new-password" />
        {err ? <T color={C.red}>{err}</T> : null}
      </View>
    </Screen>
  );
}

export function Login() {
  const nav = useNav();
  const { signIn } = useAuth();
  const [f, setF] = useState({ phone: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const submit = async () => {
    setErr(''); setBusy(true);
    if (resetMode) {
      try {
        if (!f.phone || !f.password) throw new Error('Enter your phone number and new password.');
        if (f.password.length < 6) throw new Error('Password must be at least 6 characters.');
        const http = getConvexHttpClient();
        if (!http) throw new Error('Backend not connected');
        await http.mutation('users:resetPassword', { phone: f.phone, new_password: f.password });
        await signIn(f);
      } catch (e) {
        setErr(friendlyError(e.message));
        setBusy(false);
      }
      return;
    }
    try { await signIn(f); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Screen footer={<Btn title={resetMode ? "Set New Password & Log In" : "Log in"} onPress={submit} loading={busy} />}>
      <TopBar onBack={resetMode ? () => setResetMode(false) : nav.pop} title={resetMode ? "Reset Password" : "Welcome back"} sub={resetMode ? "Enter your phone and new password" : "Log in with your phone number"} />
      <Gap h={8} />
      <View style={{ gap: 14 }}>
        <Field label="Phone number" icon="phone" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} placeholder="0803 123 4567" keyboardType="phone-pad" autoComplete="tel" />
        <Field label={resetMode ? "New password" : "Password"} icon="lock" value={f.password} onChangeText={(v) => setF({ ...f, password: v })} placeholder={resetMode ? "At least 6 characters" : undefined} secureTextEntry autoComplete={resetMode ? "new-password" : "current-password"} />
        {err ? <T color={C.red}>{err}</T> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <Pressable onPress={() => nav.replace('Signup')}><T v="label">New here? <T v="label" style={{ textDecorationLine: 'underline' }}>Create account</T></T></Pressable>
          <Pressable onPress={() => { setResetMode(!resetMode); setErr(''); }}><T v="label" style={{ textDecorationLine: 'underline' }}>{resetMode ? "Back to Login" : "Forgot password?"}</T></Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderRadius: R.pill, paddingHorizontal: 16, height: 48 },
  heroInner: { backgroundColor: C.white, borderRadius: 32, padding: 14, height: 380, justifyContent: 'space-between', marginHorizontal: 5 },
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  heroArt: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  heroCircle: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: C.accent, opacity: 0.55 },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.soft, borderRadius: 24, padding: 12, paddingLeft: 16 },
});

