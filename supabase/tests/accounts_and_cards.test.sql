begin;
select plan(10);

-- Two signed-up users. Inserting into auth.users fires the trigger that fills public.users.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test', '', now(), now(), now(), '{}', '{}'),
       ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test', '', now(), now(), now(), '{}', '{}');

select is((select count(*) from public.users), 2::bigint, 'sign-up fills public.users');

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

-- Act as user B: sees nothing of A's.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is((select count(*) from public.cards), 0::bigint, 'another user sees no cards');

select * from finish();
rollback;
