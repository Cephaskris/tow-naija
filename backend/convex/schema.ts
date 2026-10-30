import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

/*
  Townaija data model (ported from supabase/01_schema.sql).
  - Field names stay snake_case so the app and admin screens did not need to change.
  - Times are stored as milliseconds; functions return them as ISO strings.
  - A person's id is their `users` document id. An operator row points at the same
    person through `user_id`, and everywhere else "operator_id" means that user id
    (same as the old schema, where operators.id = profiles.id).
*/

const vehicleType = v.union(v.literal("car"), v.literal("suv"), v.literal("van_bus"), v.literal("truck"));
const truckType = v.union(v.literal("wheel_lift"), v.literal("flatbed"), v.literal("heavy_duty"));
const problemType = v.union(
  v.literal("breakdown"), v.literal("accident"), v.literal("wont_start"),
  v.literal("flat_tyre"), v.literal("stuck"), v.literal("other"),
);
const requestStatus = v.union(
  v.literal("open"), v.literal("matched"), v.literal("arrived"), v.literal("in_progress"),
  v.literal("delivered"), v.literal("completed"), v.literal("cancelled"), v.literal("expired"),
);
const operatorStatus = v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("suspended"));
const bidStatus = v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected"), v.literal("withdrawn"), v.literal("expired"));

export default defineSchema({
  ...authTables,

  // People. Extends the Convex Auth users table with the old `profiles` columns.
  users: defineTable({
    // Convex Auth fields
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Townaija profile
    full_name: v.optional(v.string()),
    is_operator: v.optional(v.boolean()),
    is_admin: v.optional(v.boolean()),
    admin_role: v.optional(v.union(v.literal("super"), v.literal("support"))),
    status: v.optional(v.union(v.literal("active"), v.literal("blocked"))),
    rating_avg: v.optional(v.number()),
    rating_count: v.optional(v.number()),
    push_token: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_admin", ["is_admin"]),

  app_settings: defineTable({
    commission_pct: v.number(),
    min_wallet_balance: v.number(),
    search_radius_km: v.number(),
    max_search_radius_km: v.number(),
    radius_expand_after_min: v.number(),
    request_expiry_min: v.number(),
    bid_expiry_min: v.number(),
    auto_confirm_hours: v.number(),
    road_factor: v.number(),
    offer_floor_pct: v.number(),
    support_phone: v.string(),
    bank_name: v.string(),
    bank_account_name: v.string(),
    bank_account_number: v.string(),
    apk_url: v.optional(v.string()),
    latest_version: v.optional(v.string()),
    updated_at: v.number(),
  }),

  cities: defineTable({
    name: v.string(),
    state: v.string(),
    center_lat: v.number(),
    center_lng: v.number(),
    service_radius_km: v.number(),
    is_active: v.boolean(),
  }).index("by_name", ["name"]),

  pricing_rates: defineTable({
    truck_type: truckType,
    label: v.string(),
    base_fare: v.number(),
    per_km: v.number(),
    min_fare: v.number(),
  }).index("by_truck", ["truck_type"]),

  operators: defineTable({
    user_id: v.id("users"),
    status: operatorStatus,
    truck_type: truckType,
    truck_plate: v.string(),
    truck_make_model: v.string(),
    base_area: v.string(),
    city_id: v.optional(v.id("cities")),
    license_doc_path: v.optional(v.string()),
    id_doc_path: v.optional(v.string()),
    truck_photo_path: v.optional(v.string()),
    selfie_path: v.optional(v.string()),
    review_note: v.optional(v.string()),
    reviewed_by: v.optional(v.id("users")),
    reviewed_at: v.optional(v.number()),
    is_online: v.boolean(),
    last_lat: v.optional(v.number()),
    last_lng: v.optional(v.number()),
    last_seen_at: v.optional(v.number()),
    wallet_balance: v.number(),
    jobs_completed: v.number(),
    cancellations: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_status", ["status"])
    .index("by_online", ["is_online"]),

  tow_requests: defineTable({
    ref: v.string(),
    customer_id: v.id("users"),
    city_id: v.optional(v.id("cities")),
    status: requestStatus,
    pickup_lat: v.number(),
    pickup_lng: v.number(),
    pickup_address: v.string(),
    dropoff_lat: v.number(),
    dropoff_lng: v.number(),
    dropoff_address: v.string(),
    vehicle_type: vehicleType,
    vehicle_desc: v.string(),
    problem_type: problemType,
    wheels_roll: v.boolean(),
    keys_available: v.boolean(),
    notes: v.string(),
    photo_paths: v.array(v.string()),
    distance_km: v.number(),
    required_truck_types: v.array(truckType),
    recommended_fare: v.number(),
    fare_floor: v.number(),
    offer_amount: v.number(),
    payment_method: v.union(v.literal("cash"), v.literal("transfer")),
    operator_id: v.optional(v.id("users")),
    accepted_bid_id: v.optional(v.id("bids")),
    final_price: v.optional(v.number()),
    commission_amount: v.optional(v.number()),
    pickup_photo_paths: v.array(v.string()),
    delivery_photo_paths: v.array(v.string()),
    cancel_reason: v.optional(v.string()),
    cancelled_by: v.optional(v.union(v.literal("customer"), v.literal("operator"), v.literal("admin"), v.literal("system"))),
    offer_updated_at: v.number(),
    matched_at: v.optional(v.number()),
    arrived_at: v.optional(v.number()),
    started_at: v.optional(v.number()),
    delivered_at: v.optional(v.number()),
    completed_at: v.optional(v.number()),
    cancelled_at: v.optional(v.number()),
    updated_at: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_customer", ["customer_id"])
    .index("by_operator", ["operator_id"])
    .index("by_ref", ["ref"]),

  // Start code lives apart so only the customer (and admins) can read it.
  request_codes: defineTable({
    request_id: v.id("tow_requests"),
    start_code: v.string(),
  }).index("by_request", ["request_id"]),

  bids: defineTable({
    request_id: v.id("tow_requests"),
    operator_id: v.id("users"),
    amount: v.number(),
    eta_minutes: v.number(),
    status: bidStatus,
    expires_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_request", ["request_id"])
    .index("by_request_operator", ["request_id", "operator_id"])
    .index("by_operator_status", ["operator_id", "status"])
    .index("by_status", ["status"]),

  job_tracking: defineTable({
    request_id: v.id("tow_requests"),
    operator_id: v.id("users"),
    lat: v.number(),
    lng: v.number(),
    updated_at: v.number(),
  }).index("by_request", ["request_id"]),

  ratings: defineTable({
    request_id: v.id("tow_requests"),
    rater_id: v.id("users"),
    ratee_id: v.id("users"),
    stars: v.number(),
    comment: v.string(),
  })
    .index("by_request_rater", ["request_id", "rater_id"])
    .index("by_ratee", ["ratee_id"]),

  request_events: defineTable({
    request_id: v.id("tow_requests"),
    actor_id: v.optional(v.id("users")),
    event: v.string(),
    detail: v.any(),
  }).index("by_request", ["request_id"]),

  topup_requests: defineTable({
    operator_id: v.id("users"),
    amount: v.number(),
    reference: v.string(),
    proof_path: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    review_note: v.optional(v.string()),
    reviewed_by: v.optional(v.id("users")),
    reviewed_at: v.optional(v.number()),
  })
    .index("by_operator", ["operator_id"])
    .index("by_status", ["status"]),

  wallet_transactions: defineTable({
    operator_id: v.id("users"),
    kind: v.union(v.literal("topup"), v.literal("commission"), v.literal("adjustment"), v.literal("refund")),
    amount: v.number(),
    balance_after: v.number(),
    request_id: v.optional(v.id("tow_requests")),
    topup_id: v.optional(v.id("topup_requests")),
    note: v.string(),
    created_by: v.optional(v.id("users")),
  })
    .index("by_operator", ["operator_id"])
    .index("by_request", ["request_id"]),

  disputes: defineTable({
    request_id: v.id("tow_requests"),
    raised_by: v.id("users"),
    raised_by_role: v.union(v.literal("customer"), v.literal("operator")),
    reason: v.string(),
    details: v.string(),
    status: v.union(v.literal("open"), v.literal("resolved")),
    resolution: v.optional(v.string()),
    resolved_by: v.optional(v.id("users")),
    resolved_at: v.optional(v.number()),
  })
    .index("by_request", ["request_id"])
    .index("by_status", ["status"]),

  // In-app inbox. `seq` is a growing number so the app can spot new items.
  notifications: defineTable({
    user_id: v.id("users"),
    seq: v.number(),
    title: v.string(),
    body: v.string(),
    data: v.any(),
    read_at: v.optional(v.number()),
  }).index("by_user_seq", ["user_id", "seq"]),

  counters: defineTable({ name: v.string(), value: v.number() }).index("by_name", ["name"]),

  // Uploaded photos and documents. `bucket` decides who may see them.
  files: defineTable({
    storage_id: v.id("_storage"),
    bucket: v.union(v.literal("job-photos"), v.literal("operator-docs"), v.literal("topup-proofs")),
    owner: v.id("users"),
  }).index("by_storage", ["storage_id"]),
});
