"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/money";
import { useCart } from "@/components/cart-provider";
import { placeOrder } from "@/app/checkout/actions";

export function CheckoutForm() {
  const { items, totalMinor, clear } = useCart();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const router = useRouter();

  function submit(formData: FormData) {
    setMessage(null);
    const cartItems = items.map(({ product, quantity }) => ({
      productId: product.id,
      quantity,
    }));

    startTransition(async () => {
      const result = await placeOrder({
        customerName: String(formData.get("customerName") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        address: String(formData.get("address") ?? ""),
        city: String(formData.get("city") ?? ""),
        deliveryNotes: String(formData.get("deliveryNotes") ?? ""),
        items: cartItems,
      });

      if (result.status === "error") {
        setMessage(result.message);
        if (result.unauthorized) router.refresh();
        return;
      }

      clear();
      setOrderId(result.orderId);
      if (!result.emailSent) {
        setMessage(result.emailError);
      }
    });
  }

  if (orderId) {
    return (
      <section className="confirmation-card" role="status">
        <span className="confirmation-check">✓</span>
        <p className="eyebrow">Order received</p>
        <h2>Thanks for choosing Daisy Foodz.</h2>
        <p>Your order reference is <strong>{orderId}</strong>. We’ll deliver it to the address you provided.</p>
        {message && <p className="email-warning">{message}</p>}
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">🧺</span>
        <h2>Your basket is empty</h2>
        <p>Add something delicious before checking out.</p>
        <Link className="button button-dark" href="/#menu">Explore the menu</Link>
      </div>
    );
  }

  return (
    <div className="checkout-layout">
      <form
        className="checkout-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
      >
        <div className="form-section">
          <p className="eyebrow">Where should we deliver?</p>
          <h2>Delivery details</h2>
          <label>
            Full name
            <input autoComplete="name" maxLength={120} name="customerName" required />
          </label>
          <label>
            Phone number
            <input autoComplete="tel" maxLength={40} name="phone" required />
          </label>
          <label>
            Delivery address
            <textarea autoComplete="street-address" maxLength={500} name="address" required rows={3} />
          </label>
          <label>
            City
            <input autoComplete="address-level2" maxLength={120} name="city" required />
          </label>
          <label>
            Delivery notes <span className="optional-label">Optional</span>
            <textarea maxLength={500} name="deliveryNotes" rows={2} />
          </label>
        </div>
        {message && <p className="form-error" role="alert">{message}</p>}
        <button className="button button-dark button-wide" disabled={isPending || items.length === 0} type="submit">
          {isPending ? "Placing order…" : "Place order"}
        </button>
        <p className="form-fineprint">No online payment is collected at this time.</p>
      </form>
      <aside className="summary-card">
        <h2>Your order</h2>
        {items.map(({ product, quantity }) => (
          <div className="summary-row" key={product.id}>
            <span>{product.name} × {quantity}</span>
            <strong>{formatPrice(product.price_minor * quantity)}</strong>
          </div>
        ))}
        <div className="summary-total">
          <span>Total</span>
          <strong>{formatPrice(totalMinor)}</strong>
        </div>
      </aside>
    </div>
  );
}
