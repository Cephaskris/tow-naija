/*
  Demo backend — an in-memory stand-in for Supabase with the same client shape
  (auth, from(), rpc(), storage, channel). Simulated tow operators send offers,
  drive to the pickup, tow and deliver; simulated customers post jobs and accept
  operator offers. Data is kept on the phone between app launches.
  It mirrors the rules in supabase/01_schema.sql closely enough to test every screen.
*/

const STORE_KEY = 'townaija.demo.v1';
const TICK_MS = 1000;

const BOT_OPERATORS = [
  { name: 'Musa Bello', phone: '08033344455', truck: 'flatbed', plate: 'ABJ 482 KW', model: 'Isuzu NPR flatbed', rating: 4.8, count: 41 },
  { name: 'Chinedu Eze', phone: '08155566677', truck: 'wheel_lift', plate: 'KUJ 119 AA', model: 'Mitsubishi Canter wrecker', rating: 4.6, count: 23 },
  { name: 'Garba Abdullahi', phone: '07011122233', truck: 'heavy_duty', plate: 'GWA 220 XY', model: 'MAN TGS rotator', rating: 4.9, count: 58 },
  { name: 'Femi Ogunleye', phone: '08067788990', truck: 'flatbed', plate: 'AMC 731 LS', model: 'Toyota Dyna flatbed', rating: 4.7, count: 17 },
  { name: 'Tunde Bakare', phone: '09087766554', truck: 'wheel_lift', plate: 'BWR 008 TT', model: 'Hino wrecker', rating: 4.5, count: 9 },
];
const BOT_CUSTOMERS = [
  { name: 'Zainab Yusuf', phone: '09023345671', rating: 4.9, count: 6 },
  { name: 'Ibrahim Sule', phone: '08052231877', rating: 4.7, count: 3 },
  { name: 'Chiamaka Nwosu', phone: '07064410923', rating: 5, count: 2 },
  { name: 'Emeka Obi', phone: '08127789034', rating: 4.4, count: 5 },
];
const BOT_JOBS = [
  { vehicle: 'car', desc: 'Toyota Corolla 2012', problem: 'wont_start', pickup: 'Banex Plaza, Wuse II', dropoff: 'Apo Mechanic Village', d: [0.008, 0.006], e: [-0.05, 0.02], notes: 'Parked by the Total filling station' },
  { vehicle: 'car', desc: 'Honda Accord, silver', problem: 'breakdown', pickup: 'Kubwa Expressway, Phase 4', dropoff: 'Dutse Junction', d: [-0.012, 0.01], e: [0.03, 0.05], notes: '' },
  { vehicle: 'suv', desc: 'Lexus RX 350', problem: 'accident', pickup: 'Airport Road by Lugbe', dropoff: 'Garki Area 11', d: [0.015, -0.018], e: [-0.03, -0.06], notes: 'Front bumper damaged, wheels locked', wheels: false },
  { vehicle: 'car', desc: 'Kia Rio, red', problem: 'flat_tyre', pickup: 'Jabi Lake Mall car park', dropoff: 'Utako Market', d: [-0.006, -0.011], e: [0.01, -0.03], notes: 'No spare tyre' },
];
const RATES = {
  wheel_lift: { base: 15000, perKm: 800, min: 20000 },
  flatbed: { base: 20000, perKm: 1000, min: 25000 },
  heavy_duty: { base: 60000, perKm: 2500, min: 80000 },
};

const iso = (t = Date.now()) => new Date(t).toISOString();
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const roundNaira = (n) => Math.round(n / 500) * 500;
const naira = (n) => '₦' + Math.round(Number(n || 0)).toLocaleString('en-NG');
const vehicleLabel = (v) => ({ car: 'Car', suv: 'SUV', van_bus: 'Bus/Van', truck: 'Truck' }[v] || v);

function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371, r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function compatible(vehicle, wheelsRoll) {
  if (vehicle === 'car' && wheelsRoll) return ['wheel_lift', 'flatbed', 'heavy_duty'];
  if (['car', 'suv', 'van_bus'].includes(vehicle)) return ['flatbed', 'heavy_duty'];
  return ['heavy_duty'];
}

function freshDb() {
  const db = {
    seq: 1048, notifSeq: 0, users: [], profiles: [], operators: [], tow_requests: [], bids: [],
    notifications: [], wallet_transactions: [], topup_requests: [], ratings: [], disputes: [],
    codes: {}, tracking: {}, sim: {},
    app_settings: [{ id: true, commission_pct: 10, min_wallet_balance: 1000, search_radius_km: 15, max_search_radius_km: 35, request_expiry_min: 30, bid_expiry_min: 10, auto_confirm_hours: 3, offer_floor_pct: 60, support_phone: '0800 000 0000', bank_name: 'Demo Bank', bank_account_name: 'Townaija Demo', bank_account_number: '0123456789' }],
  };
  BOT_OPERATORS.forEach((b, i) => {
    const id = `bot-op-${i}`;
    db.profiles.push({ id, full_name: b.name, phone: b.phone, is_operator: true, is_admin: false, status: 'active', rating_avg: b.rating, rating_count: b.count, bot: true });
    db.operators.push({ id, status: 'approved', truck_type: b.truck, truck_plate: b.plate, truck_make_model: b.model, base_area: 'Abuja', is_online: true, wallet_balance: 20000, jobs_completed: b.count + 4, cancellations: 0, bot: true });
  });
  BOT_CUSTOMERS.forEach((b, i) => {
    db.profiles.push({ id: `bot-cu-${i}`, full_name: b.name, phone: b.phone, is_operator: false, is_admin: false, status: 'active', rating_avg: b.rating, rating_count: b.count, bot: true });
  });
  return db;
}

export function createDemoClient(storage) {
  let db = freshDb();
  let session = null;
  const authListeners = new Set();
  const timers = [];
  let saveTimer = null;

  const ready = (async () => {
    try {
      const raw = storage && (await storage.getItem(STORE_KEY));
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.db) { db = saved.db; session = saved.session || null; }
      }
    } catch (e) { /* start fresh */ }
  })();

  const save = () => {
    if (!storage) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { storage.setItem(STORE_KEY, JSON.stringify({ db, session })).catch(() => {}); }, 600);
  };
  const later = (ms, fn) => timers.push({ at: Date.now() + ms, fn });
  const me = () => session && session.user.id;
  const P = (id) => db.profiles.find((p) => p.id === id);
  const O = (id) => db.operators.find((o) => o.id === id);
  const REQ = (id) => db.tow_requests.find((r) => r.id === id);
  const settings = () => db.app_settings[0];
  const fail = (msg) => { throw new Error(msg); };

  function notify(userId, title, body, data = {}) {
    if (!userId || String(userId).startsWith('bot-')) return;
    db.notifications.push({ id: ++db.notifSeq, user_id: userId, title, body: body || '', data, read_at: null, created_at: iso() });
  }
  function walletTx(opId, kind, amount, note, requestId) {
    const o = O(opId);
    o.wallet_balance = Math.round(o.wallet_balance + amount);
    db.wallet_transactions.push({ id: rid(), operator_id: opId, kind, amount, balance_after: o.wallet_balance, note, request_id: requestId || null, created_at: iso() });
  }
  function expired(r) {
    const s = settings();
    return r.status === 'open' && new Date(r.offer_updated_at).getTime() + s.request_expiry_min * 60000 < Date.now();
  }
  function blockReason(opId) {
    const o = O(opId);
    if (!o) return 'You are not registered as a tow operator.';
    if (P(opId).status !== 'active') return 'Your account is blocked. Contact support.';
    if (o.status !== 'approved') return 'Your operator account is not approved yet.';
    if (o.wallet_balance < settings().min_wallet_balance) return `Top up your wallet. Minimum balance to receive jobs is ${naira(settings().min_wallet_balance)}.`;
    return null;
  }
  const activeJobOf = (opId) => db.tow_requests.find((r) => r.operator_id === opId && ['matched', 'arrived', 'in_progress'].includes(r.status));

  function estimate(a) {
    const km = Math.round(haversine(a.p_pickup_lat, a.p_pickup_lng, a.p_dropoff_lat, a.p_dropoff_lng) * 1.3 * 10) / 10;
    const types = compatible(a.p_vehicle_type, a.p_wheels_roll);
    const rec = roundNaira(Math.min(...types.map((t) => Math.max(RATES[t].min, RATES[t].base + RATES[t].perKm * km))));
    return {
      distance_km: km, truck_types: types, recommended_fare: rec,
      range_low: roundNaira(rec * 0.9), range_high: roundNaira(rec * 1.15),
      fare_floor: roundNaira(rec * settings().offer_floor_pct / 100),
      city_id: 1, city_name: 'Demo area', in_service: true,
    };
  }

  function newRequest(customerId, f, code) {
    const est = estimate({ p_pickup_lat: f.pickup_lat, p_pickup_lng: f.pickup_lng, p_dropoff_lat: f.dropoff_lat, p_dropoff_lng: f.dropoff_lng, p_vehicle_type: f.vehicle_type, p_wheels_roll: f.wheels_roll !== false });
    const r = {
      id: rid(), ref: `TN-${++db.seq}`, customer_id: customerId, city_id: 1, status: 'open',
      pickup_lat: f.pickup_lat, pickup_lng: f.pickup_lng, pickup_address: f.pickup_address || 'Pickup point',
      dropoff_lat: f.dropoff_lat, dropoff_lng: f.dropoff_lng, dropoff_address: f.dropoff_address || 'Drop-off point',
      vehicle_type: f.vehicle_type, vehicle_desc: f.vehicle_desc || '', problem_type: f.problem_type || 'breakdown',
      wheels_roll: f.wheels_roll !== false, keys_available: f.keys_available !== false, notes: f.notes || '',
      photo_paths: f.photo_paths || [], distance_km: est.distance_km, required_truck_types: est.truck_types,
      recommended_fare: est.recommended_fare, fare_floor: est.fare_floor, offer_amount: f.offer_amount || est.recommended_fare,
      payment_method: f.payment_method || 'cash', operator_id: null, accepted_bid_id: null, final_price: null, commission_amount: null,
      pickup_photo_paths: [], delivery_photo_paths: [], cancel_reason: null, cancelled_by: null,
      created_at: iso(), offer_updated_at: iso(), matched_at: null, arrived_at: null, started_at: null, delivered_at: null, completed_at: null, cancelled_at: null,
    };
    db.tow_requests.push(r);
    db.codes[r.id] = code || String(Math.floor(1000 + Math.random() * 9000));
    return r;
  }

  // A simulated operator sends an offer on a customer's request
  function botBid(reqId, botIndex, extra, eta) {
    const r = REQ(reqId);
    if (!r || r.status !== 'open') return;
    const opId = `bot-op-${botIndex}`;
    if (db.bids.some((b) => b.request_id === reqId && b.operator_id === opId)) return;
    const o = O(opId);
    if (!o.last_lat) { o.last_lat = r.pickup_lat + (Math.random() - 0.5) * 0.04; o.last_lng = r.pickup_lng + (Math.random() - 0.5) * 0.04; }
    db.bids.push({ id: rid(), request_id: reqId, operator_id: opId, amount: Number(r.offer_amount) + extra, eta_minutes: eta, status: 'pending', created_at: iso(), expires_at: iso(Date.now() + settings().bid_expiry_min * 60000) });
    notify(r.customer_id, extra ? 'New counter-offer' : 'An operator accepted your price', `${naira(Number(r.offer_amount) + extra)} · arrives in ~${eta} min`, { request_id: reqId, type: 'new_bid' });
    save();
  }
  function scheduleBotBids(r, quick) {
    const bots = BOT_OPERATORS.map((b, i) => ({ ...b, i })).filter((b) => r.required_truck_types.includes(b.truck));
    const plan = [[quick ? 2500 : 4000, 0, 12], [quick ? 5000 : 9000, 3000, 8], [quick ? 8000 : 14000, 1000, 15]];
    bots.slice(0, 3).forEach((b, k) => later(plan[k][0], () => botBid(r.id, b.i, plan[k][1], plan[k][2])));
  }

  function completeJob(r, by) {
    if (r.status !== 'delivered') return;
    const comm = Math.round(Number(r.final_price) * settings().commission_pct / 100);
    r.status = 'completed'; r.completed_at = iso(); r.commission_amount = comm;
    const o = O(r.operator_id);
    o.jobs_completed += 1;
    if (!o.bot) {
      walletTx(o.id, 'commission', -comm, `Commission for ${r.ref}`, r.id);
      notify(o.id, 'Job completed ✅', `${r.ref} · commission ${naira(comm)} deducted.`, { request_id: r.id, type: 'completed' });
    }
    delete db.tracking[r.id];
    if (by !== 'customer') notify(r.customer_id, 'Tow completed', `${r.ref} is complete. Please rate your operator.`, { request_id: r.id, type: 'completed' });
  }

  function rate(r, raterId, rateeId, stars, comment) {
    db.ratings = db.ratings.filter((x) => !(x.request_id === r.id && x.rater_id === raterId));
    db.ratings.push({ request_id: r.id, rater_id: raterId, ratee_id: rateeId, stars, comment: comment || '', created_at: iso() });
    const p = P(rateeId);
    if (p.bot) return;
    const mine = db.ratings.filter((x) => x.ratee_id === rateeId);
    p.rating_count = mine.length;
    p.rating_avg = Math.round((mine.reduce((a, x) => a + x.stars, 0) / mine.length) * 100) / 100;
  }

  // Simulated customers post jobs around an operator who just went online
  function spawnJobsNear(op) {
    const open = db.tow_requests.filter((r) => r.status === 'open' && !expired(r) && String(r.customer_id).startsWith('bot-cu') && haversine(op.last_lat, op.last_lng, r.pickup_lat, r.pickup_lng) < 30);
    if (open.length >= 2) return;
    BOT_JOBS.forEach((j, i) => {
      const wheels = j.wheels !== false;
      if (!compatible(j.vehicle, wheels).includes(op.truck_type)) return;
      later(800 + i * 2500, () => {
        const r = newRequest(`bot-cu-${i % BOT_CUSTOMERS.length}`, {
          pickup_lat: op.last_lat + j.d[0], pickup_lng: op.last_lng + j.d[1], pickup_address: j.pickup,
          dropoff_lat: op.last_lat + j.d[0] + j.e[0], dropoff_lng: op.last_lng + j.d[1] + j.e[1], dropoff_address: j.dropoff,
          vehicle_type: j.vehicle, vehicle_desc: j.desc, problem_type: j.problem, wheels_roll: wheels, notes: j.notes,
          payment_method: i % 2 ? 'transfer' : 'cash',
        }, '1234');
        r.offer_amount = roundNaira(r.recommended_fare * (i % 2 ? 0.95 : 1));
        notify(op.id, 'New tow request nearby', `${vehicleLabel(r.vehicle_type)} · ${naira(r.offer_amount)} offered`, { request_id: r.id, type: 'new_request' });
        save();
      });
    });
  }

  function step(fromLat, fromLng, toLat, toLng, t) { return [fromLat + (toLat - fromLat) * t, fromLng + (toLng - fromLng) * t]; }

  // The heartbeat: runs scheduled events and moves simulated trucks
  setInterval(() => {
    const now = Date.now();
    for (let i = timers.length - 1; i >= 0; i--) {
      if (timers[i].at <= now) { const t = timers.splice(i, 1)[0]; try { t.fn(); } catch (e) { /* ignore */ } }
    }
    let changed = false;
    db.tow_requests.forEach((r) => {
      const op = r.operator_id && O(r.operator_id);
      if (!op || !op.bot) return;
      const sim = db.sim[r.id] || (db.sim[r.id] = { p: 0, wait: 0 });
      const tr = db.tracking[r.id];
      if (r.status === 'matched' && tr) {
        sim.p = Math.min(1, sim.p + 1 / 22);
        [tr.lat, tr.lng] = step(sim.fromLat, sim.fromLng, r.pickup_lat, r.pickup_lng, sim.p);
        tr.updated_at = iso(); changed = true;
        if (sim.p >= 1) {
          r.status = 'arrived'; r.arrived_at = iso(); sim.wait = 0;
          notify(r.customer_id, 'Your tow truck has arrived 🚛', 'Check the vehicle together, then give the operator your start code.', { request_id: r.id, type: 'arrived' });
        }
      } else if (r.status === 'arrived') {
        sim.wait += 1;
        if (sim.wait >= 12) {
          r.status = 'in_progress'; r.started_at = iso(); sim.p = 0;
          notify(r.customer_id, 'Tow started', 'The operator entered your start code. Track your vehicle live.', { request_id: r.id, type: 'started' });
          changed = true;
        }
      } else if (r.status === 'in_progress' && tr) {
        sim.p = Math.min(1, sim.p + 1 / 26);
        [tr.lat, tr.lng] = step(r.pickup_lat, r.pickup_lng, r.dropoff_lat, r.dropoff_lng, sim.p);
        tr.updated_at = iso(); changed = true;
        if (sim.p >= 1) {
          r.status = 'delivered'; r.delivered_at = iso();
          notify(r.customer_id, 'Vehicle delivered', `Please pay ${naira(r.final_price)} to your operator and confirm delivery.`, { request_id: r.id, type: 'delivered' });
        }
      }
    });
    if (changed) save();
  }, TICK_MS);

  function detail(r, uid) {
    let role = null;
    if (uid === r.customer_id) role = 'customer';
    else if (uid === r.operator_id) role = 'operator';
    else if (db.bids.some((b) => b.request_id === r.id && b.operator_id === uid)) role = 'bidder';
    if (!role) fail('Request not found.');
    const showContact = ['matched', 'arrived', 'in_progress', 'delivered'].includes(r.status);
    const out = { ...r, my_role: role, expired: expired(r), expires_at: iso(new Date(r.offer_updated_at).getTime() + settings().request_expiry_min * 60000) };
    if (r.operator_id) {
      const o = O(r.operator_id), p = P(r.operator_id);
      out.operator = { id: o.id, name: p.full_name, phone: showContact ? p.phone : null, rating_avg: p.rating_avg, rating_count: p.rating_count, jobs_completed: o.jobs_completed, truck_type: o.truck_type, truck_plate: o.truck_plate, truck_make_model: o.truck_make_model };
    }
    const c = P(r.customer_id);
    out.customer = { id: c.id, name: role === 'bidder' ? c.full_name.split(' ')[0] : c.full_name, phone: (role === 'operator' && showContact) || role === 'customer' ? c.phone : null, rating_avg: c.rating_avg, rating_count: c.rating_count };
    if (role === 'customer') out.start_code = db.codes[r.id];
    out.tracking = db.tracking[r.id] ? { ...db.tracking[r.id] } : null;
    const myRating = db.ratings.find((x) => x.request_id === r.id && x.rater_id === uid);
    out.my_rating = myRating ? myRating.stars : null;
    const myBid = db.bids.find((b) => b.request_id === r.id && b.operator_id === uid);
    out.my_bid = myBid ? { ...myBid } : null;
    out.open_dispute = db.disputes.some((d) => d.request_id === r.id && d.status === 'open');
    return out;
  }

  const RPC = {
    estimate_fare: (a) => estimate(a),

    create_tow_request: ({ p }) => {
      const uid = me();
      if (db.tow_requests.some((r) => r.customer_id === uid && ['open', 'matched', 'arrived', 'in_progress', 'delivered'].includes(r.status))) fail('You already have an active tow request.');
      const est = estimate({ p_pickup_lat: p.pickup_lat, p_pickup_lng: p.pickup_lng, p_dropoff_lat: p.dropoff_lat, p_dropoff_lng: p.dropoff_lng, p_vehicle_type: p.vehicle_type, p_wheels_roll: p.wheels_roll !== false });
      if (!p.offer_amount || p.offer_amount < est.fare_floor) fail(`Your offer is too low. Minimum for this trip is ${naira(est.fare_floor)}.`);
      const r = newRequest(uid, p);
      scheduleBotBids(r, false);
      return r.id;
    },

    raise_offer: ({ p_request, p_amount }) => {
      const r = REQ(p_request);
      if (!r || r.customer_id !== me()) fail('Request not found.');
      if (r.status !== 'open') fail('This request is no longer open.');
      if (p_amount <= r.offer_amount) fail(`New offer must be higher than ${naira(r.offer_amount)}.`);
      r.offer_amount = p_amount; r.offer_updated_at = iso();
      if (db.bids.filter((b) => b.request_id === r.id && b.status === 'pending').length < 3) scheduleBotBids(r, true);
    },

    get_request_bids: ({ p_request }) => {
      const r = REQ(p_request);
      if (!r || r.customer_id !== me()) fail('Request not found.');
      return db.bids.filter((b) => b.request_id === r.id && b.status === 'pending' && new Date(b.expires_at) > new Date())
        .sort((a, b) => a.amount - b.amount)
        .map((b) => {
          const o = O(b.operator_id), p = P(b.operator_id);
          return { id: b.id, amount: b.amount, eta_minutes: b.eta_minutes, status: b.status, created_at: b.created_at, expires_at: b.expires_at, is_counter: b.amount > r.offer_amount, operator_id: o.id, operator_name: p.full_name, rating_avg: p.rating_avg, rating_count: p.rating_count, jobs_completed: o.jobs_completed, truck_type: o.truck_type, truck_make_model: o.truck_make_model, pickup_distance_km: o.last_lat ? Math.round(haversine(o.last_lat, o.last_lng, r.pickup_lat, r.pickup_lng) * 10) / 10 : null };
        });
    },

    accept_bid: ({ p_bid }) => {
      const b = db.bids.find((x) => x.id === p_bid);
      if (!b) fail('Offer not found.');
      const r = REQ(b.request_id);
      if (r.customer_id !== me()) fail('Offer not found.');
      if (r.status !== 'open') fail('This request is no longer open.');
      if (b.status !== 'pending') fail('This offer has expired.');
      Object.assign(r, { status: 'matched', operator_id: b.operator_id, accepted_bid_id: b.id, final_price: b.amount, matched_at: iso() });
      b.status = 'accepted';
      db.bids.forEach((x) => { if (x.request_id === r.id && x.id !== b.id && x.status === 'pending') x.status = 'rejected'; });
      const o = O(b.operator_id);
      if (o.last_lat) db.tracking[r.id] = { request_id: r.id, operator_id: o.id, lat: o.last_lat, lng: o.last_lng, updated_at: iso() };
      db.sim[r.id] = { p: 0, wait: 0, fromLat: o.last_lat, fromLng: o.last_lng };
      notify(b.operator_id, 'You got the job! 🚛', `${r.ref} · ${naira(b.amount)}. Head to pickup.`, { request_id: r.id, type: 'matched' });
    },

    cancel_request: ({ p_request, p_reason }) => {
      const r = REQ(p_request);
      const uid = me();
      if (!r) fail('Request not found.');
      if (r.customer_id === uid) {
        if (!['open', 'matched', 'arrived'].includes(r.status)) fail('The tow has started — use "Report a problem" instead.');
        Object.assign(r, { status: 'cancelled', cancelled_by: 'customer', cancel_reason: p_reason || '', cancelled_at: iso() });
        db.bids.forEach((x) => { if (x.request_id === r.id && x.status === 'pending') x.status = 'expired'; });
        delete db.tracking[r.id];
      } else if (r.operator_id === uid) {
        if (!['matched', 'arrived'].includes(r.status)) fail('You can only cancel before the tow starts. Use "Report a problem".');
        const bid = db.bids.find((x) => x.id === r.accepted_bid_id);
        if (bid) bid.status = 'withdrawn';
        Object.assign(r, { status: 'open', operator_id: null, accepted_bid_id: null, final_price: null, matched_at: null, arrived_at: null, offer_updated_at: iso() });
        delete db.tracking[r.id];
        O(uid).cancellations += 1;
      } else fail('Request not found.');
    },

    confirm_delivery: ({ p_request }) => {
      const r = REQ(p_request);
      if (!r || r.customer_id !== me()) fail('Request not found.');
      if (r.status !== 'delivered') fail('The operator has not marked this tow as delivered yet.');
      completeJob(r, 'customer');
    },

    rate_job: ({ p_request, p_stars, p_comment }) => {
      const r = REQ(p_request);
      const uid = me();
      if (!r) fail('Request not found.');
      if (r.status !== 'completed') fail('You can rate after the job is completed.');
      const ratee = uid === r.customer_id ? r.operator_id : uid === r.operator_id ? r.customer_id : null;
      if (!ratee) fail('Request not found.');
      rate(r, uid, ratee, p_stars, p_comment);
    },

    raise_dispute: ({ p_request, p_reason, p_details }) => {
      const r = REQ(p_request);
      const uid = me();
      if (!r || (uid !== r.customer_id && uid !== r.operator_id)) fail('Request not found.');
      if (!p_reason) fail('Please choose a reason.');
      const d = { id: rid(), request_id: r.id, raised_by: uid, raised_by_role: uid === r.customer_id ? 'customer' : 'operator', reason: p_reason, details: p_details || '', status: 'open', created_at: iso() };
      db.disputes.push(d);
      later(20000, () => { d.status = 'resolved'; notify(uid, 'Your report was resolved', 'Demo: our support team reviewed the photos and contacted both parties.', { request_id: r.id, type: 'dispute' }); save(); });
      return d.id;
    },

    get_request_detail: ({ p_request }) => {
      const r = REQ(p_request);
      if (!r) fail('Request not found.');
      return detail(r, me());
    },

    my_active_request: () => {
      const uid = me();
      const r = db.tow_requests.filter((x) => (x.customer_id === uid && ['open', 'matched', 'arrived', 'in_progress', 'delivered'].includes(x.status) && !expired(x))
        || (x.operator_id === uid && ['matched', 'arrived', 'in_progress'].includes(x.status)))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
      return r ? r.id : null;
    },

    register_operator: ({ p }) => {
      const uid = me();
      if (!p.truck_plate || !String(p.truck_plate).trim()) fail('Truck plate number is required.');
      if (!p.license_doc_path || !p.truck_photo_path) fail("Driver's licence and truck photo are required.");
      let o = O(uid);
      const fields = { status: 'pending', truck_type: p.truck_type, truck_plate: String(p.truck_plate).trim().toUpperCase(), truck_make_model: p.truck_make_model || '', base_area: p.base_area || '', license_doc_path: p.license_doc_path, id_doc_path: p.id_doc_path, truck_photo_path: p.truck_photo_path, selfie_path: p.selfie_path, review_note: null };
      if (o) Object.assign(o, fields);
      else { o = { id: uid, is_online: false, wallet_balance: 0, jobs_completed: 0, cancellations: 0, created_at: iso(), ...fields }; db.operators.push(o); }
      P(uid).is_operator = true;
      later(6000, () => {
        const op = O(uid);
        if (!op || op.status !== 'pending') return;
        op.status = 'approved'; op.reviewed_at = iso();
        if (op.wallet_balance < 5000) walletTx(uid, 'adjustment', 5000, 'Demo starting balance');
        notify(uid, "You're approved! 🎉", 'Demo: ₦5,000 was added to your wallet. Go online to receive tow requests.', { type: 'operator_status' });
        save();
      });
    },

    set_online: ({ p_online, p_lat, p_lng }) => {
      const uid = me();
      if (p_online) { const why = blockReason(uid); if (why) fail(why); }
      const o = O(uid);
      if (!o) return;
      o.is_online = !!p_online;
      if (p_lat != null) { o.last_lat = p_lat; o.last_lng = p_lng; }
      o.last_seen_at = iso();
      if (!p_online) db.bids.forEach((b) => { if (b.operator_id === uid && b.status === 'pending') b.status = 'withdrawn'; });
      else if (o.last_lat != null) spawnJobsNear(o);
    },

    update_location: ({ p_lat, p_lng }) => {
      const uid = me();
      const o = O(uid);
      if (!o) return;
      o.last_lat = p_lat; o.last_lng = p_lng; o.last_seen_at = iso();
      const job = activeJobOf(uid);
      if (job) db.tracking[job.id] = { request_id: job.id, operator_id: uid, lat: p_lat, lng: p_lng, updated_at: iso() };
    },

    operator_feed: () => {
      const uid = me();
      const o = O(uid);
      if (!o || !o.is_online || o.last_lat == null || blockReason(uid) || activeJobOf(uid)) return [];
      return db.tow_requests
        .filter((r) => r.status === 'open' && !expired(r) && r.required_truck_types.includes(o.truck_type) && r.customer_id !== uid && haversine(o.last_lat, o.last_lng, r.pickup_lat, r.pickup_lng) <= settings().max_search_radius_km)
        .map((r) => {
          const b = db.bids.find((x) => x.request_id === r.id && x.operator_id === uid);
          if (b && ['rejected', 'accepted'].includes(b.status)) return null;
          const c = P(r.customer_id);
          return { ...r, pickup_distance_km: Math.round(haversine(o.last_lat, o.last_lng, r.pickup_lat, r.pickup_lng) * 10) / 10, customer_name: c.full_name.split(' ')[0], customer_rating: c.rating_avg, customer_rating_count: c.rating_count, my_bid_amount: b ? b.amount : null, my_bid_status: b ? b.status : null };
        })
        .filter(Boolean)
        .sort((a, b) => a.pickup_distance_km - b.pickup_distance_km);
    },

    place_bid: ({ p_request, p_amount, p_eta }) => {
      const uid = me();
      const why = blockReason(uid);
      if (why) fail(why);
      const o = O(uid);
      if (!o.is_online) fail('Go online to send offers.');
      if (activeJobOf(uid)) fail('Finish your current job first.');
      const r = REQ(p_request);
      if (!r || r.status !== 'open' || expired(r)) fail('This request is no longer available.');
      if (!r.required_truck_types.includes(o.truck_type)) fail('Your truck type cannot tow this vehicle.');
      if (p_amount < r.offer_amount) fail(`Your price cannot be lower than the customer's offer (${naira(r.offer_amount)}).`);
      if (p_amount > r.offer_amount * 3) fail('That price is too high for this request.');
      let b = db.bids.find((x) => x.request_id === r.id && x.operator_id === uid);
      if (b && b.status === 'rejected') fail('You can no longer bid on this request.');
      if (!b) { b = { id: rid(), request_id: r.id, operator_id: uid, created_at: iso() }; db.bids.push(b); }
      Object.assign(b, { amount: Math.round(p_amount), eta_minutes: p_eta || 20, status: 'pending', expires_at: iso(Date.now() + settings().bid_expiry_min * 60000) });
      if (String(r.customer_id).startsWith('bot-cu')) {
        const bidId = b.id;
        later(6000, () => {
          const bid = db.bids.find((x) => x.id === bidId);
          if (!bid || bid.status !== 'pending' || r.status !== 'open') return;
          Object.assign(r, { status: 'matched', operator_id: uid, accepted_bid_id: bid.id, final_price: bid.amount, matched_at: iso() });
          bid.status = 'accepted';
          if (o.last_lat != null) db.tracking[r.id] = { request_id: r.id, operator_id: uid, lat: o.last_lat, lng: o.last_lng, updated_at: iso() };
          db.bids.forEach((x) => { if (x.operator_id === uid && x.status === 'pending' && x.request_id !== r.id) x.status = 'withdrawn'; });
          notify(uid, 'You got the job! 🚛', `${r.ref} · ${naira(bid.amount)}. Head to pickup.`, { request_id: r.id, type: 'matched' });
          save();
        });
      }
      return b.id;
    },

    withdraw_bid: ({ p_request }) => {
      db.bids.forEach((b) => { if (b.request_id === p_request && b.operator_id === me() && b.status === 'pending') b.status = 'withdrawn'; });
    },

    mark_arrived: ({ p_request }) => {
      const r = REQ(p_request);
      if (!r || r.operator_id !== me()) fail('Job not found.');
      if (r.status !== 'matched') fail('You can only mark arrival once.');
      r.status = 'arrived'; r.arrived_at = iso();
    },

    start_job: ({ p_request, p_code, p_photos }) => {
      const r = REQ(p_request);
      if (!r || r.operator_id !== me()) fail('Job not found.');
      if (r.status !== 'arrived') fail('Mark that you have arrived first.');
      if (!p_photos || !p_photos.length) fail("Take at least one photo of the vehicle's condition before loading.");
      if (String(p_code).trim() !== db.codes[r.id]) fail('Wrong start code. Ask the customer for the 4-digit code in their app.');
      Object.assign(r, { status: 'in_progress', started_at: iso(), pickup_photo_paths: p_photos });
    },

    mark_delivered: ({ p_request, p_photos }) => {
      const r = REQ(p_request);
      if (!r || r.operator_id !== me()) fail('Job not found.');
      if (r.status !== 'in_progress') fail('This job is not in progress.');
      if (!p_photos || !p_photos.length) fail('Take a photo of the vehicle at drop-off.');
      Object.assign(r, { status: 'delivered', delivered_at: iso(), delivery_photo_paths: p_photos });
      if (String(r.customer_id).startsWith('bot-cu')) {
        later(7000, () => {
          completeJob(r, 'customer');
          rate(r, r.customer_id, r.operator_id, 5, 'Fast and careful. Thank you!');
          notify(r.operator_id, 'Customer confirmed payment', `${P(r.customer_id).full_name.split(' ')[0]} rated you 5 ★`, { request_id: r.id, type: 'completed' });
          save();
        });
      }
    },

    request_topup: ({ p_amount, p_reference, p_proof_path }) => {
      const uid = me();
      if (!O(uid)) fail('Only registered operators can top up.');
      if (!p_amount || p_amount < 500) fail('Minimum top-up is ₦500.');
      if (db.topup_requests.some((t) => t.operator_id === uid && t.status === 'pending')) fail('You already have a top-up waiting for approval.');
      const t = { id: rid(), operator_id: uid, amount: p_amount, reference: p_reference || '', proof_path: p_proof_path, status: 'pending', created_at: iso() };
      db.topup_requests.push(t);
      later(7000, () => {
        t.status = 'approved'; t.reviewed_at = iso();
        walletTx(uid, 'topup', t.amount, t.reference || 'Wallet top-up');
        notify(uid, 'Wallet topped up', `${naira(t.amount)} added. New balance ${naira(O(uid).wallet_balance)}.`, { type: 'wallet' });
        save();
      });
      return t.id;
    },
  };

  /* ---- Query builder: enough of supabase.from(...) for the app's reads and small updates ---- */
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.sort = null; this.max = null; this.one = false; this.patch = null; }
    select() { return this; }
    eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
    in(c, arr) { this.filters.push((r) => arr.includes(r[c])); return this; }
    order(c, o = {}) { this.sort = [c, o.ascending !== false]; return this; }
    limit(n) { this.max = n; return this; }
    update(obj) { this.patch = obj; return this; }
    maybeSingle() { this.one = true; return this; }
    single() { this.one = true; return this; }
    run() {
      const uid = me();
      let rows = db[this.table] || [];
      // Privacy like the real rules: people only see their own rows
      if (this.table === 'notifications') rows = rows.filter((r) => r.user_id === uid);
      if (this.table === 'wallet_transactions' || this.table === 'topup_requests') rows = rows.filter((r) => r.operator_id === uid);
      if (this.table === 'operators' || this.table === 'profiles') rows = rows.filter((r) => r.id === uid);
      if (this.table === 'tow_requests') rows = rows.filter((r) => r.customer_id === uid || r.operator_id === uid);
      rows = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.patch) { rows.forEach((r) => Object.assign(r, this.patch)); save(); }
      if (this.sort) {
        const [c, asc] = this.sort;
        rows = rows.slice().sort((a, b) => (a[c] === b[c] ? 0 : (a[c] > b[c] ? 1 : -1) * (asc ? 1 : -1)));
      }
      if (this.max != null) rows = rows.slice(0, this.max);
      const data = clone(this.one ? rows[0] || null : rows);
      return { data, error: null };
    }
    then(resolve, reject) {
      return ready.then(() => this.run()).then(resolve, reject);
    }
  }

  const emit = (event) => authListeners.forEach((cb) => { try { cb(event, session); } catch (e) { /* ignore */ } });

  return {
    isDemo: true,
    auth: {
      async getSession() { await ready; return { data: { session } }; },
      onAuthStateChange(cb) { authListeners.add(cb); return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } }; },
      async signUp({ email, password, options }) {
        await ready;
        if (db.users.some((u) => u.email === email)) return { data: {}, error: { message: 'User already registered' } };
        const id = `user-${rid()}`;
        db.users.push({ id, email, password });
        const m = (options && options.data) || {};
        db.profiles.push({ id, full_name: m.full_name || 'Demo user', phone: m.phone || null, is_operator: false, is_admin: false, status: 'active', rating_avg: 0, rating_count: 0, created_at: iso() });
        session = { user: { id } };
        save(); emit('SIGNED_IN');
        return { data: { session, user: session.user }, error: null };
      },
      async signInWithPassword({ email, password }) {
        await ready;
        const u = db.users.find((x) => x.email === email && x.password === password);
        if (!u) return { data: {}, error: { message: 'Invalid login credentials' } };
        session = { user: { id: u.id } };
        save(); emit('SIGNED_IN');
        return { data: { session }, error: null };
      },
      async signOut() { session = null; save(); emit('SIGNED_OUT'); return { error: null }; },
      startAutoRefresh() {},
      stopAutoRefresh() {},
    },
    from: (table) => new Query(table),
    async rpc(fn, args) {
      await ready;
      try {
        if (!RPC[fn]) throw new Error(`Not available in demo: ${fn}`);
        if (!me()) throw new Error('Please log in.');
        const data = RPC[fn](args || {});
        save();
        return { data: data === undefined ? null : clone(data), error: null };
      } catch (e) {
        return { data: null, error: { message: e.message } };
      }
    },
    storage: { from: () => ({ upload: async (path) => ({ data: { path }, error: null }) }) },
    channel() { const ch = { on: () => ch, subscribe: () => ch }; return ch; },
    removeChannel() {},
    async reset() { db = freshDb(); session = null; timers.length = 0; save(); emit('SIGNED_OUT'); },
  };
}
