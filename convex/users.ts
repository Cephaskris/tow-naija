import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Look up a user's role by their userId (used post-login to route to correct dashboard)
export const getUserRole = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user ? user.role : null;
  },
});


export const selectRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("passenger"), v.literal("driver"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (args.role === "admin") {
      // Admin accounts must be flagged manually in the Convex dashboard.
      // A regular user cannot simply select "admin" to become an admin.
      if (user.role !== "admin") {
        throw new Error("Unauthorized. Admin access must be manually granted by backend administrators.");
      }
      return { success: true };
    }

    // If the user is currently an admin, we might not want to overwrite their role 
    // just because they clicked "Passenger" or "Driver" to test the app.
    if (user.role !== "admin") {
      await ctx.db.patch(args.userId, { role: args.role });
    }

    if (args.role === "driver") {
      // Create a driver profile if it doesn't already exist
      const existingDriver = await ctx.db
        .query("drivers")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .first();

      if (!existingDriver) {
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
