import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()), // Email is optional if they just use phone
    phone: v.string(),
    role: v.union(v.literal("passenger"), v.literal("driver"), v.literal("admin")),
    isBanned: v.optional(v.boolean()),
    bannedReason: v.optional(v.string()),
    connectionCredits: v.optional(v.number()), // Connection Credits balance (in ₦ / credits)
    createdAt: v.optional(v.number()),
  }).index("by_phone", ["phone"]),

  drivers: defineTable({
    userId: v.id("users"),
    isAvailable: v.boolean(),
    verificationStatus: v.union(
      v.literal("unverified"),
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("suspended")
    ),
    rejectionReason: v.optional(v.string()),
    location: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    rating: v.optional(v.number()),
    ratingCount: v.optional(v.number()),
    totalEarnings: v.optional(v.number()),
    connectionCredits: v.optional(v.number()),
    licenseDocumentUrl: v.optional(v.string()),
    registrationDocumentUrl: v.optional(v.string()),
    truckPhotoUrl: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    vehicleDetails: v.optional(
      v.object({
        make: v.string(),
        model: v.string(),
        year: v.string(),
        licensePlate: v.string(),
        towType: v.string(), // e.g. "Flatbed", "Dolly", "Heavy Duty"
      })
    ),
    bankDetails: v.optional(
      v.object({
        bankName: v.string(),
        accountNumber: v.string(),
        accountName: v.string(),
      })
    ),
  }).index("by_userId", ["userId"])
    .index("by_verificationStatus", ["verificationStatus"]),

  towRequests: defineTable({
    passengerId: v.id("users"),
    driverId: v.optional(v.id("drivers")),
    status: v.union(
      v.literal("searching"),
      v.literal("accepted"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    price: v.optional(v.number()),
    towType: v.optional(v.string()),
    vehicleMake: v.optional(v.string()),
    vehicleModel: v.optional(v.string()),
    vehicleYear: v.optional(v.string()),
    rating: v.optional(v.number()),
    review: v.optional(v.string()),
    paymentStatus: v.optional(
      v.union(v.literal("unpaid"), v.literal("paid"))
    ),
    paymentMethod: v.optional(v.string()),
    cancelledBy: v.optional(v.string()),
    cancellationReason: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    pickupLocation: v.object({
      lat: v.number(),
      lng: v.number(),
      address: v.string(),
    }),
    dropoffLocation: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
        address: v.string(),
      })
    ),
  }).index("by_passengerId", ["passengerId"])
    .index("by_driverId", ["driverId"])
    .index("by_status", ["status"]),

  tripOffers: defineTable({
    requestId: v.id("towRequests"),
    driverId: v.id("drivers"),
    driverUserId: v.id("users"),
    offeredPrice: v.number(),
    passengerCounterPrice: v.optional(v.number()),
    lastSender: v.union(v.literal("driver"), v.literal("passenger")),
    status: v.union(
      v.literal("pending"),
      v.literal("countered"),
      v.literal("accepted"),
      v.literal("declined")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_requestId", ["requestId"])
    .index("by_driverId", ["driverId"])
    .index("by_requestId_and_driverId", ["requestId", "driverId"]),

  creditTransactions: defineTable({
    userId: v.id("users"),
    userRole: v.union(v.literal("passenger"), v.literal("driver"), v.literal("admin")),
    amount: v.number(), // positive for credit/top-up, negative for deduction
    type: v.union(
      v.literal("topup"),
      v.literal("search_deduction"),
      v.literal("go_online_deduction"),
      v.literal("admin_adjustment")
    ),
    description: v.string(),
    reference: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_userId", ["userId"])
    .index("by_type", ["type"]),

  platformSettings: defineTable({
    baseFareFlatbed: v.number(),
    baseFareDolly: v.number(),
    baseFareHeavyDuty: v.number(),
    perKmRate: v.number(),
    platformCommissionPercent: v.number(),
    surgeMultiplier: v.number(),
    passengerSearchCreditCost: v.optional(v.number()), // e.g. 1000 NGN
    driverGoOnlineCreditCost: v.optional(v.number()), // e.g. 1500 NGN
    maintenanceMode: v.boolean(),
    supportPhone: v.string(),
    supportEmail: v.string(),
  }),

  otps: defineTable({
    phone: v.string(),
    code: v.string(),
    expiresAt: v.number(), // Unix timestamp
  }).index("by_phone", ["phone"]),
});
