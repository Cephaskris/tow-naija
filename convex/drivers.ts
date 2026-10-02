import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// 1. Driver submits their details for admin verification
export const submitVerification = mutation({
  args: {
    userId: v.id("users"),
    vehicleMake: v.string(),
    vehicleModel: v.string(),
    vehicleYear: v.string(),
    licensePlate: v.string(),
    towType: v.string(),
    licenseDocumentUrl: v.optional(v.string()),
    registrationDocumentUrl: v.optional(v.string()),
    truckPhotoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db
      .query("drivers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!driver) {
      await ctx.db.insert("drivers", {
        userId: args.userId,
        isAvailable: false,
        verificationStatus: "pending",
        licenseDocumentUrl: args.licenseDocumentUrl,
        registrationDocumentUrl: args.registrationDocumentUrl,
        truckPhotoUrl: args.truckPhotoUrl,
        vehicleDetails: {
          make: args.vehicleMake,
          model: args.vehicleModel,
          year: args.vehicleYear,
          licensePlate: args.licensePlate,
          towType: args.towType,
        },
      });
      return { success: true };
    }

    await ctx.db.patch(driver._id, {
      verificationStatus: "pending",
      licenseDocumentUrl: args.licenseDocumentUrl ?? driver.licenseDocumentUrl,
      registrationDocumentUrl: args.registrationDocumentUrl ?? driver.registrationDocumentUrl,
      truckPhotoUrl: args.truckPhotoUrl ?? driver.truckPhotoUrl,
      vehicleDetails: {
        make: args.vehicleMake,
        model: args.vehicleModel,
        year: args.vehicleYear,
        licensePlate: args.licensePlate,
        towType: args.towType,
      },
    });

    return { success: true };
  },
});

// 2. Get the driver profile for the current user (enriched with user info)
export const getDriverProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const driver = await ctx.db
      .query("drivers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!driver) return null;

    const user = await ctx.db.get(args.userId);
    return {
      ...driver,
      user: user || null,
    };
  },
});

// 3. Get driver's active ongoing job for state restoration & live navigation
export const getActiveDriverTrip = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const driver = await ctx.db
      .query("drivers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!driver) return null;

    // Look for any job that is accepted or in_progress
    const activeTrip = await ctx.db
      .query("towRequests")
      .withIndex("by_driverId", (q) => q.eq("driverId", driver._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "accepted"),
          q.eq(q.field("status"), "in_progress")
        )
      )
      .first();

    if (!activeTrip) return null;

    const passenger = await ctx.db.get(activeTrip.passengerId);

    return {
      ...activeTrip,
      passengerName: passenger
        ? `${passenger.firstName} ${passenger.lastName}`
        : "Passenger",
      passengerPhone: passenger?.phone || "N/A",
      passengerEmail: passenger?.email,
    };
  },
});

// 4. Get all trips completed or handled by this driver
export const getDriverTrips = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const driver = await ctx.db
      .query("drivers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!driver) return [];

    const trips = await ctx.db
      .query("towRequests")
      .withIndex("by_driverId", (q) => q.eq("driverId", driver._id))
      .order("desc")
      .collect();

    const enrichedTrips = await Promise.all(
      trips.map(async (trip) => {
        const passenger = await ctx.db.get(trip.passengerId);
        return {
          ...trip,
          passengerName: passenger
            ? `${passenger.firstName} ${passenger.lastName}`
            : "Passenger",
          passengerPhone: passenger?.phone || "N/A",
        };
      })
    );

    return enrichedTrips;
  },
});

// 5. Get available/open tow requests pool nearby that drivers can view and accept
export const getOpenTowRequests = query({
  args: {},
  handler: async (ctx) => {
    const searchingTrips = await ctx.db
      .query("towRequests")
      .withIndex("by_status", (q) => q.eq("status", "searching"))
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      searchingTrips.map(async (trip) => {
        const passenger = await ctx.db.get(trip.passengerId);
        return {
          ...trip,
          passengerName: passenger
            ? `${passenger.firstName} ${passenger.lastName}`
            : "Stranded Motorist",
          passengerPhone: passenger?.phone || "N/A",
        };
      })
    );

    return enriched;
  },
});

// 6. Get driver earnings breakdown & wallet ledger
export const getDriverEarningsSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const driver = await ctx.db
      .query("drivers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!driver) {
      return {
        grossEarnings: 0,
        platformCommission: 0,
        netEarnings: 0,
        todayEarnings: 0,
        weekEarnings: 0,
        completedJobsCount: 0,
        commissionPercent: 15,
        rating: 5.0,
        ratingCount: 0,
        bankDetails: null,
      };
    }

    const settings = await ctx.db.query("platformSettings").first();
    const commissionPercent = settings?.platformCommissionPercent ?? 15;

    const driverTrips = await ctx.db
      .query("towRequests")
      .withIndex("by_driverId", (q) => q.eq("driverId", driver._id))
      .collect();

    const completed = driverTrips.filter((t) => t.status === "completed");

    const now = Date.now();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayTs = startOfDay.getTime();
    const startOfWeekTs = now - 7 * 24 * 60 * 60 * 1000;

    const todayTrips = completed.filter(
      (t) => (t.createdAt ?? 0) >= startOfDayTs || !t.createdAt
    );
    const weekTrips = completed.filter(
      (t) => (t.createdAt ?? 0) >= startOfWeekTs || !t.createdAt
    );

    const grossEarnings = completed.reduce((sum, t) => sum + (t.price ?? 0), 0);
    const todayGross = todayTrips.reduce((sum, t) => sum + (t.price ?? 0), 0);
    const weekGross = weekTrips.reduce((sum, t) => sum + (t.price ?? 0), 0);

    const platformCommission = (grossEarnings * commissionPercent) / 100;
    const netEarnings = grossEarnings - platformCommission;

    const todayNet = todayGross - (todayGross * commissionPercent) / 100;
    const weekNet = weekGross - (weekGross * commissionPercent) / 100;

    return {
      grossEarnings,
      platformCommission,
      netEarnings,
      todayEarnings: todayNet,
      weekEarnings: weekNet,
      completedJobsCount: completed.length,
      commissionPercent,
      rating: driver.rating || 5.0,
      ratingCount: driver.ratingCount || 0,
      bankDetails: driver.bankDetails || null,
      recentCompletedTrips: completed.slice(-10).reverse(),
    };
  },
});

// 7. Update driver bank payout details
export const updateDriverBankDetails = mutation({
  args: {
    userId: v.id("users"),
    bankName: v.string(),
    accountNumber: v.string(),
    accountName: v.string(),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db
      .query("drivers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!driver) throw new Error("Driver profile not found.");

    await ctx.db.patch(driver._id, {
      bankDetails: {
        bankName: args.bankName,
        accountNumber: args.accountNumber,
        accountName: args.accountName,
      },
    });

    return { success: true };
  },
});

// 8. Admin approves or rejects a driver
export const updateVerificationStatus = mutation({
  args: {
    driverId: v.id("drivers"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (!driver) {
      throw new Error("Driver not found");
    }

    await ctx.db.patch(args.driverId, {
      verificationStatus: args.status,
      rejectionReason: args.rejectionReason,
    });

    return { success: true };
  },
});

// 9. Get all pending driver applications (for admin use)
export const getPendingDrivers = query({
  args: {},
  handler: async (ctx) => {
    const pendingDrivers = await ctx.db
      .query("drivers")
      .withIndex("by_verificationStatus", (q) =>
        q.eq("verificationStatus", "pending")
      )
      .collect();

    const enriched = await Promise.all(
      pendingDrivers.map(async (driver) => {
        const user = await ctx.db.get(driver.userId);
        return { ...driver, user };
      })
    );

    return enriched;
  },
});

// 10. Toggle driver online/offline status
export const toggleAvailability = mutation({
  args: {
    userId: v.id("users"),
    isAvailable: v.boolean(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db
      .query("drivers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!driver) throw new Error("Driver profile not found");
    if (driver.verificationStatus !== "approved") {
      throw new Error("Driver must be approved to go online");
    }

    await ctx.db.patch(driver._id, {
      isAvailable: args.isAvailable,
      location:
        args.lat !== undefined && args.lng !== undefined
          ? { lat: args.lat, lng: args.lng }
          : driver.location,
    });

    return { success: true };
  },
});

// 11. Get all available approved drivers (for passenger map)
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
          ...driver,
          driverName: user
            ? `${user.firstName} ${user.lastName}`
            : "Unknown Driver",
        };
      })
    );

    return enriched;
  },
});
