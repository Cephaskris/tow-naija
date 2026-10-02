import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// 1. Dashboard Overview Stats
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    const allDrivers = await ctx.db.query("drivers").collect();
    const allTrips = await ctx.db.query("towRequests").collect();

    // Active (approved + available) drivers
    const activeDrivers = allDrivers.filter(
      (d) => d.verificationStatus === "approved" && d.isAvailable === true
    );

    // Pending driver approvals
    const pendingDrivers = allDrivers.filter(
      (d) => d.verificationStatus === "pending"
    );

    // Active tows (searching, accepted, in_progress)
    const activeTows = allTrips.filter(
      (t) => t.status === "in_progress" || t.status === "searching" || t.status === "accepted"
    );

    // Revenue calculations
    const now = Date.now();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayTs = startOfDay.getTime();

    const completedTrips = allTrips.filter((t) => t.status === "completed");
    const completedToday = completedTrips.filter(
      (t) => (t.createdAt ?? 0) >= startOfDayTs || !t.createdAt
    );

    const totalRevenue = completedTrips.reduce((sum, t) => sum + (t.price ?? 0), 0);
    const todaysRevenue = completedToday.reduce((sum, t) => sum + (t.price ?? 0), 0);

    // Connection Credits Revenue
    const creditTxs = await ctx.db.query("creditTransactions").collect();
    let totalCreditSales = 0;
    let totalSearchDeductions = 0;
    let totalDriverDeductions = 0;

    for (const tx of creditTxs) {
      if (tx.type === "topup" && tx.amount > 0) {
        totalCreditSales += tx.amount;
      } else if (tx.type === "search_deduction") {
        totalSearchDeductions += Math.abs(tx.amount);
      } else if (tx.type === "go_online_deduction") {
        totalDriverDeductions += Math.abs(tx.amount);
      }
    }

    // Settings for commission rate
    const settings = await ctx.db.query("platformSettings").first();
    const commissionPercent = settings?.platformCommissionPercent ?? 15;
    const platformEarningsToday = (todaysRevenue * commissionPercent) / 100;
    const totalPlatformEarnings = (totalRevenue * commissionPercent) / 100;

    // Recent trips (last 15, ordered desc)
    const recentTrips = await ctx.db
      .query("towRequests")
      .order("desc")
      .take(15);

    const enrichedTrips = await Promise.all(
      recentTrips.map(async (trip) => {
        const passenger = await ctx.db.get(trip.passengerId);
        const driver = trip.driverId ? await ctx.db.get(trip.driverId) : null;
        const driverUser = driver ? await ctx.db.get(driver.userId) : null;
        return {
          ...trip,
          passengerName: passenger
            ? `${passenger.firstName} ${passenger.lastName}`
            : "Unknown Passenger",
          passengerPhone: passenger?.phone || "",
          driverName: driverUser
            ? `${driverUser.firstName} ${driverUser.lastName}`
            : "Unassigned",
          driverPhone: driverUser?.phone || "",
        };
      })
    );

    return {
      totalUsersCount: allUsers.length,
      totalDriversCount: allDrivers.length,
      activeDriversCount: activeDrivers.length,
      pendingApprovalsCount: pendingDrivers.length,
      activeTowsCount: activeTows.length,
      completedTripsCount: completedTrips.length,
      todaysRevenue,
      platformEarningsToday,
      totalRevenue,
      totalPlatformEarnings,
      totalCreditSales,
      totalSearchDeductions,
      totalDriverDeductions,
      passengerSearchCost: settings?.passengerSearchCreditCost ?? 1000,
      driverGoOnlineCost: settings?.driverGoOnlineCreditCost ?? 1500,
      commissionPercent,
      recentTrips: enrichedTrips,
    };
  },
});

// 2. User Management Queries and Mutations
export const getAllUsers = query({
  args: {
    roleFilter: v.optional(v.string()), // "all", "passenger", "driver", "admin"
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let users = await ctx.db.query("users").collect();

    if (args.roleFilter && args.roleFilter !== "all") {
      users = users.filter((u) => u.role === args.roleFilter);
    }

    if (args.searchQuery && args.searchQuery.trim() !== "") {
      const q = args.searchQuery.toLowerCase().trim();
      users = users.filter(
        (u) =>
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q))
      );
    }

    // Enrich with driver verification status if driver
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        let driverData = null;
        if (user.role === "driver") {
          driverData = await ctx.db
            .query("drivers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .first();
        }

        // Count total completed trips as passenger
        const tripsCount = await ctx.db
          .query("towRequests")
          .withIndex("by_passengerId", (q) => q.eq("passengerId", user._id))
          .collect();

        return {
          ...user,
          driverProfile: driverData,
          totalRides: tripsCount.length,
        };
      })
    );

    return enrichedUsers;
  },
});

export const toggleUserBan = mutation({
  args: {
    userId: v.id("users"),
    isBanned: v.boolean(),
    bannedReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      isBanned: args.isBanned,
      bannedReason: args.bannedReason || (args.isBanned ? "Account suspended by administrator" : undefined),
    });
    return { success: true };
  },
});

export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("passenger"), v.literal("driver"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { role: args.role });

    if (args.role === "driver") {
      const existing = await ctx.db
        .query("drivers")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .first();
      if (!existing) {
        await ctx.db.insert("drivers", {
          userId: args.userId,
          isAvailable: false,
          verificationStatus: "unverified",
        });
      }
    }
    return { success: true };
  },
});

// 3. Driver Verification & Fleet Management
export const getAllDrivers = query({
  args: {
    statusFilter: v.optional(v.string()), // "all", "pending", "approved", "rejected", "suspended", "unverified"
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let drivers = await ctx.db.query("drivers").collect();

    if (args.statusFilter && args.statusFilter !== "all") {
      drivers = drivers.filter((d) => d.verificationStatus === args.statusFilter);
    }

    const enriched = await Promise.all(
      drivers.map(async (driver) => {
        const user = await ctx.db.get(driver.userId);
        
        // Count trips handled by this driver
        const driverTrips = await ctx.db
          .query("towRequests")
          .withIndex("by_driverId", (q) => q.eq("driverId", driver._id))
          .collect();

        const completedCount = driverTrips.filter((t) => t.status === "completed").length;

        return {
          ...driver,
          user: user || {
            firstName: "Unknown",
            lastName: "Driver",
            phone: "N/A",
            email: undefined,
            isBanned: false,
          },
          tripsCount: driverTrips.length,
          completedTripsCount: completedCount,
        };
      })
    );

    if (args.searchQuery && args.searchQuery.trim() !== "") {
      const q = args.searchQuery.toLowerCase().trim();
      return enriched.filter(
        (d) =>
          d.user.firstName.toLowerCase().includes(q) ||
          d.user.lastName.toLowerCase().includes(q) ||
          d.user.phone.toLowerCase().includes(q) ||
          (d.vehicleDetails?.licensePlate && d.vehicleDetails.licensePlate.toLowerCase().includes(q)) ||
          (d.vehicleDetails?.make && d.vehicleDetails.make.toLowerCase().includes(q)) ||
          (d.vehicleDetails?.model && d.vehicleDetails.model.toLowerCase().includes(q))
      );
    }

    return enriched;
  },
});

export const updateDriverStatusByAdmin = mutation({
  args: {
    driverId: v.id("drivers"),
    status: v.union(
      v.literal("unverified"),
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("suspended")
    ),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.driverId, {
      verificationStatus: args.status,
      rejectionReason: args.rejectionReason,
      // If rejecting or suspending, set availability to false
      ...(args.status !== "approved" ? { isAvailable: false } : {}),
    });
    return { success: true };
  },
});

// 4. Trip Management & Dispatch Controls
export const getAllTrips = query({
  args: {
    statusFilter: v.optional(v.string()), // "all", "searching", "accepted", "in_progress", "completed", "cancelled"
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let trips = await ctx.db.query("towRequests").order("desc").collect();

    if (args.statusFilter && args.statusFilter !== "all") {
      trips = trips.filter((t) => t.status === args.statusFilter);
    }

    const enrichedTrips = await Promise.all(
      trips.map(async (trip) => {
        const passenger = await ctx.db.get(trip.passengerId);
        const driver = trip.driverId ? await ctx.db.get(trip.driverId) : null;
        const driverUser = driver ? await ctx.db.get(driver.userId) : null;
        return {
          ...trip,
          passengerName: passenger
            ? `${passenger.firstName} ${passenger.lastName}`
            : "Unknown Passenger",
          passengerPhone: passenger?.phone || "N/A",
          driverName: driverUser
            ? `${driverUser.firstName} ${driverUser.lastName}`
            : "Unassigned",
          driverPhone: driverUser?.phone || "N/A",
          driverDetails: driver,
        };
      })
    );

    if (args.searchQuery && args.searchQuery.trim() !== "") {
      const q = args.searchQuery.toLowerCase().trim();
      return enrichedTrips.filter(
        (t) =>
          t.passengerName.toLowerCase().includes(q) ||
          t.passengerPhone.toLowerCase().includes(q) ||
          t.driverName.toLowerCase().includes(q) ||
          t.pickupLocation.address.toLowerCase().includes(q) ||
          (t.dropoffLocation?.address && t.dropoffLocation.address.toLowerCase().includes(q)) ||
          t._id.toLowerCase().includes(q)
      );
    }

    return enrichedTrips;
  },
});

export const getAvailableDriversForDispatch = query({
  args: {},
  handler: async (ctx) => {
    const approvedDrivers = await ctx.db
      .query("drivers")
      .withIndex("by_verificationStatus", (q) => q.eq("verificationStatus", "approved"))
      .collect();

    const available = approvedDrivers.filter((d) => d.isAvailable);

    const enriched = await Promise.all(
      available.map(async (driver) => {
        const user = await ctx.db.get(driver.userId);
        return {
          ...driver,
          driverName: user ? `${user.firstName} ${user.lastName}` : "Unknown Driver",
          driverPhone: user?.phone || "",
        };
      })
    );

    return enriched;
  },
});

export const assignDriverToTrip = mutation({
  args: {
    tripId: v.id("towRequests"),
    driverId: v.id("drivers"),
  },
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip) throw new Error("Trip not found");

    const driver = await ctx.db.get(args.driverId);
    if (!driver || driver.verificationStatus !== "approved") {
      throw new Error("Selected driver is not verified or approved");
    }

    await ctx.db.patch(args.tripId, {
      driverId: args.driverId,
      status: "accepted",
    });

    // Mark driver as busy
    await ctx.db.patch(args.driverId, {
      isAvailable: false,
    });

    return { success: true };
  },
});

export const cancelTripByAdmin = mutation({
  args: {
    tripId: v.id("towRequests"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip) throw new Error("Trip not found");

    if (trip.driverId) {
      // Free the driver
      await ctx.db.patch(trip.driverId, {
        isAvailable: true,
      });
    }

    await ctx.db.patch(args.tripId, {
      status: "cancelled",
      cancelledBy: "Admin",
      cancellationReason: args.reason || "Trip cancelled by system administrator",
    });

    return { success: true };
  },
});

// 5. Analytics & Financial Reporting
export const getAnalytics = query({
  args: {
    period: v.optional(v.string()), // "today", "7days", "30days", "all"
  },
  handler: async (ctx, args) => {
    const allTrips = await ctx.db.query("towRequests").collect();
    const allDrivers = await ctx.db.query("drivers").collect();
    const allUsers = await ctx.db.query("users").collect();

    const now = Date.now();
    let cutoff = 0;
    if (args.period === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      cutoff = today.getTime();
    } else if (args.period === "7days") {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
    } else if (args.period === "30days") {
      cutoff = now - 30 * 24 * 60 * 60 * 1000;
    }

    const filteredTrips = cutoff > 0 
      ? allTrips.filter((t) => (t.createdAt ?? 0) >= cutoff || !t.createdAt)
      : allTrips;

    const completed = filteredTrips.filter((t) => t.status === "completed");
    const cancelled = filteredTrips.filter((t) => t.status === "cancelled");
    const inProgress = filteredTrips.filter((t) => t.status === "in_progress" || t.status === "accepted");
    const searching = filteredTrips.filter((t) => t.status === "searching");

    const grossVolume = completed.reduce((sum, t) => sum + (t.price ?? 0), 0);

    const settings = await ctx.db.query("platformSettings").first();
    const commissionPercent = settings?.platformCommissionPercent ?? 15;
    const netRevenue = (grossVolume * commissionPercent) / 100;
    const driverPayouts = grossVolume - netRevenue;

    const completionRate = filteredTrips.length > 0 
      ? Math.round((completed.length / filteredTrips.length) * 100) 
      : 100;

    const cancellationRate = filteredTrips.length > 0 
      ? Math.round((cancelled.length / filteredTrips.length) * 100) 
      : 0;

    const averageTripFare = completed.length > 0 
      ? Math.round(grossVolume / completed.length) 
      : 0;

    // Tow Type Breakdown
    const towTypeCounts: Record<string, number> = {
      Flatbed: 0,
      Dolly: 0,
      "Heavy Duty": 0,
      Other: 0,
    };

    filteredTrips.forEach((t) => {
      const type = t.towType || "Flatbed";
      if (type.includes("Flatbed")) towTypeCounts.Flatbed += 1;
      else if (type.includes("Dolly") || type.includes("Wheel")) towTypeCounts.Dolly += 1;
      else if (type.includes("Heavy")) towTypeCounts["Heavy Duty"] += 1;
      else towTypeCounts.Other += 1;
    });

    // Top Rated Drivers
    const approvedDrivers = allDrivers.filter((d) => d.verificationStatus === "approved");
    const enrichedDrivers = await Promise.all(
      approvedDrivers.map(async (driver) => {
        const user = await ctx.db.get(driver.userId);
        return {
          id: driver._id,
          name: user ? `${user.firstName} ${user.lastName}` : "Driver",
          rating: driver.rating || 5.0,
          totalEarnings: driver.totalEarnings || 0,
          vehicle: driver.vehicleDetails?.make ? `${driver.vehicleDetails.make} ${driver.vehicleDetails.model}` : "Tow Truck",
        };
      })
    );

    const topDrivers = enrichedDrivers
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5);

    return {
      grossVolume,
      netRevenue,
      driverPayouts,
      commissionPercent,
      totalTrips: filteredTrips.length,
      completedTrips: completed.length,
      cancelledTrips: cancelled.length,
      inProgressTrips: inProgress.length,
      searchingTrips: searching.length,
      completionRate,
      cancellationRate,
      averageTripFare,
      towTypeCounts,
      topDrivers,
      totalRegisteredUsers: allUsers.length,
      totalRegisteredDrivers: allDrivers.length,
    };
  },
});

// 6. Platform Settings Controls
export const getPlatformSettings = query({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("platformSettings").first();
    if (existing) return existing;

    // Default Nigerian Towing Market Settings
    return {
      baseFareFlatbed: 35000,
      baseFareDolly: 25000,
      baseFareHeavyDuty: 65000,
      perKmRate: 1200,
      platformCommissionPercent: 15,
      surgeMultiplier: 1.0,
      passengerSearchCreditCost: 1000,
      driverGoOnlineCreditCost: 1500,
      maintenanceMode: false,
      supportPhone: "+234 800 TOW NAIJA",
      supportEmail: "support@townaija.ng",
    };
  },
});

export const updatePlatformSettings = mutation({
  args: {
    baseFareFlatbed: v.number(),
    baseFareDolly: v.number(),
    baseFareHeavyDuty: v.number(),
    perKmRate: v.number(),
    platformCommissionPercent: v.number(),
    surgeMultiplier: v.number(),
    passengerSearchCreditCost: v.optional(v.number()),
    driverGoOnlineCreditCost: v.optional(v.number()),
    maintenanceMode: v.boolean(),
    supportPhone: v.string(),
    supportEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("platformSettings").first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return { success: true, id: existing._id };
    } else {
      const id = await ctx.db.insert("platformSettings", {
        ...args,
        passengerSearchCreditCost: args.passengerSearchCreditCost ?? 1000,
        driverGoOnlineCreditCost: args.driverGoOnlineCreditCost ?? 1500,
      });
      return { success: true, id };
    }
  },
});
