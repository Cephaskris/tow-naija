import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConvexClient } from 'convex/browser';
import { CONVEX_URL, CONVEX_SITE_URL, IS_CONFIGURED } from './config';
/*
  Townaija backend adapter powered exclusively by Convex (charming-donkey-521).
  Direct live connection for all customer and operator screens.
*/

const AUTH_TOKEN_KEY = 'townaija.convex_token';
const AUTH_USER_KEY = 'townaija.convex_user';

let convexClient = null;
let currentToken = null;
let currentSessionUser = null;
const authListeners = new Set();

if (IS_CONFIGURED) {
  convexClient = new ConvexClient(CONVEX_URL);
}

// Map RPC function names to Convex queries, mutations, or actions
const RPC_ROUTER = {
  // Towing
  estimate_fare: { fn: 'tows:estimateFare', type: 'query' },
  create_tow_request: { fn: 'tows:createTowRequest', type: 'mutation' },
  get_request_bids: { fn: 'tows:getRequestBids', type: 'query' },
  accept_bid: { fn: 'tows:acceptBid', type: 'mutation' },
  raise_offer: { fn: 'tows:raiseOffer', type: 'mutation' },
  cancel_request: { fn: 'tows:cancelRequest', type: 'mutation' },
  mark_arrived: { fn: 'tows:markArrived', type: 'mutation' },
  start_job: { fn: 'tows:startJob', type: 'mutation' },
  mark_delivered: { fn: 'tows:markDelivered', type: 'mutation' },
  confirm_delivery: { fn: 'tows:confirmDelivery', type: 'mutation' },
  rate_job: { fn: 'tows:rateJob', type: 'mutation' },
  raise_dispute: { fn: 'tows:raiseDispute', type: 'mutation' },
  get_request_detail: { fn: 'tows:getRequestDetail', type: 'query' },
  my_active_request: { fn: 'tows:myActiveRequest', type: 'query' },

  // Operator
  register_operator: { fn: 'operators:registerOperator', type: 'mutation' },
  set_online: { fn: 'operators:setOnline', type: 'mutation' },
  update_location: { fn: 'operators:updateLocation', type: 'mutation' },
  operator_feed: { fn: 'operators:operatorFeed', type: 'query' },
  place_bid: { fn: 'operators:placeBid', type: 'mutation' },
  withdraw_bid: { fn: 'operators:withdrawBid', type: 'mutation' },
  request_topup: { fn: 'operators:requestTopup', type: 'mutation' },
};

function createLiveConvexAdapter() {
  return {
    isDemo: false,
    auth: {
      async getSession() {
        try {
          if (!currentToken) {
            currentToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            const userStr = await AsyncStorage.getItem(AUTH_USER_KEY);
            if (userStr) currentSessionUser = JSON.parse(userStr);
          }
          if (currentToken && convexClient) {
            convexClient.setAuth(async () => currentToken);
          }
          if (!currentToken || !currentSessionUser) {
            return { data: { session: null } };
          }
          return {
            data: {
              session: {
                access_token: currentToken,
                user: currentSessionUser,
              },
            },
          };
        } catch (e) {
          return { data: { session: null } };
        }
      },
      onAuthStateChange(cb) {
        authListeners.add(cb);
        return {
          data: {
            subscription: {
              unsubscribe: () => authListeners.delete(cb),
            },
          },
        };
      },
      async signUp({ email, password, options }) {
        try {
          const m = options?.data || {};
          const res = await convexClient.action('auth:signIn', {
            provider: 'password',
            params: {
              flow: 'signUp',
              email,
              phone: m.phone || email.split('@')[0],
              full_name: m.full_name || '',
              password,
            },
          });
          const token = res?.tokens?.token;
          if (!token) throw new Error('Account created, please sign in.');

          currentToken = token;
          convexClient.setAuth(async () => token);
          await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);

          // Get current user profile
          const me = await convexClient.query('users:current');
          currentSessionUser = me?.user ? { id: me.user.id, ...me.user } : { id: 'user' };
          await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentSessionUser));

          const session = { access_token: token, user: currentSessionUser };
          authListeners.forEach((fn) => fn('SIGNED_IN', session));
          return { data: { session, user: currentSessionUser }, error: null };
        } catch (e) {
          return { data: {}, error: { message: friendlyError(e.message) } };
        }
      },
      async signInWithPassword({ email, password }) {
        try {
          const res = await convexClient.action('auth:signIn', {
            provider: 'password',
            params: {
              flow: 'signIn',
              email,
              password,
            },
          });
          const token = res?.tokens?.token;
          if (!token) throw new Error('Invalid login credentials');

          currentToken = token;
          convexClient.setAuth(async () => token);
          await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);

          const me = await convexClient.query('users:current');
          currentSessionUser = me?.user ? { id: me.user.id, ...me.user } : { id: 'user' };
          await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentSessionUser));

          const session = { access_token: token, user: currentSessionUser };
          authListeners.forEach((fn) => fn('SIGNED_IN', session));
          return { data: { session }, error: null };
        } catch (e) {
          return { data: {}, error: { message: friendlyError(e.message) } };
        }
      },
      async signOut() {
        try {
          await convexClient.action('auth:signOut', {});
        } catch (e) {
          /* ignore */
        }
        currentToken = null;
        currentSessionUser = null;
        if (convexClient) convexClient.clearAuth();
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
        await AsyncStorage.removeItem(AUTH_USER_KEY);
        authListeners.forEach((fn) => fn('SIGNED_OUT', null));
        return { error: null };
      },
      startAutoRefresh() {},
      stopAutoRefresh() {},
    },

    from(table) {
      class ConvexQueryBuilder {
        constructor(tbl) {
          this.tbl = tbl;
          this.filters = [];
          this.sort = null;
          this.limitNum = 50;
          this.isSingle = false;
        }
        select() { return this; }
        eq(col, val) { this.filters.push({ col, val }); return this; }
        in(col, arr) { this.inFilter = { col, arr }; return this; }
        order(col, opts = {}) { this.sort = { col, asc: opts.ascending !== false }; return this; }
        limit(n) { this.limitNum = n; return this; }
        maybeSingle() { this.isSingle = true; return this; }
        single() { this.isSingle = true; return this; }
        async update(patch) {
          if (this.tbl === 'notifications' && this.inFilter) {
            await convexClient.mutation('notifications:markRead', { ids: this.inFilter.arr });
          }
          return { data: null, error: null };
        }
        async then(resolve, reject) {
          try {
            let data = null;
            if (this.tbl === 'pricing_rates') {
              const s = await convexClient.query('admin:settings');
              data = s?.rates || [];
            } else if (this.tbl === 'tow_requests') {
              const opFilter = this.filters.find((f) => f.col === 'operator_id');
              const role = opFilter ? 'operator' : 'customer';
              data = await convexClient.query('tows:history', { role });
            } else if (this.tbl === 'notifications') {
              data = await convexClient.query('notifications:list', { limit: this.limitNum });
            } else if (this.tbl === 'profiles') {
              const cur = await convexClient.query('users:current');
              data = cur?.user || null;
            } else if (this.tbl === 'operators') {
              const cur = await convexClient.query('users:current');
              data = cur?.operator || null;
            } else if (this.tbl === 'app_settings') {
              const cur = await convexClient.query('users:current');
              data = cur?.settings || null;
            } else if (this.tbl === 'wallet_transactions') {
              const w = await convexClient.query('operators:walletData');
              data = w?.transactions || [];
            } else if (this.tbl === 'topup_requests') {
              const w = await convexClient.query('operators:walletData');
              data = w?.pendingTopup ? [w.pendingTopup] : [];
            }

            if (Array.isArray(data) && this.isSingle) {
              data = data[0] || null;
            }
            resolve({ data, error: null });
          } catch (e) {
            reject({ data: null, error: { message: friendlyError(e.message) } });
          }
        }
      }
      return new ConvexQueryBuilder(table);
    },

    async rpc(fn, args = {}) {
      const mapping = RPC_ROUTER[fn];
      if (!mapping) {
        throw new Error(`RPC function '${fn}' not mapped in Convex adapter.`);
      }
      try {
        let res;
        if (mapping.type === 'query') {
          res = await convexClient.query(mapping.fn, args);
        } else if (mapping.type === 'mutation') {
          res = await convexClient.mutation(mapping.fn, args);
        } else {
          res = await convexClient.action(mapping.fn, args);
        }
        return { data: res, error: null };
      } catch (e) {
        return { data: null, error: { message: friendlyError(e.message) } };
      }
    },

    storage: {
      from(bucket) {
        return {
          async upload(path, fileData, opts) {
            try {
              const uploadUrl = await convexClient.mutation('files:generateUploadUrl', {});
              const res = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Content-Type': opts?.contentType || 'image/jpeg' },
                body: fileData,
              });
              const { storageId } = await res.json();
              await convexClient.mutation('files:saveFile', {
                storage_id: storageId,
                bucket: bucket === 'job-photos' ? 'job-photos' : bucket === 'topup-proofs' ? 'topup-proofs' : 'operator-docs',
              });
              return { data: { path: storageId }, error: null };
            } catch (e) {
              return { data: null, error: { message: e.message } };
            }
          },
        };
      },
    },

    channel(name) {
      const ch = {
        on: () => ch,
        subscribe: () => ch,
      };
      return ch;
    },
    removeChannel() {},
  };
}

const live = createLiveConvexAdapter();
const current = live;
const listeners = new Set();

export function isDemo() { return false; }
export function hasLiveBackend() { return true; }
export function setDemoBackend() {
  listeners.forEach((fn) => fn());
}
export function onBackendChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export const supabase = new Proxy({}, {
  get(_, key) {
    const c = current;
    const v = c[key];
    return typeof v === 'function' ? v.bind(c) : v;
  },
});

export function friendlyError(message) {
  const m = String(message || '');
  if (/network request failed|failed to fetch|fetch failed/i.test(m)) return 'No internet connection. Check your data and try again.';
  if (/invalid login credentials|invalid credentials/i.test(m)) return 'Wrong phone number or password.';
  if (/already exists|already registered/i.test(m)) return 'An account with this phone number already exists. Log in instead.';
  if (/password.*least/i.test(m)) return 'Password must be at least 6 characters.';
  if (/JWT|token|session/i.test(m)) return 'Your session expired. Please log in again.';
  return m.replace(/^Uncaught Error:\s*|^Error:\s*|^.*?ERROR:\s*/, '');
}

export async function rpc(fn, args = {}) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(friendlyError(error.message));
  return data;
}

export async function select(query) {
  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error.message));
  return data;
}

export function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('234')) d = '0' + d.slice(3);
  if (d.length === 10) d = '0' + d;
  return d;
}

export const phoneEmail = (p) => `${normPhone(p)}@users.townaija.app`;

const localPhotos = new Map();
export function rememberLocalPhoto(path, uri) { if (path && uri) localPhotos.set(path, uri); }

export const publicPhotoUrl = (path) => {
  if (!path) return null;
  if (localPhotos.has(path)) return localPhotos.get(path);
  if (/^(file|content|https?):/.test(path)) return path;
  return `${CONVEX_SITE_URL}/api/storage/${path}`;
};
