import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, Image, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../auth';
import { useFocused, useInterval, useNav } from '../nav';
import { rpc, publicPhotoUrl, supabase, isDemo } from '../supabase';
import { currentPosition, distanceKm, reverseGeocode, searchPlaces } from '../geo';
import { useLiveRefresh } from '../hooks';
import { C, F, R } from '../theme';
import { naira, km, PROBLEM, PROBLEM_ICON, STATUS, TRUCK, TRUCK_ICON, VEHICLE, VEHICLE_ICON, firstName, minutesLeft, etaMinutes } from '../format';
import TowMap from '../components/TowMap';
import PhotoPicker from '../components/PhotoPicker';
import {
  ArrowBtn, Avatar, Badge, Btn, Card, Chip, Choices, Dots, Empty, Field, Gap, Icon, Loading, OptionTiles, Pulse,
  RatingText, RoundBtn, Row, Screen, Segmented, Sheet, SlideToConfirm, Stars, T, TabBar, TAB_SPACE, Tile, TileRow, Title, ToggleRow, TopBar, useToast,
} from '../ui';
import { DEFAULT_CENTER } from '../config';
import { CUSTOMER_TABS, OPERATOR_TABS } from '../tabs';

const FALLBACK_FROM = { car: 20000, suv: 25000, van_bus: 25000, truck: 80000 };
const TRUCKS_FOR = { car: ['wheel_lift', 'flatbed'], suv: ['flatbed'], van_bus: ['flatbed'], truck: ['heavy_duty'] };
const VEHICLE_NOTE = { car: 'Saloon, hatchback, coupé', suv: 'Jeeps, 4×4s and crossovers', van_bus: 'Hiace, Sienna, minibuses', truck: 'Lorries, tippers, tankers' };

/* =========================================================
   Home — "Welcome! Choose your vehicle" carousel, or the map
   ========================================================= */
export function CustomerHome() {
  const nav = useNav();
  const focused = useFocused();
  const { profile } = useAuth();
  const toast = useToast();
  const ins = useSafeAreaInsets();
  const [view, setView] = useState('cards');
  const [me, setMe] = useState(null);
  const [addr, setAddr] = useState('Finding your location…');
  const [active, setActive] = useState(null);
  const [from, setFrom] = useState(FALLBACK_FROM);
  const [slide, setSlide] = useState(0);
  const cardW = Dimensions.get('window').width - 36 - 56;

  const locate = useCallback(async () => {
    try {
      const p = await currentPosition();
      setMe(p);
      setAddr(await reverseGeocode(p.lat, p.lng));
    } catch (e) {
      setAddr('Set your pickup point');
      toast.show(e.message, 'error');
    }
  }, [toast]);

  const loadActive = useCallback(async () => {
    try {
      const id = await rpc('my_active_request');
      setActive(id ? await rpc('get_request_detail', { p_request: id }) : null);
    } catch (e) { /* offline: keep last */ }
  }, []);

  useEffect(() => {
    locate();
    supabase.from('pricing_rates').select('*').then(({ data }) => {
      if (!data || !data.length) return;
      const min = Object.fromEntries(data.map((r) => [r.truck_type, Number(r.min_fare)]));
      setFrom(Object.fromEntries(Object.keys(TRUCKS_FOR).map((v) => [v, Math.min(...TRUCKS_FOR[v].map((t) => min[t] || Infinity))])));
    }, () => {});
  }, [locate]);
  useEffect(() => { if (focused) loadActive(); }, [focused, loadActive]);
  useInterval(loadActive, 12000, focused);

  const pickup = me ? { ...me, address: addr } : null;
  const start = (vehicle) => nav.push('NewRequest', { pickup, vehicle });
  const camera = useMemo(() => (me ? { id: `me-${me.lat.toFixed(4)}-${view}`, lat: me.lat, lng: me.lng, zoom: 15 } : { id: 'default', ...DEFAULT_CENTER, zoom: 12 }), [me, view]);
  const markers = useMemo(() => (me ? [{ id: 'me', kind: 'me', ...me }] : []), [me]);
  const toggle = <Segmented value={view} onChange={setView} options={[{ value: 'cards', icon: 'layers', label: 'Vehicle cards' }, { value: 'map', icon: 'map', label: 'Map' }]} />;

  const activeCard = active ? (
    <Card onPress={() => nav.push('RequestLive', { id: active.id })} style={{ gap: 14 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Badge icon="activity" text={`Your tow · ${active.ref}`} />
        <ArrowBtn label="Open your tow" onPress={() => nav.push('RequestLive', { id: active.id })} />
      </Row>
      <View style={{ gap: 2 }}>
        <T v="h2">{STATUS[active.status]}</T>
        <T muted numberOfLines={1}>{active.pickup_address} → {active.dropoff_address}</T>
      </View>
      <TileRow>
        <Tile tone="soft" icon="₦" label={active.final_price ? 'Agreed' : 'Offer'} value={naira(active.final_price || active.offer_amount)} />
        <Tile tone="soft" icon="navigation" label="Distance" value={km(active.distance_km)} />
      </TileRow>
    </Card>
  ) : null;

  if (view === 'map') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar style="dark" />
        <TowMap markers={markers} camera={camera} />
        <View style={[styles.floatTop, { top: ins.top + 10 }]}>
          <RoundBtn name="search" label="Search pickup" float onPress={() => start(null)} />
          <View style={styles.float}>{toggle}</View>
          <RoundBtn name="crosshair" label="My location" float onPress={locate} />
        </View>
        <Sheet style={{ bottom: 10 + TAB_SPACE - 10 }}>
          {activeCard || (
            <>
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="h2">Your location</T>
                  <T muted numberOfLines={2}>{addr}</T>
                </View>
                <Badge icon="map-pin" text="Pickup" />
              </Row>
              <TileRow>
                <Tile tone="soft" icon="clock" label="Offers in" value="~3 min" />
                <Tile tone="soft" icon="shield" label="Operators" value="Verified" />
                <Tile tone="soft" icon="₦" label="Pay" value="On delivery" />
              </TileRow>
              <SlideToConfirm label="Slide to request a tow" onConfirm={() => start(null)} endIcon="arrow-up-right" />
            </>
          )}
        </Sheet>
        <TabBar items={CUSTOMER_TABS} active="CustomerHome" onChange={(k) => nav.reset(k, { tab: true })} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen bottomSpace={TAB_SPACE + 10}>
        <StatusBar style="dark" />
        <TopBar
          left={<RoundBtn name="search" label="Request a tow" onPress={() => start(null)} />}
          middle={toggle}
          right={<RoundBtn name="bell" label="Notifications" onPress={() => nav.push('Notifications')} />}
        />
        <Gap h={8} />
        <Title title={`Welcome${profile?.full_name ? `, ${firstName(profile.full_name)}` : ''}!`} sub={active ? 'Your tow is in progress' : 'Choose your vehicle'} />
        <Gap h={16} />
        {activeCard || (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={cardW + 12}
              decelerationRate="fast"
              onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / (cardW + 12)))}
              style={{ marginHorizontal: -18 }}
              contentContainerStyle={{ paddingHorizontal: 18, gap: 12 }}
            >
              {Object.keys(VEHICLE).map((v) => (
                <Pressable key={v} onPress={() => start(v)} style={[styles.vCard, { width: cardW }]} accessibilityRole="button" accessibilityLabel={`Tow a ${VEHICLE[v]}`}>
                  <Row gap={8}>
                    <Badge icon="tag" text={`from ${naira(from[v])}`} />
                    <Badge icon="mc:tow-truck" text={TRUCKS_FOR[v].map((t) => TRUCK[t]).join(' / ')} />
                  </Row>
                  <View style={styles.vArt}>
                    <View style={styles.vCircle} />
                    <Icon name={VEHICLE_ICON[v]} size={128} color={C.ink} />
                  </View>
                  <View style={styles.vFoot}>
                    <View style={{ flex: 1 }}>
                      <T v="h3" color={C.white}>{VEHICLE[v]}</T>
                      <T v="small" color="#C9C9C9" numberOfLines={1}>{VEHICLE_NOTE[v]}</T>
                    </View>
                    <ArrowBtn label={`Request a tow for a ${VEHICLE[v]}`} onPress={() => start(v)} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <Gap h={14} />
            <Dots count={4} index={slide} />
          </>
        )}
        <Gap h={18} />
        <Card style={{ gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T v="tiny" muted>Pickup</T>
              <T v="bodyBold" numberOfLines={1}>{addr}</T>
            </View>
            <RoundBtn name="crosshair" label="Refresh my location" onPress={locate} style={{ backgroundColor: C.soft }} />
          </Row>
        </Card>
        <Gap h={12} />
        <TileRow>
          <Tile icon="shield" label="Operators" value="Verified" />
          <Tile icon="lock" label="Start code" value="You hold it" />
          <Tile icon="₦" label="You pay" value="On delivery" />
        </TileRow>
      </Screen>
      <TabBar items={CUSTOMER_TABS} active="CustomerHome" onChange={(k) => nav.reset(k, { tab: true })} />
    </View>
  );
}

/* =========================================================
   Pick a location — search or drag the map under a fixed pin
   ========================================================= */
export function PickLocation({ params }) {
  const nav = useNav();
  const ins = useSafeAreaInsets();
  const toast = useToast();
  const start = params.initial || DEFAULT_CENTER;
  const [center, setCenter] = useState(start);
  const [address, setAddress] = useState(params.initial?.address || '');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [cam, setCam] = useState({ id: 'start', lat: start.lat, lng: start.lng, zoom: 16 });
  const [resolving, setResolving] = useState(false);
  const centerRef = useRef(center);
  centerRef.current = center;

  useEffect(() => {
    if (q.trim().length < 3) { setResults([]); return undefined; }
    const t = setTimeout(() => { searchPlaces(q, centerRef.current).then(setResults, () => setResults([])); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(async () => {
      setResolving(true);
      setAddress(await reverseGeocode(center.lat, center.lng));
      setResolving(false);
    }, 500);
    return () => clearTimeout(t);
  }, [center]);

  const choose = (r) => {
    setResults([]); setQ('');
    setCam({ id: r.id, lat: r.lat, lng: r.lng, zoom: 16 });
    setCenter({ lat: r.lat, lng: r.lng });
    setAddress([r.title, r.subtitle].filter(Boolean).join(', '));
  };
  const useMine = async () => {
    try { const p = await currentPosition(); setCam({ id: `me${Date.now()}`, ...p, zoom: 17 }); setCenter(p); } catch (e) { toast.show(e.message, 'error'); }
  };
  const confirm = () => { params.onPick && params.onPick({ ...center, address }); nav.pop(); };
  const isPickup = params.kind === 'pickup';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TowMap camera={cam} onCenter={(c) => setCenter({ lat: c.lat, lng: c.lng })} />
      <View pointerEvents="none" style={styles.centerPin}>
        <View style={[styles.pinHead, !isPickup && { backgroundColor: C.accent }]}>
          <Icon name={isPickup ? 'mc:car-side' : 'flag'} size={isPickup ? 18 : 16} />
        </View>
        <View style={styles.pinStem} />
      </View>
      <View style={[styles.searchWrap, { paddingTop: ins.top + 10 }]}>
        <Row gap={10}>
          <RoundBtn name="arrow-left" label="Back" float onPress={nav.pop} />
          <View style={[styles.searchBox, styles.float]}>
            <Icon name="search" size={18} color={C.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder={isPickup ? 'Search pickup place' : 'Mechanic, street or area'} placeholderTextColor={C.faint} style={styles.searchInput} autoFocus={!isPickup} />
          </View>
        </Row>
        {results.length ? (
          <View style={[styles.results, styles.float]}>
            {results.map((r) => (
              <Pressable key={r.id} onPress={() => choose(r)} style={styles.resultRow}>
                <View style={styles.resultIcon}><Icon name="map-pin" size={16} /></View>
                <View style={{ flex: 1 }}>
                  <T v="bodyBold" numberOfLines={1}>{r.title}</T>
                  {r.subtitle ? <T v="small" muted numberOfLines={1}>{r.subtitle}</T> : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <Sheet>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="small" muted>{isPickup ? 'Pickup · where the vehicle is' : 'Drop-off · where it should go'}</T>
            <T v="h3" numberOfLines={2}>{resolving ? 'Finding address…' : address || 'Move the map to place the pin'}</T>
          </View>
          {isPickup ? <RoundBtn name="crosshair" label="Use my location" onPress={useMine} style={{ backgroundColor: C.soft }} /> : null}
        </Row>
        <Btn title={isPickup ? 'Confirm pickup' : 'Confirm drop-off'} onPress={confirm} disabled={resolving} />
      </Sheet>
    </View>
  );
}

/* =========================================================
   New request — 3 steps: route → vehicle → offer
   ========================================================= */
const VEHICLE_OPTIONS = Object.keys(VEHICLE).map((k) => ({ value: k, label: VEHICLE[k], icon: VEHICLE_ICON[k] }));
const PROBLEM_OPTIONS = Object.keys(PROBLEM).map((k) => ({ value: k, label: PROBLEM[k], icon: PROBLEM_ICON[k] }));

export function NewRequest({ params }) {
  const nav = useNav();
  const toast = useToast();
  const { uid } = useAuth();
  const [step, setStep] = useState(1);
  const [pickup, setPickup] = useState(params.pickup || null);
  const [dropoff, setDropoff] = useState(null);
  const [v, setV] = useState({ vehicle_type: params.vehicle || 'car', vehicle_desc: '', problem_type: 'breakdown', wheels_roll: true, keys_available: true, notes: '' });
  const [photos, setPhotos] = useState([]);
  const [est, setEst] = useState(null);
  const [offer, setOffer] = useState(0);
  const [payment, setPayment] = useState('cash');
  const [busy, setBusy] = useState(false);

  const set = (k, val) => setV((cur) => ({ ...cur, [k]: val }));
  const pick = (kind) => nav.push('PickLocation', { kind, initial: kind === 'pickup' ? pickup : dropoff || pickup, onPick: kind === 'pickup' ? setPickup : setDropoff });

  const estimate = useCallback(async () => {
    const e = await rpc('estimate_fare', {
      p_pickup_lat: pickup.lat, p_pickup_lng: pickup.lng, p_dropoff_lat: dropoff.lat, p_dropoff_lng: dropoff.lng,
      p_vehicle_type: v.vehicle_type, p_wheels_roll: v.wheels_roll,
    });
    setEst(e);
    return e;
  }, [pickup, dropoff, v.vehicle_type, v.wheels_roll]);

  const next = async () => {
    try {
      if (step === 1) {
        if (!pickup || !dropoff) { toast.show('Set both pickup and drop-off.', 'error'); return; }
        setBusy(true);
        const e = await estimate();
        setBusy(false);
        if (!e.in_service) { toast.show('Townaija is not available in this area yet. We are live in Abuja.', 'error'); return; }
        setStep(2);
      } else if (step === 2) {
        if (photos.some((p) => p.uploading)) { toast.show('Wait for photos to finish uploading.', 'error'); return; }
        setBusy(true);
        const e = await estimate();
        setOffer(e.recommended_fare);
        setBusy(false);
        setStep(3);
      }
    } catch (e) {
      setBusy(false);
      toast.show(e.message, 'error');
    }
  };
  const submit = async () => {
    if (offer < est.fare_floor) { toast.show(`Lowest offer for this trip is ${naira(est.fare_floor)}.`, 'error'); return; }
    setBusy(true);
    try {
      const id = await rpc('create_tow_request', {
        p: {
          pickup_lat: pickup.lat, pickup_lng: pickup.lng, pickup_address: pickup.address || '',
          dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng, dropoff_address: dropoff.address || '',
          ...v, photo_paths: photos.filter((p) => p.path).map((p) => p.path), offer_amount: offer, payment_method: payment,
        },
      });
      nav.resetTo([['CustomerHome'], ['RequestLive', { id }]]);
    } catch (e) {
      setBusy(false);
      toast.show(e.message, 'error');
    }
  };
  const back = () => (step > 1 ? setStep(step - 1) : nav.pop());
  const titles = { 1: ['Where to?', 'Set the pickup and drop-off'], 2: ['Your vehicle', 'Help operators send the right truck'], 3: ['Name your price', 'Operators accept it or counter'] };

  const footer = step < 3
    ? <Btn title="Continue" onPress={next} loading={busy} icon="arrow-right" />
    : <SlideToConfirm label={`Slide to request · ${naira(offer)}`} onConfirm={submit} loading={busy} disabled={!est || offer < est.fare_floor} endIcon="arrow-up-right" />;

  return (
    <Screen footer={footer}>
      <TopBar onBack={back} middle={<Badge text={`Step ${step} of 3`} />} title={titles[step][0]} sub={titles[step][1]} />
      <View style={styles.progress}>{[1, 2, 3].map((n) => <View key={n} style={[styles.progressBar, n <= step && { backgroundColor: C.ink }]} />)}</View>

      {step === 1 ? (
        <View style={{ gap: 12 }}>
          <Card style={{ gap: 0, paddingVertical: 8 }}>
            <Pressable style={styles.routeRow} onPress={() => pick('pickup')} accessibilityRole="button">
              <View style={styles.routeDot} />
              <View style={{ flex: 1 }}>
                <T v="small" muted>Pickup · vehicle location</T>
                <T v="bodyBold" numberOfLines={1}>{pickup?.address || 'Set pickup point'}</T>
              </View>
              <Icon name="chevron-right" color={C.faint} />
            </Pressable>
            <View style={styles.routeLine} />
            <Pressable style={styles.routeRow} onPress={() => pick('dropoff')} accessibilityRole="button">
              <View style={styles.routeFlag}><Icon name="flag" size={12} /></View>
              <View style={{ flex: 1 }}>
                <T v="small" muted>Drop-off</T>
                <T v="bodyBold" numberOfLines={1}>{dropoff?.address || 'Where should it go?'}</T>
              </View>
              <Icon name="chevron-right" color={C.faint} />
            </Pressable>
          </Card>
          <Card tone="soft" style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.white }}>
            <View style={styles.tipIcon}><Icon name="info" size={16} /></View>
            <T v="small" muted style={{ flex: 1 }}>Choose your mechanic's workshop, your home or a safe car park.</T>
          </Card>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: 20 }}>
          <View style={{ gap: 10 }}><T v="label">Vehicle type</T><OptionTiles options={VEHICLE_OPTIONS} value={v.vehicle_type} onChange={(x) => set('vehicle_type', x)} /></View>
          <Field label="Make and model" icon="edit-2" value={v.vehicle_desc} onChangeText={(x) => set('vehicle_desc', x)} placeholder="e.g. Toyota Corolla 2012, black" />
          <View style={{ gap: 10 }}><T v="label">What happened?</T><Choices options={PROBLEM_OPTIONS} value={v.problem_type} onChange={(x) => set('problem_type', x)} /></View>
          <Card style={{ gap: 0, paddingVertical: 8 }}>
            <ToggleRow icon="mc:tire" label="Can the wheels roll?" hint="If not, only flatbed trucks are sent." value={v.wheels_roll} onValueChange={(x) => set('wheels_roll', x)} />
            <ToggleRow icon="key" label="Keys available?" value={v.keys_available} onValueChange={(x) => set('keys_available', x)} />
          </Card>
          <View style={{ gap: 10 }}>
            <T v="label">Photos of the vehicle</T>
            <PhotoPicker items={photos} setItems={setPhotos} uid={uid} max={3} onError={(m) => toast.show(m, 'error')} />
            <T v="small" muted>Operators quote faster with photos.</T>
          </View>
          <Field label="Note for the operator (optional)" icon="message-circle" value={v.notes} onChangeText={(x) => set('notes', x)} placeholder="e.g. Parked by the Total filling station" multiline inputStyle={{ minHeight: 72, textAlignVertical: 'top' }} />
        </View>
      ) : null}

      {step === 3 && est ? (
        <View style={{ gap: 14 }}>
          <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 22 }}>
            <T v="small" muted>Your offer</T>
            <Row gap={14}>
              <RoundBtn name="minus" label="Lower offer by 1,000" style={{ backgroundColor: C.soft }} onPress={() => setOffer((o) => Math.max(est.fare_floor, o - 1000))} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T v="display" style={{ fontSize: 36 }}>₦</T>
                <TextInput
                  value={offer ? Math.round(offer).toLocaleString('en-NG') : ''}
                  onChangeText={(t) => setOffer(Number(t.replace(/\D/g, '')) || 0)}
                  keyboardType="number-pad"
                  style={styles.offerInput}
                  accessibilityLabel="Your offer in naira"
                />
              </View>
              <RoundBtn name="plus" label="Raise offer by 1,000" active onPress={() => setOffer((o) => o + 1000)} />
            </Row>
            <T v="small" color={offer < est.fare_floor ? C.red : C.muted} center>
              {offer < est.fare_floor ? `Too low. Minimum is ${naira(est.fare_floor)}` : offer < est.range_low ? 'Below the usual price. Operators may counter.' : 'A fair offer gets accepted faster.'}
            </T>
          </Card>
          <TileRow scroll>
            <Tile icon="navigation" label="Distance" value={km(est.distance_km)} />
            <Tile icon="mc:tow-truck" label="Truck" value={(est.truck_types || []).map((t) => TRUCK[t]).slice(0, 2).join(' / ')} />
            <Tile icon="trending-up" label="Usual price" value={`${naira(est.range_low)}+`} />
            <Tile icon={VEHICLE_ICON[v.vehicle_type]} label="Vehicle" value={VEHICLE[v.vehicle_type]} />
          </TileRow>
          <View style={{ gap: 10 }}>
            <T v="label">Pay the operator by</T>
            <Choices options={[{ value: 'cash', label: 'Cash', icon: 'dollar-sign' }, { value: 'transfer', label: 'Bank transfer', icon: 'repeat' }]} value={payment} onChange={setPayment} />
          </View>
          <T v="small" muted>You only pay after your vehicle is delivered.</T>
        </View>
      ) : null}
    </Screen>
  );
}

/* =========================================================
   Live request — offers, tracking, start code, delivery, rating
   ========================================================= */
export function RequestLive({ params }) {
  const { id } = params;
  const nav = useNav();
  const focused = useFocused();
  const toast = useToast();
  const ins = useSafeAreaInsets();
  const [job, setJob] = useState(null);
  const [bids, setBids] = useState([]);
  const [busy, setBusy] = useState(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await rpc('get_request_detail', { p_request: id });
      setJob(d);
      setBids(d.status === 'open' ? await rpc('get_request_bids', { p_request: id }) : []);
      setError(null);
    } catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(`req-${id}`, [
    { table: 'tow_requests', filter: `id=eq.${id}` },
    { table: 'bids', filter: `request_id=eq.${id}` },
    { table: 'job_tracking', filter: `request_id=eq.${id}` },
  ], load, isDemo() ? 3000 : 8000, focused);

  const act = async (key, fn, okMsg) => {
    setBusy(key);
    try { await fn(); if (okMsg) toast.show(okMsg); await load(); } catch (e) { toast.show(e.message, 'error'); }
    setBusy(null);
  };

  const markers = useMemo(() => {
    if (!job) return [];
    const m = [{ id: 'p', kind: 'pickup', lat: job.pickup_lat, lng: job.pickup_lng }, { id: 'd', kind: 'dropoff', lat: job.dropoff_lat, lng: job.dropoff_lng }];
    if (job.tracking) m.push({ id: 't', kind: 'truck', lat: job.tracking.lat, lng: job.tracking.lng });
    return m;
  }, [job]);
  const route = useMemo(() => (job ? [[job.pickup_lat, job.pickup_lng], [job.dropoff_lat, job.dropoff_lng]] : null), [job]);
  const camera = useMemo(() => {
    if (!job) return null;
    const pts = [[job.pickup_lat, job.pickup_lng], [job.dropoff_lat, job.dropoff_lng]];
    if (job.tracking && ['matched', 'arrived'].includes(job.status)) pts.push([job.tracking.lat, job.tracking.lng]);
    return { id: `${job.status}-${!!job.tracking}`, fit: pts, bottom: 470 };
  }, [job]);

  if (!job) return error ? <Screen><TopBar onBack={nav.pop} title="Couldn't load" sub={error} /></Screen> : <Loading text="Loading your tow…" />;

  const op = job.operator;
  const cancel = () => Alert.alert('Cancel this request?', job.status === 'open' ? 'Operators will stop seeing it.' : 'Your operator is on the way. Please only cancel if you must.', [
    { text: 'Keep it', style: 'cancel' },
    { text: 'Taking too long', onPress: () => act('cancel', () => rpc('cancel_request', { p_request: id, p_reason: 'Taking too long' }), 'Request cancelled') },
    { text: 'No longer needed', style: 'destructive', onPress: () => act('cancel', () => rpc('cancel_request', { p_request: id, p_reason: 'No longer needed' }), 'Request cancelled') },
  ]);
  const accept = (b) => Alert.alert(`Accept ${naira(b.amount)}?`, `${b.operator_name} will head to your vehicle now.`, [
    { text: 'Not yet', style: 'cancel' },
    { text: 'Accept', onPress: () => act(b.id, () => rpc('accept_bid', { p_bid: b.id }), `${firstName(b.operator_name)} is on the way`) },
  ]);
  const raise = (by) => act('raise', () => rpc('raise_offer', { p_request: id, p_amount: Number(job.offer_amount) + by }), 'Offer raised. Operators notified.');
  const call = (phone) => Linking.openURL(`tel:${phone}`).catch(() => toast.show(phone));
  const left = minutesLeft(job.expires_at);
  const opKm = job.tracking ? distanceKm({ lat: job.tracking.lat, lng: job.tracking.lng }, { lat: job.pickup_lat, lng: job.pickup_lng }) * 1.3 : null;

  let content;
  if (job.status === 'open') {
    content = (
      <>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h2">{bids.length ? `${bids.length} offer${bids.length > 1 ? 's' : ''}` : 'Finding operators'}</T>
            <T muted>Your offer {naira(job.offer_amount)}{left != null ? ` · ${left} min left` : ''}</T>
          </View>
          <Pulse />
        </Row>
        {bids.map((b) => (
          <View key={b.id} style={styles.offer}>
            <Row>
              <Avatar name={b.operator_name} size={44} />
              <View style={{ flex: 1 }}>
                <T v="h3" numberOfLines={1}>{b.operator_name}</T>
                <RatingText avg={b.rating_avg} count={b.rating_count} />
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <T v="price" style={{ fontSize: 22 }}>{naira(b.amount)}</T>
                {b.is_counter ? <Chip label="Counter-offer" tone="amber" /> : <Chip label="Your price" tone="accent" />}
              </View>
            </Row>
            <Row gap={10}>
              <View style={styles.miniStat}><Icon name="clock" size={14} /><T v="label">~{b.eta_minutes} min</T></View>
              <View style={styles.miniStat}><Icon name={TRUCK_ICON[b.truck_type]} size={14} /><T v="label">{TRUCK[b.truck_type]}</T></View>
              <View style={{ flex: 1 }} />
              <ArrowBtn label={`Accept ${b.operator_name}`} onPress={() => accept(b)} loading={busy === b.id} />
            </Row>
          </View>
        ))}
        {!bids.length ? <T v="small" muted>Nearby operators have been notified. Offers usually arrive within a few minutes.</T> : null}
        <Row gap={8}>
          <Btn small variant="soft" title="+ ₦2,000" onPress={() => raise(2000)} loading={busy === 'raise'} style={{ flex: 1 }} />
          <Btn small variant="soft" title="+ ₦5,000" onPress={() => raise(5000)} style={{ flex: 1 }} />
          <RoundBtn name="x" label="Cancel request" onPress={cancel} style={{ backgroundColor: C.soft }} />
        </Row>
      </>
    );
  } else if (['matched', 'arrived', 'in_progress', 'delivered'].includes(job.status)) {
    const headline = {
      matched: `${firstName(op?.name)} is on the way`,
      arrived: `${firstName(op?.name)} has arrived`,
      in_progress: 'Towing your vehicle',
      delivered: 'Vehicle delivered',
    }[job.status];
    const sub = {
      matched: opKm != null ? `About ${etaMinutes(opKm)} min · ${km(opKm)} away` : 'Watch for the yellow truck on the map',
      arrived: 'Check the vehicle together, then share your start code',
      in_progress: `Heading to ${job.dropoff_address}`,
      delivered: `Pay ${naira(job.final_price)} by ${job.payment_method === 'transfer' ? 'transfer' : 'cash'}, then confirm`,
    }[job.status];
    content = (
      <>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h2">{headline}</T>
            <T muted numberOfLines={2}>{sub}</T>
          </View>
          {op?.phone ? <RoundBtn name="phone" label="Call operator" active onPress={() => call(op.phone)} /> : null}
        </Row>
        {op ? (
          <Row>
            <Avatar name={op.name} size={44} />
            <View style={{ flex: 1 }}>
              <T v="h3">{op.name}</T>
              <RatingText avg={op.rating_avg} count={op.rating_count} />
            </View>
            <Badge icon="hash" text={op.truck_plate} />
          </Row>
        ) : null}
        <TileRow>
          <Tile tone="soft" icon="₦" label="Price" value={naira(job.final_price)} />
          <Tile tone="soft" icon={TRUCK_ICON[op?.truck_type] || 'mc:tow-truck'} label="Truck" value={TRUCK[op?.truck_type] || '—'} />
          <Tile tone="soft" icon="navigation" label="Tow" value={km(job.distance_km)} />
        </TileRow>
        {['matched', 'arrived'].includes(job.status) ? (
          <View style={[styles.codeCard, job.status === 'arrived' && { backgroundColor: C.accent }]}>
            <View style={{ flex: 1 }}>
              <T v="small" muted={job.status !== 'arrived'}>Your start code</T>
              <T v="tiny" muted={job.status !== 'arrived'}>Share only after checking the plate</T>
            </View>
            <T style={styles.code}>{job.start_code}</T>
          </View>
        ) : null}
        {job.status === 'delivered' && job.delivery_photo_paths?.length ? (
          <Row gap={8}>{job.delivery_photo_paths.map((p) => <Image key={p} source={{ uri: publicPhotoUrl(p) }} style={styles.thumb} />)}</Row>
        ) : null}
        {job.status === 'delivered'
          ? <SlideToConfirm label="Slide to confirm delivery" onConfirm={() => act('confirm', () => rpc('confirm_delivery', { p_request: id }), 'Thanks! Tow completed')} loading={busy === 'confirm'} icon="check" endIcon="flag" />
          : null}
        <Row gap={8}>
          {['matched', 'arrived'].includes(job.status) ? <Btn small variant="soft" title="Cancel" onPress={cancel} loading={busy === 'cancel'} style={{ flex: 1 }} /> : null}
          <Btn small variant="soft" title={job.open_dispute ? 'Problem reported' : 'Report a problem'} icon="flag" disabled={job.open_dispute} onPress={() => nav.push('Report', { id, role: 'customer' })} style={{ flex: 1 }} />
        </Row>
      </>
    );
  } else if (job.status === 'completed') {
    content = (
      <>
        <Row>
          <View style={styles.doneIcon}><Icon name="check" size={22} /></View>
          <View style={{ flex: 1 }}><T v="h2">Tow completed</T><T muted>{job.ref}</T></View>
        </Row>
        <TileRow>
          <Tile tone="soft" icon="user" label="Operator" value={firstName(op?.name)} />
          <Tile tone="soft" icon="navigation" label="Distance" value={km(job.distance_km)} />
          <Tile tone="soft" icon="₦" label="Paid" value={naira(job.final_price)} />
        </TileRow>
        {job.my_rating ? (
          <T muted center>You rated this tow {job.my_rating} ★. Thank you!</T>
        ) : (
          <View style={{ gap: 12 }}>
            <T v="h3" center>How was {firstName(op?.name)}?</T>
            <Stars value={stars} onChange={setStars} size={26} />
            <Field soft value={comment} onChangeText={setComment} placeholder="Anything to add? (optional)" />
            <Btn title="Submit rating" disabled={!stars} loading={busy === 'rate'} onPress={() => act('rate', () => rpc('rate_job', { p_request: id, p_stars: stars, p_comment: comment }), 'Thanks for rating')} />
          </View>
        )}
        <Btn title="Done" variant="dark" onPress={() => nav.reset('CustomerHome')} />
        {!job.open_dispute ? <Btn small variant="ghost" title="Report a problem" onPress={() => nav.push('Report', { id, role: 'customer' })} /> : null}
      </>
    );
  } else {
    content = (
      <>
        <T v="h2">{job.status === 'expired' ? 'No operator was chosen in time' : 'Request cancelled'}</T>
        <T muted>{job.status === 'expired' ? 'Try again. A slightly higher offer usually gets faster responses.' : job.cancel_reason || ''}</T>
        <Btn title="Request again" onPress={() => nav.resetTo([['CustomerHome'], ['NewRequest', { pickup: { lat: job.pickup_lat, lng: job.pickup_lng, address: job.pickup_address } }]])} />
        <Btn title="Back to home" variant="soft" onPress={() => nav.reset('CustomerHome')} />
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TowMap markers={markers} route={route} camera={camera} />
      <View style={[styles.floatTop, { top: ins.top + 10 }]}>
        <RoundBtn name="arrow-left" label="Back" float onPress={() => (nav.canGoBack() ? nav.pop() : nav.reset('CustomerHome'))} />
        <View style={[styles.refPill, styles.float]}><T v="label" numberOfLines={1}>{job.ref} · {STATUS[job.status]}</T></View>
        <RoundBtn name="refresh-cw" label="Refresh" float onPress={load} />
      </View>
      <Sheet style={{ maxHeight: '70%' }}>
        <ScrollView contentContainerStyle={{ gap: 14 }} showsVerticalScrollIndicator={false}>{content}</ScrollView>
      </Sheet>
    </View>
  );
}

/* =========================================================
   Report a problem (both roles)
   ========================================================= */
export function Report({ params }) {
  const nav = useNav();
  const toast = useToast();
  const reasons = params.role === 'operator'
    ? ['Customer did not pay', 'Customer not at pickup', 'Vehicle details were wrong', 'Unsafe situation', 'Other']
    : ['Vehicle was damaged', 'Operator did not show up', 'Asked for more money', 'Rude or unsafe behaviour', 'Other'];
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await rpc('raise_dispute', { p_request: params.id, p_reason: reason, p_details: details });
      toast.show('Report sent. Our team will contact you.');
      nav.pop();
    } catch (e) { toast.show(e.message, 'error'); setBusy(false); }
  };
  return (
    <Screen footer={<Btn title="Send report" onPress={submit} disabled={!reason} loading={busy} />}>
      <TopBar onBack={nav.pop} title="Report a problem" sub="We review every report with the job's photos" />
      <Gap h={6} />
      <Choices options={reasons.map((r) => ({ value: r, label: r }))} value={reason} onChange={setReason} />
      <Gap />
      <Field label="What happened?" value={details} onChangeText={setDetails} multiline placeholder="Tell us the details" inputStyle={{ minHeight: 120, textAlignVertical: 'top' }} />
    </Screen>
  );
}

/* =========================================================
   History (both roles)
   ========================================================= */
export function History({ params }) {
  const nav = useNav();
  const { uid, mode } = useAuth();
  const [list, setList] = useState(null);
  const isOp = mode === 'operator';
  const tabs = isOp ? OPERATOR_TABS : CUSTOMER_TABS;
  useEffect(() => {
    const col = isOp ? 'operator_id' : 'customer_id';
    supabase.from('tow_requests').select('id, ref, status, pickup_address, dropoff_address, final_price, offer_amount, created_at, vehicle_type')
      .eq(col, uid).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setList(data || []), () => setList([]));
  }, [uid, isOp]);
  if (!list) return <Loading />;
  const tab = !!params.tab;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen scroll={false} padded={false}>
        <View style={{ paddingHorizontal: 18 }}>
          <TopBar onBack={tab ? null : nav.pop} title={isOp ? 'My jobs' : 'My tows'} sub={`${list.length} ${list.length === 1 ? 'trip' : 'trips'}`} />
        </View>
        <FlatList
          data={list}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingHorizontal: 18, gap: 10, paddingBottom: tab ? TAB_SPACE + 10 : 24, paddingTop: 6 }}
          ListEmptyComponent={<Empty icon="clock" title="Nothing here yet" text={isOp ? 'Jobs you take appear here.' : 'Your tows appear here.'} />}
          renderItem={({ item: j }) => (
            <Card onPress={() => nav.push(isOp ? 'OperatorActive' : 'RequestLive', { id: j.id })} style={{ gap: 12 }}>
              <Row>
                <View style={styles.histIcon}><Icon name={VEHICLE_ICON[j.vehicle_type]} size={20} /></View>
                <View style={{ flex: 1 }}>
                  <T v="h3">{VEHICLE[j.vehicle_type]} · {j.ref}</T>
                  <T v="small" muted>{new Date(j.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</T>
                </View>
                <T v="value">{naira(j.final_price || j.offer_amount)}</T>
              </Row>
              <T v="small" muted numberOfLines={1}>{j.pickup_address} → {j.dropoff_address}</T>
              <Chip label={STATUS[j.status]} tone={j.status === 'completed' ? 'green' : ['cancelled', 'expired'].includes(j.status) ? 'fill' : 'accent'} />
            </Card>
          )}
        />
      </Screen>
      {tab ? <TabBar items={tabs} active="History" onChange={(k) => nav.reset(k, { tab: true })} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  floatTop: { position: 'absolute', left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  float: { elevation: 5, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, borderRadius: R.pill },
  vCard: { backgroundColor: C.white, borderRadius: 32, padding: 12, height: 360, justifyContent: 'space-between' },
  vArt: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vCircle: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: C.soft },
  vFoot: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.ink, borderRadius: 26, padding: 10, paddingLeft: 18 },
  centerPin: { position: 'absolute', top: '50%', left: '50%', marginLeft: -21, marginTop: -62, alignItems: 'center' },
  pinHead: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  pinStem: { width: 2, height: 20, backgroundColor: C.ink },
  searchWrap: { position: 'absolute', left: 18, right: 18, top: 0, gap: 8 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, paddingHorizontal: 16, height: 48 },
  searchInput: { flex: 1, fontFamily: F.medium, fontSize: 15, color: C.ink },
  results: { backgroundColor: C.white, borderRadius: 24, paddingVertical: 6 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  resultIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 18, marginTop: 4 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#D6D6D6' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  routeDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.ink, borderWidth: 3, borderColor: C.soft, marginHorizontal: 7 },
  routeFlag: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  routeLine: { position: 'absolute', left: 31.5, top: 50, bottom: 50, width: 1, borderLeftWidth: 1.5, borderColor: C.faint, borderStyle: 'dashed' },
  tipIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  offerInput: { fontFamily: F.semi, fontSize: 36, color: C.ink, minWidth: 120, textAlign: 'center', letterSpacing: -1, padding: 0 },
  offer: { backgroundColor: C.soft, borderRadius: R.tile, padding: 14, gap: 12 },
  miniStat: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, borderRadius: R.pill, paddingHorizontal: 12, height: 34 },
  codeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.soft, borderRadius: R.tile, padding: 16 },
  code: { fontFamily: F.bold, fontSize: 32, letterSpacing: 6, color: C.ink },
  thumb: { width: 84, height: 84, borderRadius: R.sm, backgroundColor: C.soft },
  doneIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  refPill: { flex: 1, backgroundColor: C.white, paddingHorizontal: 16, height: 48, justifyContent: 'center', alignItems: 'center' },
  histIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
});
