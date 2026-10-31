import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Scrypt } from "lucia";

export const updateAppRelease = mutation({
  args: {
    apk_url: v.string(),
    latest_version: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("app_settings").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        apk_url: args.apk_url,
        latest_version: args.latest_version,
        updated_at: Date.now(),
      });
      return { success: true, id: existing._id };
    }
    return { success: false };
  },
});

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

export const makeAdminByPhone = mutation({
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

export const provisionAdmin = mutation({
  args: {
    phone: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const p = args.phone.replace(/\D/g, "").replace(/^234/, "0");
    const email = `${p}@users.townaija.app`;
    let user = await ctx.db
      .query("users")
      .withIndex("phone", (q) => q.eq("phone", p))
      .first();

    let userId;
    if (!user) {
      userId = await ctx.db.insert("users", {
        phone: p,
        email,
        name: args.name || "Admin User",
        full_name: args.name || "Admin User",
        is_operator: false,
        is_admin: true,
        admin_role: (args.role as any) || "super",
        status: "active",
        rating_avg: 5.0,
        rating_count: 1,
      });
    } else {
      userId = user._id;
      await ctx.db.patch(user._id, {
        is_admin: true,
        admin_role: (args.role as any) || "super",
        status: "active",
        full_name: args.name || user.full_name || user.name || "Admin User",
      });
    }

    const secret = await new Scrypt().hash(args.password);

    const existingAcc = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", "password")
      )
      .first();

    if (existingAcc) {
      await ctx.db.patch(existingAcc._id, {
        providerAccountId: email,
        secret,
      });
      return { success: true, updatedAccount: true, userId, email, phone: p };
    }

    const byAccountId = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email)
      )
      .first();

    if (byAccountId) {
      await ctx.db.patch(byAccountId._id, {
        userId,
        secret,
      });
      return { success: true, updatedExistingAccount: true, userId, email, phone: p };
    }

    const accId = await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: email,
      secret,
    });
    return { success: true, createdAccount: accId, userId, email, phone: p };
  },
});


export const getDebugSummary = query({
  args: {},
  handler: async (ctx) => {
    const tows = await ctx.db.query("tow_requests").order("desc").take(20);
    const users = await ctx.db.query("users").order("desc").take(20);
    const operators = await ctx.db.query("operators").collect();
    return {
      towsCount: tows.length,
      tows: tows.map((t) => ({
        id: t._id,
        ref: t.ref,
        vehicle: t.vehicle_desc,
        status: t.status,
        pickup: t.pickup_address,
        dropoff: t.dropoff_address,
        offer: t.offer_amount,
        created: new Date(t._creationTime).toISOString(),
      })),
      usersCount: users.length,
      users: users.map((u) => ({
        id: u._id,
        phone: u.phone,
        name: u.full_name || u.name,
        is_admin: u.is_admin,
        is_operator: u.is_operator,
      })),
      operatorsCount: operators.length,
    };
  },
});

export const getAuthAccounts = query({
  args: {},
  handler: async (ctx) => {
    const accs = await ctx.db.query("authAccounts").collect();
    return accs.map((a) => ({
      id: a._id,
      userId: a.userId,
      provider: a.provider,
      providerAccountId: a.providerAccountId,
    }));
  },
});

