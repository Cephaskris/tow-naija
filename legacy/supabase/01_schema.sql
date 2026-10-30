-- =====================================================================
-- TOWNAIJA — database schema, security rules and business logic
-- Run this whole file once in Supabase: Dashboard → SQL Editor → New query
-- → paste → Run. Then run 02_storage.sql.
-- All business rules live here (no separate server to pay for).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
do $$ begin
  create type public.vehicle_type   as enum ('car','suv','van_bus','truck');
  create type public.truck_type     as enum ('wheel_lift','flatbed','heavy_duty');
  create type public.problem_type   as enum ('breakdown','accident','wont_start','flat_tyre','stuck','other');
  create type public.request_status as enum ('open','matched','arrived','in_progress','delivered','completed','cancelled','expired');
  create type public.operator_status as enum ('pending','approved','rejected','suspended');
  create type public.bid_status     as enum ('pending','accepted','rejected','withdrawn','expired');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Configuration (editable from the admin dashboard)
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  id                      boolean primary key default true check (id),
  commission_pct          numeric(5,2) not null default 10,
  min_wallet_balance      numeric(12,2) not null default 1000,  -- operators below this cannot bid
  search_radius_km        numeric(6,1) not null default 15,
  max_search_radius_km    numeric(6,1) not null default 35,
  radius_expand_after_min int not null default 3,                -- widen search after N minutes
  request_expiry_min      int not null default 30,               -- open request with no pick expires
  bid_expiry_min          int not null default 10,
  auto_confirm_hours      numeric(5,1) not null default 3,       -- delivered jobs auto-complete
  road_factor             numeric(4,2) not null default 1.30,    -- straight line → road distance
  offer_floor_pct         numeric(5,2) not null default 60,      -- lowest offer allowed, % of recommended
  support_phone           text default '',
  bank_name               text default '',
  bank_account_name       text default '',
  bank_account_number     text default '',
  updated_at              timestamptz not null default now()
);
insert into public.app_settings (id) values (true) on conflict do nothing;

create table if not exists public.cities (
  id                serial primary key,
  name              text not null unique,
  state             text not null default '',
  center_lat        double precision not null,
  center_lng        double precision not null,
  service_radius_km numeric(6,1) not null default 60,
  is_active         boolean not null default false
);
insert into public.cities (name, state, center_lat, center_lng, service_radius_km, is_active) values
  ('Abuja', 'FCT',   9.0579, 7.4951, 60, true),
  ('Lagos', 'Lagos', 6.5244, 3.3792, 60, false)
on conflict (name) do nothing;

-- Placeholder Naira rates — adjust in the admin dashboard after talking to operators.
create table if not exists public.pricing_rates (
  truck_type public.truck_type primary key,
  label      text not null,
  base_fare  numeric(12,2) not null,
  per_km     numeric(12,2) not null,
  min_fare   numeric(12,2) not null
);
insert into public.pricing_rates values
  ('wheel_lift', 'Wheel-lift (hook)', 15000, 800,  20000),
  ('flatbed',    'Flatbed',           20000, 1000, 25000),
  ('heavy_duty', 'Heavy-duty',        60000, 2500, 80000)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default '',
  phone        text unique,
  is_operator  boolean not null default false,
  is_admin     boolean not null default false,
  admin_role   text check (admin_role in ('super','support')),
  status       text not null default 'active' check (status in ('active','blocked')),
  rating_avg   numeric(3,2) not null default 0,
  rating_count int not null default 0,
  push_token   text,
  created_at   timestamptz not null default now()
);

create table if not exists public.operators (
  id               uuid primary key references public.profiles(id) on delete cascade,
  status           public.operator_status not null default 'pending',
  truck_type       public.truck_type not null,
  truck_plate      text not null,
  truck_make_model text not null default '',
  base_area        text not null default '',
  city_id          int references public.cities(id),
  license_doc_path text,
  id_doc_path      text,
  truck_photo_path text,
  selfie_path      text,
  review_note      text,
  reviewed_by      uuid references public.profiles(id),
  reviewed_at      timestamptz,
  is_online        boolean not null default false,
  last_lat         double precision,
  last_lng         double precision,
  last_seen_at     timestamptz,
  wallet_balance   numeric(12,2) not null default 0,
  jobs_completed   int not null default 0,
  cancellations    int not null default 0,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------
create sequence if not exists public.tow_ref_seq start 1001;

create table if not exists public.tow_requests (
  id                   uuid primary key default gen_random_uuid(),
  ref                  text not null unique default ('TN-' || nextval('public.tow_ref_seq')::text),
  customer_id          uuid not null references public.profiles(id),
  city_id              int references public.cities(id),
  status               public.request_status not null default 'open',
  pickup_lat           double precision not null,
  pickup_lng           double precision not null,
  pickup_address       text not null default '',
  dropoff_lat          double precision not null,
  dropoff_lng          double precision not null,
  dropoff_address      text not null default '',
  vehicle_type         public.vehicle_type not null,
  vehicle_desc         text not null default '',
  problem_type         public.problem_type not null,
  wheels_roll          boolean not null default true,
  keys_available       boolean not null default true,
  notes                text not null default '',
  photo_paths          text[] not null default '{}',
  distance_km          numeric(7,2) not null,
  required_truck_types public.truck_type[] not null,
  recommended_fare     numeric(12,2) not null,
  fare_floor           numeric(12,2) not null,
  offer_amount         numeric(12,2) not null,
  payment_method       text not null default 'cash' check (payment_method in ('cash','transfer')),
  operator_id          uuid references public.operators(id),
  accepted_bid_id      uuid,
  final_price          numeric(12,2),
  commission_amount    numeric(12,2),
  pickup_photo_paths   text[] not null default '{}',
  delivery_photo_paths text[] not null default '{}',
  cancel_reason        text,
  cancelled_by         text check (cancelled_by in ('customer','operator','admin','system')),
  created_at           timestamptz not null default now(),
  offer_updated_at     timestamptz not null default now(),
  matched_at           timestamptz,
  arrived_at           timestamptz,
  started_at           timestamptz,
  delivered_at         timestamptz,
  completed_at         timestamptz,
  cancelled_at         timestamptz,
  updated_at           timestamptz not null default now()
);
create index if not exists tow_requests_status_idx   on public.tow_requests(status);
create index if not exists tow_requests_customer_idx on public.tow_requests(customer_id);
create index if not exists tow_requests_operator_idx on public.tow_requests(operator_id);

-- Start code lives apart so only the customer (and admins) can read it.
create table if not exists public.request_codes (
  request_id uuid primary key references public.tow_requests(id) on delete cascade,
  start_code text not null
);

create table if not exists public.bids (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.tow_requests(id) on delete cascade,
  operator_id uuid not null references public.operators(id),
  amount      numeric(12,2) not null check (amount > 0),
  eta_minutes int not null default 20,
  status      public.bid_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  unique (request_id, operator_id)
);
create index if not exists bids_request_idx on public.bids(request_id);

create table if not exists public.job_tracking (
  request_id  uuid primary key references public.tow_requests(id) on delete cascade,
  operator_id uuid not null references public.operators(id),
  lat         double precision not null,
  lng         double precision not null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.ratings (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.tow_requests(id) on delete cascade,
  rater_id   uuid not null references public.profiles(id),
  ratee_id   uuid not null references public.profiles(id),
  stars      int not null check (stars between 1 and 5),
  comment    text not null default '',
  created_at timestamptz not null default now(),
  unique (request_id, rater_id)
);

create table if not exists public.request_events (
  id         bigserial primary key,
  request_id uuid not null references public.tow_requests(id) on delete cascade,
  actor_id   uuid,
  event      text not null,
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists request_events_req_idx on public.request_events(request_id);

-- ---------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------
create table if not exists public.topup_requests (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id),
  amount      numeric(12,2) not null check (amount > 0),
  reference   text not null default '',
  proof_path  text,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references public.operators(id),
  kind          text not null check (kind in ('topup','commission','adjustment','refund')),
  amount        numeric(12,2) not null,
  balance_after numeric(12,2) not null,
  request_id    uuid references public.tow_requests(id),
  topup_id      uuid references public.topup_requests(id),
  note          text not null default '',
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists wallet_tx_operator_idx on public.wallet_transactions(operator_id);

-- ---------------------------------------------------------------------
-- Support
-- ---------------------------------------------------------------------
create table if not exists public.disputes (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.tow_requests(id) on delete cascade,
  raised_by      uuid not null references public.profiles(id),
  raised_by_role text not null check (raised_by_role in ('customer','operator')),
  reason         text not null,
  details        text not null default '',
  status         text not null default 'open' check (status in ('open','resolved')),
  resolution     text,
  resolved_by    uuid references public.profiles(id),
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists public.notifications (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null default '',
  data       jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, id desc);

-- =====================================================================
-- Helper functions
-- =====================================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid() and status = 'active'), false);
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin and admin_role = 'super' from profiles where id = auth.uid() and status = 'active'), false);
$$;

create or replace function public.haversine_km(lat1 double precision, lng1 double precision,
                                               lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

-- Which tow trucks can safely move this vehicle.
create or replace function public.compatible_truck_types(p_vehicle public.vehicle_type, p_wheels_roll boolean)
returns public.truck_type[] language sql immutable as $$
  select case
    when p_vehicle = 'car' and p_wheels_roll then array['wheel_lift','flatbed','heavy_duty']::public.truck_type[]
    when p_vehicle in ('car','suv','van_bus')  then array['flatbed','heavy_duty']::public.truck_type[]
    else array['heavy_duty']::public.truck_type[]
  end;
$$;

create or replace function public.round_naira(p numeric) returns numeric
language sql immutable as $$ select round(p / 500.0) * 500 $$;

create or replace function public.nearest_city(p_lat double precision, p_lng double precision)
returns int language sql stable as $$
  select id from public.cities
  where is_active and public.haversine_km(center_lat, center_lng, p_lat, p_lng) <= service_radius_km
  order by public.haversine_km(center_lat, center_lng, p_lat, p_lng)
  limit 1;
$$;

-- Fare guide. Uses the cheapest compatible truck type.
create or replace function public.estimate_fare(
  p_pickup_lat double precision, p_pickup_lng double precision,
  p_dropoff_lat double precision, p_dropoff_lng double precision,
  p_vehicle_type public.vehicle_type, p_wheels_roll boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s app_settings; v_km numeric; v_types truck_type[]; v_rec numeric; v_city int; v_city_name text;
begin
  select * into s from app_settings where id;
  v_km := round((haversine_km(p_pickup_lat, p_pickup_lng, p_dropoff_lat, p_dropoff_lng) * s.road_factor)::numeric, 1);
  v_types := compatible_truck_types(p_vehicle_type, p_wheels_roll);
  select min(greatest(min_fare, base_fare + per_km * v_km)) into v_rec
    from pricing_rates where truck_type = any(v_types);
  v_rec := round_naira(v_rec);
  v_city := nearest_city(p_pickup_lat, p_pickup_lng);
  select name into v_city_name from cities where id = v_city;
  return jsonb_build_object(
    'distance_km', v_km,
    'truck_types', to_jsonb(v_types),
    'recommended_fare', v_rec,
    'range_low',  round_naira(v_rec * 0.9),
    'range_high', round_naira(v_rec * 1.15),
    'fare_floor', round_naira(v_rec * s.offer_floor_pct / 100),
    'city_id', v_city,
    'city_name', v_city_name,
    'in_service', v_city is not null);
end $$;

create or replace function public.log_event(p_request uuid, p_event text, p_detail jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into request_events (request_id, actor_id, event, detail) values (p_request, auth.uid(), p_event, coalesce(p_detail, '{}'));
$$;

-- In-app notification (+ phone push if pg_net and a push token exist).
create or replace function public.notify(p_user uuid, p_title text, p_body text, p_data jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if p_user is null then return; end if;
  insert into notifications (user_id, title, body, data) values (p_user, p_title, coalesce(p_body,''), coalesce(p_data,'{}'));
  select push_token into v_token from profiles where id = p_user;
  if v_token is not null and v_token <> '' and exists (select 1 from pg_extension where extname = 'pg_net') then
    begin
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := jsonb_build_object('to', v_token, 'title', p_title, 'body', p_body, 'data', p_data,
                                   'sound', 'default', 'priority', 'high'),
        headers := '{"Content-Type":"application/json"}'::jsonb);
    exception when others then null;
    end;
  end if;
end $$;

create or replace function public.request_radius(r public.tow_requests)
returns numeric language sql stable as $$
  select case when now() - r.created_at > make_interval(mins => s.radius_expand_after_min)
              then s.max_search_radius_km else s.search_radius_km end
  from public.app_settings s where s.id;
$$;

create or replace function public.request_expired(r public.tow_requests)
returns boolean language sql stable as $$
  select r.status = 'open' and greatest(r.created_at, r.offer_updated_at)
         + make_interval(mins => s.request_expiry_min) < now()
  from public.app_settings s where s.id;
$$;

create or replace function public.operator_has_active_job(p_operator uuid)
returns boolean language sql stable as $$
  select exists (select 1 from public.tow_requests
                 where operator_id = p_operator and status in ('matched','arrived','in_progress'));
$$;

-- Can this operator take work right now? Returns null if yes, else a reason.
create or replace function public.operator_block_reason(p_operator uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare o operators; p profiles; s app_settings;
begin
  select * into o from operators where id = p_operator;
  if not found then return 'You are not registered as a tow operator.'; end if;
  select * into p from profiles where id = p_operator;
  select * into s from app_settings where id;
  if p.status <> 'active' then return 'Your account is blocked. Contact support.'; end if;
  if o.status <> 'approved' then return 'Your operator account is not approved yet.'; end if;
  if o.wallet_balance < s.min_wallet_balance then
    return format('Top up your wallet. Minimum balance to receive jobs is ₦%s.', to_char(s.min_wallet_balance, 'FM999,999,990'));
  end if;
  return null;
end $$;

-- Online operators who could serve a request.
create or replace function public.eligible_operators(p_request uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select o.id
  from tow_requests r
  join operators o on o.truck_type = any(r.required_truck_types)
  join profiles p on p.id = o.id
  cross join app_settings s
  where r.id = p_request and s.id
    and o.status = 'approved' and o.is_online and p.status = 'active'
    and o.last_seen_at > now() - interval '15 minutes'
    and o.wallet_balance >= s.min_wallet_balance
    and o.id <> r.customer_id
    and o.last_lat is not null
    and haversine_km(o.last_lat, o.last_lng, r.pickup_lat, r.pickup_lng) <= request_radius(r)
    and not operator_has_active_job(o.id);
$$;

create or replace function public.vehicle_label(v public.vehicle_type) returns text
language sql immutable as $$
  select case v when 'car' then 'Car' when 'suv' then 'SUV' when 'van_bus' then 'Bus/Van' else 'Truck' end;
$$;

create or replace function public.naira(p numeric) returns text
language sql immutable as $$ select '₦' || to_char(coalesce(p,0), 'FM999,999,999,990') $$;

-- =====================================================================
-- Sign-up: create a profile for every new auth user
-- =====================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          nullif(new.raw_user_meta_data->>'phone', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists tow_requests_touch on public.tow_requests;
create trigger tow_requests_touch before update on public.tow_requests
  for each row execute function public.touch_updated_at();
drop trigger if exists bids_touch on public.bids;
create trigger bids_touch before update on public.bids
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- CUSTOMER ACTIONS
-- =====================================================================
create or replace function public.create_tow_request(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_est jsonb; v_id uuid; v_offer numeric; v_photos text[]; v_op uuid;
  v_vehicle vehicle_type; v_wheels boolean;
begin
  if v_uid is null then raise exception 'Please log in.'; end if;
  if exists (select 1 from profiles where id = v_uid and status <> 'active') then
    raise exception 'Your account is blocked. Contact support.'; end if;
  if exists (select 1 from tow_requests where customer_id = v_uid
             and status in ('open','matched','arrived','in_progress','delivered')) then
    raise exception 'You already have an active tow request.'; end if;

  v_vehicle := (p->>'vehicle_type')::vehicle_type;
  v_wheels  := coalesce((p->>'wheels_roll')::boolean, true);
  v_est := estimate_fare((p->>'pickup_lat')::float8, (p->>'pickup_lng')::float8,
                         (p->>'dropoff_lat')::float8, (p->>'dropoff_lng')::float8, v_vehicle, v_wheels);
  if not (v_est->>'in_service')::boolean then
    raise exception 'Townaija is not available in this area yet.'; end if;

  v_offer := (p->>'offer_amount')::numeric;
  if v_offer is null or v_offer < (v_est->>'fare_floor')::numeric then
    raise exception 'Your offer is too low. Minimum for this trip is %.', naira((v_est->>'fare_floor')::numeric); end if;

  v_photos := coalesce(array(select jsonb_array_elements_text(coalesce(p->'photo_paths','[]'::jsonb))), '{}');
  if array_length(v_photos, 1) > 3 then raise exception 'Maximum 3 photos.'; end if;

  insert into tow_requests (customer_id, city_id, pickup_lat, pickup_lng, pickup_address,
    dropoff_lat, dropoff_lng, dropoff_address, vehicle_type, vehicle_desc, problem_type,
    wheels_roll, keys_available, notes, photo_paths, distance_km, required_truck_types,
    recommended_fare, fare_floor, offer_amount, payment_method)
  values (v_uid, (v_est->>'city_id')::int,
    (p->>'pickup_lat')::float8, (p->>'pickup_lng')::float8, coalesce(p->>'pickup_address',''),
    (p->>'dropoff_lat')::float8, (p->>'dropoff_lng')::float8, coalesce(p->>'dropoff_address',''),
    v_vehicle, left(coalesce(p->>'vehicle_desc',''), 120), (p->>'problem_type')::problem_type,
    v_wheels, coalesce((p->>'keys_available')::boolean, true), left(coalesce(p->>'notes',''), 500),
    v_photos, (v_est->>'distance_km')::numeric,
    array(select jsonb_array_elements_text(v_est->'truck_types'))::truck_type[],
    (v_est->>'recommended_fare')::numeric, (v_est->>'fare_floor')::numeric, v_offer,
    coalesce(nullif(p->>'payment_method',''), 'cash'))
  returning id into v_id;

  insert into request_codes (request_id, start_code)
    values (v_id, lpad((floor(random() * 10000))::int::text, 4, '0'));
  perform log_event(v_id, 'created', jsonb_build_object('offer', v_offer));

  for v_op in select eligible_operators(v_id) loop
    perform notify(v_op, 'New tow request nearby',
      format('%s · %s offered', vehicle_label(v_vehicle), naira(v_offer)), jsonb_build_object('request_id', v_id, 'type', 'new_request'));
  end loop;
  return v_id;
end $$;

create or replace function public.raise_offer(p_request uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
declare r tow_requests; v_op uuid;
begin
  select * into r from tow_requests where id = p_request for update;
  if not found or r.customer_id <> auth.uid() then raise exception 'Request not found.'; end if;
  if r.status <> 'open' then raise exception 'This request is no longer open.'; end if;
  if request_expired(r) then
    update tow_requests set status = 'expired' where id = r.id;
    raise exception 'This request has expired. Please create a new one.'; end if;
  if p_amount <= r.offer_amount then raise exception 'New offer must be higher than %.', naira(r.offer_amount); end if;
  update tow_requests set offer_amount = p_amount, offer_updated_at = now() where id = r.id;
  perform log_event(r.id, 'offer_raised', jsonb_build_object('from', r.offer_amount, 'to', p_amount));
  for v_op in select e from eligible_operators(r.id) e
              where not exists (select 1 from bids b where b.request_id = r.id and b.operator_id = e and b.status = 'pending') loop
    perform notify(v_op, 'Offer increased', format('%s · now %s', vehicle_label(r.vehicle_type), naira(p_amount)),
                   jsonb_build_object('request_id', r.id, 'type', 'offer_raised'));
  end loop;
end $$;

-- Bids for a customer's own open request, with operator details.
create or replace function public.get_request_bids(p_request uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r tow_requests;
begin
  select * into r from tow_requests where id = p_request;
  if not found or (r.customer_id <> auth.uid() and not is_admin()) then raise exception 'Request not found.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', b.id, 'amount', b.amount, 'eta_minutes', b.eta_minutes, 'status', b.status,
      'created_at', b.created_at, 'expires_at', b.expires_at,
      'is_counter', b.amount > r.offer_amount,
      'operator_id', o.id, 'operator_name', p.full_name,
      'rating_avg', p.rating_avg, 'rating_count', p.rating_count,
      'jobs_completed', o.jobs_completed, 'truck_type', o.truck_type,
      'truck_make_model', o.truck_make_model,
      'pickup_distance_km', case when o.last_lat is null then null else
         round(haversine_km(o.last_lat, o.last_lng, r.pickup_lat, r.pickup_lng)::numeric, 1) end
    ) order by b.amount, b.created_at)
    from bids b join operators o on o.id = b.operator_id join profiles p on p.id = o.id
    where b.request_id = r.id and b.status = 'pending' and b.expires_at > now()), '[]'::jsonb);
end $$;

create or replace function public.accept_bid(p_bid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b bids; r tow_requests; v_reason text; o operators; v_other uuid;
begin
  select * into b from bids where id = p_bid for update;
  if not found then raise exception 'Offer not found.'; end if;
  select * into r from tow_requests where id = b.request_id for update;
  if r.customer_id <> auth.uid() then raise exception 'Offer not found.'; end if;
  if r.status <> 'open' then raise exception 'This request is no longer open.'; end if;
  if request_expired(r) then
    update tow_requests set status = 'expired' where id = r.id;
    raise exception 'This request has expired. Please create a new one.'; end if;
  if b.status <> 'pending' or b.expires_at < now() then raise exception 'This offer has expired.'; end if;
  v_reason := operator_block_reason(b.operator_id);
  if v_reason is not null or operator_has_active_job(b.operator_id) then
    update bids set status = 'expired' where id = b.id;
    raise exception 'This operator is no longer available. Please choose another offer.'; end if;

  update tow_requests set status = 'matched', operator_id = b.operator_id, accepted_bid_id = b.id,
         final_price = b.amount, matched_at = now() where id = r.id;
  update bids set status = 'accepted' where id = b.id;
  for v_other in update bids set status = 'rejected'
                 where request_id = r.id and id <> b.id and status = 'pending' returning operator_id loop
    perform notify(v_other, 'Customer chose another operator', r.ref, jsonb_build_object('request_id', r.id, 'type', 'bid_rejected'));
  end loop;
  -- Free up this operator's other pending bids
  update bids set status = 'withdrawn' where operator_id = b.operator_id and status = 'pending' and request_id <> r.id;

  select * into o from operators where id = b.operator_id;
  if o.last_lat is not null then
    insert into job_tracking (request_id, operator_id, lat, lng) values (r.id, o.id, o.last_lat, o.last_lng)
    on conflict (request_id) do update set operator_id = excluded.operator_id, lat = excluded.lat, lng = excluded.lng, updated_at = now();
  end if;
  perform log_event(r.id, 'matched', jsonb_build_object('operator_id', b.operator_id, 'price', b.amount));
  perform notify(b.operator_id, 'You got the job! 🚛', format('%s · %s. Head to pickup.', r.ref, naira(b.amount)),
                 jsonb_build_object('request_id', r.id, 'type', 'matched'));
end $$;

create or replace function public.cancel_request(p_request uuid, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare r tow_requests; v_uid uuid := auth.uid(); v_op uuid;
begin
  select * into r from tow_requests where id = p_request for update;
  if not found then raise exception 'Request not found.'; end if;

  if r.customer_id = v_uid then
    if r.status not in ('open','matched','arrived') then
      raise exception 'The tow has started — use "Report a problem" instead.'; end if;
    update tow_requests set status = 'cancelled', cancelled_by = 'customer', cancel_reason = p_reason,
           cancelled_at = now() where id = r.id;
    update bids set status = 'expired' where request_id = r.id and status = 'pending';
    perform log_event(r.id, 'cancelled_by_customer', jsonb_build_object('reason', p_reason));
    if r.operator_id is not null then
      perform notify(r.operator_id, 'Job cancelled', format('%s was cancelled by the customer.', r.ref),
                     jsonb_build_object('request_id', r.id, 'type', 'cancelled'));
    end if;

  elsif r.operator_id = v_uid then
    if r.status not in ('matched','arrived') then
      raise exception 'You can only cancel before the tow starts. Use "Report a problem".'; end if;
    -- Keep the customer's request alive: reopen it for new offers.
    update tow_requests set status = 'open', operator_id = null, accepted_bid_id = null, final_price = null,
           matched_at = null, arrived_at = null, offer_updated_at = now() where id = r.id;
    update bids set status = 'withdrawn' where id = r.accepted_bid_id;
    update bids set status = 'expired' where request_id = r.id and status = 'rejected';
    delete from job_tracking where request_id = r.id;
    update operators set cancellations = cancellations + 1 where id = v_uid;
    perform log_event(r.id, 'cancelled_by_operator', jsonb_build_object('reason', p_reason, 'operator_id', v_uid));
    perform notify(r.customer_id, 'Operator cancelled',
                   'Sorry — your operator cancelled. We''ve reopened your request to other operators.',
                   jsonb_build_object('request_id', r.id, 'type', 'reopened'));
    for v_op in select eligible_operators(r.id) loop
      if v_op <> v_uid then
        perform notify(v_op, 'New tow request nearby', format('%s · %s offered', vehicle_label(r.vehicle_type), naira(r.offer_amount)),
                       jsonb_build_object('request_id', r.id, 'type', 'new_request'));
      end if;
    end loop;
  else
    raise exception 'Request not found.';
  end if;
end $$;

-- Internal: finish a job and charge commission.
create or replace function public.complete_job(p_request uuid, p_by text)
returns void language plpgsql security definer set search_path = public as $$
declare r tow_requests; s app_settings; v_comm numeric; v_bal numeric;
begin
  select * into r from tow_requests where id = p_request for update;
  if r.status <> 'delivered' then return; end if;
  select * into s from app_settings where id;
  v_comm := round(r.final_price * s.commission_pct / 100, 0);
  update tow_requests set status = 'completed', completed_at = now(), commission_amount = v_comm where id = r.id;
  update operators set wallet_balance = wallet_balance - v_comm, jobs_completed = jobs_completed + 1
    where id = r.operator_id returning wallet_balance into v_bal;
  insert into wallet_transactions (operator_id, kind, amount, balance_after, request_id, note, created_by)
    values (r.operator_id, 'commission', -v_comm, v_bal, r.id, 'Commission for ' || r.ref, auth.uid());
  delete from job_tracking where request_id = r.id;
  perform log_event(r.id, 'completed', jsonb_build_object('by', p_by, 'commission', v_comm));
  perform notify(r.operator_id, 'Job completed ✅', format('%s · commission %s deducted.', r.ref, naira(v_comm)),
                 jsonb_build_object('request_id', r.id, 'type', 'completed'));
  if p_by <> 'customer' then
    perform notify(r.customer_id, 'Tow completed', format('%s is complete. Please rate your operator.', r.ref),
                   jsonb_build_object('request_id', r.id, 'type', 'completed'));
  end if;
end $$;

create or replace function public.confirm_delivery(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r tow_requests;
begin
  select * into r from tow_requests where id = p_request;
  if not found or r.customer_id <> auth.uid() then raise exception 'Request not found.'; end if;
  if r.status <> 'delivered' then raise exception 'The operator has not marked this tow as delivered yet.'; end if;
  perform complete_job(r.id, 'customer');
end $$;

create or replace function public.rate_job(p_request uuid, p_stars int, p_comment text default '')
returns void language plpgsql security definer set search_path = public as $$
declare r tow_requests; v_uid uuid := auth.uid(); v_ratee uuid;
begin
  select * into r from tow_requests where id = p_request;
  if not found then raise exception 'Request not found.'; end if;
  if r.status <> 'completed' then raise exception 'You can rate after the job is completed.'; end if;
  if v_uid = r.customer_id then v_ratee := r.operator_id;
  elsif v_uid = r.operator_id then v_ratee := r.customer_id;
  else raise exception 'Request not found.'; end if;
  if p_stars not between 1 and 5 then raise exception 'Rating must be 1 to 5 stars.'; end if;
  insert into ratings (request_id, rater_id, ratee_id, stars, comment)
    values (r.id, v_uid, v_ratee, p_stars, left(coalesce(p_comment,''), 500))
    on conflict (request_id, rater_id) do update set stars = excluded.stars, comment = excluded.comment;
  update profiles p set rating_avg = x.avg, rating_count = x.cnt
    from (select round(avg(stars)::numeric, 2) avg, count(*) cnt from ratings where ratee_id = v_ratee) x
    where p.id = v_ratee;
end $$;

create or replace function public.raise_dispute(p_request uuid, p_reason text, p_details text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare r tow_requests; v_uid uuid := auth.uid(); v_role text; v_id uuid;
begin
  select * into r from tow_requests where id = p_request;
  if not found then raise exception 'Request not found.'; end if;
  if v_uid = r.customer_id then v_role := 'customer';
  elsif v_uid = r.operator_id then v_role := 'operator';
  else raise exception 'Request not found.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Please choose a reason.'; end if;
  insert into disputes (request_id, raised_by, raised_by_role, reason, details)
    values (r.id, v_uid, v_role, left(p_reason, 120), left(coalesce(p_details,''), 2000)) returning id into v_id;
  perform log_event(r.id, 'dispute_raised', jsonb_build_object('reason', p_reason, 'by', v_role));
  return v_id;
end $$;

-- Everything a party needs to show one job screen.
create or replace function public.get_request_detail(p_request uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r tow_requests; v_uid uuid := auth.uid(); v_role text; v_res jsonb; o operators; op profiles; cu profiles;
        v_show_contact boolean;
begin
  select * into r from tow_requests where id = p_request;
  if not found then raise exception 'Request not found.'; end if;
  if v_uid = r.customer_id then v_role := 'customer';
  elsif v_uid = r.operator_id then v_role := 'operator';
  elsif is_admin() then v_role := 'admin';
  elsif exists (select 1 from bids where request_id = r.id and operator_id = v_uid) then v_role := 'bidder';
  else raise exception 'Request not found.'; end if;

  v_res := to_jsonb(r) || jsonb_build_object('my_role', v_role, 'expired', request_expired(r),
    'expires_at', greatest(r.created_at, r.offer_updated_at) + make_interval(mins => (select request_expiry_min from app_settings where id)));
  v_show_contact := r.status in ('matched','arrived','in_progress','delivered');

  if r.operator_id is not null then
    select * into o from operators where id = r.operator_id;
    select * into op from profiles where id = r.operator_id;
    v_res := v_res || jsonb_build_object('operator', jsonb_build_object(
      'id', o.id, 'name', op.full_name,
      'phone', case when v_show_contact or v_role = 'admin' then op.phone end,
      'rating_avg', op.rating_avg, 'rating_count', op.rating_count, 'jobs_completed', o.jobs_completed,
      'truck_type', o.truck_type, 'truck_plate', o.truck_plate, 'truck_make_model', o.truck_make_model));
  end if;
  select * into cu from profiles where id = r.customer_id;
  v_res := v_res || jsonb_build_object('customer', jsonb_build_object(
    'id', cu.id, 'name', case when v_role = 'bidder' then split_part(cu.full_name, ' ', 1) else cu.full_name end,
    'phone', case when (v_role = 'operator' and v_show_contact) or v_role in ('admin','customer') then cu.phone end,
    'rating_avg', cu.rating_avg, 'rating_count', cu.rating_count));

  if v_role in ('customer','admin') then
    v_res := v_res || jsonb_build_object('start_code', (select start_code from request_codes where request_id = r.id));
  end if;
  v_res := v_res || jsonb_build_object(
    'tracking', (select to_jsonb(t) from job_tracking t where t.request_id = r.id),
    'my_rating', (select stars from ratings where request_id = r.id and rater_id = v_uid),
    'my_bid', (select to_jsonb(b) from bids b where b.request_id = r.id and b.operator_id = v_uid),
    'open_dispute', exists (select 1 from disputes where request_id = r.id and status = 'open'));
  if v_role = 'admin' then
    v_res := v_res || jsonb_build_object(
      'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from request_events e where e.request_id = r.id), '[]'),
      'bids', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'amount', b.amount, 'status', b.status,
                 'operator_name', p.full_name, 'created_at', b.created_at) order by b.created_at)
               from bids b join profiles p on p.id = b.operator_id where b.request_id = r.id), '[]'),
      'disputes', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at) from disputes d where d.request_id = r.id), '[]'));
  end if;
  return v_res;
end $$;

create or replace function public.my_active_request()
returns uuid language sql stable security definer set search_path = public as $$
  select id from tow_requests
  where (customer_id = auth.uid() and status in ('open','matched','arrived','in_progress','delivered'))
     or (operator_id = auth.uid() and status in ('matched','arrived','in_progress'))
  order by created_at desc limit 1;
$$;

-- =====================================================================
-- OPERATOR ACTIONS
-- =====================================================================
create or replace function public.register_operator(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); o operators;
begin
  if v_uid is null then raise exception 'Please log in.'; end if;
  if coalesce(trim(p->>'truck_plate'),'') = '' then raise exception 'Truck plate number is required.'; end if;
  if coalesce(p->>'license_doc_path','') = '' or coalesce(p->>'truck_photo_path','') = '' then
    raise exception 'Driver''s licence and truck photo are required.'; end if;
  select * into o from operators where id = v_uid;
  if found and o.status in ('approved','suspended') then
    raise exception 'Your operator account already exists. Contact support to change details.'; end if;

  insert into operators (id, status, truck_type, truck_plate, truck_make_model, base_area, city_id,
                         license_doc_path, id_doc_path, truck_photo_path, selfie_path)
  values (v_uid, 'pending', (p->>'truck_type')::truck_type, upper(trim(p->>'truck_plate')),
          coalesce(p->>'truck_make_model',''), coalesce(p->>'base_area',''),
          coalesce((p->>'city_id')::int, (select id from cities where is_active order by id limit 1)),
          p->>'license_doc_path', p->>'id_doc_path', p->>'truck_photo_path', p->>'selfie_path')
  on conflict (id) do update set status = 'pending', truck_type = excluded.truck_type,
     truck_plate = excluded.truck_plate, truck_make_model = excluded.truck_make_model,
     base_area = excluded.base_area, city_id = excluded.city_id,
     license_doc_path = excluded.license_doc_path, id_doc_path = excluded.id_doc_path,
     truck_photo_path = excluded.truck_photo_path, selfie_path = excluded.selfie_path, review_note = null;
  update profiles set is_operator = true where id = v_uid;
end $$;

create or replace function public.set_online(p_online boolean, p_lat double precision default null, p_lng double precision default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_reason text;
begin
  if p_online then
    v_reason := operator_block_reason(auth.uid());
    if v_reason is not null then raise exception '%', v_reason; end if;
  end if;
  update operators set is_online = p_online,
         last_lat = coalesce(p_lat, last_lat), last_lng = coalesce(p_lng, last_lng),
         last_seen_at = now() where id = auth.uid();
  if not p_online then
    update bids set status = 'withdrawn' where operator_id = auth.uid() and status = 'pending';
  end if;
end $$;

create or replace function public.update_location(p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = public as $$
declare v_req uuid;
begin
  update operators set last_lat = p_lat, last_lng = p_lng, last_seen_at = now() where id = auth.uid();
  select id into v_req from tow_requests where operator_id = auth.uid()
    and status in ('matched','arrived','in_progress') order by matched_at desc limit 1;
  if v_req is not null then
    insert into job_tracking (request_id, operator_id, lat, lng) values (v_req, auth.uid(), p_lat, p_lng)
    on conflict (request_id) do update set lat = excluded.lat, lng = excluded.lng, updated_at = now();
  end if;
end $$;

create or replace function public.operator_feed()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o operators;
begin
  select * into o from operators where id = auth.uid();
  if not found or not o.is_online or o.last_lat is null or operator_block_reason(o.id) is not null then
    return '[]'::jsonb; end if;
  if operator_has_active_job(o.id) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(x order by (x->>'pickup_distance_km')::numeric) from (
      select jsonb_build_object(
        'id', r.id, 'ref', r.ref, 'vehicle_type', r.vehicle_type, 'vehicle_desc', r.vehicle_desc,
        'problem_type', r.problem_type, 'wheels_roll', r.wheels_roll, 'keys_available', r.keys_available,
        'notes', r.notes, 'photo_paths', r.photo_paths,
        'pickup_address', r.pickup_address, 'pickup_lat', r.pickup_lat, 'pickup_lng', r.pickup_lng,
        'dropoff_address', r.dropoff_address, 'dropoff_lat', r.dropoff_lat, 'dropoff_lng', r.dropoff_lng,
        'distance_km', r.distance_km, 'offer_amount', r.offer_amount, 'payment_method', r.payment_method,
        'created_at', r.created_at,
        'pickup_distance_km', round(haversine_km(o.last_lat, o.last_lng, r.pickup_lat, r.pickup_lng)::numeric, 1),
        'customer_name', split_part(p.full_name, ' ', 1), 'customer_rating', p.rating_avg,
        'customer_rating_count', p.rating_count,
        'my_bid_amount', b.amount, 'my_bid_status', b.status) x
      from tow_requests r
      join profiles p on p.id = r.customer_id
      left join bids b on b.request_id = r.id and b.operator_id = o.id
      where r.status = 'open' and not request_expired(r)
        and o.truck_type = any(r.required_truck_types)
        and r.customer_id <> o.id
        and haversine_km(o.last_lat, o.last_lng, r.pickup_lat, r.pickup_lng) <= request_radius(r)
        and coalesce(b.status::text, 'pending') not in ('rejected','accepted')
    ) q), '[]'::jsonb);
end $$;

create or replace function public.place_bid(p_request uuid, p_amount numeric, p_eta int default 20)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r tow_requests; o operators; v_reason text; v_id uuid; s app_settings;
begin
  v_reason := operator_block_reason(v_uid);
  if v_reason is not null then raise exception '%', v_reason; end if;
  select * into o from operators where id = v_uid;
  if not o.is_online then raise exception 'Go online to send offers.'; end if;
  if operator_has_active_job(v_uid) then raise exception 'Finish your current job first.'; end if;
  select * into r from tow_requests where id = p_request;
  if not found or r.status <> 'open' or request_expired(r) then raise exception 'This request is no longer available.'; end if;
  if r.customer_id = v_uid then raise exception 'You cannot bid on your own request.'; end if;
  if not (o.truck_type = any(r.required_truck_types)) then raise exception 'Your truck type cannot tow this vehicle.'; end if;
  if o.last_lat is null or haversine_km(o.last_lat, o.last_lng, r.pickup_lat, r.pickup_lng) > request_radius(r) then
    raise exception 'You are too far from this pickup.'; end if;
  if p_amount < r.offer_amount then raise exception 'Your price cannot be lower than the customer''s offer (%).', naira(r.offer_amount); end if;
  if p_amount > r.offer_amount * 3 then raise exception 'That price is too high for this request.'; end if;
  if exists (select 1 from bids where request_id = r.id and operator_id = v_uid and status = 'rejected') then
    raise exception 'You can no longer bid on this request.'; end if;
  select * into s from app_settings where id;

  insert into bids (request_id, operator_id, amount, eta_minutes, status, expires_at)
  values (r.id, v_uid, round(p_amount), greatest(1, least(coalesce(p_eta, 20), 240)), 'pending',
          now() + make_interval(mins => s.bid_expiry_min))
  on conflict (request_id, operator_id) do update set amount = excluded.amount, eta_minutes = excluded.eta_minutes,
     status = 'pending', expires_at = excluded.expires_at
  returning id into v_id;
  perform log_event(r.id, 'bid', jsonb_build_object('operator_id', v_uid, 'amount', p_amount));
  perform notify(r.customer_id,
    case when p_amount = r.offer_amount then 'An operator accepted your price' else 'New counter-offer' end,
    format('%s · arrives in ~%s min', naira(p_amount), coalesce(p_eta, 20)),
    jsonb_build_object('request_id', r.id, 'type', 'new_bid'));
  return v_id;
end $$;

create or replace function public.withdraw_bid(p_request uuid)
returns void language sql security definer set search_path = public as $$
  update bids set status = 'withdrawn' where request_id = p_request and operator_id = auth.uid() and status = 'pending';
$$;

create or replace function public.mark_arrived(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r tow_requests;
begin
  select * into r from tow_requests where id = p_request for update;
  if not found or r.operator_id <> auth.uid() then raise exception 'Job not found.'; end if;
  if r.status <> 'matched' then raise exception 'You can only mark arrival once.'; end if;
  update tow_requests set status = 'arrived', arrived_at = now() where id = r.id;
  perform log_event(r.id, 'arrived');
  perform notify(r.customer_id, 'Your tow truck has arrived 🚛',
                 'Inspect together, then give the operator your 4-digit start code.',
                 jsonb_build_object('request_id', r.id, 'type', 'arrived'));
end $$;

create or replace function public.start_job(p_request uuid, p_code text, p_photos text[])
returns void language plpgsql security definer set search_path = public as $$
declare r tow_requests; v_code text;
begin
  select * into r from tow_requests where id = p_request for update;
  if not found or r.operator_id <> auth.uid() then raise exception 'Job not found.'; end if;
  if r.status <> 'arrived' then raise exception 'Mark that you have arrived first.'; end if;
  if coalesce(array_length(p_photos, 1), 0) < 1 then
    raise exception 'Take at least one photo of the vehicle''s condition before loading.'; end if;
  select start_code into v_code from request_codes where request_id = r.id;
  if v_code is distinct from trim(p_code) then
    perform log_event(r.id, 'wrong_start_code');
    raise exception 'Wrong start code. Ask the customer for the 4-digit code in their app.'; end if;
  update tow_requests set status = 'in_progress', started_at = now(), pickup_photo_paths = p_photos where id = r.id;
  perform log_event(r.id, 'started', jsonb_build_object('photos', array_length(p_photos, 1)));
  perform notify(r.customer_id, 'Tow started', 'Your vehicle is on its way. Track it live in the app.',
                 jsonb_build_object('request_id', r.id, 'type', 'started'));
end $$;

create or replace function public.mark_delivered(p_request uuid, p_photos text[])
returns void language plpgsql security definer set search_path = public as $$
declare r tow_requests;
begin
  select * into r from tow_requests where id = p_request for update;
  if not found or r.operator_id <> auth.uid() then raise exception 'Job not found.'; end if;
  if r.status <> 'in_progress' then raise exception 'This job is not in progress.'; end if;
  if coalesce(array_length(p_photos, 1), 0) < 1 then raise exception 'Take a photo of the vehicle at drop-off.'; end if;
  update tow_requests set status = 'delivered', delivered_at = now(), delivery_photo_paths = p_photos where id = r.id;
  perform log_event(r.id, 'delivered');
  perform notify(r.customer_id, 'Vehicle delivered',
                 format('Please pay %s to your operator and confirm delivery in the app.', naira(r.final_price)),
                 jsonb_build_object('request_id', r.id, 'type', 'delivered'));
end $$;

create or replace function public.request_topup(p_amount numeric, p_reference text, p_proof_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from operators where id = auth.uid() and status in ('approved','pending')) then
    raise exception 'Only registered operators can top up.'; end if;
  if p_amount is null or p_amount < 500 then raise exception 'Minimum top-up is ₦500.'; end if;
  if exists (select 1 from topup_requests where operator_id = auth.uid() and status = 'pending') then
    raise exception 'You already have a top-up waiting for approval.'; end if;
  insert into topup_requests (operator_id, amount, reference, proof_path)
    values (auth.uid(), p_amount, coalesce(p_reference,''), p_proof_path) returning id into v_id;
  return v_id;
end $$;

-- =====================================================================
-- ADMIN ACTIONS
-- =====================================================================
create or replace function public.require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin if not is_admin() then raise exception 'Admins only.'; end if; end $$;

create or replace function public.admin_review_operator(p_operator uuid, p_decision text, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare v_status operator_status; v_msg text;
begin
  perform require_admin();
  v_status := case p_decision when 'approve' then 'approved' when 'reinstate' then 'approved'
                when 'reject' then 'rejected' when 'suspend' then 'suspended' end;
  if v_status is null then raise exception 'Unknown decision.'; end if;
  update operators set status = v_status, review_note = nullif(p_note,''), reviewed_by = auth.uid(), reviewed_at = now(),
         is_online = case when v_status = 'approved' then is_online else false end
   where id = p_operator;
  if not found then raise exception 'Operator not found.'; end if;
  if v_status <> 'approved' then
    update bids set status = 'withdrawn' where operator_id = p_operator and status = 'pending';
  end if;
  v_msg := case v_status
    when 'approved' then 'You''re approved! Top up your wallet and go online to receive tow requests.'
    when 'rejected' then 'Your application was not approved. ' || coalesce(p_note, '')
    else 'Your operator account has been suspended. ' || coalesce(p_note, '') end;
  perform notify(p_operator, 'Operator account update', v_msg, jsonb_build_object('type', 'operator_status'));
end $$;

create or replace function public.admin_review_topup(p_topup uuid, p_approve boolean, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare t topup_requests; v_bal numeric;
begin
  perform require_admin();
  select * into t from topup_requests where id = p_topup for update;
  if not found or t.status <> 'pending' then raise exception 'Top-up not found or already reviewed.'; end if;
  update topup_requests set status = case when p_approve then 'approved' else 'rejected' end,
         review_note = nullif(p_note,''), reviewed_by = auth.uid(), reviewed_at = now() where id = t.id;
  if p_approve then
    update operators set wallet_balance = wallet_balance + t.amount where id = t.operator_id returning wallet_balance into v_bal;
    insert into wallet_transactions (operator_id, kind, amount, balance_after, topup_id, note, created_by)
      values (t.operator_id, 'topup', t.amount, v_bal, t.id, coalesce(nullif(t.reference,''), 'Wallet top-up'), auth.uid());
    perform notify(t.operator_id, 'Wallet topped up', format('%s added. New balance %s.', naira(t.amount), naira(v_bal)),
                   jsonb_build_object('type', 'wallet'));
  else
    perform notify(t.operator_id, 'Top-up not approved', coalesce(nullif(p_note,''), 'Please contact support.'),
                   jsonb_build_object('type', 'wallet'));
  end if;
end $$;

create or replace function public.admin_adjust_wallet(p_operator uuid, p_amount numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_bal numeric;
begin
  perform require_admin();
  if p_amount = 0 then raise exception 'Amount cannot be zero.'; end if;
  if coalesce(trim(p_note),'') = '' then raise exception 'A note is required for adjustments.'; end if;
  update operators set wallet_balance = wallet_balance + p_amount where id = p_operator returning wallet_balance into v_bal;
  if not found then raise exception 'Operator not found.'; end if;
  insert into wallet_transactions (operator_id, kind, amount, balance_after, note, created_by)
    values (p_operator, 'adjustment', p_amount, v_bal, p_note, auth.uid());
end $$;

create or replace function public.admin_set_user_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  if p_status not in ('active','blocked') then raise exception 'Invalid status.'; end if;
  if p_user = auth.uid() then raise exception 'You cannot block yourself.'; end if;
  update profiles set status = p_status where id = p_user;
  if p_status = 'blocked' then
    update operators set is_online = false where id = p_user;
    update bids set status = 'withdrawn' where operator_id = p_user and status = 'pending';
  end if;
end $$;

create or replace function public.admin_cancel_request(p_request uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare r tow_requests;
begin
  perform require_admin();
  select * into r from tow_requests where id = p_request for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status in ('completed','cancelled','expired') then raise exception 'This request is already closed.'; end if;
  update tow_requests set status = 'cancelled', cancelled_by = 'admin', cancel_reason = p_reason, cancelled_at = now() where id = r.id;
  update bids set status = 'expired' where request_id = r.id and status = 'pending';
  delete from job_tracking where request_id = r.id;
  perform log_event(r.id, 'cancelled_by_admin', jsonb_build_object('reason', p_reason));
  perform notify(r.customer_id, 'Request cancelled by Townaija', coalesce(p_reason,''), jsonb_build_object('request_id', r.id, 'type', 'cancelled'));
  if r.operator_id is not null then
    perform notify(r.operator_id, 'Job cancelled by Townaija', coalesce(p_reason,''), jsonb_build_object('request_id', r.id, 'type', 'cancelled'));
  end if;
end $$;

create or replace function public.admin_complete_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  if not exists (select 1 from tow_requests where id = p_request and status = 'delivered') then
    raise exception 'Only delivered jobs can be marked complete.'; end if;
  perform complete_job(p_request, 'admin');
end $$;

create or replace function public.admin_resolve_dispute(p_dispute uuid, p_resolution text, p_refund_commission boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare d disputes; r tow_requests; v_bal numeric;
begin
  perform require_admin();
  select * into d from disputes where id = p_dispute for update;
  if not found or d.status <> 'open' then raise exception 'Dispute not found or already resolved.'; end if;
  if coalesce(trim(p_resolution),'') = '' then raise exception 'Write a resolution note.'; end if;
  update disputes set status = 'resolved', resolution = p_resolution, resolved_by = auth.uid(), resolved_at = now() where id = d.id;
  select * into r from tow_requests where id = d.request_id;
  if p_refund_commission and coalesce(r.commission_amount, 0) > 0
     and not exists (select 1 from wallet_transactions where request_id = r.id and kind = 'refund') then
    update operators set wallet_balance = wallet_balance + r.commission_amount where id = r.operator_id returning wallet_balance into v_bal;
    insert into wallet_transactions (operator_id, kind, amount, balance_after, request_id, note, created_by)
      values (r.operator_id, 'refund', r.commission_amount, v_bal, r.id, 'Commission refund for ' || r.ref, auth.uid());
  end if;
  perform log_event(r.id, 'dispute_resolved', jsonb_build_object('resolution', p_resolution));
  perform notify(d.raised_by, 'Your report was resolved', p_resolution, jsonb_build_object('request_id', r.id, 'type', 'dispute'));
end $$;

create or replace function public.admin_update_settings(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  update app_settings set
    commission_pct          = coalesce((p->>'commission_pct')::numeric, commission_pct),
    min_wallet_balance      = coalesce((p->>'min_wallet_balance')::numeric, min_wallet_balance),
    search_radius_km        = coalesce((p->>'search_radius_km')::numeric, search_radius_km),
    max_search_radius_km    = coalesce((p->>'max_search_radius_km')::numeric, max_search_radius_km),
    radius_expand_after_min = coalesce((p->>'radius_expand_after_min')::int, radius_expand_after_min),
    request_expiry_min      = coalesce((p->>'request_expiry_min')::int, request_expiry_min),
    bid_expiry_min          = coalesce((p->>'bid_expiry_min')::int, bid_expiry_min),
    auto_confirm_hours      = coalesce((p->>'auto_confirm_hours')::numeric, auto_confirm_hours),
    road_factor             = coalesce((p->>'road_factor')::numeric, road_factor),
    offer_floor_pct         = coalesce((p->>'offer_floor_pct')::numeric, offer_floor_pct),
    support_phone           = coalesce(p->>'support_phone', support_phone),
    bank_name               = coalesce(p->>'bank_name', bank_name),
    bank_account_name       = coalesce(p->>'bank_account_name', bank_account_name),
    bank_account_number     = coalesce(p->>'bank_account_number', bank_account_number),
    updated_at = now()
  where id;
  if (select commission_pct not between 0 and 50 or offer_floor_pct not between 10 and 100
             or search_radius_km > max_search_radius_km from app_settings where id) then
    raise exception 'Invalid settings: commission 0–50%%, floor 10–100%%, radius ≤ max radius.'; end if;
end $$;

create or replace function public.admin_update_rate(p_truck public.truck_type, p_base numeric, p_per_km numeric, p_min numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  if p_base < 0 or p_per_km < 0 or p_min < 0 then raise exception 'Rates cannot be negative.'; end if;
  update pricing_rates set base_fare = p_base, per_km = p_per_km, min_fare = p_min where truck_type = p_truck;
end $$;

create or replace function public.admin_upsert_city(p_id int, p_name text, p_state text, p_lat double precision,
                                                    p_lng double precision, p_radius numeric, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  if p_id is null then
    insert into cities (name, state, center_lat, center_lng, service_radius_km, is_active)
      values (p_name, coalesce(p_state,''), p_lat, p_lng, coalesce(p_radius, 60), coalesce(p_active, false));
  else
    update cities set name = p_name, state = coalesce(p_state,''), center_lat = p_lat, center_lng = p_lng,
           service_radius_km = coalesce(p_radius, 60), is_active = coalesce(p_active, false) where id = p_id;
  end if;
end $$;

create or replace function public.admin_set_admin(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_super_admin() then raise exception 'Only super admins can manage admins.'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own admin role.'; end if;
  if p_role is not null and p_role not in ('super','support') then raise exception 'Invalid role.'; end if;
  update profiles set is_admin = p_role is not null, admin_role = p_role where id = p_user;
end $$;

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_today timestamptz := date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
begin
  perform require_admin();
  return jsonb_build_object(
    'open_requests',     (select count(*) from tow_requests r where status = 'open' and not request_expired(r)),
    'active_jobs',       (select count(*) from tow_requests where status in ('matched','arrived','in_progress','delivered')),
    'operators_online',  (select count(*) from operators where is_online and last_seen_at > now() - interval '15 minutes'),
    'operators_pending', (select count(*) from operators where status = 'pending'),
    'operators_approved',(select count(*) from operators where status = 'approved'),
    'customers',         (select count(*) from profiles where not is_operator and not is_admin),
    'topups_pending',    (select count(*) from topup_requests where status = 'pending'),
    'disputes_open',     (select count(*) from disputes where status = 'open'),
    'today_requests',    (select count(*) from tow_requests where created_at >= v_today),
    'today_completed',   (select count(*) from tow_requests where completed_at >= v_today),
    'today_gmv',         (select coalesce(sum(final_price),0) from tow_requests where completed_at >= v_today),
    'today_commission',  (select coalesce(sum(commission_amount),0) from tow_requests where completed_at >= v_today),
    'week_completed',    (select count(*) from tow_requests where completed_at >= now() - interval '7 days'),
    'week_gmv',          (select coalesce(sum(final_price),0) from tow_requests where completed_at >= now() - interval '7 days'),
    'week_commission',   (select coalesce(sum(commission_amount),0) from tow_requests where completed_at >= now() - interval '7 days'),
    'match_rate_7d',     (select case when count(*) = 0 then null else
                            round(100.0 * count(*) filter (where matched_at is not null) / count(*), 0) end
                          from tow_requests where created_at >= now() - interval '7 days' and status <> 'open'),
    'daily',             (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'requests', coalesce(x.req,0),
                                   'completed', coalesce(x.done,0), 'gmv', coalesce(x.gmv,0)) order by d), '[]')
                          from generate_series((now() at time zone 'Africa/Lagos')::date - 13,
                                               (now() at time zone 'Africa/Lagos')::date, interval '1 day') d
                          left join (select (created_at at time zone 'Africa/Lagos')::date dd, count(*) req,
                                            count(*) filter (where status = 'completed') done,
                                            sum(final_price) filter (where status = 'completed') gmv
                                     from tow_requests group by 1) x on x.dd = d::date));
end $$;

-- =====================================================================
-- Housekeeping (runs every minute via pg_cron when available)
-- =====================================================================
create or replace function public.run_maintenance()
returns jsonb language plpgsql security definer set search_path = public as $$
declare s app_settings; v_expired int; v_done int := 0; v_id uuid;
begin
  select * into s from app_settings where id;
  with x as (
    update tow_requests r set status = 'expired'
    where r.status = 'open' and greatest(r.created_at, r.offer_updated_at) + make_interval(mins => s.request_expiry_min) < now()
    returning r.id, r.customer_id)
  select count(*) into v_expired from x;
  update bids set status = 'expired' where status = 'pending' and expires_at < now();
  update bids b set status = 'expired' from tow_requests r
    where b.request_id = r.id and b.status = 'pending' and r.status in ('expired','cancelled');
  for v_id in select id from tow_requests
              where status = 'delivered' and delivered_at < now() - make_interval(secs => (s.auto_confirm_hours * 3600)::int)
                and not exists (select 1 from disputes d where d.request_id = tow_requests.id and d.status = 'open') loop
    perform complete_job(v_id, 'system'); v_done := v_done + 1;
  end loop;
  update operators set is_online = false where is_online and last_seen_at < now() - interval '15 minutes';
  return jsonb_build_object('expired', v_expired, 'auto_completed', v_done);
end $$;

-- =====================================================================
-- ROW LEVEL SECURITY — every table locked; actions go through functions
-- =====================================================================
alter table public.app_settings        enable row level security;
alter table public.cities              enable row level security;
alter table public.pricing_rates       enable row level security;
alter table public.profiles            enable row level security;
alter table public.operators           enable row level security;
alter table public.tow_requests        enable row level security;
alter table public.request_codes       enable row level security;
alter table public.bids                enable row level security;
alter table public.job_tracking        enable row level security;
alter table public.ratings             enable row level security;
alter table public.request_events      enable row level security;
alter table public.topup_requests      enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.disputes            enable row level security;
alter table public.notifications       enable row level security;

drop policy if exists "read settings" on public.app_settings;
create policy "read settings" on public.app_settings for select to authenticated using (true);
drop policy if exists "read cities" on public.cities;
create policy "read cities" on public.cities for select using (true);
drop policy if exists "read rates" on public.pricing_rates;
create policy "read rates" on public.pricing_rates for select using (true);

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_admin()
  or exists (select 1 from public.tow_requests r where r.status in ('matched','arrived','in_progress','delivered','completed')
             and ((r.customer_id = auth.uid() and r.operator_id = profiles.id)
               or (r.operator_id = auth.uid() and r.customer_id = profiles.id))));
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name, push_token) on public.profiles to authenticated;

drop policy if exists "operators read" on public.operators;
create policy "operators read" on public.operators for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "requests read" on public.tow_requests;
create policy "requests read" on public.tow_requests for select to authenticated using (
  customer_id = auth.uid() or operator_id = auth.uid() or public.is_admin());

drop policy if exists "codes read" on public.request_codes;
create policy "codes read" on public.request_codes for select to authenticated using (
  public.is_admin() or exists (select 1 from public.tow_requests r where r.id = request_id and r.customer_id = auth.uid()));

drop policy if exists "bids read" on public.bids;
create policy "bids read" on public.bids for select to authenticated using (
  operator_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.tow_requests r where r.id = request_id and r.customer_id = auth.uid()));

drop policy if exists "tracking read" on public.job_tracking;
create policy "tracking read" on public.job_tracking for select to authenticated using (
  operator_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.tow_requests r where r.id = request_id and r.customer_id = auth.uid()));

drop policy if exists "ratings read" on public.ratings;
create policy "ratings read" on public.ratings for select to authenticated using (
  rater_id = auth.uid() or ratee_id = auth.uid() or public.is_admin());

drop policy if exists "events read" on public.request_events;
create policy "events read" on public.request_events for select to authenticated using (public.is_admin());

drop policy if exists "topups read" on public.topup_requests;
create policy "topups read" on public.topup_requests for select to authenticated using (operator_id = auth.uid() or public.is_admin());

drop policy if exists "wallet read" on public.wallet_transactions;
create policy "wallet read" on public.wallet_transactions for select to authenticated using (operator_id = auth.uid() or public.is_admin());

drop policy if exists "disputes read" on public.disputes;
create policy "disputes read" on public.disputes for select to authenticated using (raised_by = auth.uid() or public.is_admin());

drop policy if exists "notifications read" on public.notifications;
create policy "notifications read" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "notifications mark read" on public.notifications;
create policy "notifications mark read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

-- No direct inserts/updates/deletes from the apps on business tables.
revoke insert, update, delete on public.app_settings, public.cities, public.pricing_rates, public.operators,
  public.tow_requests, public.request_codes, public.bids, public.job_tracking, public.ratings,
  public.request_events, public.topup_requests, public.wallet_transactions, public.disputes
  from anon, authenticated;
revoke insert, delete on public.profiles, public.notifications from anon, authenticated;

-- Internal helpers are not callable from the apps.
revoke execute on function public.complete_job(uuid, text) from public, anon, authenticated;
revoke execute on function public.notify(uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.log_event(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.run_maintenance() from public, anon, authenticated;
revoke execute on function public.eligible_operators(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- =====================================================================
-- Realtime + scheduled housekeeping (Supabase only; skipped elsewhere)
-- =====================================================================
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.tow_requests; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.bids;         exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.job_tracking; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  end if;
end $$;

do $$ begin
  begin
    create extension if not exists pg_cron;
    perform cron.unschedule('townaija-maintenance') from cron.job where jobname = 'townaija-maintenance';
    perform cron.schedule('townaija-maintenance', '* * * * *', 'select public.run_maintenance()');
  exception when others then
    raise notice 'pg_cron not available — enable it in Supabase (Database → Extensions) and re-run this block.';
  end;
end $$;

do $$ begin
  begin create extension if not exists pg_net; exception when others then null; end;
end $$;
