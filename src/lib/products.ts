import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

export async function getProducts(): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, description, category, price_minor, emoji")
    .eq("is_available", true)
    .order("sort_order");

  if (error) {
    throw new Error(`Unable to load the product catalogue: ${error.message}`);
  }

  return data;
}
