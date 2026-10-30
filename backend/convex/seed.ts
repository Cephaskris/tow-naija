import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const initDefaults = internalMutation({
  args: {},
  handler: async (ctx) => {
    // 1. Settings
    const existingSettings = await ctx.db.query("app_settings").first();
    if (!existingSettings) {
      await ctx.db.insert("app_settings", {
        commission_pct: 10,
        min_wallet_balance: 1000,
        search_radius_km: 15,
        max_search_radius_km: 35,
        radius_expand_after_min: 3,
        request_expiry_min: 30,
        bid_expiry_min: 10,
        auto_confirm_hours: 3,
        road_factor: 1.3,
        offer_floor_pct: 60,
        support_phone: "0800 TOWNAIJA",
        bank_name: "GTBank",
        bank_account_name: "Townaija Ltd",
        bank_account_number: "0123456789",
        updated_at: Date.now(),
      });
    }

    // 2. Cities
    const existingCities = await ctx.db.query("cities").collect();
    if (!existingCities.length) {
      await ctx.db.insert("cities", {
        name: "Abuja",
        state: "FCT",
        center_lat: 9.0579,
        center_lng: 7.4951,
        service_radius_km: 60,
        is_active: true,
      });
      await ctx.db.insert("cities", {
        name: "Lagos",
        state: "Lagos",
        center_lat: 6.5244,
        center_lng: 3.3792,
        service_radius_km: 60,
        is_active: false,
      });
    }

    // 3. Pricing rates
    const existingRates = await ctx.db.query("pricing_rates").collect();
    if (!existingRates.length) {
      await ctx.db.insert("pricing_rates", {
        truck_type: "wheel_lift",
        label: "Wheel-lift (hook)",
        base_fare: 15000,
        per_km: 800,
        min_fare: 20000,
      });
      await ctx.db.insert("pricing_rates", {
        truck_type: "flatbed",
        label: "Flatbed",
        base_fare: 20000,
        per_km: 1000,
        min_fare: 25000,
      });
      await ctx.db.insert("pricing_rates", {
        truck_type: "heavy_duty",
        label: "Heavy-duty",
        base_fare: 60000,
        per_km: 2500,
        min_fare: 80000,
      });
    }
  },
});

export const makeAdminByPhone = internalMutation({
  args: { phone: v.string(), role: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const p = args.phone.replace(/\D/g, "").replace(/^234/, "0");
    const user = await ctx.db
      .query("users")
      .withIndex("phone", (q) => q.eq("phone", p))
      .first();
    if (!user) {
      // Create user directly if not already registered
      const id = await ctx.db.insert("users", {
        phone: p,
        email: `${p}@users.townaija.app`,
        full_name: "Admin User",
        is_operator: false,
        is_admin: true,
        admin_role: (args.role as any) || "super",
        status: "active",
        rating_avg: 5.0,
        rating_count: 1,
      });
      return { success: true, created: true, userId: id };
    }
    await ctx.db.patch(user._id, {
      is_admin: true,
      admin_role: (args.role as any) || "super",
    });
    return { success: true, updated: true, userId: user._id };
  },
});
