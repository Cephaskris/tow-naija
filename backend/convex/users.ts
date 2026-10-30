import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const byPhone = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    if (!args.phone) return null;
    return await ctx.db
      .query("users")
      .withIndex("phone", (q) => q.eq("phone", args.phone))
      .first();
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const operator = await ctx.db
      .query("operators")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .first();

    const settings = await ctx.db.query("app_settings").first();

    return {
      user: {
        id: user._id,
        _id: user._id,
        full_name: user.full_name || user.name || "",
        phone: user.phone || "",
        is_operator: !!user.is_operator,
        is_admin: !!user.is_admin,
        admin_role: user.admin_role,
        status: user.status || "active",
        rating_avg: user.rating_avg || 0,
        rating_count: user.rating_count || 0,
        push_token: user.push_token,
      },
      operator: operator
        ? {
            ...operator,
            id: operator.user_id,
            _id: operator._id,
          }
        : null,
      settings: settings || null,
    };
  },
});

export const updatePushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not logged in");
    await ctx.db.patch(userId, { push_token: args.token });
  },
});

export const updateProfile = mutation({
  args: { full_name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not logged in");
    await ctx.db.patch(userId, {
      full_name: args.full_name.trim().slice(0, 80),
      name: args.full_name.trim().slice(0, 80),
    });
  },
});
