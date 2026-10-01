"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/money";
import { useCart } from "@/components/cart-provider";

export function CartView() {
  const { items, totalMinor, setQuantity } = useCart();

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">🧺</span>
        <h2>Your basket is waiting</h2>
        <p>Pick something delicious from our kitchen.</p>
        <Link className="button button-dark" href="/#menu">Explore the menu</Link>
      </div>
    );
  }

  return (
    <div className="cart-layout">
      <div className="cart-items">
        {items.map(({ product, quantity }) => (
          <article className="cart-line" key={product.id}>
            <div className="cart-item-icon" aria-hidden="true">{product.emoji}</div>
            <div className="cart-item-copy">
              <h2>{product.name}</h2>
              <p>{formatPrice(product.price_minor)}</p>
            </div>
            <div className="quantity-control" aria-label={`Quantity for ${product.name}`}>
              <button
                aria-label={`Decrease ${product.name} quantity`}
                onClick={() => setQuantity(product.id, quantity - 1)}
                type="button"
              >
                −
              </button>
              <span>{quantity}</span>
              <button
                aria-label={`Increase ${product.name} quantity`}
                disabled={quantity >= 20}
                onClick={() => setQuantity(product.id, quantity + 1)}
                type="button"
              >
                +
              </button>
            </div>
            <strong className="cart-line-total">{formatPrice(product.price_minor * quantity)}</strong>
          </article>
        ))}
      </div>
      <aside className="summary-card">
        <h2>Order summary</h2>
        <div className="summary-row">
          <span>Subtotal</span>
          <strong>{formatPrice(totalMinor)}</strong>
        </div>
        <p className="summary-note">Delivery details are collected at checkout. Payment is arranged separately.</p>
        <Link className="button button-dark button-wide" href="/checkout">Continue to checkout</Link>
      </aside>
    </div>
  );
}
