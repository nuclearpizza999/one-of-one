begin;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f@example.test', '', now(), now(), now(), '{}', '{}'),
       ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r@example.test', '', now(), now(), now(), '{}', '{}');

insert into public.cards (id, user_id, original_path, rendition_path, thumb_path, photo_w, photo_h, date_source, variation, intro, variation_seed)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaf1', '00000000-0000-0000-0000-0000000000f1', 'f/1.jpg', 'f/1/2048.jpg', 'f/1/512.jpg', 900, 1200, 'exif', '{"texture":"paper"}', 'rise', 1),
       ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaae2', '00000000-0000-0000-0000-0000000000e2', 'r/1.jpg', 'r/1/2048.jpg', 'r/1/512.jpg', 900, 1200, 'exif', '{"texture":"paper"}', 'rise', 2);

update public.users set is_founder = true where id = '00000000-0000-0000-0000-0000000000f1';

select ok(not has_function_privilege('anon', 'public.is_founder()', 'execute'), 'anon cannot execute is_founder');

-- Regular user R.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000e2", "role": "authenticated"}';

select is(public.is_founder(), false, 'a regular user is not a founder');
select lives_ok($$ update public.cards set caption_place = 'Edited' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaae2' $$, 'a regular user can edit other fields of their card');
select throws_ok($$ update public.cards set variation = '{"texture":"linen"}' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaae2' $$, '42501', 'only founders can change a card''s design', 'a regular user cannot change variation');
select throws_ok($$ update public.cards set intro = 'fade' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaae2' $$, '42501', 'only founders can change a card''s design', 'a regular user cannot change intro');
select lives_ok($$ update public.users set is_founder = true where id = '00000000-0000-0000-0000-0000000000e2' $$, 'a self-promotion update does not error');

reset role;
select is((select is_founder from public.users where id = '00000000-0000-0000-0000-0000000000e2'), false, 'a user cannot set their own founder flag');

-- Founder F.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated"}';

select is(public.is_founder(), true, 'a founder is a founder');
select lives_ok($$ update public.cards set variation = '{"texture":"linen"}', intro = 'fade' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaf1' $$, 'a founder can change variation and intro');
select is((select variation->>'texture' from public.cards where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaf1'), 'linen', 'the founder variation reads back');
select is((select intro from public.cards where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaf1'), 'fade', 'the founder intro reads back');
select lives_ok($$ update public.cards set variation = '{"texture":"linen"}', intro = 'fade' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaae2' $$, 'a founder updating another user''s card does not error');

reset role;
select is((select intro from public.cards where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaae2'), 'rise', 'a founder cannot change another user''s card intro');
select is((select variation->>'texture' from public.cards where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaae2'), 'paper', 'a founder cannot change another user''s card variation');

select * from finish();
rollback;
