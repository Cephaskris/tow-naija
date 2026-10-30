/*
  Helper math, formatting and distance functions
  Ported from PostgreSQL in supabase/01_schema.sql
*/

export function normPhone(p?: string | null): string {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("234")) d = "0" + d.slice(3);
  if (d.length === 10) d = "0" + d;
  return d;
}

export function phoneEmail(p?: string | null): string {
  return `${normPhone(p)}@users.townaija.app`;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type VehicleType = "car" | "suv" | "van_bus" | "truck";
export type TruckType = "wheel_lift" | "flatbed" | "heavy_duty";

export function compatibleTruckTypes(vehicle: VehicleType, wheelsRoll: boolean): TruckType[] {
  if (vehicle === "car" && wheelsRoll) {
    return ["wheel_lift", "flatbed", "heavy_duty"];
  }
  if (vehicle === "car" || vehicle === "suv" || vehicle === "van_bus") {
    return ["flatbed", "heavy_duty"];
  }
  return ["heavy_duty"];
}

export function roundNaira(amount: number): number {
  return Math.round(amount / 500) * 500;
}

export function naira(amount: number): string {
  return "₦" + Math.round(Number(amount || 0)).toLocaleString("en-NG");
}

export function vehicleLabel(v: VehicleType): string {
  switch (v) {
    case "car": return "Car";
    case "suv": return "SUV";
    case "van_bus": return "Bus/Van";
    case "truck": return "Truck";
    default: return v;
  }
}

export function randomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
