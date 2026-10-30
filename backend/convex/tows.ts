import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  compatibleTruckTypes,
  haversineKm,
  naira,
  randomCode,
  roundNaira,
  vehicleLabel,
  VehicleType,
  TruckType,
} from "./lib";
import { Doc, Id } from "./_generated/dataModel";

const vehicleTypeValidator = v.union(v.literal("car"), v.literal("suv"), v.literal("van_bus"), v.literal("truck"));

export const estimateFare = query({
  args: {
    p_pickup_lat: v.number(),
    p_pickup_lng: v.number(),
    p_dropoff_lat: v.number(),
    p_dropoff_lng: v.number(),
    p_vehicle_type: vehicleTypeValidator,
    p_wheels_roll: v.boolean(),
  },
  handler: async (ctx, args) => {
    let settings = await ctx.db.query("app_settings").first();
    const roadFactor = settings?.road_factor || 1.3;
    const floorPct = settings?.offer_floor_pct || 60;

    const straightKm = haversineKm(args.p_pickup_lat, args.p_pickup_lng, args.p_dropoff_lat, args.p_dropoff_lng);
    const distKm = Math.round(straightKm * roadFactor * 10) / 10;

    const truckTypes = compatibleTruckTypes(args.p_vehicle_type as VehicleType, args.p_wheels_roll);

    const rates = await ctx.db.query("pricing_rates").collect();
    const matchingRates = rates.filter((r) => truckTypes.includes(r.truck_type as TruckType));

    let minFareEst = Infinity;
    for (const r of matchingRates) {
      const calc = Math.max(r.min_fare, r.base_fare + r.per_km * distKm);
      if (calc < minFareEst) minFareEst = calc;
    }
    if (minFareEst === Infinity) {
      minFareEst = 25000;
    }

    const recFare = roundNaira(minFareEst);

    // Find nearest active city
    const cities = await ctx.db.query("cities").collect();
    let matchedCity: Doc<"cities"> | null = null;
    let shortestCityDist = Infinity;
    for (const c of cities) {
      if (!c.is_active) continue;
      const d = haversineKm(c.center_lat, c.center_lng, args.p_pickup_lat, args.p_pickup_lng);
      if (d <= c.service_radius_km && d < shortestCityDist) {
        shortestCityDist = d;
        matchedCity = c;
      }
    }

    return {
      distance_km: distKm,
      truck_types: truckTypes,
      recommended_fare: recFare,
      range_low: roundNaira(recFare * 0.9),
      range_high: roundNaira(recFare * 1.15),
      fare_floor: roundNaira((recFare * floorPct) / 100),
      city_id: matchedCity?._id || null,
      city_name: matchedCity?.name || null,
      in_service: !!matchedCity,
    };
  },
});

export const createTowRequest = mutation({
  args: {
    p: v.object({
      pickup_lat: v.number(),
      pickup_lng: v.number(),
      pickup_address: v.optional(v.string()),
      dropoff_lat: v.number(),
      dropoff_lng: v.number(),
      dropoff_address: v.optional(v.string()),
      vehicle_type: vehicleTypeValidator,
      vehicle_desc: v.optional(v.string()),
      vehicle_make: v.optional(v.string()),
      vehicle_model: v.optional(v.string()),
      vehicle_year: v.optional(v.number()),
      vehicle_color: v.optional(v.string()),
      vehicle_plate: v.optional(v.string()),
      wheels_roll: v.optional(v.boolean()),
      steering_works: v.optional(v.boolean()),
      keys_available: v.optional(v.boolean()),
      problem_type: v.union(v.literal("breakdown"), v.literal("accident"), v.literal("wont_start"), v.literal("flat_tyre"), v.literal("stuck"), v.literal("other")),
      notes: v.optional(v.string()),
      photo_paths: v.optional(v.array(v.string())),
      offer_amount: v.number(),
      payment_method: v.optional(v.union(v.literal("cash"), v.literal("transfer"))),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    const user = await ctx.db.get(userId);
    if (!user || user.status === "blocked") throw new Error("Your account is blocked. Contact support.");

    // Check existing active requests
    const activeReq = await ctx.db
      .query("tow_requests")
      .withIndex("by_customer", (q) => q.eq("customer_id", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "open"),
          q.eq(q.field("status"), "matched"),
          q.eq(q.field("status"), "arrived"),
          q.eq(q.field("status"), "in_progress"),
          q.eq(q.field("status"), "delivered")
        )
      )
      .first();

    if (activeReq) throw new Error("You already have an active tow request.");

    const p = args.p;
    const wheelsRoll = p.wheels_roll ?? true;
    const truckTypes = compatibleTruckTypes(p.vehicle_type as VehicleType, wheelsRoll);

    // Sequence for reference: TN-1049, etc.
    let seqCounter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "tow_ref_seq"))
      .first();
    const nextSeq = (seqCounter?.value || 1048) + 1;
    if (!seqCounter) {
      await ctx.db.insert("counters", { name: "tow_ref_seq", value: nextSeq });
    } else {
      await ctx.db.patch(seqCounter._id, { value: nextSeq });
    }
    const ref = `TN-${nextSeq}`;

    // Calculate distance
    const settings = await ctx.db.query("app_settings").first();
    const roadFactor = settings?.road_factor || 1.3;
    const distKm = Math.round(haversineKm(p.pickup_lat, p.pickup_lng, p.dropoff_lat, p.dropoff_lng) * roadFactor * 10) / 10;

    const rates = await ctx.db.query("pricing_rates").collect();
    const matchingRates = rates.filter((r) => truckTypes.includes(r.truck_type as TruckType));
    let minFareEst = Infinity;
    for (const r of matchingRates) {
      const calc = Math.max(r.min_fare, r.base_fare + r.per_km * distKm);
      if (calc < minFareEst) minFareEst = calc;
    }
    const recFare = roundNaira(minFareEst === Infinity ? 25000 : minFareEst);
    const fareFloor = roundNaira((recFare * (settings?.offer_floor_pct || 60)) / 100);

    if (p.offer_amount < fareFloor) {
      throw new Error(`Your offer is too low. Minimum for this trip is ${naira(fareFloor)}.`);
    }

    const desc = (
      p.vehicle_desc ||
      [p.vehicle_make, p.vehicle_model, p.vehicle_year, p.vehicle_color].filter(Boolean).join(" ")
    ).slice(0, 120) || "Vehicle";

    const now = Date.now();
    const requestId = await ctx.db.insert("tow_requests", {
      ref,
      customer_id: userId,
      status: "open",
      pickup_lat: p.pickup_lat,
      pickup_lng: p.pickup_lng,
      pickup_address: p.pickup_address || "",
      dropoff_lat: p.dropoff_lat,
      dropoff_lng: p.dropoff_lng,
      dropoff_address: p.dropoff_address || "",
      vehicle_type: p.vehicle_type,
      vehicle_desc: desc,
      problem_type: p.problem_type,
      wheels_roll: wheelsRoll,
      keys_available: p.keys_available ?? true,
      notes: (p.notes || "").slice(0, 500),
      photo_paths: (p.photo_paths || []).slice(0, 3),
      distance_km: distKm,
      required_truck_types: truckTypes,
      recommended_fare: recFare,
      fare_floor: fareFloor,
      offer_amount: p.offer_amount,
      payment_method: p.payment_method || "cash",
      pickup_photo_paths: [],
      delivery_photo_paths: [],
      offer_updated_at: now,
      updated_at: now,
    });

    // 4-digit start code
    const startCode = randomCode();
    await ctx.db.insert("request_codes", {
      request_id: requestId,
      start_code: startCode,
    });

    await ctx.db.insert("request_events", {
      request_id: requestId,
      actor_id: userId,
      event: "created",
      detail: { offer: p.offer_amount },
    });

    // Notify online eligible operators
    const maxRadius = settings?.search_radius_km || 15;
    const minBalance = settings?.min_wallet_balance || 1000;
    const operators = await ctx.db.query("operators").withIndex("by_online", (q) => q.eq("is_online", true)).collect();

    for (const op of operators) {
      if (op.status !== "approved" || op.user_id === userId) continue;
      if (op.wallet_balance < minBalance) continue;
      if (!truckTypes.includes(op.truck_type as TruckType)) continue;
      if (op.last_lat == null || op.last_lng == null) continue;

      const d = haversineKm(op.last_lat, op.last_lng, p.pickup_lat, p.pickup_lng);
      if (d <= maxRadius) {
        await ctx.db.insert("notifications", {
          user_id: op.user_id,
          seq: now,
          title: "New tow request nearby",
          body: `${vehicleLabel(p.vehicle_type as VehicleType)} · ${naira(p.offer_amount)} offered`,
          data: { request_id: requestId, type: "new_request" },
        });
      }
    }

    return requestId;
  },
});

export const getRequestBids = query({
  args: { p_request: v.id("tow_requests") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const req = await ctx.db.get(args.p_request);
    if (!req) return [];

    const user = await ctx.db.get(userId);
    const isAdmin = user?.is_admin;
    if (req.customer_id !== userId && !isAdmin) return [];

    const now = Date.now();
    const bids = await ctx.db
      .query("bids")
      .withIndex("by_request", (q) => q.eq("request_id", args.p_request))
      .filter((q) => q.and(q.eq(q.field("status"), "pending"), q.gt(q.field("expires_at"), now)))
      .collect();

    const result = [];
    for (const b of bids) {
      const op = await ctx.db
        .query("operators")
        .withIndex("by_user", (q) => q.eq("user_id", b.operator_id))
        .first();
      const opProfile = await ctx.db.get(b.operator_id);

      let pickupDist = null;
      if (op?.last_lat != null && op?.last_lng != null) {
        pickupDist = Math.round(haversineKm(op.last_lat, op.last_lng, req.pickup_lat, req.pickup_lng) * 10) / 10;
      }

      result.push({
        id: b._id,
        _id: b._id,
        amount: b.amount,
        eta_minutes: b.eta_minutes,
        status: b.status,
        created_at: new Date(b._creationTime).toISOString(),
        expires_at: new Date(b.expires_at).toISOString(),
        is_counter: b.amount > req.offer_amount,
        operator_id: b.operator_id,
        operator_name: opProfile?.full_name || "Tow Operator",
        rating_avg: opProfile?.rating_avg || 5,
        rating_count: opProfile?.rating_count || 1,
        jobs_completed: op?.jobs_completed || 0,
        truck_type: op?.truck_type || "flatbed",
        truck_make_model: op?.truck_make_model || "",
        pickup_distance_km: pickupDist,
      });
    }

    result.sort((a, b) => a.amount - b.amount);
    return result;
  },
});

export const acceptBid = mutation({
  args: { p_bid: v.id("bids") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    const bid = await ctx.db.get(args.p_bid);
    if (!bid) throw new Error("Offer not found.");

    const req = await ctx.db.get(bid.request_id);
    if (!req || req.customer_id !== userId) throw new Error("Request not found.");
    if (req.status !== "open") throw new Error("This request is no longer open.");
    if (bid.status !== "pending" || bid.expires_at < Date.now()) {
      throw new Error("This offer has expired.");
    }

    const now = Date.now();
    await ctx.db.patch(req._id, {
      status: "matched",
      operator_id: bid.operator_id,
      accepted_bid_id: bid._id,
      final_price: bid.amount,
      matched_at: now,
      updated_at: now,
    });

    await ctx.db.patch(bid._id, { status: "accepted", updated_at: now });

    // Reject other bids for this request
    const otherBids = await ctx.db
      .query("bids")
      .withIndex("by_request", (q) => q.eq("request_id", req._id))
      .filter((q) => q.and(q.neq(q.field("_id"), bid._id), q.eq(q.field("status"), "pending")))
      .collect();

    for (const ob of otherBids) {
      await ctx.db.patch(ob._id, { status: "rejected", updated_at: now });
      await ctx.db.insert("notifications", {
        user_id: ob.operator_id,
        seq: now,
        title: "Customer chose another operator",
        body: req.ref,
        data: { request_id: req._id, type: "bid_rejected" },
      });
    }

    // Set initial tracking from operator's last known location
    const op = await ctx.db
      .query("operators")
      .withIndex("by_user", (q) => q.eq("user_id", bid.operator_id))
      .first();

    if (op?.last_lat != null && op?.last_lng != null) {
      const existingTracking = await ctx.db
        .query("job_tracking")
        .withIndex("by_request", (q) => q.eq("request_id", req._id))
        .first();

      if (existingTracking) {
        await ctx.db.patch(existingTracking._id, {
          operator_id: op.user_id,
          lat: op.last_lat,
          lng: op.last_lng,
          updated_at: now,
        });
      } else {
        await ctx.db.insert("job_tracking", {
          request_id: req._id,
          operator_id: op.user_id,
          lat: op.last_lat,
          lng: op.last_lng,
          updated_at: now,
        });
      }
    }

    await ctx.db.insert("request_events", {
      request_id: req._id,
      actor_id: userId,
      event: "matched",
      detail: { operator_id: bid.operator_id, price: bid.amount },
    });

    await ctx.db.insert("notifications", {
      user_id: bid.operator_id,
      seq: now,
      title: "You got the job! 🚛",
      body: `${req.ref} · ${naira(bid.amount)}. Head to pickup.`,
      data: { request_id: req._id, type: "matched" },
    });
  },
});

export const raiseOffer = mutation({
  args: {
    p_request: v.id("tow_requests"),
    p_amount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    const req = await ctx.db.get(args.p_request);
    if (!req || req.customer_id !== userId) throw new Error("Request not found.");
    if (req.status !== "open") throw new Error("This request is no longer open.");
    if (args.p_amount <= req.offer_amount) {
      throw new Error(`New offer must be higher than ${naira(req.offer_amount)}.`);
    }

    const now = Date.now();
    await ctx.db.patch(req._id, {
      offer_amount: args.p_amount,
      offer_updated_at: now,
      updated_at: now,
    });

    await ctx.db.insert("request_events", {
      request_id: req._id,
      actor_id: userId,
      event: "offer_raised",
      detail: { from: req.offer_amount, to: args.p_amount },
    });
  },
});

export const cancelRequest = mutation({
  args: {
    p_request: v.id("tow_requests"),
    p_reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    const req = await ctx.db.get(args.p_request);
    if (!req) throw new Error("Request not found.");

    const now = Date.now();
    const reason = args.p_reason || "";

    if (req.customer_id === userId) {
      if (!["open", "matched", "arrived"].includes(req.status)) {
        throw new Error("The tow has started — use 'Report a problem' instead.");
      }
      await ctx.db.patch(req._id, {
        status: "cancelled",
        cancelled_by: "customer",
        cancel_reason: reason,
        cancelled_at: now,
        updated_at: now,
      });

      // Expire pending bids
      const pendingBids = await ctx.db
        .query("bids")
        .withIndex("by_request", (q) => q.eq("request_id", req._id))
        .filter((q) => q.eq(q.field("status"), "pending"))
        .collect();
      for (const b of pendingBids) {
        await ctx.db.patch(b._id, { status: "expired", updated_at: now });
      }

      if (req.operator_id) {
        await ctx.db.insert("notifications", {
          user_id: req.operator_id,
          seq: now,
          title: "Job cancelled",
          body: `${req.ref} was cancelled by the customer.`,
          data: { request_id: req._id, type: "cancelled" },
        });
      }
    } else if (req.operator_id === userId) {
      if (!["matched", "arrived"].includes(req.status)) {
        throw new Error("You can only cancel before the tow starts. Use 'Report a problem'.");
      }
      // Reopen request for customer
      await ctx.db.patch(req._id, {
        status: "open",
        operator_id: undefined,
        accepted_bid_id: undefined,
        final_price: undefined,
        matched_at: undefined,
        arrived_at: undefined,
        offer_updated_at: now,
        updated_at: now,
      });

      // Clear tracking
      const trk = await ctx.db
        .query("job_tracking")
        .withIndex("by_request", (q) => q.eq("request_id", req._id))
        .first();
      if (trk) await ctx.db.delete(trk._id);

      // Increment operator cancellations
      const op = await ctx.db
        .query("operators")
        .withIndex("by_user", (q) => q.eq("user_id", userId))
        .first();
      if (op) {
        await ctx.db.patch(op._id, { cancellations: op.cancellations + 1 });
      }

      await ctx.db.insert("notifications", {
        user_id: req.customer_id,
        seq: now,
        title: "Operator cancelled",
        body: "Sorry — your operator cancelled. We've reopened your request to other operators.",
        data: { request_id: req._id, type: "reopened" },
      });
    } else {
      throw new Error("Not authorized to cancel this request.");
    }
  },
});

export const markArrived = mutation({
  args: { p_request: v.id("tow_requests") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    const req = await ctx.db.get(args.p_request);
    if (!req || req.operator_id !== userId) throw new Error("Job not found.");
    if (req.status !== "matched") throw new Error("You can only mark arrival once.");

    const now = Date.now();
    await ctx.db.patch(req._id, {
      status: "arrived",
      arrived_at: now,
      updated_at: now,
    });

    await ctx.db.insert("request_events", {
      request_id: req._id,
      actor_id: userId,
      event: "arrived",
      detail: {},
    });

    await ctx.db.insert("notifications", {
      user_id: req.customer_id,
      seq: now,
      title: "Your tow truck has arrived 🚛",
      body: "Inspect together, then give the operator your 4-digit start code.",
      data: { request_id: req._id, type: "arrived" },
    });
  },
});

export const startJob = mutation({
  args: {
    p_request: v.id("tow_requests"),
    p_code: v.string(),
    p_photos: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    const req = await ctx.db.get(args.p_request);
    if (!req || req.operator_id !== userId) throw new Error("Job not found.");
    if (req.status !== "arrived") throw new Error("Mark that you have arrived first.");
    if (!args.p_photos || args.p_photos.length < 1) {
      throw new Error("Take at least one photo of the vehicle's condition before loading.");
    }

    const codeDoc = await ctx.db
      .query("request_codes")
      .withIndex("by_request", (q) => q.eq("request_id", req._id))
      .first();

    if (!codeDoc || codeDoc.start_code.trim() !== args.p_code.trim()) {
      await ctx.db.insert("request_events", {
        request_id: req._id,
        actor_id: userId,
        event: "wrong_start_code",
        detail: {},
      });
      throw new Error("Wrong start code. Ask the customer for the 4-digit code in their app.");
    }

    const now = Date.now();
    await ctx.db.patch(req._id, {
      status: "in_progress",
      started_at: now,
      pickup_photo_paths: args.p_photos,
      updated_at: now,
    });

    await ctx.db.insert("request_events", {
      request_id: req._id,
      actor_id: userId,
      event: "started",
      detail: { photos: args.p_photos.length },
    });

    await ctx.db.insert("notifications", {
      user_id: req.customer_id,
      seq: now,
      title: "Tow started",
      body: "Your vehicle is on its way. Track it live in the app.",
      data: { request_id: req._id, type: "started" },
    });
  },
});

export const markDelivered = mutation({
  args: {
    p_request: v.id("tow_requests"),
    p_photos: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    const req = await ctx.db.get(args.p_request);
    if (!req || req.operator_id !== userId) throw new Error("Job not found.");
    if (req.status !== "in_progress") throw new Error("This job is not in progress.");
    if (!args.p_photos || args.p_photos.length < 1) {
      throw new Error("Take a photo of the vehicle at drop-off.");
    }

    const now = Date.now();
    await ctx.db.patch(req._id, {
      status: "delivered",
      delivered_at: now,
      delivery_photo_paths: args.p_photos,
      updated_at: now,
    });

    await ctx.db.insert("request_events", {
      request_id: req._id,
      actor_id: userId,
      event: "delivered",
      detail: {},
    });

    await ctx.db.insert("notifications", {
      user_id: req.customer_id,
      seq: now,
      title: "Vehicle delivered",
      body: `Please pay ${naira(req.final_price || req.offer_amount)} to your operator and confirm delivery in the app.`,
      data: { request_id: req._id, type: "delivered" },
    });
  },
});

export const confirmDelivery = mutation({
  args: { p_request: v.id("tow_requests") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    const req = await ctx.db.get(args.p_request);
    if (!req || req.customer_id !== userId) throw new Error("Request not found.");
    if (req.status !== "delivered") throw new Error("The operator has not marked this tow as delivered yet.");

    const settings = await ctx.db.query("app_settings").first();
    const commPct = settings?.commission_pct || 10;
    const finalPrice = req.final_price || req.offer_amount;
    const commission = Math.round((finalPrice * commPct) / 100);

    const now = Date.now();
    await ctx.db.patch(req._id, {
      status: "completed",
      completed_at: now,
      commission_amount: commission,
      updated_at: now,
    });

    if (req.operator_id) {
      const op = await ctx.db
        .query("operators")
        .withIndex("by_user", (q) => q.eq("user_id", req.operator_id!))
        .first();

      if (op) {
        const newBal = op.wallet_balance - commission;
        await ctx.db.patch(op._id, {
          wallet_balance: newBal,
          jobs_completed: op.jobs_completed + 1,
        });

        await ctx.db.insert("wallet_transactions", {
          operator_id: op.user_id,
          kind: "commission",
          amount: -commission,
          balance_after: newBal,
          request_id: req._id,
          note: `Commission for ${req.ref}`,
          created_by: userId,
        });
      }

      await ctx.db.insert("notifications", {
        user_id: req.operator_id,
        seq: now,
        title: "Job completed ✅",
        body: `${req.ref} · commission ${naira(commission)} deducted.`,
        data: { request_id: req._id, type: "completed" },
      });
    }

    // Delete tracking row
    const trk = await ctx.db
      .query("job_tracking")
      .withIndex("by_request", (q) => q.eq("request_id", req._id))
      .first();
    if (trk) await ctx.db.delete(trk._id);

    await ctx.db.insert("request_events", {
      request_id: req._id,
      actor_id: userId,
      event: "completed",
      detail: { by: "customer", commission },
    });
  },
});

export const rateJob = mutation({
  args: {
    p_request: v.id("tow_requests"),
    p_stars: v.number(),
    p_comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    const req = await ctx.db.get(args.p_request);
    if (!req) throw new Error("Request not found.");
    if (req.status !== "completed") throw new Error("You can rate after the job is completed.");

    let rateeId: Id<"users">;
    if (userId === req.customer_id && req.operator_id) {
      rateeId = req.operator_id;
    } else if (userId === req.operator_id) {
      rateeId = req.customer_id;
    } else {
      throw new Error("Request not found.");
    }

    const stars = Math.max(1, Math.min(5, Math.round(args.p_stars)));
    const existing = await ctx.db
      .query("ratings")
      .withIndex("by_request_rater", (q) => q.eq("request_id", req._id).eq("rater_id", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { stars, comment: (args.p_comment || "").slice(0, 500) });
    } else {
      await ctx.db.insert("ratings", {
        request_id: req._id,
        rater_id: userId,
        ratee_id: rateeId,
        stars,
        comment: (args.p_comment || "").slice(0, 500),
      });
    }

    // Update target user's rating averages
    const allRatings = await ctx.db
      .query("ratings")
      .withIndex("by_ratee", (q) => q.eq("ratee_id", rateeId))
      .collect();

    const count = allRatings.length;
    const avg = count ? Math.round((allRatings.reduce((sum, r) => sum + r.stars, 0) / count) * 100) / 100 : 0;
    await ctx.db.patch(rateeId, { rating_avg: avg, rating_count: count });
  },
});

export const raiseDispute = mutation({
  args: {
    p_request: v.id("tow_requests"),
    p_reason: v.string(),
    p_details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    const req = await ctx.db.get(args.p_request);
    if (!req) throw new Error("Request not found.");

    let role: "customer" | "operator";
    if (userId === req.customer_id) role = "customer";
    else if (userId === req.operator_id) role = "operator";
    else throw new Error("Request not found.");

    const disputeId = await ctx.db.insert("disputes", {
      request_id: req._id,
      raised_by: userId,
      raised_by_role: role,
      reason: args.p_reason.slice(0, 120),
      details: (args.p_details || "").slice(0, 2000),
      status: "open",
    });

    await ctx.db.insert("request_events", {
      request_id: req._id,
      actor_id: userId,
      event: "dispute_raised",
      detail: { reason: args.p_reason, by: role },
    });

    return disputeId;
  },
});

export const getRequestDetail = query({
  args: { p_request: v.id("tow_requests") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    const req = await ctx.db.get(args.p_request);
    if (!req) throw new Error("Request not found.");

    const currentUser = await ctx.db.get(userId);
    const isAdmin = currentUser?.is_admin;

    let role = "viewer";
    if (userId === req.customer_id) role = "customer";
    else if (userId === req.operator_id) role = "operator";
    else if (isAdmin) role = "admin";
    else {
      const myBid = await ctx.db
        .query("bids")
        .withIndex("by_request_operator", (q) => q.eq("request_id", req._id).eq("operator_id", userId))
        .first();
      if (myBid) role = "bidder";
    }

    if (role === "viewer") throw new Error("Request not found.");

    const showContact = ["matched", "arrived", "in_progress", "delivered"].includes(req.status);

    let operatorInfo = null;
    if (req.operator_id) {
      const opProfile = await ctx.db.get(req.operator_id);
      const op = await ctx.db
        .query("operators")
        .withIndex("by_user", (q) => q.eq("user_id", req.operator_id))
        .first();

      operatorInfo = {
        id: req.operator_id,
        name: opProfile?.full_name || "",
        phone: showContact || role === "admin" ? opProfile?.phone : undefined,
        rating_avg: opProfile?.rating_avg || 5,
        rating_count: opProfile?.rating_count || 0,
        jobs_completed: op?.jobs_completed || 0,
        truck_type: op?.truck_type || "flatbed",
        truck_plate: op?.truck_plate || "",
        truck_make_model: op?.truck_make_model || "",
      };
    }

    const cuProfile = await ctx.db.get(req.customer_id);
    const customerInfo = {
      id: req.customer_id,
      name: role === "bidder" ? cuProfile?.full_name?.split(" ")[0] : cuProfile?.full_name,
      phone: (role === "operator" && showContact) || ["admin", "customer"].includes(role) ? cuProfile?.phone : undefined,
      rating_avg: cuProfile?.rating_avg || 5,
      rating_count: cuProfile?.rating_count || 0,
    };

    let startCode = null;
    if (role === "customer" || role === "admin") {
      const codeDoc = await ctx.db
        .query("request_codes")
        .withIndex("by_request", (q) => q.eq("request_id", req._id))
        .first();
      startCode = codeDoc?.start_code || null;
    }

    const tracking = await ctx.db
      .query("job_tracking")
      .withIndex("by_request", (q) => q.eq("request_id", req._id))
      .first();

    const myRating = await ctx.db
      .query("ratings")
      .withIndex("by_request_rater", (q) => q.eq("request_id", req._id).eq("rater_id", userId))
      .first();

    const myBid = await ctx.db
      .query("bids")
      .withIndex("by_request_operator", (q) => q.eq("request_id", req._id).eq("operator_id", userId))
      .first();

    const openDispute = await ctx.db
      .query("disputes")
      .withIndex("by_request", (q) => q.eq("request_id", req._id))
      .filter((q) => q.eq(q.field("status"), "open"))
      .first();

    return {
      ...req,
      id: req._id,
      _id: req._id,
      my_role: role,
      operator: operatorInfo,
      customer: customerInfo,
      start_code: startCode,
      tracking: tracking ? { lat: tracking.lat, lng: tracking.lng } : null,
      my_rating: myRating?.stars || null,
      my_bid: myBid || null,
      open_dispute: !!openDispute,
      created_at: new Date(req._creationTime).toISOString(),
    };
  },
});

export const myActiveRequest = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // As customer
    const asCust = await ctx.db
      .query("tow_requests")
      .withIndex("by_customer", (q) => q.eq("customer_id", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "open"),
          q.eq(q.field("status"), "matched"),
          q.eq(q.field("status"), "arrived"),
          q.eq(q.field("status"), "in_progress"),
          q.eq(q.field("status"), "delivered")
        )
      )
      .first();
    if (asCust) return asCust._id;

    // As operator
    const asOp = await ctx.db
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
    if (asOp) return asOp._id;

    return null;
  },
});

export const history = query({
  args: { role: v.union(v.literal("customer"), v.literal("operator")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let requests;
    if (args.role === "customer") {
      requests = await ctx.db
        .query("tow_requests")
        .withIndex("by_customer", (q) => q.eq("customer_id", userId))
        .order("desc")
        .take(50);
    } else {
      requests = await ctx.db
        .query("tow_requests")
        .withIndex("by_operator", (q) => q.eq("operator_id", userId))
        .order("desc")
        .take(50);
    }

    return requests.map((r) => ({
      ...r,
      id: r._id,
      _id: r._id,
      created_at: new Date(r._creationTime).toISOString(),
    }));
  },
});
