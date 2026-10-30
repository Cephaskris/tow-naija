import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const notifyUser = internalMutation({
  args: {
    user_id: v.id("users"),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.user_id);
    if (!user) return;

    // Get counter for sequential notifications
    let counter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", `notif_${args.user_id}`))
      .first();

    const seq = (counter?.value || 0) + 1;
    if (!counter) {
      await ctx.db.insert("counters", { name: `notif_${args.user_id}`, value: seq });
    } else {
      await ctx.db.patch(counter._id, { value: seq });
    }

    await ctx.db.insert("notifications", {
      user_id: args.user_id,
      seq,
      title: args.title,
      body: args.body,
      data: args.data || {},
    });
  },
});

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const limit = args.limit || 50;
    const notifs = await ctx.db
      .query("notifications")
      .withIndex("by_user_seq", (q) => q.eq("user_id", userId))
      .order("desc")
      .take(limit);

    return notifs.map((n) => ({
      ...n,
      id: n._id,
      created_at: new Date(n._creationTime).toISOString(),
    }));
  },
});

export const markRead = mutation({
  args: { ids: v.array(v.id("notifications")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const now = Date.now();
    for (const id of args.ids) {
      const n = await ctx.db.get(id);
      if (n && n.user_id === userId && !n.read_at) {
        await ctx.db.patch(id, { read_at: now });
      }
    }
  },
});
