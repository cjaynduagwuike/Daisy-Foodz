import Link from "next/link";
import { CartView } from "@/components/cart-view";

export default function CartPage() {
  return (
    <main className="inner-page">
      <div className="page-heading">
        <p className="eyebrow">YOUR GOODIES</p>
        <h1>Your basket.</h1>
        <Link href="/#menu" className="text-link">← Back to the menu</Link>
      </div>
      <CartView />
    </main>
  );
}
