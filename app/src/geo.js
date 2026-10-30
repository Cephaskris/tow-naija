import * as Location from 'expo-location';
import { DEFAULT_CENTER } from './config';

// Free geocoding by Photon (OpenStreetMap). Fine for testing and early launch;
// swap for a paid geocoder if search quality or volume becomes an issue.
const PHOTON = 'https://photon.komoot.io';
const NIGERIA_BBOX = '2.6,4.2,14.7,13.9';

function label(p) {
  const parts = [p.name, p.street && (p.housenumber ? `${p.housenumber} ${p.street}` : p.street), p.district || p.locality, p.city || p.county, p.state]
    .filter(Boolean);
  const uniq = parts.filter((x, i) => parts.indexOf(x) === i);
  return { title: uniq[0] || 'Unnamed place', subtitle: uniq.slice(1, 4).join(', ') };
}

export async function searchPlaces(q, near) {
  if (!q || q.trim().length < 3) return [];
  const c = near || DEFAULT_CENTER;
  const url = `${PHOTON}/api/?q=${encodeURIComponent(q.trim())}&lat=${c.lat}&lon=${c.lng}&limit=7&lang=en&bbox=${NIGERIA_BBOX}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Townaija/1.0' } });
  if (!res.ok) throw new Error('Search is unavailable right now.');
  const json = await res.json();
  return (json.features || []).map((f) => {
    const l = label(f.properties || {});
    return { id: `${f.properties.osm_type}${f.properties.osm_id}`, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], title: l.title, subtitle: l.subtitle };
  });
}

export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&lang=en`, { headers: { 'User-Agent': 'Townaija/1.0' } });
    const json = await res.json();
    const f = json.features && json.features[0];
    if (!f) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const l = label(f.properties || {});
    return [l.title, l.subtitle].filter(Boolean).join(', ');
  } catch (e) {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export async function ensureLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function currentPosition() {
  const ok = await ensureLocationPermission();
  if (!ok) throw new Error('Allow location access so tow trucks can find you.');
  try {
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  } catch (e) {
    const last = await Location.getLastKnownPositionAsync();
    if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
    throw new Error('Could not get your location. Turn on GPS and try again.');
  }
}

export function distanceKm(a, b) {
  const R = 6371, toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const directionsUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
