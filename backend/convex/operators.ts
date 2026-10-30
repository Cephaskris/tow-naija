import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { haversineKm, naira, TruckType, vehicleLabel, VehicleType } from "./lib";

const truckTypeValidator = v.union(v.literal("wheel_lift"), v.literal("flatbed"), v.literal("heavy_duty"));

export const registerOperator = mutation({
  args: {
    p: v.object({
      truck_type: truckTypeValidator,
      truck_plate: v.string(),
      truck_make_model: v.optional(v.string()),
      base_area: v.optional(v.string()),
      city_id: v.optional(v.id("cities")),
      license_doc_path: v.string(),
      id_doc_path: v.optional(v.string()),
      truck_photo_path: v.string(),
      selfie_path: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    const p = args.p;
    if (!p.truck_plate.trim()) throw new Error("Truck plate number is required.");
    if (!p.license_doc_path || !p.truck_photo_path) {
      throw new Error("Driver's licence and truck photo are required.");
    }

    const existing = await ctx.db
      .query("operators")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .first();

    if (existing && ["approved", "suspended"].includes(existing.status)) {
      throw new Error("Your operator account already exists. Contact support to change details.");
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "pending",
        truck_type: p.truck_type,
        truck_plate: p.truck_plate.trim().toUpperCase(),
        truck_make_model: p.truck_make_model || "",
        base_area: p.base_area || "",
        license_doc_path: p.license_doc_path,
        id_doc_path: p.id_doc_path,
        truck_photo_path: p.truck_photo_path,
        selfie_path: p.selfie_path,
        review_note: undefined,
      });
    } else {
      await ctx.db.insert("operators", {
        user_id: userId,
        status: "pending",
        truck_type: p.truck_type,
        truck_plate: p.truck_plate.trim().toUpperCase(),
        truck_make_model: p.truck_make_model || "",
        base_area: p.base_area || "",
        city_id: p.city_id,
        license_doc_path: p.license_doc_path,
        id_doc_path: p.id_doc_path,
        truck_photo_path: p.truck_photo_path,
        selfie_path: p.selfie_path,
        is_online: false,
        wallet_balance: 0,
        jobs_completed: 0,
        cancellations: 0,
      });
    }

    await ctx.db.patch(userId, { is_operator: true });
  },
});

export const setOnline = mutation({
  args: {
    p_online: v.boolean(),
    p_lat: v.optional(v.number()),
    p_lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    const op = await ctx.db
      .query("operators")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .first();

    if (!op) throw new Error("You are not registered as a tow operator.");
    if (op.status !== "approved") throw new Error("Your operator account is not approved yet.");

    const settings = await ctx.db.query("app_settings").first();
    const minBal = settings?.min_wallet_balance || 1000;
    if (args.p_online && op.wallet_balance < minBal) {
      throw new Error(`Top up your wallet. Minimum balance to receive jobs is ${naira(minBal)}.`);
    }

    const now = Date.now();
    await ctx.db.patch(op._id, {
      is_online: args.p_online,
      last_lat: args.p_lat ?? op.last_lat,
      last_lng: args.p_lng ?? op.last_lng,
      last_seen_at: now,
    });

    if (!args.p_online) {
      // Withdraw pending bids
      const pendingBids = await ctx.db
        .query("bids")
        .withIndex("by_operator_status", (q) => q.eq("operator_id", userId).eq("status", "pending"))
        .collect();
      for (const b of pendingBids) {
        await ctx.db.patch(b._id, { status: "withdrawn", updated_at: now });
      }
    }
  },
});

export const updateLocation = mutation({
  args: {
    p_lat: v.number(),
    p_lng: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const op = await ctx.db
      .query("operators")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .first();
    if (!op) return;

    const now = Date.now();
    await ctx.db.patch(op._id, {
      last_lat: args.p_lat,
      last_lng: args.p_lng,
      last_seen_at: now,
    });

    // If operator has an active job, update job_tracking
    const activeReq = await ctx.db
      .query("tow_requests")
      .withIndex("by_operator", (q) => q.eq("operator_id", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "matched"),
          q.eq(q.field("status"), "arrived"),
          q.eq(q.field("status"), "in_progress")
        )
      )
      .first();

    if (activeReq) {
      const tracking = await ctx.db
        .query("job_tracking")
        .withIndex("by_request", (q) => q.eq("request_id", activeReq._id))
        .first();

      if (tracking) {
        await ctx.db.patch(tracking._id, { lat: args.p_lat, lng: args.p_lng, updated_at: now });
      } else {
        await ctx.db.insert("job_tracking", {
          request_id: activeReq._id,
          operator_id: userId,
          lat: args.p_lat,
          lng: args.p_lng,
          updated_at: now,
        });
      }
    }
  },
});

export const operatorFeed = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const op = await ctx.db
      .query("operators")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .first();

    if (!op || !op.is_online || op.status !== "approved" || op.last_lat == null || op.last_lng == null) {
      return [];
    }

    const settings = await ctx.db.query("app_settings").first();
    const minBal = settings?.min_wallet_balance || 1000;
    if (op.wallet_balance < minBal) return [];

    // Check if operator has active job
    const activeJob = await ctx.db
      .query("tow_requests")
      .withIndex("by_operator", (q) => q.eq("operator_id", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "matched"),
          q.eq(q.field("status"), "arrived"),
          q.eq(q.field("status"), "in_progress")
        )
      )
      .first();
    if (activeJob) return [];

    const openRequests = await ctx.db
      .query("tow_requests")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    const maxRadius = settings?.search_radius_km || 15;
    const feed = [];

    for (const r of openRequests) {
      if (r.customer_id === userId) continue;
      if (!r.required_truck_types.includes(op.truck_type as TruckType)) continue;

      const d = Math.round(haversineKm(op.last_lat, op.last_lng, r.pickup_lat, r.pickup_lng) * 10) / 10;
      if (d > maxRadius) continue;

      const myBid = await ctx.db
        .query("bids")
        .withIndex("by_request_operator", (q) => q.eq("request_id", r._id).eq("operator_id", userId))
        .first();

      if (myBid && ["accepted", "rejected"].includes(myBid.status)) continue;

      const cu = await ctx.db.get(r.customer_id);

      feed.push({
        id: r._id,
        _id: r._id,
        ref: r.ref,
        vehicle_type: r.vehicle_type,
        vehicle_desc: r.vehicle_desc,
        problem_type: r.problem_type,
        wheels_roll: r.wheels_roll,
        keys_available: r.keys_available,
        notes: r.notes,
        photo_paths: r.photo_paths,
        pickup_address: r.pickup_address,
        pickup_lat: r.pickup_lat,
        pickup_lng: r.pickup_lng,
        dropoff_address: r.dropoff_address,
        dropoff_lat: r.dropoff_lat,
        dropoff_lng: r.dropoff_lng,
        distance_km: r.distance_km,
        offer_amount: r.offer_amount,
        payment_method: r.payment_method,
        created_at: new Date(r._creationTime).toISOString(),
        pickup_distance_km: d,
        customer_name: cu?.full_name?.split(" ")[0] || "Customer",
        customer_rating: cu?.rating_avg || 5,
        customer_rating_count: cu?.rating_count || 1,
        my_bid_amount: myBid?.amount,
        my_bid_status: myBid?.status,
      });
    }

    feed.sort((a, b) => a.pickup_distance_km - b.pickup_distance_km);
    return feed;
  },
});

export const placeBid = mutation({
  args: {
    p_request: v.id("tow_requests"),
    p_amount: v.number(),
    p_eta: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    const op = await ctx.db
      .query("operators")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .first();

    if (!op || op.status !== "approved" || !op.is_online) {
      throw new Error("Go online to send offers.");
    }

    const req = await ctx.db.get(args.p_request);
    if (!req || req.status !== "open") throw new Error("This request is no longer available.");
    if (req.customer_id === userId) throw new Error("You cannot bid on your own request.");
    if (!req.required_truck_types.includes(op.truck_type as TruckType)) {
      throw new Error("Your truck type cannot tow this vehicle.");
    }

    if (args.p_amount < req.offer_amount) {
      throw new Error(`Your price cannot be lower than the customer's offer (${naira(req.offer_amount)}).`);
    }

    const settings = await ctx.db.query("app_settings").first();
    const expiryMin = settings?.bid_expiry_min || 10;
    const now = Date.now();
    const expiresAt = now + expiryMin * 60 * 1000;
    const eta = Math.max(1, Math.min(240, args.p_eta || 20));

    const existingBid = await ctx.db
      .query("bids")
      .withIndex("by_request_operator", (q) => q.eq("request_id", req._id).eq("operator_id", userId))
      .first();

    let bidId;
    if (existingBid) {
      await ctx.db.patch(existingBid._id, {
        amount: Math.round(args.p_amount),
        eta_minutes: eta,
        status: "pending",
        expires_at: expiresAt,
        updated_at: now,
      });
      bidId = existingBid._id;
    } else {
      bidId = await ctx.db.insert("bids", {
        request_id: req._id,
        operator_id: userId,
        amount: Math.round(args.p_amount),
        eta_minutes: eta,
        status: "pending",
        expires_at: expiresAt,
        updated_at: now,
      });
    }

    await ctx.db.insert("request_events", {
      request_id: req._id,
      actor_id: userId,
      event: "bid",
      detail: { operator_id: userId, amount: args.p_amount },
    });

    await ctx.db.insert("notifications", {
      user_id: req.customer_id,
      seq: now,
      title: args.p_amount === req.offer_amount ? "An operator accepted your price" : "New counter-offer",
      body: `${naira(args.p_amount)} · arrives in ~${eta} min`,
      data: { request_id: req._id, type: "new_bid" },
    });

    return bidId;
  },
});

export const withdrawBid = mutation({
  args: { p_request: v.id("tow_requests") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const bid = await ctx.db
      .query("bids")
      .withIndex("by_request_operator", (q) => q.eq("request_id", args.p_request).eq("operator_id", userId))
      .first();

    if (bid && bid.status === "pending") {
      await ctx.db.patch(bid._id, { status: "withdrawn", updated_at: Date.now() });
    }
  },
});

export const requestTopup = mutation({
  args: {
    p_amount: v.number(),
    p_reference: v.optional(v.string()),
    p_proof_path: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    const op = await ctx.db
      .query("operators")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .first();

    if (!op) throw new Error("Only registered operators can top up.");
    if (args.p_amount < 500) throw new Error("Minimum top-up is ₦500.");

    const pending = await ctx.db
      .query("topup_requests")
      .withIndex("by_operator", (q) => q.eq("operator_id", userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (pending) throw new Error("You already have a top-up waiting for approval.");

    const topupId = await ctx.db.insert("topup_requests", {
      operator_id: userId,
      amount: args.p_amount,
      reference: args.p_reference || "",
      proof_path: args.p_proof_path,
      status: "pending",
    });

    return topupId;
  },
});

export const walletData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { transactions: [], pendingTopup: null, operator: null };

    const op = await ctx.db
      .query("operators")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .first();

    const txs = await ctx.db
      .query("wallet_transactions")
      .withIndex("by_operator", (q) => q.eq("operator_id", userId))
      .order("desc")
      .take(30);

    const pending = await ctx.db
      .query("topup_requests")
      .withIndex("by_operator", (q) => q.eq("operator_id", userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    return {
      transactions: txs.map((t) => ({
        ...t,
        id: t._id,
        created_at: new Date(t._creationTime).toISOString(),
      })),
      pendingTopup: pending ? { ...pending, id: pending._id, created_at: new Date(pending._creationTime).toISOString() } : null,
      operator: op ? { ...op, id: op.user_id } : null,
    };
  },
});
