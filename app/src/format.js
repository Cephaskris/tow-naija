export const naira = (n) => '₦' + Math.round(Number(n || 0)).toLocaleString('en-NG');

export const TRUCK = {
  wheel_lift: 'Wheel-lift',
  flatbed: 'Flatbed',
  heavy_duty: 'Heavy-duty',
};
export const TRUCK_INFO = {
  wheel_lift: 'Lifts the front or back wheels. For cars that can roll.',
  flatbed: 'Carries the whole vehicle. Safest for SUVs, accidents and locked wheels.',
  heavy_duty: 'For buses, trucks and heavy recovery.',
};
export const VEHICLE = { car: 'Car', suv: 'SUV', van_bus: 'Bus / Van', truck: 'Truck' };
export const VEHICLE_ICON = { car: 'mc:car-side', suv: 'mc:car-estate', van_bus: 'mc:van-utility', truck: 'mc:truck-outline' };
export const TRUCK_ICON = { wheel_lift: 'mc:tow-truck', flatbed: 'mc:truck-flatbed', heavy_duty: 'mc:truck-outline' };
export const PROBLEM_ICON = { breakdown: 'mc:car-wrench', accident: 'mc:car-emergency', wont_start: 'mc:car-key', flat_tyre: 'mc:tire', stuck: 'mc:car-off', other: 'help-circle' };
export const PROBLEM = {
  breakdown: 'Breakdown',
  accident: 'Accident',
  wont_start: "Won't start",
  flat_tyre: 'Flat tyre',
  stuck: 'Stuck / ditch',
  other: 'Other',
};

export const STATUS = {
  open: 'Finding an operator',
  matched: 'Operator on the way',
  arrived: 'Operator has arrived',
  in_progress: 'Towing',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export const ACTIVE = ['open', 'matched', 'arrived', 'in_progress', 'delivered'];

export function ago(d) {
  if (!d) return '';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function shortDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function minutesLeft(iso) {
  if (!iso) return null;
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
}

export const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';

export function km(n) {
  const v = Number(n || 0);
  return v < 1 ? `${Math.round(v * 1000)} m` : `${v.toFixed(1)} km`;
}

// Rough city-driving ETA: ~2.5 min per km plus 5 min to get moving.
export const etaMinutes = (distanceKm) => Math.max(5, Math.round(5 + Number(distanceKm || 0) * 2.5));
