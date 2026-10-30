import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, TextInput, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../auth';
import { useFocused, useInterval, useNav } from '../nav';
import { rpc, select, supabase, publicPhotoUrl, isDemo } from '../supabase';
import { currentPosition, directionsUrl } from '../geo';
import { useLiveRefresh, useOperatorTracking } from '../hooks';
import { C, F, R } from '../theme';
import { ago, etaMinutes, firstName, km, naira, PROBLEM, shortDate, STATUS, TRUCK, TRUCK_ICON, TRUCK_INFO, VEHICLE, VEHICLE_ICON } from '../format';
import TowMap from '../components/TowMap';
import PhotoPicker, { DocSlot, uploadPhoto, takeOrPick } from '../components/PhotoPicker';
import {
  ArrowBtn, Avatar, Badge, Btn, Card, Chip, Choices, Empty, Field, Gap, Icon, Loading, Pulse, RatingText, RoundBtn, Row,
  Screen, Segmented, Sheet, SlideToConfirm, Stars, T, TabBar, TAB_SPACE, Tile, TileRow, Title, TopBar, useToast,
} from '../ui';
import { DEFAULT_CENTER } from '../config';
import { OPERATOR_TABS } from '../tabs';

const goTab = (nav) => (k) => nav.reset(k, { tab: true });

/* =========================================================
   Operator sign-up
   ========================================================= */
export function OperatorOnboard() {
  const nav = useNav();
  const toast = useToast();
  const { uid, operator, refresh, setMode } = useAuth();
  const [f, setF] = useState({
    truck_type: operator?.truck_type || 'flatbed',
    truck_plate: operator?.truck_plate || '',
    truck_make_model: operator?.truck_make_model || '',
    base_area: operator?.base_area || '',
  });
  const [docs, setDocs] = useState({ license: null, id: null, truck: null, selfie: null });
  const [busy, setBusy] = useState(false);
  const err = (m) => toast.show(m, 'error');

  const submit = async () => {
    if (!f.truck_plate.trim()) return err('Enter your truck plate number.');
    if (!docs.license || !docs.truck) return err("Upload your driver's licence and a photo of your truck.");
    setBusy(true);
    try {
      await rpc('register_operator', {
        p: {
          ...f,
          license_doc_path: docs.license.path, id_doc_path: docs.id?.path || null,
          truck_photo_path: docs.truck.path, selfie_path: docs.selfie?.path || null,
        },
      });
      await refresh();
      toast.show('Application sent');
      if (nav.canGoBack()) nav.pop();
    } catch (e) { err(e.message); setBusy(false); }
  };

  return (
    <Screen footer={<Btn title="Submit for review" onPress={submit} loading={busy} icon="send" />}>
      <TopBar
        onBack={nav.canGoBack() ? nav.pop : null}
        right={<Pressable onPress={() => setMode('customer')} style={styles.modePill} accessibilityRole="button"><Icon name="repeat" size={14} /><T v="label">Customer</T></Pressable>}
        title="Become an operator"
        sub="Get tow requests from drivers near you"
      />
      {operator?.status === 'rejected' && operator.review_note ? (
        <Card tone="red"><T v="bodyBold" color={C.red}>Please fix and resubmit</T><T>{operator.review_note}</T></Card>
      ) : null}
      <Gap h={8} />
      <T v="label">Your truck</T>
      <Gap h={10} />
      <View style={{ gap: 10 }}>
        {Object.keys(TRUCK).map((k) => {
          const on = f.truck_type === k;
          return (
            <Pressable key={k} onPress={() => setF({ ...f, truck_type: k })} style={[styles.truckOpt, on && { backgroundColor: C.accent }]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <View style={[styles.truckIcon, on && { backgroundColor: C.white }]}><Icon name={TRUCK_ICON[k]} size={22} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="h3">{TRUCK[k]}</T>
                <T v="small" color={on ? C.ink : C.muted}>{TRUCK_INFO[k]}</T>
              </View>
              <View style={[styles.radio, on && { backgroundColor: C.ink, borderColor: C.ink }]}>{on ? <Icon name="check" size={13} color={C.white} /> : null}</View>
            </Pressable>
          );
        })}
      </View>
      <Gap h={18} />
      <View style={{ gap: 14 }}>
        <Field label="Plate number" icon="hash" value={f.truck_plate} onChangeText={(v) => setF({ ...f, truck_plate: v })} placeholder="ABJ 123 XY" autoCapitalize="characters" />
        <Field label="Make and model" icon="mc:tow-truck" value={f.truck_make_model} onChangeText={(v) => setF({ ...f, truck_make_model: v })} placeholder="e.g. Isuzu NPR flatbed" />
        <Field label="Where are you usually based?" icon="map-pin" value={f.base_area} onChangeText={(v) => setF({ ...f, base_area: v })} placeholder="e.g. Wuse, Kubwa, Lugbe" />
      </View>
      <Gap h={22} />
      <T v="label">Documents</T>
      <T v="small" muted>Only Townaija's verification team can see these.</T>
      <Gap h={10} />
      <View style={{ gap: 10 }}>
        <DocSlot title="Driver's licence" hint="Clear photo of the front" required uid={uid} value={docs.license} onChange={(x) => setDocs({ ...docs, license: x })} onError={err} />
        <DocSlot title="Truck photo" hint="Whole truck with the plate visible" required uid={uid} value={docs.truck} onChange={(x) => setDocs({ ...docs, truck: x })} onError={err} />
        <DocSlot title="ID card" hint="NIN slip, voter's card or passport" uid={uid} value={docs.id} onChange={(x) => setDocs({ ...docs, id: x })} onError={err} />
        <DocSlot title="Selfie" hint="So customers know who to expect" uid={uid} cameraOnly value={docs.selfie} onChange={(x) => setDocs({ ...docs, selfie: x })} onError={err} />
      </View>
    </Screen>
  );
}

/* =========================================================
   Waiting for approval / rejected
   ========================================================= */
export function OperatorStatus() {
  const nav = useNav();
  const { operator, refresh, setMode, settings } = useAuth();
  const [busy, setBusy] = useState(false);
  const check = async () => { setBusy(true); await refresh(); setBusy(false); };
  useInterval(refresh, isDemo() ? 3000 : 30000, true);
  const rejected = operator?.status === 'rejected';
  return (
    <Screen footer={<>
      {rejected ? <Btn title="Update my application" onPress={() => nav.push('OperatorOnboard')} /> : <Btn title="Check status" variant="secondary" onPress={check} loading={busy} icon="refresh-cw" />}
      <Btn title="Use Townaija as a customer" variant="ghost" onPress={() => setMode('customer')} />
    </>}>
      <View style={{ alignItems: 'center', gap: 14, paddingTop: 70 }}>
        <View style={[styles.bigIcon, rejected && { backgroundColor: C.redSoft }]}>
          <Icon name={rejected ? 'x' : 'clock'} size={38} color={rejected ? C.red : C.ink} />
        </View>
        <T v="h1" center>{rejected ? 'Application not approved' : "We're checking your documents"}</T>
        <T muted center style={{ maxWidth: 320 }}>
          {rejected ? operator?.review_note || 'Please update your details and resubmit.' : 'This usually takes less than 24 hours. You will be notified as soon as you are approved.'}
        </T>
        {!rejected ? (
          <Card style={{ alignSelf: 'stretch', marginTop: 10 }}>
            <Row>
              <View style={styles.truckIcon}><Icon name="credit-card" size={18} /></View>
              <View style={{ flex: 1 }}>
                <T v="bodyBold">While you wait</T>
                <T v="small" muted>Keep at least {naira(settings?.min_wallet_balance ?? 1000)} in your wallet to receive jobs.</T>
              </View>
              <ArrowBtn label="Open wallet" onPress={() => nav.push('Wallet')} size={44} />
            </Row>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

/* =========================================================
   Operator home — online switch + job cards or map
   ========================================================= */
export function OperatorHome() {
  const nav = useNav();
  const focused = useFocused();
  const toast = useToast();
  const ins = useSafeAreaInsets();
  const { operator, profile, refresh, settings } = useAuth();
  const [online, setOnline] = useState(!!operator?.is_online);
  const [view, setView] = useState('cards');
  const [feed, setFeed] = useState([]);
  const [busy, setBusy] = useState(false);
  const pos = useOperatorTracking(online);
  const seen = useRef(new Set());
  const suspended = operator?.status === 'suspended';
  const lowWallet = Number(operator?.wallet_balance || 0) < Number(settings?.min_wallet_balance ?? 1000);

  const loadFeed = useCallback(async () => {
    try {
      const active = await rpc('my_active_request');
      if (active) { nav.push('OperatorActive', { id: active }); return; }
      if (!online) { setFeed([]); return; }
      const f = await rpc('operator_feed');
      const fresh = f.filter((x) => !seen.current.has(x.id));
      if (fresh.length && seen.current.size) Vibration.vibrate([0, 300, 150, 300]);
      f.forEach((x) => seen.current.add(x.id));
      setFeed(f);
    } catch (e) { /* offline: keep last */ }
  }, [online, nav]);

  useEffect(() => { if (focused) { loadFeed(); refresh(); } }, [focused]);
  useInterval(loadFeed, isDemo() ? 3000 : 8000, focused);
  useEffect(() => { if (online && pos && !feed.length) loadFeed(); }, [pos]);

  const setOnlineTo = async (next) => {
    if (next === online) return;
    setBusy(true);
    try {
      if (next) {
        const p = pos || (await currentPosition().catch(() => DEFAULT_CENTER));
        await rpc('set_online', { p_online: true, p_lat: p.lat, p_lng: p.lng });
      } else {
        await rpc('set_online', { p_online: false });
      }
      setOnline(next);
      toast.show(next ? "You're online. New jobs appear here." : "You're offline.");
      refresh();
      setTimeout(loadFeed, 1200);
    } catch (e) { toast.show(e.message, 'error'); }
    setBusy(false);
  };

  const markers = useMemo(() => [
    ...(pos ? [{ id: 'me', kind: 'truck', ...pos }] : []),
    ...feed.map((j) => ({ id: j.id, kind: 'pickup', lat: j.pickup_lat, lng: j.pickup_lng })),
  ], [pos, feed]);
  const camera = useMemo(() => (pos ? { id: `op-${feed.length}-${view}`, fit: feed.length ? [[pos.lat, pos.lng], ...feed.map((j) => [j.pickup_lat, j.pickup_lng])] : undefined, lat: pos.lat, lng: pos.lng, zoom: 13, bottom: 420 } : { id: 'def', ...DEFAULT_CENTER, zoom: 11 }), [pos, feed, view]);

  const onlineSwitch = (
    <Segmented
      value={online ? 'on' : 'off'}
      onChange={(v) => !busy && !suspended && setOnlineTo(v === 'on')}
      options={[{ value: 'off', icon: 'moon', text: 'Offline', label: 'Go offline' }, { value: 'on', icon: 'radio', text: 'Online', label: 'Go online' }]}
    />
  );
  const walletPill = (
    <Pressable onPress={() => nav.reset('Wallet', { tab: true })} style={[styles.walletPill, lowWallet && { backgroundColor: C.redSoft }]} accessibilityRole="button" accessibilityLabel="Wallet">
      <Icon name="credit-card" size={15} color={lowWallet ? C.red : C.ink} />
      <T v="label" color={lowWallet ? C.red : C.ink}>{naira(operator?.wallet_balance)}</T>
    </Pressable>
  );

  const warnings = (
    <>
      {suspended ? <Card tone="red"><T v="bodyBold" color={C.red}>Account suspended</T><T v="small">{operator?.review_note || 'Contact Townaija support.'}</T></Card> : null}
      {!suspended && lowWallet ? (
        <Card onPress={() => nav.reset('Wallet', { tab: true })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[styles.truckIcon, { backgroundColor: C.amberSoft }]}><Icon name="alert-circle" size={18} color={C.amber} /></View>
          <View style={{ flex: 1 }}>
            <T v="bodyBold">Top up to receive jobs</T>
            <T v="small" muted>Keep at least {naira(settings?.min_wallet_balance ?? 1000)} for commission.</T>
          </View>
          <Icon name="chevron-right" color={C.faint} />
        </Card>
      ) : null}
    </>
  );

  const jobCard = (j) => (
    <Card key={j.id} onPress={() => nav.push('OperatorJob', { job: j })} style={{ gap: 14 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Badge icon="map-pin" text={`${km(j.pickup_distance_km)} away`} />
        {j.my_bid_status === 'pending' ? <Chip label={`Offer ${naira(j.my_bid_amount)} sent`} tone="accent" /> : <T v="small" muted>{ago(j.created_at)}</T>}
      </Row>
      <Row>
        <View style={styles.vIcon}><Icon name={VEHICLE_ICON[j.vehicle_type]} size={30} /></View>
        <View style={{ flex: 1 }}>
          <T v="h3" numberOfLines={1}>{j.vehicle_desc || VEHICLE[j.vehicle_type]}</T>
          <T v="small" muted>{PROBLEM[j.problem_type]}{!j.wheels_roll ? ' · wheels locked' : ''}</T>
        </View>
        <T v="price" style={{ fontSize: 22 }}>{naira(j.offer_amount)}</T>
      </Row>
      <TileRow>
        <Tile tone="soft" icon="navigation" label="Tow" value={km(j.distance_km)} />
        <Tile tone="soft" icon={j.payment_method === 'transfer' ? 'repeat' : 'dollar-sign'} label="Payment" value={j.payment_method === 'transfer' ? 'Transfer' : 'Cash'} />
      </TileRow>
      <Row>
        <T v="small" muted numberOfLines={2} style={{ flex: 1 }}>{j.pickup_address} → {j.dropoff_address}</T>
        <ArrowBtn label="View job" onPress={() => nav.push('OperatorJob', { job: j })} />
      </Row>
    </Card>
  );

  if (view === 'map') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar style="dark" />
        <TowMap markers={markers} camera={camera} />
        <View style={[styles.floatTop, { top: ins.top + 10 }]}>
          <RoundBtn name="layers" label="Show job cards" float onPress={() => setView('cards')} />
          <View style={styles.float}>{onlineSwitch}</View>
          <View style={styles.float}>{walletPill}</View>
        </View>
        <Sheet style={{ bottom: TAB_SPACE, maxHeight: '52%' }}>
          <View style={{ gap: 2 }}>
            <T v="h2">{online ? (feed.length ? `${feed.length} request${feed.length > 1 ? 's' : ''} nearby` : 'Waiting for requests') : "You're offline"}</T>
            <T muted>{online ? 'Tap a pickup card to send an offer' : 'Go online to see tow requests'}</T>
          </View>
          {online && feed[0] ? (
            <ScrollView contentContainerStyle={{ gap: 10 }}>{feed.slice(0, 3).map((j) => (
              <Pressable key={j.id} onPress={() => nav.push('OperatorJob', { job: j })} style={styles.mapJob}>
                <View style={styles.vIconSm}><Icon name={VEHICLE_ICON[j.vehicle_type]} size={20} /></View>
                <View style={{ flex: 1 }}>
                  <T v="bodyBold" numberOfLines={1}>{j.vehicle_desc || VEHICLE[j.vehicle_type]}</T>
                  <T v="small" muted>{km(j.pickup_distance_km)} · {PROBLEM[j.problem_type]}</T>
                </View>
                <T v="value">{naira(j.offer_amount)}</T>
              </Pressable>
            ))}</ScrollView>
          ) : !online ? <SlideToConfirm label="Slide to go online" icon="power" endIcon="radio" onConfirm={() => setOnlineTo(true)} loading={busy} disabled={suspended} /> : <Row style={{ justifyContent: 'center' }}><Pulse /></Row>}
        </Sheet>
        <TabBar items={OPERATOR_TABS} active="OperatorHome" onChange={goTab(nav)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen bottomSpace={TAB_SPACE + 10}>
        <StatusBar style="dark" />
        <TopBar left={<RoundBtn name="map" label="Show map" onPress={() => setView('map')} />} middle={onlineSwitch} right={walletPill} />
        <Gap h={6} />
        <Title
          title={`Hi ${firstName(profile?.full_name) || 'there'}!`}
          sub={online ? (feed.length ? `${feed.length} tow request${feed.length > 1 ? 's' : ''} near you` : 'Waiting for tow requests nearby') : 'Go online to receive tow requests'}
        />
        <Gap h={16} />
        <View style={{ gap: 12 }}>
          {warnings}
          {!online ? (
            <Card style={{ gap: 16 }}>
              <Row>
                <View style={styles.vIcon}><Icon name={TRUCK_ICON[operator?.truck_type] || 'mc:tow-truck'} size={30} /></View>
                <View style={{ flex: 1 }}>
                  <T v="h3">{TRUCK[operator?.truck_type] || 'Your truck'}</T>
                  <T v="small" muted>{operator?.truck_plate}</T>
                </View>
                <RatingText avg={profile?.rating_avg} count={profile?.rating_count} />
              </Row>
              <TileRow>
                <Tile tone="soft" icon="check-circle" label="Jobs done" value={String(operator?.jobs_completed || 0)} />
                <Tile tone="soft" icon="credit-card" label="Wallet" value={naira(operator?.wallet_balance)} />
              </TileRow>
              <SlideToConfirm label="Slide to go online" icon="power" endIcon="radio" onConfirm={() => setOnlineTo(true)} loading={busy} disabled={suspended} />
            </Card>
          ) : feed.length ? feed.map(jobCard) : (
            <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Pulse />
              <T v="h3" center>Looking for jobs…</T>
              <T v="small" muted center>Keep the app open. Your phone vibrates when a job comes in.</T>
            </Card>
          )}
        </View>
      </Screen>
      <TabBar items={OPERATOR_TABS} active="OperatorHome" onChange={goTab(nav)} />
    </View>
  );
}

/* =========================================================
   Job detail + bidding (reference: car detail screen)
   ========================================================= */
export function OperatorJob({ params }) {
  const nav = useNav();
  const focused = useFocused();
  const toast = useToast();
  const { uid } = useAuth();
  const j = params.job;
  const [myBid, setMyBid] = useState(j.my_bid_status === 'pending' ? { amount: j.my_bid_amount, status: 'pending' } : null);
  const [status, setStatus] = useState('open');
  const [custom, setCustom] = useState('');
  const [eta, setEta] = useState(etaMinutes(j.pickup_distance_km * 1.3));
  const [busy, setBusy] = useState(null);

  const check = useCallback(async () => {
    if (!myBid) return;
    try {
      const d = await rpc('get_request_detail', { p_request: j.id });
      if (d.operator_id === uid && d.status !== 'open') { Vibration.vibrate([0, 500, 200, 500]); nav.resetTo([['OperatorHome'], ['OperatorActive', { id: j.id }]]); return; }
      setStatus(d.status);
      setMyBid(d.my_bid);
    } catch (e) { /* ignore */ }
  }, [myBid, j.id, uid, nav]);
  useInterval(check, 3000, focused && !!myBid);

  const bid = async (amount) => {
    setBusy(amount);
    try {
      await rpc('place_bid', { p_request: j.id, p_amount: amount, p_eta: eta });
      setMyBid({ amount, status: 'pending' });
      toast.show(amount === Number(j.offer_amount) ? 'Accepted. Waiting for the customer to confirm.' : 'Counter-offer sent');
    } catch (e) { toast.show(e.message, 'error'); }
    setBusy(null);
  };
  const withdraw = async () => {
    try { await rpc('withdraw_bid', { p_request: j.id }); setMyBid(null); toast.show('Offer withdrawn'); } catch (e) { toast.show(e.message, 'error'); }
  };

  const offer = Number(j.offer_amount);
  const lost = (myBid && ['rejected', 'expired', 'withdrawn'].includes(myBid.status)) || (status !== 'open' && myBid);
  const etas = [10, 20, 30, 45, 60];
  const etaPick = etas.reduce((a, b) => (Math.abs(b - eta) < Math.abs(a - eta) ? b : a));

  const footer = lost ? <Btn title="Back to jobs" variant="secondary" onPress={nav.pop} />
    : myBid ? (
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pulse size={10} />
        <T v="bodyBold" style={{ flex: 1 }}>{naira(myBid.amount)} sent. Waiting for the customer…</T>
        <Btn small variant="soft" title="Withdraw" onPress={withdraw} />
      </Card>
    ) : (
      <>
        <Row gap={8}>
          {[2000, 5000, 10000].map((x) => <Btn key={x} small variant="secondary" title={`Counter ${naira(offer + x)}`} onPress={() => bid(offer + x)} loading={busy === offer + x} style={{ flex: 1, paddingHorizontal: 6 }} />)}
        </Row>
        <SlideToConfirm label={`Slide to accept · ${naira(offer)}`} onConfirm={() => bid(offer)} loading={busy === offer} />
      </>
    );

  return (
    <Screen footer={footer}>
      <TopBar onBack={nav.pop} right={<Badge icon="map-pin" text={km(j.pickup_distance_km)} />} />
      <Title title={j.vehicle_desc || VEHICLE[j.vehicle_type]} sub={`${PROBLEM[j.problem_type]} · ${j.ref}`} />
      {lost ? <><Gap h={10} /><Card tone="soft" style={{ backgroundColor: C.white }}><T v="bodyBold">{status !== 'open' ? 'The customer chose another operator.' : 'This offer is no longer active.'}</T></Card></> : null}
      <View style={styles.art}>
        {j.photo_paths?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {j.photo_paths.map((p) => <Image key={p} source={{ uri: publicPhotoUrl(p) }} style={styles.photo} />)}
          </ScrollView>
        ) : (
          <View style={styles.artCircleWrap}>
            <View style={styles.artCircle} />
            <Icon name={VEHICLE_ICON[j.vehicle_type]} size={140} />
          </View>
        )}
      </View>
      <TileRow scroll>
        <Tile icon="₦" label="Offer" value={naira(offer)} />
        <Tile icon="map-pin" label="To pickup" value={km(j.pickup_distance_km)} />
        <Tile icon="navigation" label="Tow" value={km(j.distance_km)} />
        <Tile icon={j.payment_method === 'transfer' ? 'repeat' : 'dollar-sign'} label="Payment" value={j.payment_method === 'transfer' ? 'Transfer' : 'Cash'} />
        <Tile icon="mc:tire" label="Wheels" value={j.wheels_roll ? 'Roll' : 'Locked'} />
        <Tile icon="key" label="Keys" value={j.keys_available ? 'Yes' : 'No'} />
      </TileRow>
      <Gap h={12} />
      <Card style={{ gap: 12 }}>
        <Row>
          <Avatar name={j.customer_name} size={40} />
          <View style={{ flex: 1 }}>
            <T v="bodyBold">{j.customer_name}</T>
            <RatingText avg={j.customer_rating} count={j.customer_rating_count} />
          </View>
        </Row>
        <View style={styles.routeMini}>
          <View style={styles.dotSm} />
          <T v="small" style={{ flex: 1 }} numberOfLines={2}>{j.pickup_address}</T>
        </View>
        <View style={styles.routeMini}>
          <View style={[styles.dotSm, { borderRadius: 3, backgroundColor: C.accent, borderWidth: 1, borderColor: C.ink }]} />
          <T v="small" style={{ flex: 1 }} numberOfLines={2}>{j.dropoff_address}</T>
        </View>
        {j.notes ? <View style={styles.note}><Icon name="message-circle" size={14} /><T v="small" style={{ flex: 1 }}>{j.notes}</T></View> : null}
      </Card>
      {!myBid && !lost ? (
        <>
          <Gap h={14} />
          <T v="label">I can be there in</T>
          <Gap h={8} />
          <Choices options={etas.map((m) => ({ value: m, label: `${m} min` }))} value={etaPick} onChange={setEta} />
          <Gap h={12} />
          <Row gap={8}>
            <View style={styles.customWrap}>
              <T v="bodyBold" muted>₦</T>
              <TextInput value={custom} onChangeText={(t) => setCustom(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="Your own price" placeholderTextColor={C.faint} style={styles.customInput} />
            </View>
            <ArrowBtn dark label="Send your price" icon="send" onPress={() => custom && bid(Number(custom))} loading={busy === Number(custom)} />
          </Row>
        </>
      ) : null}
    </Screen>
  );
}

/* =========================================================
   Active job — navigate, arrive, photos + code, deliver
   ========================================================= */
export function OperatorActive({ params }) {
  const { id } = params;
  const nav = useNav();
  const focused = useFocused();
  const toast = useToast();
  const ins = useSafeAreaInsets();
  const { uid, refresh } = useAuth();
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(null);
  const [code, setCode] = useState('');
  const [pickupPhotos, setPickupPhotos] = useState([]);
  const [dropPhotos, setDropPhotos] = useState([]);
  const [stars, setStars] = useState(0);
  const live = job && ['matched', 'arrived', 'in_progress'].includes(job.status);
  const pos = useOperatorTracking(!!live);

  const load = useCallback(async () => {
    try { setJob(await rpc('get_request_detail', { p_request: id })); } catch (e) { toast.show(e.message, 'error'); }
  }, [id, toast]);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(`op-${id}`, [{ table: 'tow_requests', filter: `id=eq.${id}` }], load, isDemo() ? 3000 : 10000, focused);

  const act = async (key, fn, ok) => {
    setBusy(key);
    try { await fn(); if (ok) toast.show(ok); await load(); } catch (e) { toast.show(e.message, 'error'); }
    setBusy(null);
  };

  const markers = useMemo(() => {
    if (!job) return [];
    const m = [{ id: 'p', kind: 'pickup', lat: job.pickup_lat, lng: job.pickup_lng }, { id: 'd', kind: 'dropoff', lat: job.dropoff_lat, lng: job.dropoff_lng }];
    if (pos) m.push({ id: 'me', kind: 'truck', ...pos });
    return m;
  }, [job, pos]);
  const camera = useMemo(() => {
    if (!job) return null;
    const target = job.status === 'matched' ? [job.pickup_lat, job.pickup_lng] : [job.dropoff_lat, job.dropoff_lng];
    const pts = pos ? [[pos.lat, pos.lng], target] : [[job.pickup_lat, job.pickup_lng], [job.dropoff_lat, job.dropoff_lng]];
    return { id: `${job.status}-${!!pos}`, fit: pts, bottom: 480 };
  }, [job, pos]);

  if (!job) return <Loading text="Loading job…" />;
  const cust = job.customer || {};
  const navTo = (lat, lng) => Linking.openURL(directionsUrl(lat, lng)).catch(() => toast.show('Could not open maps', 'error'));
  const call = () => cust.phone && Linking.openURL(`tel:${cust.phone}`).catch(() => toast.show(cust.phone));
  const cancel = () => Alert.alert('Cancel this job?', 'The customer goes back to choosing another operator. Cancellations affect your standing.', [
    { text: 'Keep job', style: 'cancel' },
    { text: 'Truck problem', onPress: () => act('cancel', () => rpc('cancel_request', { p_request: id, p_reason: 'Truck problem' })).then(() => nav.reset('OperatorHome')) },
    { text: 'Customer unreachable', style: 'destructive', onPress: () => act('cancel', () => rpc('cancel_request', { p_request: id, p_reason: 'Customer unreachable' })).then(() => nav.reset('OperatorHome')) },
  ]);
  const done = () => { refresh(); nav.reset('OperatorHome'); };

  const header = (title, sub) => (
    <Row style={{ alignItems: 'flex-start' }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="h2">{title}</T>
        {sub ? <T muted numberOfLines={2}>{sub}</T> : null}
      </View>
      {cust.phone && live ? <RoundBtn name="phone" label="Call customer" active onPress={call} /> : null}
    </Row>
  );
  const stats = (
    <TileRow>
      <Tile tone="soft" icon="user" label="Customer" value={firstName(cust.name)} />
      <Tile tone="soft" icon="₦" label="Price" value={naira(job.final_price)} />
      <Tile tone="soft" icon={job.payment_method === 'transfer' ? 'repeat' : 'dollar-sign'} label="Pay" value={job.payment_method === 'transfer' ? 'Transfer' : 'Cash'} />
    </TileRow>
  );

  let content;
  if (job.status === 'matched') {
    content = (<>
      {header('Head to pickup', job.pickup_address)}
      {stats}
      <Row gap={10}>
        <Btn title="Navigate" icon="navigation" variant="dark" onPress={() => navTo(job.pickup_lat, job.pickup_lng)} style={{ flex: 1 }} />
        <RoundBtn name="x" label="Cancel job" onPress={cancel} size={56} style={{ backgroundColor: C.soft }} />
      </Row>
      <SlideToConfirm label="Slide when you arrive" icon="map-pin" endIcon="flag" onConfirm={() => act('arrive', () => rpc('mark_arrived', { p_request: id }), 'Customer notified')} loading={busy === 'arrive'} />
    </>);
  } else if (job.status === 'arrived') {
    const uploading = pickupPhotos.some((p) => p.uploading);
    content = (<>
      {header('Inspect and photograph', 'Photos of the vehicle protect you if there is a damage claim')}
      <PhotoPicker items={pickupPhotos} setItems={setPickupPhotos} uid={uid} max={4} cameraOnly label="Condition photo" onError={(m) => toast.show(m, 'error')} tileSize={78} />
      <View style={{ gap: 8 }}>
        <T v="label">Customer's 4-digit start code</T>
        <TextInput value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} placeholder="• • • •" placeholderTextColor={C.faint} style={styles.codeInput} accessibilityLabel="Start code" />
      </View>
      <SlideToConfirm label="Slide to start the tow" icon="lock" endIcon="mc:tow-truck" disabled={code.length !== 4 || !pickupPhotos.length || uploading} loading={busy === 'start'}
        onConfirm={() => act('start', () => rpc('start_job', { p_request: id, p_code: code, p_photos: pickupPhotos.map((p) => p.path) }), 'Tow started')} />
      <Btn small variant="ghost" title="Cancel job" onPress={cancel} />
    </>);
  } else if (job.status === 'in_progress') {
    const uploading = dropPhotos.some((p) => p.uploading);
    content = (<>
      {header('Tow to drop-off', job.dropoff_address)}
      <Btn title="Navigate to drop-off" icon="navigation" variant="dark" onPress={() => navTo(job.dropoff_lat, job.dropoff_lng)} />
      <T v="label">Photo at drop-off</T>
      <PhotoPicker items={dropPhotos} setItems={setDropPhotos} uid={uid} max={3} cameraOnly label="Drop-off photo" onError={(m) => toast.show(m, 'error')} tileSize={78} />
      <SlideToConfirm label="Slide when delivered" icon="flag" endIcon="check" disabled={!dropPhotos.length || uploading} loading={busy === 'deliver'}
        onConfirm={() => act('deliver', () => rpc('mark_delivered', { p_request: id, p_photos: dropPhotos.map((p) => p.path) }), 'Customer asked to confirm')} />
      <Btn small variant="ghost" title="Report a problem" onPress={() => nav.push('Report', { id, role: 'operator' })} />
    </>);
  } else if (job.status === 'delivered') {
    content = (<>
      {header(`Collect ${naira(job.final_price)}`, `Get paid by ${job.payment_method === 'transfer' ? 'bank transfer' : 'cash'}. The job completes when the customer confirms.`)}
      {stats}
      <Btn small variant="soft" title="Customer didn't pay? Report it" icon="flag" onPress={() => nav.push('Report', { id, role: 'operator' })} />
      <Btn title="Back to jobs" variant="dark" onPress={done} />
    </>);
  } else if (job.status === 'completed') {
    content = (<>
      <Row>
        <View style={styles.doneIcon}><Icon name="check" size={22} /></View>
        <View style={{ flex: 1 }}><T v="h2">Job completed</T><T muted>{shortDate(job.completed_at)}</T></View>
      </Row>
      <TileRow>
        <Tile tone="soft" icon="₦" label="You earned" value={naira(job.final_price)} />
        <Tile tone="soft" icon="percent" label="Commission" value={`− ${naira(job.commission_amount)}`} />
      </TileRow>
      {job.my_rating ? <T muted center>You rated {firstName(cust.name)} {job.my_rating} ★.</T> : (
        <View style={{ gap: 10 }}>
          <T v="h3" center>Rate {firstName(cust.name)}</T>
          <Stars value={stars} onChange={setStars} size={26} />
          <Btn title="Submit rating" disabled={!stars} loading={busy === 'rate'} onPress={() => act('rate', () => rpc('rate_job', { p_request: id, p_stars: stars }), 'Thanks')} />
        </View>
      )}
      <Btn title="Back to jobs" variant="dark" onPress={done} />
    </>);
  } else {
    content = (<>
      {header(STATUS[job.status], job.cancel_reason || 'This job is closed.')}
      <Btn title="Back to jobs" onPress={done} />
    </>);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TowMap markers={markers} route={[[job.pickup_lat, job.pickup_lng], [job.dropoff_lat, job.dropoff_lng]]} camera={camera} />
      <View style={[styles.floatTop, { top: ins.top + 10 }]}>
        <RoundBtn name="arrow-left" label="Back" float onPress={() => (nav.canGoBack() ? nav.pop() : nav.reset('OperatorHome'))} />
        <View style={[styles.refPill, styles.float]}><T v="label" numberOfLines={1}>{job.ref} · {STATUS[job.status]}</T></View>
        <RoundBtn name="refresh-cw" label="Refresh" float onPress={load} />
      </View>
      <Sheet style={{ maxHeight: '72%' }}>
        <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{content}</ScrollView>
      </Sheet>
    </View>
  );
}

/* =========================================================
   Wallet — balance, bank top-up with receipt, history
   ========================================================= */
export function Wallet({ params }) {
  const nav = useNav();
  const toast = useToast();
  const { uid, operator, settings, refresh } = useAuth();
  const [tx, setTx] = useState([]);
  const [pending, setPending] = useState(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState(null);
  const [busy, setBusy] = useState(false);
  const tab = !!params.tab;

  const load = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([
        select(supabase.from('wallet_transactions').select('*').eq('operator_id', uid).order('created_at', { ascending: false }).limit(30)),
        select(supabase.from('topup_requests').select('*').eq('operator_id', uid).order('created_at', { ascending: false }).limit(1)),
      ]);
      setTx(t); setPending(p[0] && p[0].status === 'pending' ? p[0] : null);
      refresh();
    } catch (e) { /* ignore */ }
  }, [uid, refresh]);
  useEffect(() => { load(); }, []);
  useInterval(load, isDemo() ? 3000 : 20000, !!pending);

  const attach = async () => {
    try {
      const uri = await takeOrPick('library');
      if (!uri) return;
      setBusy(true);
      setProof({ uri, path: await uploadPhoto(uri, 'topup-proofs', uid) });
    } catch (e) { toast.show(e.message, 'error'); }
    setBusy(false);
  };
  const submit = async () => {
    setBusy(true);
    try {
      await rpc('request_topup', { p_amount: Number(amount), p_reference: reference, p_proof_path: proof?.path || null });
      toast.show('Top-up sent for approval');
      setAmount(''); setReference(''); setProof(null);
      await load();
    } catch (e) { toast.show(e.message, 'error'); }
    setBusy(false);
  };
  const copy = async (text) => {
    try { await Clipboard.setStringAsync(text); toast.show('Account number copied'); } catch (e) { toast.show(text); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen bottomSpace={tab ? TAB_SPACE + 10 : 24}>
        <TopBar onBack={tab ? null : nav.pop} title="Wallet" sub={`Commission is ${settings?.commission_pct ?? 10}% of each completed job`} />
        <Card tone="dark" style={{ gap: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="small" color="#B5B5B5">Balance</T>
            <View style={styles.darkBadge}><Icon name="credit-card" size={13} color={C.white} /><T v="tiny" color={C.white}>Townaija wallet</T></View>
          </Row>
          <T v="display" color={C.white} style={{ fontSize: 40, lineHeight: 46 }}>{naira(operator?.wallet_balance)}</T>
          <Row gap={8}>
            <View style={styles.darkTile}><T v="tiny" color="#B5B5B5">Minimum</T><T v="bodyBold" color={C.white}>{naira(settings?.min_wallet_balance ?? 1000)}</T></View>
            <View style={styles.darkTile}><T v="tiny" color="#B5B5B5">Jobs done</T><T v="bodyBold" color={C.white}>{operator?.jobs_completed || 0}</T></View>
          </Row>
        </Card>
        <Gap h={20} />
        <T v="h3">Top up</T>
        <Gap h={10} />
        {pending ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pulse size={10} />
            <View style={{ flex: 1 }}>
              <T v="bodyBold">{naira(pending.amount)} waiting for approval</T>
              <T v="small" muted>Sent {ago(pending.created_at)}. You'll be notified when it's credited.</T>
            </View>
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            <Card style={{ gap: 6 }}>
              <T v="small" muted>1 · Transfer to</T>
              {settings?.bank_account_number ? (
                <Row>
                  <View style={{ flex: 1 }}>
                    <T v="h2">{settings.bank_account_number}</T>
                    <T muted>{settings.bank_name} · {settings.bank_account_name}</T>
                  </View>
                  <RoundBtn name="copy" label="Copy account number" onPress={() => copy(settings.bank_account_number)} style={{ backgroundColor: C.soft }} />
                </Row>
              ) : <T>Bank details coming soon. Contact support{settings?.support_phone ? ` on ${settings.support_phone}` : ''}.</T>}
            </Card>
            <Field label="2 · Amount you sent" icon="dollar-sign" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="5000" />
            <Field label="3 · Transfer reference or sender name" icon="file-text" value={reference} onChangeText={setReference} placeholder="e.g. Musa Bello / GTB 0042" />
            <Pressable onPress={attach} style={styles.receipt} accessibilityRole="button">
              <View style={[styles.truckIcon, proof && { backgroundColor: C.accent }]}><Icon name={proof ? 'check' : 'paperclip'} size={16} /></View>
              <T v="bodyBold" style={{ flex: 1 }}>{proof ? 'Receipt attached' : '4 · Attach receipt (recommended)'}</T>
              <Icon name="chevron-right" color={C.faint} />
            </Pressable>
            <Btn title="Send for approval" onPress={submit} disabled={!amount || Number(amount) < 500} loading={busy} icon="send" />
          </View>
        )}
        <Gap h={22} />
        <T v="h3">History</T>
        <Gap h={10} />
        {tx.length ? (
          <Card style={{ gap: 0, paddingVertical: 6 }}>
            {tx.map((t, i) => (
              <Row key={t.id} style={[styles.txRow, i === tx.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[styles.truckIcon, t.amount > 0 && { backgroundColor: C.accent }]}><Icon name={t.amount < 0 ? 'arrow-up-right' : 'arrow-down-left'} size={16} /></View>
                <View style={{ flex: 1 }}>
                  <T v="bodyBold">{{ topup: 'Top-up', commission: 'Commission', adjustment: 'Adjustment', refund: 'Refund' }[t.kind]}</T>
                  <T v="small" muted numberOfLines={1}>{t.note} · {shortDate(t.created_at)}</T>
                </View>
                <T v="value" color={t.amount < 0 ? C.ink : C.green}>{t.amount < 0 ? '−' : '+'}{naira(Math.abs(t.amount))}</T>
              </Row>
            ))}
          </Card>
        ) : <Empty icon="credit-card" title="No transactions yet" />}
      </Screen>
      {tab ? <TabBar items={OPERATOR_TABS} active="Wallet" onChange={goTab(nav)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  floatTop: { position: 'absolute', left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  float: { elevation: 5, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, borderRadius: R.pill },
  modePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, borderRadius: R.pill, paddingHorizontal: 14, height: 48 },
  walletPill: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: C.white, borderRadius: R.pill, paddingHorizontal: 14, height: 48 },
  truckOpt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: R.tile, backgroundColor: C.white },
  truckIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: C.faint, alignItems: 'center', justifyContent: 'center' },
  bigIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  vIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  vIconSm: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  mapJob: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.soft, borderRadius: R.tile, padding: 12 },
  art: { height: 230, marginVertical: 14, justifyContent: 'center' },
  artCircleWrap: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  artCircle: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: C.white },
  photo: { width: 280, height: 220, borderRadius: R.card, backgroundColor: C.white },
  routeMini: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dotSm: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.ink },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: C.soft, borderRadius: R.sm, padding: 12 },
  customWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: 52, borderRadius: R.pill, backgroundColor: C.white, paddingHorizontal: 18 },
  customInput: { flex: 1, fontFamily: F.semi, fontSize: 16, color: C.ink },
  codeInput: { height: 64, borderRadius: R.tile, backgroundColor: C.soft, textAlign: 'center', fontFamily: F.bold, fontSize: 30, letterSpacing: 16, color: C.ink },
  doneIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  refPill: { flex: 1, backgroundColor: C.white, paddingHorizontal: 16, height: 48, justifyContent: 'center', alignItems: 'center' },
  darkBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: R.pill, borderWidth: 1, borderColor: '#3A3A3A', paddingHorizontal: 10, height: 28 },
  darkTile: { flex: 1, backgroundColor: '#242424', borderRadius: 18, padding: 12, gap: 2 },
  receipt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.tile, backgroundColor: C.white },
  txRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
});
