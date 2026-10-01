"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart-provider";
import { createClient } from "@/lib/supabase/browser";

export function SiteHeader() {
  const { count } = useCart();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!error) setSignedIn(Boolean(data.user));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    const { error } = await createClient().auth.signOut();
    if (error) {
      window.alert(`Unable to sign out: ${error.message}`);
      return;
    }
    window.location.assign("/");
  }

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Daisy Foodz home">
        <span className="brand-mark">D</span>
        <span>DAISY FOODZ</span>
      </Link>
      <nav className="header-nav" aria-label="Main navigation">
        <Link href="/#menu">Menu</Link>
        <Link href="/cart">Cart <span className="cart-count">{count}</span></Link>
        {signedIn ? (
          <button className="nav-button" onClick={signOut} type="button">
            Sign out
          </button>
        ) : (
          <Link href="/checkout">Sign in</Link>
        )}
      </nav>
    </header>
  );
}
