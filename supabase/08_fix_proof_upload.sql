-- Run AFTER 07. Fixes: "new row violates row-level security policy" when uploading a payment screenshot.
-- Cause: inside the subquery, "name" meant restaurants.name instead of the file name. It must be objects.name.
drop policy if exists "proof upload" on storage.objects;
drop policy if exists "proof owner read" on storage.objects;
create policy "proof upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'payment-proofs' and exists (select 1 from public.restaurants r where r.id::text = (storage.foldername(objects.name))[1]));
create policy "proof owner read" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and exists (select 1 from public.restaurants r where r.id::text = (storage.foldername(objects.name))[1] and r.owner_id = auth.uid()));
