"use client";

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="inner-page">
      <section className="confirmation-card" role="alert">
        <p className="eyebrow">A LITTLE KITCHEN PAUSE</p>
        <h2>We couldn’t load the shop.</h2>
        <p>{error.message}</p>
        <button className="button button-dark" onClick={reset} type="button">
          Try again
        </button>
      </section>
    </main>
  );
}
