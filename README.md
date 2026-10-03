# Daisy Foodz

A responsive food shop built with Next.js, TypeScript, and Supabase. Customers can browse the seeded menu, manage a cart, sign in with Google, and place delivery orders. Online payment is not enabled; orders are created as unpaid.

## Run locally

1. Install Node.js 20 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase and Mailgun values described below.
4. Apply the migrations in `supabase/migrations/` to your Supabase project using the Supabase SQL Editor or Supabase CLI.
5. Start the app with `npm run dev` and open `http://localhost:3000`.

The shop requires a configured Supabase project to load the menu. Missing Supabase variables are reported rather than replaced with fake catalogue or order data.

## Supabase and Google sign-in

1. Create a Supabase project and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` using the project URL and publishable/anon key.
2. In Supabase Authentication, enable Google as a provider and enter the OAuth client ID and secret from Google Cloud Console.
3. In Google Cloud Console, configure the OAuth consent screen and add the Supabase callback URI shown in the Supabase Google provider settings as an authorized redirect URI.
4. In Supabase Authentication URL Configuration, add `http://localhost:3000/auth/callback` as a redirect URL. Add the production callback URL when deploying.
5. Apply both SQL migrations. The second creates the RLS-protected, Realtime-enabled `cart_items` table used by the web and mobile carts.

Never expose a Google OAuth client secret, Mailgun API key, or Supabase service-role key to the browser. The application uses the public Supabase key with row-level security; a service-role key is not needed at runtime.

## Mobile app (Expo Go)

1. Install the root web dependencies as above, then in a second terminal run `cd mobile` and `npm install`.
2. Copy `mobile/.env.example` to `mobile/.env` and fill in the **same** Supabase project URL and anon/publishable key used in the root `.env.local`:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. In Supabase Authentication → URL Configuration → Redirect URLs, add `daisyfoodz://auth/callback` for a native build. For Expo Go, launch the app and copy the exact `exp://…/--/auth/callback` URL displayed under the Google sign-in button into the allow list; Expo Go's tunnel address can change between runs.
4. In Supabase Authentication → Providers → Google, enable Google using the same Google OAuth client credentials as the website. Keep the Supabase callback URI shown in that provider's settings registered as an authorized redirect URI in Google Cloud Console. The mobile callback URL is added to Supabase's redirect allow list; it is not a replacement for the Google Cloud Supabase callback URI.
5. From `mobile/`, run `npx expo start --tunnel`. Install Expo Go on the physical phone, scan the terminal/Expo webpage QR code, and ensure the phone has internet access.
6. On the phone, sign in with the same Google account used on the website. The menu is read directly from Supabase, and cart rows are stored per account in `public.cart_items`.
7. Verify both directions while signed in to the same account:
   - Add a product or change its quantity on the website; confirm it appears/updates on the phone without refreshing either app.
   - Add, increment, decrement, and remove a product on the phone; confirm the website cart and count update immediately.
   - Sign out on either client and verify another account does not see the previous account's cart.

## Mailgun order confirmations

Set the following server-side variables in `.env.local`:

- `MAILGUN_API_KEY`: a Mailgun private API key.
- `MAILGUN_DOMAIN`: the verified sending domain in Mailgun.
- `MAILGUN_FROM_EMAIL`: a sender address authorized for that domain.

The email send occurs after the database transaction commits. If Mailgun is unconfigured, unreachable, or rejects the request, the order remains saved and checkout displays the failure along with the order reference so the customer can contact the shop.

## Environment variables

See `.env.example` for the variable names. Keep `.env.local` out of version control.

## Checks

- `npm run lint`
- `npm run build`
