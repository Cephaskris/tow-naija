import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const populate = internalMutation({
  args: { wipeExisting: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (args.wipeExisting) {
      const tables = [
        "disputes",
        "wallet_transactions",
        "topup_requests",
        "request_events",
        "ratings",
        "job_tracking",
        "bids",
        "request_codes",
        "tow_requests",
        "operators",
      ] as const;
      for (const t of tables) {
        const rows = await ctx.db.query(t).collect();
        for (const r of rows) await ctx.db.delete(r._id);
      }
    }

    const existingOps = await ctx.db.query("operators").collect();
    if (existingOps.length > 0 && !args.wipeExisting) {
      return { message: "Operational data already exists." };
    }

    const now = Date.now();
    const m = 60000;
    const h = 3600000;
    const d = 86400000;

    // 1. Ensure Cities
    let abuja = await ctx.db.query("cities").filter((q) => q.eq(q.field("name"), "Abuja")).first();
    if (!abuja) {
      const cId = await ctx.db.insert("cities", {
        name: "Abuja",
        state: "FCT",
        center_lat: 9.0579,
        center_lng: 7.4951,
        service_radius_km: 60,
        is_active: true,
      });
      abuja = await ctx.db.get(cId);
    } else {
      await ctx.db.patch(abuja._id, { is_active: true });
    }

    let lagos = await ctx.db.query("cities").filter((q) => q.eq(q.field("name"), "Lagos")).first();
    if (!lagos) {
      await ctx.db.insert("cities", {
        name: "Lagos",
        state: "Lagos",
        center_lat: 6.5244,
        center_lng: 3.3792,
        service_radius_km: 60,
        is_active: true,
      });
    } else {
      await ctx.db.patch(lagos._id, { is_active: true });
    }

    // 2. Ensure Users (Operators & Customers)
    const userProfiles = [
      // Operators
      { phone: "08033344455", name: "Musa Bello", is_operator: true, rating_avg: 4.9, rating_count: 41 },
      { phone: "08155566677", name: "Chinedu Eze", is_operator: true, rating_avg: 4.8, rating_count: 23 },
      { phone: "07011122233", name: "Garba Abdullahi", is_operator: true, rating_avg: 4.9, rating_count: 58 },
      { phone: "08067788990", name: "Femi Ogunleye", is_operator: true, rating_avg: 0, rating_count: 0 },
      { phone: "09087766554", name: "Yakubu Danjuma", is_operator: true, rating_avg: 0, rating_count: 0 },
      // Customers
      { phone: "08031234501", name: "Ada Okafor", is_operator: false, rating_avg: 4.9, rating_count: 5 },
      { phone: "08052231877", name: "Ibrahim Sule", is_operator: false, rating_avg: 5.0, rating_count: 3 },
      { phone: "07064410923", name: "Chiamaka Nwosu", is_operator: false, rating_avg: 4.7, rating_count: 4 },
      { phone: "08127789034", name: "Emeka Obi", is_operator: false, rating_avg: 5.0, rating_count: 2 },
      { phone: "09023345671", name: "Zainab Yusuf", is_operator: false, rating_avg: 4.8, rating_count: 6 },
      { phone: "08099812345", name: "Tolu Adeyemi", is_operator: false, rating_avg: 4.6, rating_count: 2 },
    ];

    const userMap: Record<string, Id<"users">> = {};

    for (const p of userProfiles) {
      let u = await ctx.db.query("users").withIndex("phone", (q) => q.eq("phone", p.phone)).first();
      if (!u) {
        const uId = await ctx.db.insert("users", {
          phone: p.phone,
          email: `${p.phone}@users.townaija.app`,
          full_name: p.name,
          name: p.name,
          is_operator: p.is_operator,
          is_admin: false,
          status: "active",
          rating_avg: p.rating_avg,
          rating_count: p.rating_count,
        });
        userMap[p.phone] = uId;
      } else {
        await ctx.db.patch(u._id, {
          full_name: p.name,
          name: p.name,
          is_operator: p.is_operator,
          rating_avg: p.rating_avg,
          rating_count: p.rating_count,
        });
        userMap[p.phone] = u._id;
      }
    }

    // 3. Operators
    const operatorData = [
      {
        phone: "08033344455",
        status: "approved" as const,
        truck_type: "flatbed" as const,
        truck_plate: "ABJ 482 KW",
        truck_make_model: "Isuzu NPR flatbed",
        base_area: "Wuse II",
        is_online: true,
        last_lat: 9.0755,
        last_lng: 7.4721,
        last_seen_at: now - 2 * m,
        wallet_balance: 18500,
        jobs_completed: 41,
        cancellations: 1,
      },
      {
        phone: "08155566677",
        status: "approved" as const,
        truck_type: "wheel_lift" as const,
        truck_plate: "KUJ 119 AA",
        truck_make_model: "Mitsubishi Canter wrecker",
        base_area: "Kubwa",
        is_online: true,
        last_lat: 9.148,
        last_lng: 7.331,
        last_seen_at: now - 1 * m,
        wallet_balance: 4200,
        jobs_completed: 23,
        cancellations: 0,
      },
      {
        phone: "07011122233",
        status: "approved" as const,
        truck_type: "heavy_duty" as const,
        truck_plate: "GWA 220 XY",
        truck_make_model: "MAN TGS rotator",
        base_area: "Gwagwalada",
        is_online: false,
        last_lat: 8.943,
        last_lng: 7.085,
        last_seen_at: now - 5 * h,
        wallet_balance: 31000,
        jobs_completed: 58,
        cancellations: 2,
      },
      {
        phone: "08067788990",
        status: "pending" as const,
        truck_type: "flatbed" as const,
        truck_plate: "AMC 731 LS",
        truck_make_model: "Toyota Dyna flatbed",
        base_area: "Lugbe",
        is_online: false,
        wallet_balance: 0,
        jobs_completed: 0,
        cancellations: 0,
      },
      {
        phone: "09087766554",
        status: "pending" as const,
        truck_type: "wheel_lift" as const,
        truck_plate: "BWR 008 TT",
        truck_make_model: "Hino wrecker",
        base_area: "Nyanya",
        is_online: false,
        wallet_balance: 0,
        jobs_completed: 0,
        cancellations: 0,
      },
    ];

    const opUserIds: Record<string, Id<"users">> = {};
    for (const op of operatorData) {
      const uId = userMap[op.phone];
      opUserIds[op.phone] = uId;
      const existing = await ctx.db.query("operators").withIndex("by_user", (q) => q.eq("user_id", uId)).first();
      if (!existing) {
        await ctx.db.insert("operators", {
          user_id: uId,
          city_id: abuja?._id,
          status: op.status,
          truck_type: op.truck_type,
          truck_plate: op.truck_plate,
          truck_make_model: op.truck_make_model,
          base_area: op.base_area,
          is_online: op.is_online,
          last_lat: op.last_lat,
          last_lng: op.last_lng,
          last_seen_at: op.last_seen_at,
          wallet_balance: op.wallet_balance,
          jobs_completed: op.jobs_completed,
          cancellations: op.cancellations,
        });
      }
    }

    // 4. Tow Requests
    const musa = opUserIds["08033344455"];
    const chinedu = opUserIds["08155566677"];
    const garba = opUserIds["07011122233"];

    const ada = userMap["08031234501"];
    const ibrahim = userMap["08052231877"];
    const chiamaka = userMap["07064410923"];
    const zainab = userMap["09023345671"];
    const tolu = userMap["08099812345"];

    // Active Job 1: Open Request
    const j1Id = await ctx.db.insert("tow_requests", {
      ref: "TN-1048",
      customer_id: zainab,
      city_id: abuja?._id,
      status: "open",
      pickup_address: "Banex Plaza, Wuse II",
      pickup_lat: 9.0817,
      pickup_lng: 7.4697,
      dropoff_address: "Apo Mechanic Village",
      dropoff_lat: 8.9977,
      dropoff_lng: 7.4986,
      distance_km: 13.1,
      vehicle_type: "car",
      vehicle_desc: "Toyota Camry 2010",
      problem_type: "wont_start",
      wheels_roll: true,
      keys_available: true,
      notes: "Engine won't crank. Keys are inside.",
      photo_paths: [],
      required_truck_types: ["wheel_lift", "flatbed"],
      recommended_fare: 28000,
      fare_floor: 16800,
      offer_amount: 26000,
      payment_method: "cash",
      pickup_photo_paths: [],
      delivery_photo_paths: [],
      offer_updated_at: now - 4 * m,
      updated_at: now - 4 * m,
    });

    await ctx.db.insert("request_codes", { request_id: j1Id, start_code: "5914" });
    await ctx.db.insert("bids", {
      request_id: j1Id,
      operator_id: chinedu,
      amount: 26000,
      eta_minutes: 15,
      status: "pending",
      expires_at: now + 6 * m,
      updated_at: now - 2 * m,
    });
    await ctx.db.insert("bids", {
      request_id: j1Id,
      operator_id: musa,
      amount: 28000,
      eta_minutes: 20,
      status: "pending",
      expires_at: now + 7 * m,
      updated_at: now - 1 * m,
    });

    // Active Job 2: In Progress (accident, non-rolling wheels)
    const j2Id = await ctx.db.insert("tow_requests", {
      ref: "TN-1047",
      customer_id: chiamaka,
      operator_id: musa,
      city_id: abuja?._id,
      status: "in_progress",
      pickup_address: "Airport Road by Lugbe",
      pickup_lat: 8.9806,
      pickup_lng: 7.381,
      dropoff_address: "Garki Area 11",
      dropoff_lat: 9.03,
      dropoff_lng: 7.485,
      distance_km: 16.4,
      vehicle_type: "suv",
      vehicle_desc: "Lexus RX 350",
      problem_type: "accident",
      wheels_roll: false,
      keys_available: true,
      notes: "Right front axle snapped. Requires flatbed with skates.",
      photo_paths: [],
      required_truck_types: ["flatbed"],
      recommended_fare: 41500,
      fare_floor: 25000,
      offer_amount: 40000,
      final_price: 45000,
      commission_amount: 4500,
      payment_method: "transfer",
      pickup_photo_paths: [],
      delivery_photo_paths: [],
      matched_at: now - 64 * m,
      arrived_at: now - 40 * m,
      started_at: now - 30 * m,
      offer_updated_at: now - 70 * m,
      updated_at: now - 30 * m,
    });
    await ctx.db.insert("request_codes", { request_id: j2Id, start_code: "8821" });
    await ctx.db.insert("job_tracking", {
      request_id: j2Id,
      operator_id: musa,
      lat: 9.005,
      lng: 7.432,
      updated_at: now - 2 * m,
    });

    // Active Job 3: Matched & En Route
    const j3Id = await ctx.db.insert("tow_requests", {
      ref: "TN-1046",
      customer_id: ibrahim,
      operator_id: chinedu,
      city_id: abuja?._id,
      status: "matched",
      pickup_address: "Kubwa Expressway, Phase 4",
      pickup_lat: 9.153,
      pickup_lng: 7.322,
      dropoff_address: "Dutse Junction",
      dropoff_lat: 9.172,
      dropoff_lng: 7.378,
      distance_km: 8.1,
      vehicle_type: "car",
      vehicle_desc: "Honda Accord",
      problem_type: "breakdown",
      wheels_roll: true,
      keys_available: true,
      notes: "Transmission failure on the bridge.",
      photo_paths: [],
      required_truck_types: ["wheel_lift", "flatbed"],
      recommended_fare: 21500,
      fare_floor: 13000,
      offer_amount: 21500,
      final_price: 21500,
      commission_amount: 2150,
      payment_method: "cash",
      pickup_photo_paths: [],
      delivery_photo_paths: [],
      matched_at: now - 15 * m,
      offer_updated_at: now - 22 * m,
      updated_at: now - 15 * m,
    });
    await ctx.db.insert("request_codes", { request_id: j3Id, start_code: "3419" });

    // Active Job 4: Delivered, Awaiting Confirmation
    const j4Id = await ctx.db.insert("tow_requests", {
      ref: "TN-1045",
      customer_id: ada,
      operator_id: musa,
      city_id: abuja?._id,
      status: "delivered",
      pickup_address: "Jabi Lake Mall",
      pickup_lat: 9.07,
      pickup_lng: 7.423,
      dropoff_address: "Utako Market",
      dropoff_lat: 9.065,
      dropoff_lng: 7.441,
      distance_km: 2.6,
      vehicle_type: "car",
      vehicle_desc: "Kia Rio",
      problem_type: "flat_tyre",
      wheels_roll: true,
      keys_available: true,
      notes: "Dual flat tyres, no spare.",
      photo_paths: [],
      required_truck_types: ["wheel_lift", "flatbed"],
      recommended_fare: 25000,
      fare_floor: 15000,
      offer_amount: 25000,
      final_price: 25000,
      commission_amount: 2500,
      payment_method: "cash",
      pickup_photo_paths: [],
      delivery_photo_paths: [],
      matched_at: now - 170 * m,
      arrived_at: now - 150 * m,
      started_at: now - 140 * m,
      delivered_at: now - 120 * m,
      offer_updated_at: now - 180 * m,
      updated_at: now - 120 * m,
    });
    await ctx.db.insert("request_codes", { request_id: j4Id, start_code: "7104" });

    // Past 12 Completed Jobs (distributed across previous days)
    const pastLocations = [
      { from: "Maitama", to: "Apo Mechanic", dist: 14, car: "Toyota Corolla", price: 28000, op: musa, cust: ada, daysAgo: 1 },
      { from: "Gwarinpa 3rd Ave", to: "Kado Village", dist: 6, car: "Peugeot 406", price: 22000, op: chinedu, cust: ibrahim, daysAgo: 1 },
      { from: "Life Camp", to: "Utako", dist: 8, car: "Toyota Hilux", price: 32000, op: musa, cust: chiamaka, daysAgo: 2 },
      { from: "Wuye", to: "Wuse Zone 2", dist: 5, car: "VW Golf 4", price: 20000, op: chinedu, cust: tolu, daysAgo: 2 },
      { from: "Zuba Junction", to: "Dei-Dei", dist: 9, car: "Dangote Tipper (Empty)", price: 85000, op: garba, cust: zainab, daysAgo: 3 },
      { from: "Asokoro", to: "Garki 2", dist: 7, car: "Toyota Sienna", price: 27500, op: musa, cust: ada, daysAgo: 4 },
      { from: "Jahi", to: "Mabushi", dist: 5, car: "Toyota Camry", price: 21000, op: chinedu, cust: ibrahim, daysAgo: 5 },
      { from: "Katampe Extension", to: "Apo", dist: 15, car: "Toyota RAV4", price: 38000, op: musa, cust: chiamaka, daysAgo: 6 },
      { from: "Karu Site", to: "Nyanya", dist: 6, car: "Honda Civic", price: 24000, op: chinedu, cust: tolu, daysAgo: 8 },
      { from: "Durumi", to: "Area 1", dist: 4, car: "Hyundai Elantra", price: 22000, op: musa, cust: zainab, daysAgo: 9 },
      { from: "Gwagwalada", to: "Kuje", dist: 22, car: "Mack Water Tanker", price: 95000, op: garba, cust: ada, daysAgo: 11 },
      { from: "Galadimawa", to: "Lokogoma", dist: 5, car: "Toyota Highlander", price: 26000, op: chinedu, cust: ibrahim, daysAgo: 13 },
    ];

    let refNum = 1044;
    for (const pj of pastLocations) {
      const createdTime = now - pj.daysAgo * d - 3 * h;
      const completedTime = createdTime + 2 * h;
      const comm = Math.round(pj.price * 0.1);

      await ctx.db.insert("tow_requests", {
        ref: `TN-${refNum--}`,
        customer_id: pj.cust,
        operator_id: pj.op,
        city_id: abuja?._id,
        status: "completed",
        pickup_address: pj.from,
        pickup_lat: 9.05 + (refNum % 5) * 0.02,
        pickup_lng: 7.42 + (refNum % 4) * 0.02,
        dropoff_address: pj.to,
        dropoff_lat: 9.01,
        dropoff_lng: 7.48,
        distance_km: pj.dist,
        vehicle_type: pj.price > 80000 ? "truck" : "car",
        vehicle_desc: pj.car,
        problem_type: "breakdown",
        wheels_roll: true,
        keys_available: true,
        notes: "Towed safely to workshop.",
        photo_paths: [],
        required_truck_types: pj.price > 80000 ? ["heavy_duty"] : ["flatbed", "wheel_lift"],
        recommended_fare: pj.price,
        fare_floor: Math.round(pj.price * 0.6),
        offer_amount: pj.price,
        final_price: pj.price,
        commission_amount: comm,
        payment_method: "cash",
        pickup_photo_paths: [],
        delivery_photo_paths: [],
        matched_at: createdTime + 10 * m,
        arrived_at: createdTime + 25 * m,
        started_at: createdTime + 35 * m,
        delivered_at: completedTime - 10 * m,
        completed_at: completedTime,
        offer_updated_at: createdTime,
        updated_at: completedTime,
      });

      // Wallet commission deduction
      await ctx.db.insert("wallet_transactions", {
        operator_id: pj.op,
        kind: "commission",
        amount: -comm,
        balance_after: 20000,
        note: `10% commission for TN-${refNum + 1}`,
      });
    }

    // 5. Driver Top-Up Requests
    await ctx.db.insert("topup_requests", {
      operator_id: chinedu,
      amount: 10000,
      reference: "Opay transfer 7731",
      status: "pending",
    });
    await ctx.db.insert("topup_requests", {
      operator_id: musa,
      amount: 20000,
      reference: "GTB 0042",
      status: "approved",
      review_note: "Verified via GTB corporate app",
      reviewed_at: now - 3 * d,
    });
    await ctx.db.insert("wallet_transactions", {
      operator_id: musa,
      kind: "topup",
      amount: 20000,
      balance_after: 25000,
      note: "Wallet topup: GTB 0042",
    });

    // 6. Dispute
    const disputeJob = await ctx.db.query("tow_requests").filter((q) => q.eq(q.field("ref"), "TN-1044")).first();
    if (disputeJob) {
      await ctx.db.insert("disputes", {
        request_id: disputeJob._id,
        raised_by_role: "customer",
        raised_by: ada,
        reason: "Vehicle scratch on rear fender",
        details: "Customer reports a light scratch on rear bumper after offloading at workshop. Seeking review.",
        status: "open",
      });
    }

    return { success: true, message: "Real Nigerian operational data populated in Convex!" };
  },
});
