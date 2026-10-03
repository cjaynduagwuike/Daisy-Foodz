"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, Product } from "@/lib/types";
import { createClient } from "@/lib/supabase/browser";

type CartContextValue = {
  items: CartItem[];
  count: number;
  totalMinor: number;
  cartError: string | null;
  add: (product: Product) => Promise<void>;
  setQuantity: (productId: string, quantity: number) => Promise<void>;
  clear: () => Promise<void>;
};

type CartRow = {
  product_id: string;
  quantity: number;
  products: Product;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "daisy-foodz-cart";

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<CartItem>;
  const product = item.product as Partial<Product> | undefined;
  return Boolean(
    product &&
      typeof product.id === "string" &&
      typeof product.slug === "string" &&
      typeof product.name === "string" &&
      typeof product.description === "string" &&
      typeof product.category === "string" &&
      typeof product.emoji === "string" &&
      typeof product.price_minor === "number" &&
      Number.isSafeInteger(product.price_minor) &&
      product.price_minor > 0 &&
      typeof item.quantity === "number" &&
      Number.isInteger(item.quantity) &&
      item.quantity >= 1 &&
      item.quantity <= 20,
  );
}

function readStoredCart(): CartItem[] {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      Array.isArray(parsed) &&
      parsed.every(isCartItem) &&
      new Set(parsed.map((item) => item.product.id)).size === parsed.length
    ) {
      return parsed;
    }
  } catch (error) {
    console.warn("Ignoring invalid saved cart data.", error);
  }
  window.localStorage.removeItem(STORAGE_KEY);
  return [];
}

function toCartItems(rows: CartRow[] | null): CartItem[] {
  return (rows ?? [])
    .filter((row) => isCartItem({ product: row.products, quantity: row.quantity }))
    .map((row) => ({ product: row.products, quantity: row.quantity }));
}

function mergeCartItems(
  remoteItems: CartItem[],
  savedItems: CartItem[],
): CartItem[] {
  const merged = new Map(
    remoteItems.map((item) => [item.product.id, item]),
  );
  for (const item of savedItems) {
    const existing = merged.get(item.product.id);
    merged.set(item.product.id, {
      product: item.product,
      quantity: Math.min((existing?.quantity ?? 0) + item.quantity, 20),
    });
  }
  return [...merged.values()];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    setItems(readStoredCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && authResolved && !userId) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [hydrated, authResolved, userId, items]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (previousUserId.current && previousUserId.current !== nextUserId) {
        setItems([]);
        window.localStorage.removeItem(STORAGE_KEY);
      }
      previousUserId.current = nextUserId;
      setUserId(nextUserId);
      setAuthResolved(true);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setCartError(`Unable to check your sign-in: ${error.message}`);
      const initialUserId = data.session?.user.id ?? null;
      if (previousUserId.current && previousUserId.current !== initialUserId) {
        setItems([]);
        window.localStorage.removeItem(STORAGE_KEY);
      }
      previousUserId.current = initialUserId;
      setUserId(initialUserId);
      setAuthResolved(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !authResolved || !userId) return;

    const supabase = createClient();
    let active = true;

    async function loadCart(): Promise<CartItem[] | null> {
      const { data, error } = await supabase
        .from("cart_items")
        .select(
          "product_id, quantity, products!inner(id,slug,name,description,category,price_minor,emoji)",
        )
        .eq("user_id", userId);

      if (!active) return null;
      if (error) {
        setCartError(`Unable to load your shared cart: ${error.message}`);
        return null;
      }
      return toCartItems(data as unknown as CartRow[]);
    }

    async function syncCart() {
      const savedItems = readStoredCart();
      const remoteItems = await loadCart();
      if (!active || remoteItems === null) return;

      const mergedItems = mergeCartItems(remoteItems, savedItems);

      if (savedItems.length > 0) {
        const { error } = await supabase.from("cart_items").upsert(
          savedItems.map((item) => ({
            user_id: userId,
            product_id: item.product.id,
            quantity: Math.min(
              item.quantity +
                (remoteItems.find((remote) => remote.product.id === item.product.id)
                  ?.quantity ?? 0),
              20,
            ),
          })),
          { onConflict: "user_id,product_id" },
        );
        if (!active) return;
        if (error) {
          setItems(mergedItems);
          setCartError(`Unable to move your saved cart online: ${error.message}`);
          return;
        }
        window.localStorage.removeItem(STORAGE_KEY);
      }

      setItems(mergedItems);
      setCartError(null);
    }

    const channel = supabase
      .channel(`cart:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cart_items",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadCart().then((nextItems) => {
            if (active && nextItems !== null) {
              setItems(mergeCartItems(nextItems, readStoredCart()));
            }
          });
        },
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setCartError(
            `Live cart updates are unavailable${error?.message ? `: ${error.message}` : "."}`,
          );
        }
      });

    void syncCart();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [hydrated, authResolved, userId]);

  const add = useCallback(
    async (product: Product) => {
      const existing = items.find((item) => item.product.id === product.id);
      const quantity = Math.min((existing?.quantity ?? 0) + 1, 20);
      setItems((current) => {
        const currentItem = current.find((item) => item.product.id === product.id);
        if (currentItem) {
          return current.map((item) =>
            item.product.id === product.id ? { ...item, quantity } : item,
          );
        }
        return [...current, { product, quantity }];
      });
      setCartError(null);
      if (!userId) return;

      const { error } = await createClient()
        .from("cart_items")
        .upsert(
          { user_id: userId, product_id: product.id, quantity },
          { onConflict: "user_id,product_id" },
        );
      if (error) setCartError(`Unable to save your cart change: ${error.message}`);
    },
    [items, userId],
  );

  const setQuantity = useCallback(
    async (productId: string, requestedQuantity: number) => {
      const quantity = Math.min(requestedQuantity, 20);
      setItems((current) =>
        quantity <= 0
          ? current.filter((item) => item.product.id !== productId)
          : current.map((item) =>
              item.product.id === productId ? { ...item, quantity } : item,
            ),
      );
      setCartError(null);
      if (!userId) return;

      const supabase = createClient();
      const result =
        quantity <= 0
          ? await supabase
              .from("cart_items")
              .delete()
              .eq("user_id", userId)
              .eq("product_id", productId)
          : await supabase.from("cart_items").upsert(
              { user_id: userId, product_id: productId, quantity },
              { onConflict: "user_id,product_id" },
            );
      if (result.error) {
        setCartError(`Unable to save your cart change: ${result.error.message}`);
      }
    },
    [userId],
  );

  const clear = useCallback(async () => {
    setItems([]);
    setCartError(null);
    if (!userId) return;
    const { error } = await createClient()
      .from("cart_items")
      .delete()
      .eq("user_id", userId);
    if (error) setCartError(`Unable to clear your shared cart: ${error.message}`);
  }, [userId]);

  const value = useMemo(
    () => ({
      items,
      cartError,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      totalMinor: items.reduce(
        (sum, item) => sum + item.product.price_minor * item.quantity,
        0,
      ),
      add,
      setQuantity,
      clear,
    }),
    [items, cartError, add, setQuantity, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) {
    throw new Error("useCart must be used within CartProvider.");
  }
  return value;
}
