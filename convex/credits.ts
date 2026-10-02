import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Helper to get platform credit costs
async function getCreditCosts(db: any) {
  const settings = await db.query("platformSettings").first();
  return {
    passengerSearchCost: settings?.passengerSearchCreditCost ?? 1000,
    driverGoOnlineCost: settings?.driverGoOnlineCreditCost ?? 1500,
  };
}

// 1. Get user credit balance & history
export const getUserCredits = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { balance: 0, transactions: [], costs: { passengerSearchCost: 1000, driverGoOnlineCost: 1500 } };
    }

    const transactions = await ctx.db
      .query("creditTransactions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(20);

    const costs = await getCreditCosts(ctx.db);

    return {
      balance: user.connectionCredits ?? 0,
      transactions,
      costs,
    };
  },
});

// 2. Top-up connection credits (Passenger or Driver)
export const topUpCredits = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    paymentMethod: v.optional(v.string()),
    reference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) {
      throw new Error("Top-up amount must be greater than zero.");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found.");
    }

    const currentBalance = user.connectionCredits ?? 0;
    const newBalance = currentBalance + args.amount;

    // Update user balance
    await ctx.db.patch(args.userId, {
      connectionCredits: newBalance,
    });

    // Also update driver record if exists
    const driver = await ctx.db
      .query("drivers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (driver) {
      await ctx.db.patch(driver._id, {
        connectionCredits: newBalance,
      });
    }

    // Log transaction
    const txId = await ctx.db.insert("creditTransactions", {
      userId: args.userId,
      userRole: user.role,
      amount: args.amount,
      type: "topup",
      description: `Connection Credits Top-Up (${args.paymentMethod || "Card/Transfer"})`,
      reference: args.reference || `TOPUP-${Date.now()}`,
      createdAt: Date.now(),
    });

    return {
      success: true,
      newBalance,
      transactionId: txId,
    };
  },
});

// 3. Deduct Passenger Search Connection Credit
export const deductPassengerSearchCredit = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found.");
    }

    const costs = await getCreditCosts(ctx.db);
    const requiredCost = costs.passengerSearchCost;
    const currentBalance = user.connectionCredits ?? 0;

    if (currentBalance < requiredCost) {
      return {
        success: false,
        requiredCost,
        currentBalance,
        message: `Insufficient Connection Credits. You need ₦${requiredCost.toLocaleString()} but currently have ₦${currentBalance.toLocaleString()}.`,
      };
    }

    const newBalance = currentBalance - requiredCost;

    // Deduct from user
    await ctx.db.patch(args.userId, {
      connectionCredits: newBalance,
    });

    // Record deduction transaction
    await ctx.db.insert("creditTransactions", {
      userId: args.userId,
      userRole: "passenger",
      amount: -requiredCost,
      type: "search_deduction",
      description: `Connection Credit: Tow Truck Dispatch Search`,
      createdAt: Date.now(),
    });

    return {
      success: true,
      deducted: requiredCost,
      newBalance,
    };
  },
});

// 4. Deduct Driver Go-Online Connection Credit
export const deductDriverGoOnlineCredit = mutation({
  args: {
    driverId: v.id("drivers"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (!driver) {
      throw new Error("Driver profile not found.");
    }

    const user = await ctx.db.get(driver.userId);
    if (!user) {
      throw new Error("User profile not found.");
    }

    const costs = await getCreditCosts(ctx.db);
    const requiredCost = costs.driverGoOnlineCost;
    const currentBalance = user.connectionCredits ?? driver.connectionCredits ?? 0;

    if (currentBalance < requiredCost) {
      return {
        success: false,
        requiredCost,
        currentBalance,
        message: `Insufficient Connection Credits. Going online requires ₦${requiredCost.toLocaleString()} connection credit. Your balance is ₦${currentBalance.toLocaleString()}.`,
      };
    }

    const newBalance = currentBalance - requiredCost;

    // Deduct from both user and driver record
    await ctx.db.patch(user._id, {
      connectionCredits: newBalance,
    });
    await ctx.db.patch(driver._id, {
      connectionCredits: newBalance,
      isAvailable: true,
    });

    // Record deduction transaction
    await ctx.db.insert("creditTransactions", {
      userId: user._id,
      userRole: "driver",
      amount: -requiredCost,
      type: "go_online_deduction",
      description: `Connection Credit: Driver Active Shift (Go Online)`,
      createdAt: Date.now(),
    });

    return {
      success: true,
      deducted: requiredCost,
      newBalance,
    };
  },
});

// 5. Admin Adjust User Connection Credits
export const adminAdjustCredits = mutation({
  args: {
    targetUserId: v.id("users"),
    amount: v.number(), // positive to add, negative to deduct
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) {
      throw new Error("Target user not found.");
    }

    const currentBalance = targetUser.connectionCredits ?? 0;
    const newBalance = Math.max(0, currentBalance + args.amount);

    await ctx.db.patch(args.targetUserId, {
      connectionCredits: newBalance,
    });

    const driver = await ctx.db
      .query("drivers")
      .withIndex("by_userId", (q) => q.eq("userId", args.targetUserId))
      .first();

    if (driver) {
      await ctx.db.patch(driver._id, {
        connectionCredits: newBalance,
      });
    }

    await ctx.db.insert("creditTransactions", {
      userId: args.targetUserId,
      userRole: targetUser.role,
      amount: args.amount,
      type: "admin_adjustment",
      description: `Admin Adjustment: ${args.reason}`,
      createdAt: Date.now(),
    });

    return {
      success: true,
      newBalance,
    };
  },
});

// 6. Admin Credit System Analytics & Transaction Log
export const getCreditAnalytics = query({
  handler: async (ctx) => {
    const transactions = await ctx.db.query("creditTransactions").order("desc").take(100);
    const settings = await ctx.db.query("platformSettings").first();

    let totalRevenue = 0; // Total from Top-ups
    let totalSearchDeductions = 0;
    let totalDriverDeductions = 0;
    let searchDeductionCount = 0;
    let driverDeductionCount = 0;

    for (const tx of transactions) {
      if (tx.type === "topup" && tx.amount > 0) {
        totalRevenue += tx.amount;
      } else if (tx.type === "search_deduction") {
        totalSearchDeductions += Math.abs(tx.amount);
        searchDeductionCount += 1;
      } else if (tx.type === "go_online_deduction") {
        totalDriverDeductions += Math.abs(tx.amount);
        driverDeductionCount += 1;
      }
    }

    return {
      totalRevenue,
      totalSearchDeductions,
      totalDriverDeductions,
      searchDeductionCount,
      driverDeductionCount,
      passengerSearchCost: settings?.passengerSearchCreditCost ?? 1000,
      driverGoOnlineCost: settings?.driverGoOnlineCreditCost ?? 1500,
      recentTransactions: transactions.slice(0, 25),
    };
  },
});
