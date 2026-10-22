begin;
select plan(27);

-- Two signed-up users. Inserting into auth.users fires the trigger that fills public.users.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test', '', now(), now(), now(), '{}', '{}'),
       ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test', '', now(), now(), now(), '{}', '{}');

select is((select count(*) from public.users where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')), 2::bigint, 'sign-up fills public.users');

select is((select table_schema::text from information_schema.tables where table_name = 'spatial_ref_sys'), 'extensions', 'PostGIS lives outside public');

-- Step 5's path: postgres (a security-definer owner) may set publication fields.
insert into public.cards (id, user_id, original_path, rendition_path, thumb_path, photo_w, photo_h, date_source, variation, intro, variation_seed, number, is_public, published_at, share_token)
values ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-00000000000a', 'a/3.jpg', 'a/3/2048.jpg', 'a/3/512.jpg', 900, 1200, 'exif', '{"texture":"paper"}', 'rise', 43, 7, true, now(), 'tok');
select is((select number from public.cards where id = '33333333-3333-3333-3333-333333333333'), 7, 'the guard lets postgres set a number');

-- Act as user A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok($$
  insert into public.cards (id, user_id, original_path, rendition_path, thumb_path, photo_w, photo_h, date_source, variation, intro, variation_seed, number, is_public)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'a/1.jpg', 'a/1/2048.jpg', 'a/1/512.jpg', 900, 1200, 'exif', '{"texture":"paper"}', 'rise', 42, 7, true)
$$, 'the owner can insert a card');

select is((select number from public.cards where id = '11111111-1111-1111-1111-111111111111'), null, 'the guard clears a client-supplied number');
select is((select is_public from public.cards where id = '11111111-1111-1111-1111-111111111111'), false, 'the guard clears a client-supplied is_public');

select throws_ok($$
  insert into public.cards (id, user_id, original_path, rendition_path, thumb_path, photo_w, photo_h, date_source, variation, intro, variation_seed)
  values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-00000000000b', 'b/2.jpg', 'b/2/2048.jpg', 'b/2/512.jpg', 900, 1200, 'exif', '{}', 'rise', 1)
$$, '42501', 'new row violates row-level security policy for table "cards"', 'a user cannot insert a card for someone else');

select is((select public.ensure_place('city', 'Seoul', 'South Korea', 37.56, 126.99, null, 'city:Seoul, South Korea@37.56,126.99')),
          (select public.ensure_place('city', 'Seoul', 'South Korea', 37.56, 126.99, null, 'city:Seoul, South Korea@37.56,126.99')),
          'ensure_place returns the same id for the same key');

select throws_ok($$ insert into public.places (kind, name, lat, lng, provider_ref) values ('city', 'X', 0, 0, 'x') $$, '42501', null, 'places cannot be inserted directly');

select lives_ok($$ insert into storage.objects (bucket_id, name) values ('originals', '00000000-0000-0000-0000-00000000000a/x.jpg') $$, 'a user can upload under their own prefix');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('originals', '00000000-0000-0000-0000-00000000000b/x.jpg') $$, '42501', null, 'a user cannot upload under another prefix');
select is((select count(*) from storage.objects where bucket_id = 'originals'), 1::bigint, 'the owner lists their own object');

select ok(not has_function_privilege('anon', 'public.ensure_place(text, text, text, double precision, double precision, integer, text)', 'execute'), 'anon cannot execute ensure_place');
select ok(has_function_privilege('authenticated', 'public.ensure_place(text, text, text, double precision, double precision, integer, text)', 'execute'), 'authenticated can execute ensure_place');

select is((select public.ensure_place('city', 'Busan', 'South Korea', 35.18, 129.07, null, 'city:Busan@35.18,129.07')),
          (select public.ensure_place('city', 'Renamed', 'Elsewhere', 35.18, 129.07, null, 'city:Busan@35.18,129.07')),
          'a repeat key returns the same id');
select is((select name from public.places where provider_ref = 'city:Busan@35.18,129.07'), 'Busan', 'a repeat key does not rename the place');
select is((select region from public.places where provider_ref = 'city:Busan@35.18,129.07'), 'South Korea', 'a repeat key does not change the region');

select lives_ok($$ update public.cards set caption_place = 'Edited' where id = '33333333-3333-3333-3333-333333333333' $$, 'the owner can edit a published card');
select is((select number from public.cards where id = '33333333-3333-3333-3333-333333333333'), 7, 'an ordinary edit keeps the number');
select is((select is_public from public.cards where id = '33333333-3333-3333-3333-333333333333'), true, 'an ordinary edit keeps the card public');
select lives_ok($$ update public.cards set number = 99, is_public = false where id = '33333333-3333-3333-3333-333333333333' $$, 'a client update of publication fields does not error');
select is((select number from public.cards where id = '33333333-3333-3333-3333-333333333333'), 7, 'a client cannot change the number');
select is((select is_public from public.cards where id = '33333333-3333-3333-3333-333333333333'), true, 'a client cannot unpublish');
select throws_ok($$ update public.cards set user_id = '00000000-0000-0000-0000-00000000000b' where id = '11111111-1111-1111-1111-111111111111' $$, '42501', null, 'an owner cannot hand a card to another user');

-- Act as user B: sees nothing of A's.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is((select count(*) from public.cards), 0::bigint, 'another user sees no cards');
select is((select count(*) from public.users), 1::bigint, 'another user sees only their own users row');
select is((select count(*) from storage.objects where bucket_id = 'originals'), 0::bigint, 'another user lists none of the owner''s objects');

select * from finish();
rollback;
