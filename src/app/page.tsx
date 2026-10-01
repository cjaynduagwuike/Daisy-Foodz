import Link from "next/link";
import { ProductGrid } from "@/components/product-grid";
import { getProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await getProducts();

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">GOOD FOOD, GOOD MOOD</p>
          <h1>A little joy<br />in every <em>bite.</em></h1>
          <p className="hero-description">
            Freshly made favourites, crafted with care and delivered right to your door.
          </p>
          <Link className="button button-dark" href="#menu">Explore the menu <span aria-hidden="true">↘</span></Link>
        </div>
        <div className="hero-art" aria-label="A colourful selection of fresh food">
          <div className="hero-sun" />
          <div className="hero-bowl">🥗</div>
          <span className="hero-spark hero-spark-one">✳</span>
          <span className="hero-spark hero-spark-two">✳</span>
          <span className="hero-sticker">FRESH<br />& LOCAL</span>
        </div>
        <div className="hero-bottom">
          <span>FRESH INGREDIENTS</span><span>·</span><span>MADE WITH LOVE</span><span>·</span><span>STRAIGHT TO YOUR DOOR</span>
        </div>
      </section>

      <section className="menu-section" id="menu">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FROM OUR KITCHEN</p>
            <h2>The good stuff.</h2>
          </div>
          <p>Small-batch favourites, made fresh just for you.</p>
        </div>
        <ProductGrid products={products} />
      </section>
      <section className="promise-strip">
        <span className="promise-icon">✳</span>
        <p>Real ingredients. Big flavour. <em>Always.</em></p>
        <span className="promise-icon">✳</span>
      </section>
    </main>
  );
}
