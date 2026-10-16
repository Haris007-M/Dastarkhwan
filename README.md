# Dastarkhwan
1. Create a Supabase project, run `supabase/schema.sql` in the SQL editor (also adds a /demo menu).
2. Copy `.env.example` to `.env.local` and fill in your URL and anon key.
3. `npm install && npm run dev`
4. Open /admin, create an account, set up your restaurant. Menu is at /your-slug.
5. Deploy on Vercel and add the same two env variables.

## Run order
`supabase/schema.sql` then `supabase/02_security_orders_storage.sql`. In Supabase: Auth > turn ON "Confirm email", set a strong minimum password length, and (for private use) turn OFF "Allow new users to sign up" after creating owner accounts.
Table QR codes: Dashboard > QR tab > enter table number.
