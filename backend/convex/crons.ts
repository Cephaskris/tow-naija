import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const runMaintenance = internalMutation({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("app_settings").first();
    const now = Date.now();
    const reqExpiryMs = (settings?.request_expiry_min || 30) * 60 * 1000;
    const bidExpiryMs = (settings?.bid_expiry_min || 10) * 60 * 1000;
    const autoConfirmMs = (settings?.auto_confirm_hours || 3) * 60 * 60 * 1000;

    // Expire old open requests
    const openReqs = await ctx.db
      .query("tow_requests")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    for (const r of openReqs) {
      const lastActivity = Math.max(r._creationTime, r.offer_updated_at);
      if (now - lastActivity > reqExpiryMs) {
        await ctx.db.patch(r._id, { status: "expired", updated_at: now });
      }
    }

    // Auto-complete delivered jobs after autoConfirm hours if no dispute
    const deliveredReqs = await ctx.db
      .query("tow_requests")
      .withIndex("by_status", (q) => q.eq("status", "delivered"))
      .collect();

    for (const r of deliveredReqs) {
      if (r.delivered_at && now - r.delivered_at > autoConfirmMs) {
        const dispute = await ctx.db
          .query("disputes")
          .withIndex("by_request", (q) => q.eq("request_id", r._id))
          .filter((q) => q.eq(q.field("status"), "open"))
          .first();

        if (!dispute) {
          const commPct = settings?.commission_pct || 10;
          const finalPrice = r.final_price || r.offer_amount;
          const comm = Math.round((finalPrice * commPct) / 100);

          await ctx.db.patch(r._id, {
            status: "completed",
            completed_at: now,
            commission_amount: comm,
            updated_at: now,
          });

          if (r.operator_id) {
            const op = await ctx.db
              .query("operators")
              .withIndex("by_user", (q) => q.eq("user_id", r.operator_id!))
              .first();
            if (op) {
              const newBal = op.wallet_balance - comm;
              await ctx.db.patch(op._id, {
                wallet_balance: newBal,
                jobs_completed: op.jobs_completed + 1,
              });
              await ctx.db.insert("wallet_transactions", {
                operator_id: op.user_id,
                kind: "commission",
                amount: -comm,
                balance_after: newBal,
                request_id: r._id,
                note: `Commission for ${r.ref} (auto-completed)`,
              });
            }
          }
        }
      }
    }

    // Offline stale operators (>15 mins)
    const onlineOps = await ctx.db
      .query("operators")
      .withIndex("by_online", (q) => q.eq("is_online", true))
      .collect();

    for (const op of onlineOps) {
      if (op.last_seen_at && now - op.last_seen_at > 15 * 60 * 1000) {
        await ctx.db.patch(op._id, { is_online: false });
      }
    }
  },
});

const crons = cronJobs();
crons.interval("maintenance", { minutes: 1 }, internal.crons.runMaintenance);

export default crons;
