-- End-to-end test of the Townaija backend. Runs against a local Postgres
-- loaded with 00_supabase_stub.sql + 01_schema.sql + 02_storage.sql.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset tuples_only on
\pset format unaligned

\set C  '11111111-1111-1111-1111-111111111111'
\set O1 '22222222-2222-2222-2222-222222222222'
\set O2 '33333333-3333-3333-3333-333333333333'
\set O3 '44444444-4444-4444-4444-444444444444'
\set A  '55555555-5555-5555-5555-555555555555'

create or replace function public.t_err(q text, pat text) returns text language plpgsql as $$
begin
  execute q;
  raise exception 'EXPECTED ERROR NOT RAISED: %', q;
exception when others then
  if sqlerrm like 'EXPECTED ERROR NOT RAISED%' then raise; end if;
  if sqlerrm not ilike '%' || pat || '%' then
    raise exception 'Wrong error for [%]: got "%" expected "%"', q, sqlerrm, pat; end if;
  return 'ok';
end $$;
grant execute on function public.t_err(text, text) to authenticated, anon;

create or replace function public.t_ok(cond boolean, label text) returns text language plpgsql as $$
begin if cond is not true then raise exception 'ASSERT FAILED: %', label; end if; return 'PASS  ' || label; end $$;
grant execute on function public.t_ok(boolean, text) to authenticated, anon;

create or replace function public.t_as(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p::text, ''), false); $$;
grant execute on function public.t_as(uuid) to authenticated, anon;

-- ---------- Sign-ups (Supabase auth creates users; trigger makes profiles)
insert into auth.users (id, email, raw_user_meta_data) values
  (:'C',  '08030000001@users.townaija.app', '{"full_name":"Ada Okafor","phone":"08030000001"}'),
  (:'O1', '08030000002@users.townaija.app', '{"full_name":"Musa Bello","phone":"08030000002"}'),
  (:'O2', '08030000003@users.townaija.app', '{"full_name":"Chinedu Eze","phone":"08030000003"}'),
  (:'O3', '08030000004@users.townaija.app', '{"full_name":"Tunde Lagos","phone":"08030000004"}'),
  (:'A',  '08030000005@users.townaija.app', '{"full_name":"Kem Admin","phone":"08030000005"}');
update profiles set is_admin = true, admin_role = 'super' where id = :'A';
select t_ok((select count(*) = 5 from profiles), 'profiles auto-created on sign-up');

-- ---------- Operator onboarding
select t_as(:'O1'); set role authenticated;
select register_operator('{"truck_type":"flatbed","truck_plate":"abj 123 xy","truck_make_model":"Isuzu NPR","base_area":"Wuse","license_doc_path":"o1/lic.jpg","truck_photo_path":"o1/truck.jpg"}');
select t_err($$select set_online(true, 9.0765, 7.4986)$$, 'not approved');
select t_err($$select admin_stats()$$, 'Admins only');
select t_ok((select count(*) = 1 from operators), 'operator sees only own operator row');
reset role;
select t_as(:'O2'); set role authenticated;
select register_operator('{"truck_type":"wheel_lift","truck_plate":"KUJ 555 AA","license_doc_path":"o2/lic.jpg","truck_photo_path":"o2/truck.jpg"}');
select t_err($$select register_operator('{"truck_type":"flatbed","truck_plate":""}')$$, 'plate');
reset role;
select t_as(:'O3'); set role authenticated;
select register_operator('{"truck_type":"heavy_duty","truck_plate":"LAG 1 HD","license_doc_path":"o3/lic.jpg","truck_photo_path":"o3/truck.jpg"}');
reset role;

select t_as(:'A'); set role authenticated;
select admin_review_operator(:'O1', 'approve');
select admin_review_operator(:'O2', 'approve');
select admin_review_operator(:'O3', 'approve');
select t_ok((select count(*) = 3 from operators where status = 'approved'), 'admin approves operators');
reset role;

-- ---------- Wallet top-ups
select t_as(:'O1'); set role authenticated;
select t_err($$select set_online(true, 9.0765, 7.4986)$$, 'Top up');
select request_topup(5000, 'GTB transfer 001', 'o1/proof.jpg');
select t_err($$select request_topup(2000, 'again', null)$$, 'already have a top-up');
reset role;
select t_as(:'O2'); set role authenticated; select request_topup(5000, 'ref2', null); reset role;
select t_as(:'O3'); set role authenticated; select request_topup(5000, 'ref3', null); reset role;
select t_as(:'A'); set role authenticated;
select admin_review_topup(id, true) from topup_requests where status = 'pending';
select t_ok((select bool_and(wallet_balance = 5000) from operators), 'top-ups credited to wallets');
select t_ok((select count(*) = 3 from wallet_transactions where kind = 'topup'), 'top-up ledger entries');
reset role;

-- ---------- Go online
select t_as(:'O1'); set role authenticated; select set_online(true, 9.0765, 7.4986); reset role;   -- Wuse, Abuja
select t_as(:'O2'); set role authenticated; select set_online(true, 9.0600, 7.4900); reset role;   -- Abuja
select t_as(:'O3'); set role authenticated; select set_online(true, 6.5244, 3.3792); reset role;   -- Lagos (far)

-- ---------- Customer requests a tow
select t_as(:'C'); set role authenticated;
select estimate_fare(9.0700, 7.4800, 9.0300, 7.4900, 'car', true) as est \gset
select t_ok((:'est'::jsonb->>'in_service')::boolean, 'Abuja pickup is in service');
select t_ok((:'est'::jsonb->>'recommended_fare')::numeric >= 20000, 'recommended fare respects minimum');
select t_ok((estimate_fare(6.52, 3.37, 6.45, 3.40, 'car', true)->>'in_service')::boolean = false, 'Lagos not yet in service');
select t_err($$select create_tow_request('{"pickup_lat":9.07,"pickup_lng":7.48,"dropoff_lat":9.03,"dropoff_lng":7.49,"vehicle_type":"car","problem_type":"breakdown","offer_amount":1000}')$$, 'too low');
select t_err($$select create_tow_request('{"pickup_lat":6.52,"pickup_lng":3.37,"dropoff_lat":6.45,"dropoff_lng":3.40,"vehicle_type":"car","problem_type":"breakdown","offer_amount":90000}')$$, 'not available in this area');
select create_tow_request(jsonb_build_object('pickup_lat',9.07,'pickup_lng',7.48,'pickup_address','Wuse Market',
  'dropoff_lat',9.03,'dropoff_lng',7.49,'dropoff_address','Garki Mechanic Village','vehicle_type','car',
  'vehicle_desc','Toyota Corolla 2012','problem_type','wont_start','wheels_roll',true,'keys_available',true,
  'photo_paths',jsonb_build_array(:'C' || '/car1.jpg'),'offer_amount',(:'est'::jsonb->>'recommended_fare')::numeric,
  'payment_method','cash')) as r1 \gset
select t_err($$select create_tow_request('{"pickup_lat":9.07,"pickup_lng":7.48,"dropoff_lat":9.03,"dropoff_lng":7.49,"vehicle_type":"car","problem_type":"breakdown","offer_amount":90000}')$$, 'already have an active');
select t_ok((select start_code ~ '^\d{4}$' from request_codes where request_id = :'r1'), 'customer can read own start code');
select (select start_code from request_codes where request_id = :'r1') as code \gset
select offer_amount as offer from tow_requests where id = :'r1' \gset
reset role;
select t_ok((select count(*) = 2 from notifications where data->>'type' = 'new_request'), 'nearby compatible operators notified (not Lagos)');

-- ---------- Operators see & bid
select t_as(:'O1'); set role authenticated;
select t_ok(jsonb_array_length(operator_feed()) = 1, 'nearby operator sees request in feed');
select t_ok((select count(*) = 0 from request_codes), 'operator cannot read start code');
select t_ok((select count(*) = 0 from tow_requests), 'operator cannot list open requests directly');
select t_err(format('select place_bid(%L, %s)', :'r1', :'offer'::numeric - 1000), 'cannot be lower');
select place_bid(:'r1', :'offer'::numeric, 15) as b1 \gset
select t_ok(get_request_detail(:'r1')->>'my_role' = 'bidder', 'bidder can open request detail');
reset role;
select t_as(:'O2'); set role authenticated;
select place_bid(:'r1', :'offer'::numeric + 5000, 10) as b2 \gset
reset role;
select t_as(:'O3'); set role authenticated;
select t_ok(jsonb_array_length(operator_feed()) = 0, 'far-away operator does not see request');
select t_err(format('select place_bid(%L, %s)', :'r1', :'offer'), 'too far');
reset role;

select t_as(:'C'); set role authenticated;
select t_ok(jsonb_array_length(get_request_bids(:'r1')) = 2, 'customer sees 2 offers');
select t_ok((get_request_bids(:'r1')->1->>'is_counter')::boolean, 'counter-offer flagged');
select t_ok((get_request_detail(:'r1')->'operator') is null, 'no operator details before match');
select accept_bid(:'b1');
select t_ok((select status = 'matched' and final_price = :'offer'::numeric from tow_requests where id = :'r1'), 'request matched at agreed price');
select t_ok(get_request_detail(:'r1')->'operator'->>'phone' = '08030000002', 'customer sees operator phone after match');
select t_ok(get_request_detail(:'r1')->>'start_code' = :'code', 'start code returned to customer');
reset role;
select t_ok((select status = 'rejected' from bids where id = :'b2'), 'other offer rejected');
select t_ok((select count(*) = 1 from job_tracking where request_id = :'r1'), 'live tracking row created');

select t_as(:'O2'); set role authenticated;
select t_ok(get_request_detail(:'r1')->'customer'->>'phone' is null, 'losing bidder cannot see customer phone');
select t_ok(get_request_detail(:'r1')->>'start_code' is null, 'losing bidder cannot see code');
reset role;

-- ---------- Job execution
select t_as(:'O1'); set role authenticated;
select t_ok(get_request_detail(:'r1')->'customer'->>'phone' = '08030000001', 'operator sees customer phone after match');
select t_ok(get_request_detail(:'r1')->>'start_code' is null, 'operator never sees the start code');
select t_err(format('select start_job(%L, %L, array[''x.jpg''])', :'r1', :'code'), 'arrived first');
select update_location(9.071, 7.481);
select mark_arrived(:'r1');
select t_err(format('select start_job(%L, ''0000x'', array[''x.jpg''])', :'r1'), 'Wrong start code');
select t_err(format('select start_job(%L, %L, array[]::text[])', :'r1', :'code'), 'photo');
select start_job(:'r1', :'code', array[:'O1' || '/pickup1.jpg']);
select update_location(9.05, 7.485);
select t_err(format('select cancel_request(%L, ''x'')', :'r1'), 'before the tow starts');
select mark_delivered(:'r1', array[:'O1' || '/drop1.jpg']);
reset role;

select t_as(:'C'); set role authenticated;
select t_ok((select lat = 9.05 from job_tracking where request_id = :'r1'), 'customer sees live operator location');
select t_err(format('select cancel_request(%L, ''x'')', :'r1'), 'Report a problem');
select confirm_delivery(:'r1');
select rate_job(:'r1', 5, 'Fast and careful');
reset role;
select t_ok((select status = 'completed' and commission_amount = round(final_price * 0.10) from tow_requests where id = :'r1'), 'completed with 10% commission');
select t_ok((select wallet_balance = 5000 - round(:'offer'::numeric * 0.10) from operators where id = :'O1'), 'commission deducted from operator wallet');
select t_ok((select jobs_completed = 1 from operators where id = :'O1'), 'operator job count incremented');
select t_ok((select rating_avg = 5 from profiles where id = :'O1'), 'operator rating updated');
select t_ok((select count(*) = 0 from job_tracking where request_id = :'r1'), 'tracking cleared after completion');

select t_as(:'O1'); set role authenticated;
select rate_job(:'r1', 4);
select t_ok((select count(*) >= 2 from wallet_transactions), 'operator sees own wallet ledger');
reset role;

-- ---------- Dispute + refund
select t_as(:'C'); set role authenticated;
select raise_dispute(:'r1', 'Vehicle damaged', 'Scratch on bumper') as d1 \gset
select t_err('select admin_resolve_dispute(''' || :'d1' || ''', ''x'', true)', 'Admins only');
reset role;
select t_as(:'A'); set role authenticated;
select t_ok((admin_stats()->>'disputes_open')::int = 1, 'admin stats show open dispute');
select admin_resolve_dispute(:'d1', 'Operator fixed scratch; commission refunded as goodwill', true);
select t_ok((select wallet_balance = 5000 from operators where id = :'O1'), 'commission refunded to wallet');
select t_ok(jsonb_array_length(get_request_detail(:'r1')->'events') >= 6, 'admin sees job timeline');
reset role;

-- ---------- Security checks
select t_as(:'C'); set role authenticated;
select t_err(format('update tow_requests set final_price = 1 where id = %L', :'r1'), 'permission denied');
select t_err($$insert into bids (request_id, operator_id, amount, expires_at) values (gen_random_uuid(), gen_random_uuid(), 1, now())$$, 'permission denied');
select t_err($$update profiles set is_admin = true$$, 'permission denied');
select t_err($$select run_maintenance()$$, 'permission denied');
select t_err($$select notify(auth.uid(), 'x', 'y')$$, 'permission denied');
update profiles set full_name = 'Ada N. Okafor' where id = auth.uid();
select t_ok((select count(*) = 0 from operators), 'customer cannot read operators table');
select t_ok((select count(*) = 0 from wallet_transactions), 'customer cannot read wallets');
select t_ok((select count(*) = 1 from profiles where full_name = 'Ada N. Okafor'), 'customer can edit own name');
reset role;
select t_as(null); set role anon;
select t_ok((select count(*) = 0 from tow_requests), 'anonymous sees nothing');
reset role;

-- ---------- Operator cancels after match → request reopens
select t_as(:'C'); set role authenticated;
select create_tow_request(jsonb_build_object('pickup_lat',9.07,'pickup_lng',7.48,'dropoff_lat',9.0,'dropoff_lng',7.5,
  'vehicle_type','car','problem_type','accident','wheels_roll',false,'offer_amount',60000)) as r2 \gset
select t_ok((select required_truck_types = array['flatbed','heavy_duty']::truck_type[] from tow_requests where id = :'r2'), 'non-rolling car needs flatbed');
reset role;
select t_as(:'O2'); set role authenticated;
select t_ok(jsonb_array_length(operator_feed()) = 0, 'wheel-lift operator excluded from non-rolling job');
reset role;
select t_as(:'O1'); set role authenticated;
select place_bid(:'r2', 60000) as b3 \gset
reset role;
select t_as(:'C'); set role authenticated; select raise_offer(:'r2', 65000); select accept_bid(:'b3'); reset role;
select t_as(:'O1'); set role authenticated;
select t_ok(jsonb_array_length(operator_feed()) = 0, 'busy operator gets empty feed');
select cancel_request(:'r2', 'Truck broke down');
reset role;
select t_ok((select status = 'open' and operator_id is null from tow_requests where id = :'r2'), 'operator cancel reopens request');
select t_ok((select cancellations = 1 from operators where id = :'O1'), 'operator cancellation counted');
select t_as(:'O1'); set role authenticated;
select place_bid(:'r2', 66000) as b4 \gset
select t_ok(:'b4' is not null, 'operator can re-bid after withdrawing');
reset role;
select t_as(:'C'); set role authenticated;
select cancel_request(:'r2', 'Fixed it myself');
reset role;
select t_ok((select status = 'cancelled' from tow_requests where id = :'r2'), 'customer cancel works');

-- ---------- Expiry + auto-complete housekeeping
select t_as(:'C'); set role authenticated;
select create_tow_request(jsonb_build_object('pickup_lat',9.07,'pickup_lng',7.48,'dropoff_lat',9.0,'dropoff_lng',7.5,
  'vehicle_type','car','problem_type','breakdown','offer_amount',50000)) as r3 \gset
reset role;
update tow_requests set created_at = now() - interval '2 hours', offer_updated_at = now() - interval '2 hours' where id = :'r3';
select t_ok((run_maintenance()->>'expired')::int = 1, 'stale request expires');
select t_as(:'O2'); set role authenticated;
select t_err(format('select place_bid(%L, 60000)', :'r3'), 'no longer available');
reset role;

-- Delivered job auto-completes if customer never confirms
select t_as(:'C'); set role authenticated;
select create_tow_request(jsonb_build_object('pickup_lat',9.07,'pickup_lng',7.48,'dropoff_lat',9.0,'dropoff_lng',7.5,
  'vehicle_type','car','problem_type','breakdown','offer_amount',50000)) as r4 \gset
select start_code as code4 from request_codes where request_id = :'r4' \gset
reset role;
select t_as(:'O2'); set role authenticated; select place_bid(:'r4', 50000) as b5 \gset
reset role;
select t_as(:'C'); set role authenticated; select accept_bid(:'b5'); reset role;
select t_as(:'O2'); set role authenticated;
select mark_arrived(:'r4'); select start_job(:'r4', :'code4', array['p.jpg']); select mark_delivered(:'r4', array['d.jpg']);
reset role;
update tow_requests set delivered_at = now() - interval '5 hours' where id = :'r4';
select t_ok((run_maintenance()->>'auto_completed')::int = 1, 'unconfirmed delivery auto-completes');

-- ---------- Admin tools
select t_as(:'A'); set role authenticated;
select admin_update_settings('{"commission_pct": 12, "bank_name":"GTBank","bank_account_number":"0123456789"}');
select t_ok((select commission_pct = 12 from app_settings), 'admin updates commission');
select t_err($$select admin_update_settings('{"commission_pct": 80}')$$, 'Invalid settings');
select admin_update_rate('flatbed', 22000, 1100, 27000);
select admin_adjust_wallet(:'O3', -500, 'Test correction');
select t_err(format('select admin_adjust_wallet(%L, 100, '''')', :'O3'), 'note is required');
select admin_review_operator(:'O3', 'suspend', 'Docs expired');
select admin_set_user_status(:'C', 'blocked');
select t_ok((select (admin_stats()->>'operators_approved')::int = 2), 'stats reflect suspension');
select t_ok(jsonb_array_length(admin_stats()->'daily') = 14, '14-day trend returned');
reset role;
select t_as(:'C'); set role authenticated;
select t_err($$select create_tow_request('{"pickup_lat":9.07,"pickup_lng":7.48,"dropoff_lat":9.03,"dropoff_lng":7.49,"vehicle_type":"car","problem_type":"breakdown","offer_amount":90000}')$$, 'blocked');
reset role;
select t_as(:'O3'); set role authenticated;
select t_err($$select set_online(true, 6.5, 3.3)$$, 'not approved');
reset role;

-- ---------- Storage rules
select t_as(:'C'); set role authenticated;
insert into storage.objects (bucket_id, name) values ('job-photos', :'C' || '/a.jpg');
select t_err($$insert into storage.objects (bucket_id, name) values ('job-photos', 'someone-else/a.jpg')$$, 'row-level security');
reset role;

select 'ALL TESTS PASSED';
