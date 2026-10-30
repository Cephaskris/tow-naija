# Townaija

Tow-truck marketplace for Nigeria. Stranded drivers post their location and name a price; verified tow operators nearby accept or counter; the driver picks one, the vehicle is towed, and the driver pays the operator directly. Townaija earns a commission from the operator's prepaid wallet.

```
townaija/
├── app/                     Android app (customer + operator modes in one app)
├── landing/index.html       Public landing page (download the app, become an operator)
├── admin/index.html         Admin dashboard (single web page, no server)
├── build_site.py            Builds the website: landing at /, admin at /admin/
├── supabase/
│   ├── 01_schema.sql        Database, security rules and all business logic
│   ├── 02_storage.sql       Photo and document storage
│   └── tests/               Automated end-to-end test of the backend
└── .github/workflows/       Builds the APK and deploys the admin automatically
```

## What it costs to run

| Piece | Service | Cost |
|---|---|---|
| Database, logins, live updates, photos | Supabase free plan | ₦0 (upgrade to ~$25/month once you have real traffic) |
| Maps | OpenFreeMap tiles + MapLibre | ₦0, no API key |
| Address search | Photon (OpenStreetMap) | ₦0 (fair-use; swap for a paid geocoder at scale) |
| APK builds | GitHub Actions | ₦0 (2,000 free minutes/month on private repos ≈ 80+ builds) |
| Admin hosting | Netlify or GitHub Pages | ₦0 |
| Logins | Phone + password, no SMS | ₦0 (add SMS one-time codes before public launch) |
| Payments | Cash/transfer to operator; manual wallet top-up approval | ₦0 gateway fees |

There is no server to rent: every rule (bidding, start codes, commission, refunds) runs inside the database.

---

## Setup (about 45 minutes, no coding)

### 1. Create the Supabase project
1. Sign up at **supabase.com** → **New project**. Name it `townaija`, set a strong database password, pick the region closest to Nigeria (e.g. *West EU (London)*).
2. When it's ready, open **SQL Editor → New query**. Paste the whole of `supabase/01_schema.sql` and press **Run**. Then do the same with `supabase/02_storage.sql`.
3. Go to **Authentication → Sign In / Providers → Email** and turn **off** "Confirm email". (Townaija logs people in with phone + password, so there is no email to confirm.)
4. Go to **Database → Extensions** and check that **pg_cron** and **pg_net** are enabled. If you had to enable pg_cron here, run `01_schema.sql` once more — it's safe to re-run. pg_cron expires stale requests and auto-confirms deliveries every minute.
5. Go to **Project Settings → API**. Keep this tab open: you need the **Project URL** and the **anon public** key.

### 2. Put the code on GitHub
1. Create a free account at **github.com** and a new **private** repository called `townaija`.
2. Upload this whole folder (including the hidden `.github` folder). The easiest way is **GitHub Desktop** → *Add existing repository* → *Publish*. Or ask Claude to push it for you once the repo exists.
3. In the repo: **Settings → Secrets and variables → Actions → New repository secret**. Add two secrets:
   - `SUPABASE_URL` → the Project URL
   - `SUPABASE_ANON_KEY` → the anon public key

### 3. Build the APK
1. Open the **Actions** tab → **Build Android APK** → **Run workflow**. It takes about 20 minutes.
2. When it's green, open **Releases** (right side of the repo's main page). The newest release has `Townaija-N.apk`.
3. On your Android phone, open that page (logged into GitHub), tap the APK, and allow *Install unknown apps* when asked.

Every time the app code changes, a new APK is built automatically.

### 4. Make yourself admin
1. Open the app and **create an account** with your phone number.
2. In Supabase **SQL Editor**, run (with your number):
   ```sql
   update public.profiles set is_admin = true, admin_role = 'super' where phone = '08031234567';
   ```

### 5. Put the website online (landing page + admin dashboard)
One deploy hosts both: the landing page at `/` and the admin dashboard at `/admin/`.
Optional settings for the landing page: `APK_URL` (the Download for Android link — your repo's Releases page), `COMMISSION`, `SUPPORT_PHONE`, `SUPPORT_EMAIL`. On GitHub Pages the APK link is filled in automatically; add the others under *Settings → Secrets and variables → Actions → Variables*.

Pick one:
- **Netlify (works with private repos):** netlify.com → *Add new site → Import from GitHub* → choose the repo. `netlify.toml` already sets the build. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` under *Site configuration → Environment variables*, then redeploy.
- **GitHub Pages (public repos only on the free plan):** *Settings → Pages → Source: GitHub Actions*. The **Deploy website** workflow publishes it.
- **Quick local test:** open `admin/index.html` in Chrome, click *Connect Supabase*, paste the URL and key.

Log in to `/admin/` with the same phone and password as the app.

### 6. First things to set in the admin (Settings page)
- **Bank details** operators pay top-ups into, and your **support phone**.
- **Fare guide** — the Naira rates are placeholders. Call 5–10 Abuja operators and set them to real market prices.
- **Commission** (default 10%) and **minimum wallet balance** (default ₦1,000).
- **Cities** — Abuja is live. To test from outside Nigeria, add a test city with your own coordinates and tick *Live*.

---

## How it works

**Customer:** open app → pickup (GPS) and drop-off → vehicle type, problem, wheels/keys, photos → see the recommended price and make an offer → nearby operators accept or counter → pick one → watch the truck arrive → share the 4-digit start code → track the tow → pay operator → confirm → rate.

**Operator:** switch to operator mode → submit truck details and documents → admin approves → top up wallet by bank transfer (admin approves) → go online → feed shows compatible jobs within 15 km (widens to 35 km after 3 min) → accept or counter → navigate (opens Google Maps) → arrive → photograph the vehicle → enter the customer's start code → tow → photograph at drop-off → mark delivered → commission is deducted when the customer confirms (or automatically after 3 hours).

**Safety and trust rules built in:**
- Only trucks that can safely move the vehicle see the job. Locked wheels or an SUV means flatbed or heavy-duty only.
- The tow cannot start without the customer's start code, and condition photos are mandatory before loading and at drop-off.
- Phone numbers are only revealed after a match. Losing bidders never see them.
- If an operator cancels, the request automatically reopens to other operators instead of leaving the customer stranded.
- Operators with a wallet below the minimum can't bid.
- Disputes show both photo sets and the full timeline. Admins can refund commission.

## Known limits of this first version
- **Alerts arrive while the app is open** (in-app banner and vibration). Alerts when the phone is locked need a free Firebase project. The database already sends them once phones register a push token; that's the next step.
- **Operator location** updates while the app is open on screen. Background tracking is a later addition.
- **Logins don't verify the phone number.** Add SMS one-time codes (Termii or Twilio) before public launch.
- The APK is signed with a development key, which is fine for testing. Create a proper signing key before publishing to Google Play.

## Running the backend tests (for a developer)
```bash
cd supabase && PGHOST=... PGUSER=postgres ./tests/run_tests.sh   # needs a local PostgreSQL 15+
```
