import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth';
import { useNav } from '../nav';
import { supabase, isDemo, hasLiveBackend, setDemoBackend } from '../supabase';
import { C, R } from '../theme';
import { ago } from '../format';
import { Avatar, Btn, Card, Empty, Gap, Icon, Loading, RatingText, Screen, T, TabBar, TAB_SPACE, TopBar, useToast } from '../ui';
import { CUSTOMER_TABS, OPERATOR_TABS } from '../tabs';

function MenuItem({ icon, label, sub, onPress, danger, last }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, !last && styles.itemLine, pressed && { opacity: 0.6 }]} accessibilityRole="button">
      <View style={[styles.itemIcon, danger && { borderColor: C.redSoft, backgroundColor: C.redSoft }]}><Icon name={icon} size={16} color={danger ? C.red : C.ink} /></View>
      <View style={{ flex: 1 }}>
        <T v="bodyBold" color={danger ? C.red : C.ink}>{label}</T>
        {sub ? <T v="small" muted>{sub}</T> : null}
      </View>
      <Icon name="chevron-right" size={18} color={C.faint} />
    </Pressable>
  );
}

export function Menu({ params }) {
  const nav = useNav();
  const toast = useToast();
  const { profile, operator, mode, setMode, signOut, settings } = useAuth();
  const isOp = mode === 'operator';
  const tab = !!params.tab;
  const switchMode = async () => {
    if (isOp) {
      try { await supabase.rpc('set_online', { p_online: false }); } catch (e) { /* ignore */ }
    }
    setMode(isOp ? 'customer' : 'operator');
  };
  const out = () => Alert.alert('Log out?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: signOut }]);
  const support = () => {
    const phone = settings?.support_phone;
    if (!phone) { toast.show('Support line coming soon.'); return; }
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => toast.show(phone));
  };
  const updateSoftware = () => {
    const apkUrl = settings?.apk_url || "https://charming-donkey-521.convex.cloud/api/storage/117e332b-fa68-4c80-89c1-7f477f85d47d";
    const curVer = "1.2.7";
    const latest = settings?.latest_version || curVer;
    Alert.alert(
      'Update software',
      `Current Version: v${curVer}\nLatest Version: v${latest}\n\nDownload and install the latest APK update for Townaija.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download & Install',
          onPress: () => {
            Linking.openURL(apkUrl).catch(() => toast.show('Could not open download link'));
          },
        },
      ]
    );
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen bottomSpace={tab ? TAB_SPACE + 10 : 24}>
        <TopBar onBack={tab ? null : nav.pop} title="Settings & Profile" />
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={profile?.full_name} size={60} tone="accent" />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h2" numberOfLines={1}>{profile?.full_name}</T>
            <T muted>{profile?.phone}</T>
            <RatingText avg={profile?.rating_avg} count={profile?.rating_count} />
          </View>
        </Card>
        <Gap h={12} />
        <Card tone="dark" onPress={switchMode} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={styles.switchIcon}><Icon name={isOp ? 'mc:car-side' : 'mc:tow-truck'} size={20} /></View>
          <View style={{ flex: 1 }}>
            <T v="bodyBold" color={C.white}>{isOp ? 'Switch to customer mode' : operator ? 'Switch to operator mode' : 'Own a tow truck?'}</T>
            <T v="small" color="#B5B5B5">{isOp ? 'Request a tow for your own vehicle' : operator ? 'Receive tow requests and earn' : 'Become an operator and get jobs near you'}</T>
          </View>
          <Icon name="arrow-up-right" size={20} color={C.accent} />
        </Card>
        <Gap h={12} />
        <Card style={{ gap: 0, paddingVertical: 4 }}>
          {!tab ? <MenuItem icon="clock" label={isOp ? 'My jobs' : 'My tows'} onPress={() => nav.push('History')} /> : null}
          {isOp && !tab ? <MenuItem icon="credit-card" label="Wallet" onPress={() => nav.push('Wallet')} /> : null}
          <MenuItem icon="bell" label="Notifications" onPress={() => nav.push('Notifications')} />
          <MenuItem icon="download" label="Update software" sub={settings?.latest_version ? `v${settings.latest_version} · Tap to update` : "Check for updates"} onPress={updateSoftware} />
          <MenuItem icon="lock" label="Change password" onPress={() => nav.push('ForgotPassword', { phone: profile?.phone })} />
          <MenuItem icon="help-circle" label="Contact support" sub={settings?.support_phone || undefined} onPress={support} />
          <MenuItem icon="log-out" label="Log out" danger onPress={out} last />
        </Card>
        <Gap h={20} />
        <T v="small" muted center>Townaija · v1.2.7 · Made for Nigerian roads</T>
      </Screen>
      {tab ? <TabBar items={isOp ? OPERATOR_TABS : CUSTOMER_TABS} active="Menu" onChange={(k) => nav.reset(k, { tab: true })} /> : null}
    </View>
  );
}

export function Notifications() {
  const nav = useNav();
  const { uid, mode } = useAuth();
  const [list, setList] = useState(null);
  useEffect(() => {
    supabase.from('notifications').select('*').eq('user_id', uid).order('id', { ascending: false }).limit(50)
      .then(({ data }) => {
        setList(data || []);
        const unread = (data || []).filter((n) => !n.read_at).map((n) => n.id);
        if (unread.length) supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread).then(() => {}, () => {});
      }, () => setList([]));
  }, [uid]);
  if (!list) return <Loading />;
  const open = (n) => {
    const rid = n.data && n.data.request_id;
    if (!rid) return;
    if (mode === 'operator') { if (n.data.type === 'new_request') nav.reset('OperatorHome'); else nav.push('OperatorActive', { id: rid }); } else nav.push('RequestLive', { id: rid });
  };
  return (
    <Screen scroll={false} padded={false}>
      <View style={{ paddingHorizontal: 18 }}><TopBar onBack={nav.pop} title="Notifications" /></View>
      <FlatList
        data={list}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24, gap: 10 }}
        ListEmptyComponent={<Empty icon="bell" title="No notifications yet" text="Updates about your tows appear here." />}
        renderItem={({ item: n }) => (
          <Pressable onPress={() => open(n)} style={styles.notif}>
            <View style={[styles.notifIcon, !n.read_at && { backgroundColor: C.accent }]}><Icon name="bell" size={16} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="bodyBold">{n.title}</T>
              {n.body ? <T v="small" muted>{n.body}</T> : null}
              <T v="tiny" muted>{ago(n.created_at)}</T>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

export function NotConfigured() {
  return (
    <Screen>
      <Gap h={60} />
      <T v="h1">Almost there</T>
      <Gap h={8} />
      <T muted>This build of Townaija isn't connected to a server yet. Add the SUPABASE_URL and SUPABASE_ANON_KEY secrets in GitHub, then build the APK again.</T>
    </Screen>
  );
}

export function Blocked() {
  const { signOut, settings } = useAuth();
  return (
    <Screen footer={<Btn title="Log out" variant="secondary" onPress={signOut} />}>
      <Gap h={60} />
      <T v="h1">Account on hold</T>
      <Gap h={8} />
      <T muted>Your Townaija account has been paused. Please contact support{settings?.support_phone ? ` on ${settings.support_phone}` : ''}.</T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  itemLine: { borderBottomWidth: 1, borderBottomColor: C.line },
  itemIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  switchIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  notif: { flexDirection: 'row', gap: 12, padding: 14, backgroundColor: C.white, borderRadius: R.tile, alignItems: 'flex-start' },
  notifIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
});
