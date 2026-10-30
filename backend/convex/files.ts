import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveFile = mutation({
  args: {
    storage_id: v.id("_storage"),
    bucket: v.union(v.literal("job-photos"), v.literal("operator-docs"), v.literal("topup-proofs")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please log in.");

    await ctx.db.insert("files", {
      storage_id: args.storage_id,
      bucket: args.bucket,
      owner: userId,
    });

    return args.storage_id;
  },
});

export const getFileUrl = query({
  args: { storage_id: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storage_id);
  },
});
