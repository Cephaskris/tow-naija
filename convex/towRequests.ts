import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a new tow request from a passenger
export const createTowRequest = mutation({
  args: {
    passengerId: v.id("users"),
    pickupAddress: v.string(),
    pickupLat: v.number(),
    pickupLng: v.number(),
    dropoffAddress: v.optional(v.string()),
    dropoffLat: v.optional(v.number()),
    dropoffLng: v.optional(v.number()),
    towType: v.optional(v.string()),
    vehicleMake: v.optional(v.string()),
    vehicleModel: v.optional(v.string()),
    vehicleYear: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Generate a beautiful, realistic pricing range
    const basePrices: Record<string, number> = {
      flat: 15000,
      dolly: 12000,
      trailer: 25000,
    };
    const towKey = args.towType || "flat";
    const basePrice = basePrices[towKey] || 15000;
    const finalPrice = basePrice + Math.floor(Math.random() * 3000);

    const requestId = await ctx.db.insert("towRequests", {
      passengerId: args.passengerId,
      status: "searching",
      price: finalPrice,
      towType: args.towType || "Flat Towing",
      vehicleMake: args.vehicleMake || "Honda",
      vehicleModel: args.vehicleModel || "Accord",
      vehicleYear: args.vehicleYear || "2010",
      pickupLocation: {
        lat: args.pickupLat,
        lng: args.pickupLng,
        address: args.pickupAddress,
      },
      dropoffLocation:
        args.dropoffAddress && args.dropoffLat && args.dropoffLng
          ? {
              lat: args.dropoffLat,
              lng: args.dropoffLng,
              address: args.dropoffAddress,
            }
          : undefined,
    });

    return { requestId };
  },
});

// Fetch active request for a passenger (real-time subscription)
export const getActiveRequest = query({
  args: { passengerId: v.id("users") },
  handler: async (ctx, args) => {
    const active = await ctx.db
      .query("towRequests")
      .withIndex("by_passengerId", (q) => q.eq("passengerId", args.passengerId))
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "cancelled"),
          q.or(
            q.neq(q.field("status"), "completed"),
            q.neq(q.field("paymentStatus"), "paid")
          )
        )
      )
      .order("desc")
      .first();

    if (!active) return null;

    // If driver is assigned, enrich with driver details
    let driverInfo = null;
    if (active.driverId) {
      const driver = await ctx.db.get(active.driverId);
      if (driver) {
        const user = await ctx.db.get(driver.userId);
        driverInfo = {
          driverId: driver._id,
          name: user ? `${user.firstName} ${user.lastName}` : "Verified Operator",
          phone: user ? user.phone : "N/A",
          rating: driver.rating ?? 4.9,
          ratingCount: driver.ratingCount ?? 12,
          vehicleMake: driver.vehicleDetails?.make ?? "Tow Truck",
          vehicleModel: driver.vehicleDetails?.model ?? "F-150",
          licensePlate: driver.vehicleDetails?.licensePlate ?? "LAG-491-BD",
          towType: driver.vehicleDetails?.towType ?? "Flatbed",
          location: driver.location,
        };
      }
    }

    return {
      ...active,
      driverInfo,
    };
  },
});

// Fetch incoming searching request for a driver who is online
export const getIncomingRequest = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Check if the current driver profile is online and approved
    const driver = await ctx.db
      .query("drivers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!driver || !driver.isAvailable || driver.verificationStatus !== "approved") {
      return null;
    }

    // Find the oldest request that is currently searching
    const incoming = await ctx.db
      .query("towRequests")
      .withIndex("by_status", (q) => q.eq("status", "searching"))
      .order("asc")
      .first();

    if (!incoming) return null;

    // Enrich with passenger user details
    const passengerUser = await ctx.db.get(incoming.passengerId);

    // Check if driver has already submitted an offer on this request
    const existingOffer = await ctx.db
      .query("tripOffers")
      .withIndex("by_requestId_and_driverId", (q) =>
        q.eq("requestId", incoming._id).eq("driverId", driver._id)
      )
      .first();

    return {
      ...incoming,
      passengerName: passengerUser
        ? `${passengerUser.firstName} ${passengerUser.lastName}`
        : "Stranded Passenger",
      passengerPhone: passengerUser ? passengerUser.phone : "N/A",
      driverOffer: existingOffer || null,
    };
  },
});

// Real-time query for passenger to fetch all active driver bids/offers
export const getOffersForRequest = query({
  args: { requestId: v.id("towRequests") },
  handler: async (ctx, args) => {
    const offers = await ctx.db
      .query("tripOffers")
      .withIndex("by_requestId", (q) => q.eq("requestId", args.requestId))
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      offers.map(async (offer) => {
        const driver = await ctx.db.get(offer.driverId);
        const user = await ctx.db.get(offer.driverUserId);
        return {
          ...offer,
          driverName: user ? `${user.firstName} ${user.lastName}` : "Verified Driver",
          driverPhone: user ? user.phone : "N/A",
          rating: driver?.rating ?? 5.0,
          ratingCount: driver?.ratingCount ?? 1,
          vehicleDetails: driver?.vehicleDetails,
          location: driver?.location,
        };
      })
    );

    return enriched;
  },
});

// Driver submits a proposed price offer
export const submitDriverOffer = mutation({
  args: {
    requestId: v.id("towRequests"),
    userId: v.id("users"),
    offeredPrice: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.offeredPrice <= 0) {
      throw new Error("Price offer must be greater than zero.");
    }

    const driver = await ctx.db
      .query("drivers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!driver) throw new Error("Driver profile not found.");

    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "searching") {
      throw new Error("This request is no longer active.");
    }

    // Check if offer already exists for this driver and request
    const existing = await ctx.db
      .query("tripOffers")
      .withIndex("by_requestId_and_driverId", (q) =>
        q.eq("requestId", args.requestId).eq("driverId", driver._id)
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        offeredPrice: args.offeredPrice,
        lastSender: "driver",
        status: "pending",
        updatedAt: now,
      });
      return { success: true, offerId: existing._id };
    } else {
      const offerId = await ctx.db.insert("tripOffers", {
        requestId: args.requestId,
        driverId: driver._id,
        driverUserId: args.userId,
        offeredPrice: args.offeredPrice,
        lastSender: "driver",
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, offerId };
    }
  },
});

// Passenger submits a counter-offer price
export const submitPassengerCounterOffer = mutation({
  args: {
    offerId: v.id("tripOffers"),
    counterPrice: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.counterPrice <= 0) {
      throw new Error("Counter price must be greater than zero.");
    }

    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Offer not found.");

    const request = await ctx.db.get(offer.requestId);
    if (!request || request.status !== "searching") {
      throw new Error("This request is no longer active.");
    }

    await ctx.db.patch(args.offerId, {
      passengerCounterPrice: args.counterPrice,
      lastSender: "passenger",
      status: "countered",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Accept an offer (either driver accepts passenger counter, or passenger accepts driver offer)
export const acceptOffer = mutation({
  args: {
    offerId: v.id("tripOffers"),
    acceptedBy: v.union(v.literal("driver"), v.literal("passenger")),
  },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Offer not found.");

    const request = await ctx.db.get(offer.requestId);
    if (!request) throw new Error("Tow request no longer exists.");
    if (request.status !== "searching") {
      throw new Error("This request has already been accepted.");
    }

    // Determine final agreed price
    // If passenger accepted, agreed price is offeredPrice (or passengerCounterPrice if driver accepted counter)
    const agreedPrice =
      args.acceptedBy === "driver" && offer.passengerCounterPrice
        ? offer.passengerCounterPrice
        : offer.offeredPrice;

    // 1. Assign driver and set status to accepted with agreed price
    await ctx.db.patch(offer.requestId, {
      driverId: offer.driverId,
      price: agreedPrice,
      status: "accepted",
    });

    // 2. Mark this offer as accepted
    await ctx.db.patch(offer._id, {
      status: "accepted",
      updatedAt: Date.now(),
    });

    // 3. Mark driver as unavailable (busy with this trip)
    await ctx.db.patch(offer.driverId, {
      isAvailable: false,
    });

    // 4. Mark all other offers for this request as declined
    const otherOffers = await ctx.db
      .query("tripOffers")
      .withIndex("by_requestId", (q) => q.eq("requestId", offer.requestId))
      .collect();

    for (const o of otherOffers) {
      if (o._id !== offer._id) {
        await ctx.db.patch(o._id, {
          status: "declined",
          updatedAt: Date.now(),
        });
      }
    }

    return { success: true, agreedPrice };
  },
});

// Driver accepts a tow request (legacy direct accept fallback)
export const acceptTowRequest = mutation({
  args: {
    requestId: v.id("towRequests"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db
      .query("drivers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!driver) throw new Error("Driver profile not found.");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Tow request no longer exists.");
    if (request.status !== "searching") {
      throw new Error("This request has already been claimed by another driver.");
    }

    // Assign driver to request
    await ctx.db.patch(args.requestId, {
      driverId: driver._id,
      status: "accepted",
    });

    // Make driver unavailable for other incoming requests while on this job
    await ctx.db.patch(driver._id, {
      isAvailable: false,
    });

    return { success: true };
  },
});

// Driver updates status of the current request
export const updateRequestStatus = mutation({
  args: {
    requestId: v.id("towRequests"),
    status: v.union(v.literal("in_progress"), v.literal("completed"), v.literal("cancelled")),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");

    await ctx.db.patch(args.requestId, {
      status: args.status,
      paymentStatus: args.status === "completed" ? "unpaid" : request.paymentStatus,
    });

    // If completed or cancelled, make the driver available again
    if (args.status === "completed" || args.status === "cancelled") {
      if (request.driverId) {
        await ctx.db.patch(request.driverId, {
          isAvailable: true,
        });
      }
    }

    return { success: true };
  },
});

// Passenger rates driver, submits review and confirms payment
export const rateAndPayTowRequest = mutation({
  args: {
    requestId: v.id("towRequests"),
    rating: v.number(),
    review: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");

    await ctx.db.patch(args.requestId, {
      rating: args.rating,
      review: args.review,
      paymentStatus: "paid",
      paymentMethod: args.paymentMethod || "cash",
      status: "completed",
    });

    // Update driver rating & aggregate earnings
    if (request.driverId) {
      const driver = await ctx.db.get(request.driverId);
      if (driver) {
        const currentCount = driver.ratingCount || 0;
        const currentRating = driver.rating || 5.0;
        const newCount = currentCount + 1;
        const newRating = Number(
          ((currentRating * currentCount + args.rating) / newCount).toFixed(1)
        );
        const currentEarnings = driver.totalEarnings || 0;
        const newEarnings = currentEarnings + (request.price || 0);

        await ctx.db.patch(request.driverId, {
          rating: newRating,
          ratingCount: newCount,
          totalEarnings: newEarnings,
        });
      }
    }

    return { success: true };
  },
});

// Get available drivers for the passenger map 
export const getAvailableDrivers = query({
  args: {},
  handler: async (ctx) => {
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_verificationStatus", (q) =>
        q.eq("verificationStatus", "approved")
      )
      .filter((q) => q.eq(q.field("isAvailable"), true))
      .collect();

    const enriched = await Promise.all(
      drivers.map(async (driver) => {
        const user = await ctx.db.get(driver.userId);
        return {
          id: driver._id,
          lat: driver.location?.lat ?? 6.6018,
          lng: driver.location?.lng ?? 3.3515,
          name: user ? `${user.firstName} ${user.lastName}` : "Tow Truck",
          vehicleMake: driver.vehicleDetails?.make ?? "Truck",
          towType: driver.vehicleDetails?.towType ?? "Flatbed",
        };
      })
    );

    return enriched;
  },
});
