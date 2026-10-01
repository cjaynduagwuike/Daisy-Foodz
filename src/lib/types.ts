export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  price_minor: number;
  emoji: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
};
