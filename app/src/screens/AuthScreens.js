import React, { useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../auth';
import { useNav } from '../nav';
import { hasLiveBackend, isDemo, setDemoBackend, friendlyError, getUnauthedHttpClient } from '../supabase';
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

export function Login({ route }) {
  const nav = useNav();
  const { signIn } = useAuth();
  const [f, setF] = useState({ phone: route?.params?.phone || '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      await signIn(f);
    } catch (e) {
      setErr(friendlyError(e.message));
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Btn title="Log in" onPress={submit} loading={busy} />}>
      <TopBar onBack={nav.pop} title="Welcome back" sub="Log in with your phone number" />
      <Gap h={8} />
      <View style={{ gap: 14 }}>
        <Field label="Phone number" icon="phone" value={f.phone} onChangeText={(v) => { setF({ ...f, phone: v }); setErr(''); }} placeholder="0803 123 4567" keyboardType="phone-pad" autoComplete="tel" />
        <Field label="Password" icon="lock" value={f.password} onChangeText={(v) => { setF({ ...f, password: v }); setErr(''); }} secureTextEntry autoComplete="current-password" />
        {err ? <T color={C.red}>{err}</T> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <Pressable onPress={() => nav.replace('Signup')}><T v="label">New here? <T v="label" style={{ textDecorationLine: 'underline' }}>Create account</T></T></Pressable>
          <Pressable onPress={() => nav.push('ForgotPassword', { phone: f.phone })}><T v="label" color={C.ink} style={{ textDecorationLine: 'underline', fontWeight: '600' }}>Forgot password?</T></Pressable>
        </View>
      </View>
    </Screen>
  );
}

export function ForgotPassword({ route }) {
  const nav = useNav();
  const { signIn } = useAuth();
  const initialPhone = route?.params?.phone || '';
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState(initialPhone);
  const [userFound, setUserFound] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const checkPhone = async () => {
    setErr('');
    const p = phone.replace(/\D/g, '');
    if (p.length < 10) {
      setErr('Enter a valid Nigerian phone number, e.g. 0803 123 4567.');
      return;
    }
    setBusy(true);
    try {
      const http = getUnauthedHttpClient();
      if (!http) throw new Error('Backend not connected');
      const res = await http.query('users:checkAccount', { phone });
      if (!res?.exists) {
        throw new Error('No account found with this phone number. Please check the number or create an account.');
      }
      setUserFound(res);
      setStep(2);
    } catch (e) {
      setErr(friendlyError(e.message));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setErr('');
    if (newPassword.length < 6) {
      setErr('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr('Passwords do not match. Please re-enter.');
      return;
    }
    setBusy(true);
    try {
      const http = getUnauthedHttpClient();
      if (!http) throw new Error('Backend not connected');
      await http.mutation('users:resetPassword', { phone, new_password: newPassword });
      await signIn({ phone, password: newPassword });
    } catch (e) {
      setErr(friendlyError(e.message));
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        step === 1 ? (
          <Btn title="Continue" onPress={checkPhone} loading={busy} />
        ) : (
          <Btn title="Reset Password & Log In" onPress={handleReset} loading={busy} />
        )
      }
    >
      <TopBar
        onBack={step === 2 ? () => setStep(1) : nav.pop}
        title="Forgot Password"
        sub={step === 1 ? "Enter your phone number to find your account" : "Create a new password for your account"}
      />
      <Gap h={12} />
      {step === 1 ? (
        <View style={{ gap: 14 }}>
          <Field
            label="Phone number"
            icon="phone"
            value={phone}
            onChangeText={(v) => { setPhone(v); setErr(''); }}
            placeholder="0803 123 4567"
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          {err ? <T color={C.red}>{err}</T> : null}
          <T v="small" muted>
            Enter the phone number linked to your Townaija account. We will verify your account and let you set a new password.
          </T>
          <Gap h={8} />
          <Pressable onPress={() => nav.pop()}>
            <T v="label" center style={{ textDecorationLine: 'underline' }}>Remember your password? Log in</T>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {userFound ? (
            <View style={{ backgroundColor: C.soft, borderRadius: R.sm, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name="check-circle" size={24} color={C.green} />
              <View style={{ flex: 1 }}>
                <T v="bodyBold">{userFound.name}</T>
                <T v="small" muted>{userFound.phone}</T>
              </View>
            </View>
          ) : null}
          <Field
            label="New password"
            icon="lock"
            value={newPassword}
            onChangeText={(v) => { setNewPassword(v); setErr(''); }}
            placeholder="At least 6 characters"
            secureTextEntry
            autoComplete="new-password"
          />
          <Field
            label="Confirm new password"
            icon="lock"
            value={confirmPassword}
            onChangeText={(v) => { setConfirmPassword(v); setErr(''); }}
            placeholder="Re-enter your new password"
            secureTextEntry
            autoComplete="new-password"
          />
          {err ? <T color={C.red}>{err}</T> : null}
          <T v="small" muted>
            After saving your new password, you will be automatically logged in.
          </T>
        </View>
      )}
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

