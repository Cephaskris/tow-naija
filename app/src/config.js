// Convex Cloud endpoints
export const CONVEX_URL = (process.env.EXPO_PUBLIC_CONVEX_URL || 'https://charming-donkey-521.convex.cloud').replace(/\/$/, '');
export const CONVEX_SITE_URL = (process.env.EXPO_PUBLIC_CONVEX_SITE_URL || 'https://charming-donkey-521.convex.site').replace(/\/$/, '');
export const IS_CONFIGURED = CONVEX_URL.startsWith('https://');

// Abuja city centre — used until we have the phone's location.
export const DEFAULT_CENTER = { lat: 9.0579, lng: 7.4951 };
