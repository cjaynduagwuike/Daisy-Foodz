import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-provider";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daisy Foodz — Good food, good mood",
  description: "Thoughtful, delicious food made fresh for your table.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <SiteHeader />
          {children}
          <footer className="site-footer">
            <span>DAISY FOODZ</span>
            <span>Made fresh. Delivered with love.</span>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
