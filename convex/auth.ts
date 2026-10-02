import { v } from "convex/values";
import { mutation, action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// Internal mutation to generate and store the OTP
export const generateAndStoreOTP = internalMutation({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    // Check if there is an existing valid OTP for this phone
    const existingOtp = await ctx.db
      .query("otps")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    if (existingOtp) {
      await ctx.db.delete(existingOtp._id);
    }

    // Generate a new 4-digit OTP
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Set expiration for 10 minutes from now
    const expiresAt = Date.now() + 10 * 60 * 1000;

    await ctx.db.insert("otps", {
      phone: args.phone,
      code,
      expiresAt,
    });

    return code;
  },
});

// Action to send the OTP via BulkSMS Nigeria
export const sendOTP = action({
  args: { phone: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean; code: string }> => {
    // 1. Generate and save the OTP in the database
    const code: string = await ctx.runMutation(internal.auth.generateAndStoreOTP, {
      phone: args.phone,
    });

    // 2. Send the SMS via BulkSMS Nigeria
    const apiToken = process.env.BULKSMS_NIGERIA_API_TOKEN;
    
    // Use Sandbox if no token is provided for testing
    const baseUrl = apiToken 
      ? "https://www.bulksmsnigeria.com/api/v2" 
      : "https://www.bulksmsnigeria.com/api/sandbox/v2";
    
    // Fallback token for Sandbox testing if none exists
    const token = apiToken || "SANDBOX_TOKEN_PLACEHOLDER";

    // Format phone number for BulkSMS Nigeria (remove + and ensure 234 prefix)
    let formattedPhone = args.phone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("234")) {
        // Simple logic for local numbers starting with 0
        if (formattedPhone.startsWith("0")) {
            formattedPhone = "234" + formattedPhone.substring(1);
        }
    }

    try {
      const response = await fetch(`${baseUrl}/sms`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          from: "TowNaija",
          to: formattedPhone,
          body: `Your TowNaija verification code is: ${code}. Valid for 10 minutes.`,
          gateway: "otp"
        }),
      });

      const result = await response.json();
      console.log(`[BulkSMS Nigeria] Status: ${result.status}, Message: ${result.message}`);
      
      if (result.status !== "success") {
        console.error("BulkSMS Error:", result.error);
      }

    } catch (error) {
      console.error("Failed to send SMS:", error);
      // We don't throw here to avoid blocking the user flow in dev, 
      // but in production you might want to handle this differently.
    }

    // For debugging/AI testing
    console.log(`[OTP DEBUG] Phone: ${args.phone}, Code: ${code}`);

    return { success: true, code };
  },
});

// Query to fetch the active OTP generated in Convex for a phone number
export const getActiveOTP = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    if (!args.phone) return null;
    const otp = await ctx.db
      .query("otps")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();
    if (!otp || Date.now() > otp.expiresAt) return null;
    return otp.code;
  },
});

// Verify the 4-digit OTP stored in Convex and return the user ID
export const verifyOTP = mutation({
  args: { 
    phone: v.string(),
    code: v.string(),
    firstName: v.optional(v.string()), // Optional, passed during registration
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const otpRecord = await ctx.db
      .query("otps")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    if (!otpRecord) {
      throw new Error("No active verification code found in Convex for this phone number. Please click Resend.");
    }

    if (Date.now() > otpRecord.expiresAt) {
      await ctx.db.delete(otpRecord._id);
      throw new Error("Verification code has expired. Please request a new code.");
    }

    if (otpRecord.code !== args.code) {
      throw new Error("Invalid verification code. Please check and try again.");
    }

    // OTP is valid, remove it from Convex database
    await ctx.db.delete(otpRecord._id);

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    if (existingUser) {
      return { success: true, userId: existingUser._id, role: existingUser.role };
    }

    if (!args.firstName || !args.lastName) {
      throw new Error("Account not found for this phone number. Please register first.");
    }

    const newUserId = await ctx.db.insert("users", {
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      role: "passenger",
    });

    return { success: true, userId: newUserId, role: 'passenger' as const };
  },
});

// Register a new user (passenger or driver) with phone number and password
export const registerWithPassword = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    phone: v.string(),
    password: v.string(),
    email: v.optional(v.string()),
    role: v.union(v.literal("passenger"), v.literal("driver")),
  },
  handler: async (ctx, args) => {
    const cleanDigits = args.phone.replace(/\D/g, "");
    if (!cleanDigits || cleanDigits.length < 9) {
      throw new Error("Please provide a valid phone number.");
    }

    const formattedPhone = cleanDigits.startsWith("234")
      ? `+${cleanDigits}`
      : `+234${cleanDigits.replace(/^0+/, "")}`;

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", formattedPhone))
      .first();

    if (existingUser) {
      throw new Error("An account with this phone number already exists. Please sign in.");
    }

    const newUserId = await ctx.db.insert("users", {
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      email: args.email?.trim() || undefined,
      phone: formattedPhone,
      password: args.password,
      role: args.role,
      connectionCredits: 5000,
      createdAt: Date.now(),
    });

    if (args.role === "driver") {
      await ctx.db.insert("drivers", {
        userId: newUserId,
        isAvailable: false,
        verificationStatus: "unverified",
        connectionCredits: 5000,
        createdAt: Date.now(),
      });
    }

    return {
      success: true,
      userId: newUserId,
      role: args.role,
    };
  },
});

// Login existing user with phone number and password
export const loginWithPassword = mutation({
  args: {
    phone: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanDigits = args.phone.replace(/\D/g, "");
    if (!cleanDigits || cleanDigits.length < 9) {
      throw new Error("Please enter a valid phone number.");
    }

    const formattedWithPlus = cleanDigits.startsWith("234")
      ? `+${cleanDigits}`
      : `+234${cleanDigits.replace(/^0+/, "")}`;
    const formattedWithoutPlus = formattedWithPlus.replace("+", "");
    const formattedLocal = "0" + cleanDigits.replace(/^234/, "").replace(/^0+/, "");

    // Look up user by phone variations
    let user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", formattedWithPlus))
      .first();

    if (!user) {
      user = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", formattedWithoutPlus))
        .first();
    }

    if (!user) {
      user = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", formattedLocal))
        .first();
    }

    if (!user) {
      // Fallback: check all users by suffix match
      const allUsers = await ctx.db.query("users").collect();
      user =
        allUsers.find((u) => {
          const uClean = u.phone.replace(/\D/g, "");
          return (
            uClean === cleanDigits ||
            uClean.endsWith(cleanDigits.slice(-10)) ||
            cleanDigits.endsWith(uClean.slice(-10))
          );
        }) || null;
    }

    if (!user) {
      throw new Error("No account found with this phone number. Please sign up first.");
    }

    if (user.isBanned) {
      throw new Error(`Account suspended: ${user.bannedReason || "Please contact support."}`);
    }

    // Verify password
    if (user.password) {
      if (user.password !== args.password) {
        throw new Error("Incorrect password. Please try again.");
      }
    } else {
      // For existing legacy accounts without password, set it on first password login
      await ctx.db.patch(user._id, { password: args.password });
    }

    return {
      success: true,
      userId: user._id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  },
});

