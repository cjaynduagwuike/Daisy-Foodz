"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setError(null);
    setLoading(true);
    const { error: authError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/checkout`,
      },
    });

    if (authError) {
      setLoading(false);
      setError(`Google sign-in failed: ${authError.message}`);
    }
  }

  return (
    <div>
      <button className="button button-dark button-wide" disabled={loading} onClick={signIn} type="button">
        <span className="google-g" aria-hidden="true">G</span>
        {loading ? "Connecting…" : "Continue with Google"}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
