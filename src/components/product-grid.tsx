import { AddToCartButton } from "@/components/add-to-cart-button";
import { formatPrice } from "@/lib/money";
import type { Product } from "@/lib/types";

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <p className="empty-copy">Our kitchen is preparing the menu. Check back soon.</p>;
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <article className="product-card" key={product.id}>
          <div className={`product-visual visual-${product.category.toLowerCase()}`}>
            <span className="product-emoji" aria-hidden="true">{product.emoji}</span>
            <span className="product-tag">{product.category}</span>
          </div>
          <div className="product-info">
            <div>
              <h3>{product.name}</h3>
              <p>{product.description}</p>
            </div>
            <div className="product-buy-row">
              <strong>{formatPrice(product.price_minor)}</strong>
              <AddToCartButton product={product} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
