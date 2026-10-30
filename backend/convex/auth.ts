import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { normPhone, phoneEmail } from "./lib";

/*
  Phone number + password sign-in (no SMS cost).
  Each phone maps to a private login address like 08031234567@users.townaija.app,
  exactly as the Supabase version did, so nothing changes for users.
*/
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile: (params, ctx) => {
        const phone = normPhone(String(params.phone ?? params.email ?? "").split("@")[0]);
        const email = phoneEmail(phone);
        if (params.flow !== "signUp") return { email };

        const fullName = String(params.full_name ?? "").trim();
        if (fullName.length < 2) throw new ConvexError("Enter your full name.");
        if (!/^0[789][01]\d{8}$/.test(phone)) {
          throw new ConvexError("Enter a valid Nigerian phone number, e.g. 0803 123 4567.");
        }
        // Runs inside the sign-up action, before the account is created.
        void ctx;
        return {
          email,
          phone,
          full_name: fullName.slice(0, 80),
          name: fullName.slice(0, 80),
          is_operator: false,
          is_admin: false,
          status: "active" as const,
          rating_avg: 0,
          rating_count: 0,
        };
      },
      validatePasswordRequirements: (password: string) => {
        if (!password || password.length < 6) throw new ConvexError("Password must be at least 6 characters.");
      },
    }),
  ],
  callbacks: {
    // Friendly error instead of a generic failure when the phone is already registered.
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) return args.existingUserId;
      const profile = args.profile as Record<string, unknown>;
      const taken = await ctx.runQuery(internal.users.byPhone, { phone: String(profile.phone ?? "") });
      if (taken) throw new ConvexError("An account with this phone number already exists. Log in instead.");
      return await ctx.db.insert("users", profile as never);
    },
  },
});
