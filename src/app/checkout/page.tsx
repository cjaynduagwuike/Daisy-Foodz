import { CheckoutForm } from "@/components/checkout-form";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string }>;
}) {
  const { authError } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="inner-page">
      <div className="page-heading">
        <p className="eyebrow">ALMOST THERE</p>
        <h1>Checkout.</h1>
        <p>Fresh food is just a few details away.</p>
      </div>
      {!user ? (
        <section className="sign-in-card">
          <span className="sign-in-icon">🌼</span>
          <p className="eyebrow">A quick hello first</p>
          <h2>Sign in to place your order.</h2>
          <p>Use your Google account so we can keep your order details together.</p>
          {authError && (
            <p className="form-error" role="alert">
              Google sign-in could not be completed. Please try again.
            </p>
          )}
          <GoogleSignInButton />
        </section>
      ) : (
        <CheckoutForm />
      )}
    </main>
  );
}
