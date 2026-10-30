import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { naira, normPhone } from "./lib";
import { Doc, Id } from "./_generated/dataModel";

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Admins only.");
  const user = await ctx.db.get(userId);
  if (!user || !user.is_admin || user.status === "blocked") {
    throw new Error("Admins only.");
  }
  return { userId, user };
}

export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const requests = await ctx.db.query("tow_requests").collect();
    const operators = await ctx.db.query("operators").collect();
    const profiles = await ctx.db.query("users").collect();
    const topups = await ctx.db.query("topup_requests").collect();
    const disputes = await ctx.db.query("disputes").collect();

    const openReqs = requests.filter((r) => r.status === "open").length;
    const activeJobs = requests.filter((r) => ["matched", "arrived", "in_progress", "delivered"].includes(r.status)).length;
    const onlineOps = operators.filter((o) => o.is_online).length;
    const pendingOps = operators.filter((o) => o.status === "pending").length;
    const approvedOps = operators.filter((o) => o.status === "approved").length;
    const customers = profiles.filter((p) => !p.is_operator && !p.is_admin).length;
    const pendingTopups = topups.filter((t) => t.status === "pending").length;
    const openDisputes = disputes.filter((d) => d.status === "open").length;

    // Today's metrics (Lagos midnight UTC+1)
    const now = new Date();
    const lagosOffset = 60 * 60 * 1000;
    const lagosDate = new Date(now.getTime() + lagosOffset);
    lagosDate.setUTCHours(0, 0, 0, 0);
    const todayStart = lagosDate.getTime() - lagosOffset;

    let todayReqs = 0;
    let todayCompleted = 0;
    let todayGmv = 0;
    let todayComm = 0;

    for (const r of requests) {
      if (r._creationTime >= todayStart) todayReqs++;
      if (r.completed_at && r.completed_at >= todayStart) {
        todayCompleted++;
        todayGmv += r.final_price || 0;
        todayComm += r.commission_amount || 0;
      }
    }

    const dMs = 86400000;
    const weekStart = todayStart - 6 * dMs;
    let weekCompleted = 0;
    let weekGmv = 0;
    let weekComm = 0;

    for (const r of requests) {
      if (r.completed_at && r.completed_at >= weekStart) {
        weekCompleted++;
        weekGmv += r.final_price || 0;
        weekComm += r.commission_amount || 0;
      }
    }

    const daily = [];
    for (let i = 13; i >= 0; i--) {
      const dStart = todayStart - i * dMs;
      const dEnd = dStart + dMs;
      const key = new Date(dStart + lagosOffset).toISOString().slice(0, 10);
      let dayReqs = 0;
      let dayCompleted = 0;
      let dayGmv = 0;
      for (const r of requests) {
        if (r._creationTime >= dStart && r._creationTime < dEnd) dayReqs++;
        if (r.completed_at && r.completed_at >= dStart && r.completed_at < dEnd) {
          dayCompleted++;
          dayGmv += r.final_price || 0;
        }
      }
      daily.push({ day: key, requests: dayReqs, completed: dayCompleted, gmv: dayGmv });
    }

    const matchRate = todayReqs > 0 ? Math.round((todayCompleted / todayReqs) * 100) : 90;

    return {
      open_requests: openReqs,
      active_jobs: activeJobs,
      operators_online: onlineOps,
      operators_pending: pendingOps,
      operators_approved: approvedOps,
      customers,
      topups_pending: pendingTopups,
      disputes_open: openDisputes,
      today_requests: todayReqs,
      today_completed: todayCompleted,
      today_gmv: todayGmv,
      today_commission: todayComm,
      week_completed: weekCompleted,
      week_gmv: weekGmv,
      week_commission: weekComm,
      match_rate_7d: matchRate,
      daily,
    };
  },
});

export const operators = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const ops = await ctx.db.query("operators").order("desc").take(500);
    const list = [];
    for (const o of ops) {
      const p = await ctx.db.get(o.user_id);
      list.push({
        ...o,
        id: o.user_id,
        _id: o._id,
        name: p?.full_name || p?.name || "",
        phone: p?.phone || "",
        user_status: p?.status || "active",
        rating_avg: p?.rating_avg || 0,
        rating_count: p?.rating_count || 0,
        created_at: new Date(o._creationTime).toISOString(),
      });
    }
    return list;
  },
});

export const operator = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const op = await ctx.db
      .query("operators")
      .withIndex("by_user", (q) => q.eq("user_id", args.id))
      .first();
    if (!op) throw new Error("Operator not found");

    const p = await ctx.db.get(args.id);
    const txs = await ctx.db
      .query("wallet_transactions")
      .withIndex("by_operator", (q) => q.eq("operator_id", args.id))
      .order("desc")
      .take(20);

    const jobs = await ctx.db
      .query("tow_requests")
      .withIndex("by_operator", (q) => q.eq("operator_id", args.id))
      .order("desc")
      .take(10);

    return {
      ...op,
      id: op.user_id,
      _id: op._id,
      name: p?.full_name || p?.name || "",
      phone: p?.phone || "",
      user_status: p?.status || "active",
      rating_avg: p?.rating_avg || 0,
      rating_count: p?.rating_count || 0,
      created_at: new Date(op._creationTime).toISOString(),
      ledger: txs.map((t) => ({ ...t, id: t._id, created_at: new Date(t._creationTime).toISOString() })),
      recent_jobs: jobs.map((j) => ({ ...j, id: j._id, created_at: new Date(j._creationTime).toISOString() })),
    };
  },
});

export const jobs = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const reqs = await ctx.db.query("tow_requests").order("desc").take(300);
    const list = [];
    for (const r of reqs) {
      const cu = await ctx.db.get(r.customer_id);
      let op = null;
      let opUser = null;
      if (r.operator_id) {
        opUser = await ctx.db.get(r.operator_id);
        op = await ctx.db
          .query("operators")
          .withIndex("by_user", (q) => q.eq("user_id", r.operator_id!))
          .first();
      }
      list.push({
        ...r,
        id: r._id,
        _id: r._id,
        customer_name: cu?.full_name || cu?.name || "",
        customer_phone: cu?.phone || "",
        operator_name: opUser?.full_name || opUser?.name || "",
        operator_phone: opUser?.phone || "",
        truck_plate: op?.truck_plate || "",
        created_at: new Date(r._creationTime).toISOString(),
      });
    }
    return list;
  },
});

export const customers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").order("desc").take(500);
    return users.map((u) => ({
      ...u,
      id: u._id,
      _id: u._id,
      created_at: new Date(u._creationTime).toISOString(),
    }));
  },
});

export const topups = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const list = await ctx.db.query("topup_requests").order("desc").take(200);
    const result = [];
    for (const t of list) {
      const op = await ctx.db
        .query("operators")
        .withIndex("by_user", (q) => q.eq("user_id", t.operator_id))
        .first();
      const p = await ctx.db.get(t.operator_id);
      result.push({
        ...t,
        id: t._id,
        _id: t._id,
        operator_name: p?.full_name || p?.name || "",
        operator_phone: p?.phone || "",
        truck_plate: op?.truck_plate || "",
        created_at: new Date(t._creationTime).toISOString(),
      });
    }
    return result;
  },
});

export const ledger = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const txs = await ctx.db.query("wallet_transactions").order("desc").take(100);
    const result = [];
    for (const t of txs) {
      const p = await ctx.db.get(t.operator_id);
      result.push({
        ...t,
        id: t._id,
        _id: t._id,
        operator_name: p?.full_name || p?.name || "",
        created_at: new Date(t._creationTime).toISOString(),
      });
    }
    return result;
  },
});

export const disputes = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const list = await ctx.db.query("disputes").order("desc").take(200);
    const result = [];
    for (const d of list) {
      const r = await ctx.db.get(d.request_id);
      const raiser = await ctx.db.get(d.raised_by);
      result.push({
        ...d,
        id: d._id,
        _id: d._id,
        ref: r?.ref,
        final_price: r?.final_price,
        commission_amount: r?.commission_amount,
        raiser_name: raiser?.full_name || raiser?.name || "",
        raiser_phone: raiser?.phone || "",
        created_at: new Date(d._creationTime).toISOString(),
      });
    }
    return result;
  },
});

export const settings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [s, rates, cities] = await Promise.all([
      ctx.db.query("app_settings").first(),
      ctx.db.query("pricing_rates").collect(),
      ctx.db.query("cities").collect(),
    ]);
    return {
      settings: s || null,
      rates: rates.map((r) => ({ ...r, id: r._id })),
      cities: cities.map((c) => ({ ...c, id: c._id })),
    };
  },
});

export const admins = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db
      .query("users")
      .withIndex("by_admin", (q) => q.eq("is_admin", true))
      .collect();
    return users.map((u) => ({ ...u, id: u._id }));
  },
});

export const reviewOperator = mutation({
  args: {
    p_operator: v.id("users"),
    p_decision: v.union(v.literal("approve"), v.literal("reject"), v.literal("suspend"), v.literal("reinstate")),
    p_note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);

    const op = await ctx.db
      .query("operators")
      .withIndex("by_user", (q) => q.eq("user_id", args.p_operator))
      .first();
    if (!op) throw new Error("Operator not found.");

    const statusMap = {
      approve: "approved",
      reinstate: "approved",
      reject: "rejected",
      suspend: "suspended",
    } as const;
    const newStatus = statusMap[args.p_decision];

    const now = Date.now();
    await ctx.db.patch(op._id, {
      status: newStatus,
      review_note: args.p_note || undefined,
      reviewed_by: userId,
      reviewed_at: now,
      is_online: newStatus === "approved" ? op.is_online : false,
    });

    const msgMap = {
      approved: "You're approved! Top up your wallet and go online to receive tow requests.",
      rejected: `Your application was not approved. ${args.p_note || ""}`,
      suspended: `Your operator account has been suspended. ${args.p_note || ""}`,
    };
    await ctx.db.insert("notifications", {
      user_id: args.p_operator,
      seq: now,
      title: "Operator account update",
      body: msgMap[newStatus],
      data: { type: "operator_status" },
    });
  },
});

export const reviewTopup = mutation({
  args: {
    p_topup: v.id("topup_requests"),
    p_approve: v.boolean(),
    p_note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);

    const topup = await ctx.db.get(args.p_topup);
    if (!topup || topup.status !== "pending") {
      throw new Error("Top-up not found or already reviewed.");
    }

    const now = Date.now();
    await ctx.db.patch(topup._id, {
      status: args.p_approve ? "approved" : "rejected",
      review_note: args.p_note || undefined,
      reviewed_by: userId,
      reviewed_at: now,
    });

    const op = await ctx.db
      .query("operators")
      .withIndex("by_user", (q) => q.eq("user_id", topup.operator_id))
      .first();

    if (args.p_approve && op) {
      const newBal = op.wallet_balance + topup.amount;
      await ctx.db.patch(op._id, { wallet_balance: newBal });
      await ctx.db.insert("wallet_transactions", {
        operator_id: op.user_id,
        kind: "topup",
        amount: topup.amount,
        balance_after: newBal,
        topup_id: topup._id,
        note: topup.reference || "Wallet top-up",
        created_by: userId,
      });

      await ctx.db.insert("notifications", {
        user_id: topup.operator_id,
        seq: now,
        title: "Wallet topped up",
        body: `${naira(topup.amount)} added. New balance ${naira(newBal)}.`,
        data: { type: "wallet" },
      });
    } else {
      await ctx.db.insert("notifications", {
        user_id: topup.operator_id,
        seq: now,
        title: "Top-up not approved",
        body: args.p_note || "Please contact support.",
        data: { type: "wallet" },
      });
    }
  },
});

export const adjustWallet = mutation({
  args: {
    p_operator: v.id("users"),
    p_amount: v.number(),
    p_note: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    if (args.p_amount === 0) throw new Error("Amount cannot be zero.");
    if (!args.p_note.trim()) throw new Error("A note is required for adjustments.");

    const op = await ctx.db
      .query("operators")
      .withIndex("by_user", (q) => q.eq("user_id", args.p_operator))
      .first();
    if (!op) throw new Error("Operator not found.");

    const newBal = op.wallet_balance + args.p_amount;
    await ctx.db.patch(op._id, { wallet_balance: newBal });
    await ctx.db.insert("wallet_transactions", {
      operator_id: args.p_operator,
      kind: "adjustment",
      amount: args.p_amount,
      balance_after: newBal,
      note: args.p_note,
      created_by: userId,
    });
  },
});

export const setUserStatus = mutation({
  args: {
    p_user: v.id("users"),
    p_status: v.union(v.literal("active"), v.literal("blocked")),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    if (args.p_user === userId) throw new Error("You cannot block yourself.");

    await ctx.db.patch(args.p_user, { status: args.p_status });
    if (args.p_status === "blocked") {
      const op = await ctx.db
        .query("operators")
        .withIndex("by_user", (q) => q.eq("user_id", args.p_user))
        .first();
      if (op) {
        await ctx.db.patch(op._id, { is_online: false });
      }
    }
  },
});

export const cancelJob = mutation({
  args: {
    p_request: v.id("tow_requests"),
    p_reason: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const req = await ctx.db.get(args.p_request);
    if (!req) throw new Error("Request not found.");

    const now = Date.now();
    await ctx.db.patch(req._id, {
      status: "cancelled",
      cancelled_by: "admin",
      cancel_reason: args.p_reason,
      cancelled_at: now,
      updated_at: now,
    });

    const trk = await ctx.db
      .query("job_tracking")
      .withIndex("by_request", (q) => q.eq("request_id", req._id))
      .first();
    if (trk) await ctx.db.delete(trk._id);

    await ctx.db.insert("request_events", {
      request_id: req._id,
      event: "cancelled_by_admin",
      detail: { reason: args.p_reason },
    });

    await ctx.db.insert("notifications", {
      user_id: req.customer_id,
      seq: now,
      title: "Request cancelled by Townaija",
      body: args.p_reason,
      data: { request_id: req._id, type: "cancelled" },
    });

    if (req.operator_id) {
      await ctx.db.insert("notifications", {
        user_id: req.operator_id,
        seq: now,
        title: "Job cancelled by Townaija",
        body: args.p_reason,
        data: { request_id: req._id, type: "cancelled" },
      });
    }
  },
});

export const completeJob = mutation({
  args: { p_request: v.id("tow_requests") },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const req = await ctx.db.get(args.p_request);
    if (!req || req.status !== "delivered") {
      throw new Error("Only delivered jobs can be marked complete.");
    }

    const settings = await ctx.db.query("app_settings").first();
    const commPct = settings?.commission_pct || 10;
    const finalPrice = req.final_price || req.offer_amount;
    const comm = Math.round((finalPrice * commPct) / 100);

    const now = Date.now();
    await ctx.db.patch(req._id, {
      status: "completed",
      completed_at: now,
      commission_amount: comm,
      updated_at: now,
    });

    if (req.operator_id) {
      const op = await ctx.db
        .query("operators")
        .withIndex("by_user", (q) => q.eq("user_id", req.operator_id!))
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
          request_id: req._id,
          note: `Commission for ${req.ref}`,
          created_by: userId,
        });
      }
    }

    const trk = await ctx.db
      .query("job_tracking")
      .withIndex("by_request", (q) => q.eq("request_id", req._id))
      .first();
    if (trk) await ctx.db.delete(trk._id);
  },
});

export const resolveDispute = mutation({
  args: {
    p_dispute: v.id("disputes"),
    p_resolution: v.string(),
    p_refund_commission: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const dispute = await ctx.db.get(args.p_dispute);
    if (!dispute || dispute.status !== "open") {
      throw new Error("Dispute not found or already resolved.");
    }

    const now = Date.now();
    await ctx.db.patch(dispute._id, {
      status: "resolved",
      resolution: args.p_resolution,
      resolved_by: userId,
      resolved_at: now,
    });

    const req = await ctx.db.get(dispute.request_id);
    if (args.p_refund_commission && req?.operator_id && req.commission_amount) {
      const op = await ctx.db
        .query("operators")
        .withIndex("by_user", (q) => q.eq("user_id", req.operator_id!))
        .first();
      if (op) {
        const newBal = op.wallet_balance + req.commission_amount;
        await ctx.db.patch(op._id, { wallet_balance: newBal });
        await ctx.db.insert("wallet_transactions", {
          operator_id: op.user_id,
          kind: "refund",
          amount: req.commission_amount,
          balance_after: newBal,
          request_id: req._id,
          note: `Commission refund for ${req.ref}`,
          created_by: userId,
        });
      }
    }

    await ctx.db.insert("notifications", {
      user_id: dispute.raised_by,
      seq: now,
      title: "Your report was resolved",
      body: args.p_resolution,
      data: { request_id: dispute.request_id, type: "dispute" },
    });
  },
});

export const saveSettings = mutation({
  args: {
    p: v.object({
      commission_pct: v.optional(v.number()),
      min_wallet_balance: v.optional(v.number()),
      search_radius_km: v.optional(v.number()),
      max_search_radius_km: v.optional(v.number()),
      radius_expand_after_min: v.optional(v.number()),
      request_expiry_min: v.optional(v.number()),
      bid_expiry_min: v.optional(v.number()),
      auto_confirm_hours: v.optional(v.number()),
      road_factor: v.optional(v.number()),
      offer_floor_pct: v.optional(v.number()),
      support_phone: v.optional(v.string()),
      bank_name: v.optional(v.string()),
      bank_account_name: v.optional(v.string()),
      bank_account_number: v.optional(v.string()),
      apk_url: v.optional(v.string()),
      latest_version: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("app_settings").first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args.p, updated_at: now });
    } else {
      await ctx.db.insert("app_settings", {
        commission_pct: args.p.commission_pct ?? 10,
        min_wallet_balance: args.p.min_wallet_balance ?? 1000,
        search_radius_km: args.p.search_radius_km ?? 15,
        max_search_radius_km: args.p.max_search_radius_km ?? 35,
        radius_expand_after_min: args.p.radius_expand_after_min ?? 3,
        request_expiry_min: args.p.request_expiry_min ?? 30,
        bid_expiry_min: args.p.bid_expiry_min ?? 10,
        auto_confirm_hours: args.p.auto_confirm_hours ?? 3,
        road_factor: args.p.road_factor ?? 1.3,
        offer_floor_pct: args.p.offer_floor_pct ?? 60,
        support_phone: args.p.support_phone ?? "0800 TOWNAIJA",
        bank_name: args.p.bank_name ?? "GTBank",
        bank_account_name: args.p.bank_account_name ?? "Townaija Ltd",
        bank_account_number: args.p.bank_account_number ?? "0123456789",
        apk_url: args.p.apk_url,
        latest_version: args.p.latest_version,
        updated_at: now,
      });
    }
  },
});

export const saveRate = mutation({
  args: {
    truck_type: v.union(v.literal("wheel_lift"), v.literal("flatbed"), v.literal("heavy_duty")),
    base_fare: v.number(),
    per_km: v.number(),
    min_fare: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("pricing_rates")
      .withIndex("by_truck", (q) => q.eq("truck_type", args.truck_type))
      .first();

    const labels = {
      wheel_lift: "Wheel-lift (hook)",
      flatbed: "Flatbed",
      heavy_duty: "Heavy-duty",
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        base_fare: args.base_fare,
        per_km: args.per_km,
        min_fare: args.min_fare,
      });
    } else {
      await ctx.db.insert("pricing_rates", {
        truck_type: args.truck_type,
        label: labels[args.truck_type],
        base_fare: args.base_fare,
        per_km: args.per_km,
        min_fare: args.min_fare,
      });
    }
  },
});

export const saveCity = mutation({
  args: {
    id: v.optional(v.id("cities")),
    name: v.string(),
    state: v.string(),
    center_lat: v.number(),
    center_lng: v.number(),
    service_radius_km: v.number(),
    is_active: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.id) {
      await ctx.db.patch(args.id, {
        name: args.name,
        state: args.state,
        center_lat: args.center_lat,
        center_lng: args.center_lng,
        service_radius_km: args.service_radius_km,
        is_active: args.is_active,
      });
    } else {
      await ctx.db.insert("cities", {
        name: args.name,
        state: args.state,
        center_lat: args.center_lat,
        center_lng: args.center_lng,
        service_radius_km: args.service_radius_km,
        is_active: args.is_active,
      });
    }
  },
});

export const setAdmin = mutation({
  args: {
    p_user: v.id("users"),
    p_role: v.optional(v.union(v.literal("super"), v.literal("support"))),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAdmin(ctx);
    if (user.admin_role !== "super") {
      throw new Error("Only super admins can manage admins.");
    }
    if (args.p_user === userId) {
      throw new Error("You cannot change your own admin role.");
    }
    await ctx.db.patch(args.p_user, {
      is_admin: args.p_role != null,
      admin_role: args.p_role,
    });
  },
});
