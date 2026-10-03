"use client";

import { useState } from "react";
import { useCart } from "@/components/cart-provider";
import type { Product } from "@/lib/types";

export function AddToCartButton({ product }: { product: Product }) {
  const { add, cartError } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    void add(product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  return (
    <>
      <button className="button button-dark product-add" onClick={handleAdd} type="button">
        {added ? "Added!" : "Add to cart"}
      </button>
      {cartError && <p className="form-error" role="alert">{cartError}</p>}
    </>
  );
}
