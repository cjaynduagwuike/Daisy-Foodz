import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { supabase } from "./src/api/supabase";

WebBrowser.maybeCompleteAuthSession();

type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  price_minor: number;
  emoji: string;
};

type CartItem = { product: Product; quantity: number };
type CartRow = { product_id: string; quantity: number; products: Product };

const Tab = createBottomTabNavigator();
const redirectTo = AuthSession.makeRedirectUri({
  scheme: "daisyfoodz",
  path: "auth/callback",
});

function formatPrice(minorUnits: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(minorUnits / 100);
}

function MenuScreen({
  products,
  loading,
  busy,
  session,
  onAdd,
}: {
  products: Product[];
  loading: boolean;
  busy: boolean;
  session: Session | null;
  onAdd: (product: Product) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Fresh from our kitchen</Text>
      {loading ? (
        <ActivityIndicator color="#276b45" />
      ) : (
        products.map((product) => (
          <View key={product.id} style={styles.card}>
            <Text style={styles.productEmoji}>{product.emoji}</Text>
            <View style={styles.productCopy}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.description}>{product.description}</Text>
              <Text style={styles.price}>{formatPrice(product.price_minor)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={busy || !session}
              onPress={() => onAdd(product)}
              style={[styles.addButton, (!session || busy) && styles.disabled]}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>
        ))
      )}
      {!session && (
        <Text style={styles.signInPrompt}>
          Sign in below to add menu items to your shared cart.
        </Text>
      )}
    </ScrollView>
  );
}

function CartScreen({
  session,
  loading,
  cart,
  busy,
  total,
  onSetQuantity,
}: {
  session: Session | null;
  loading: boolean;
  cart: CartItem[];
  busy: boolean;
  total: number;
  onSetQuantity: (product: Product, quantity: number) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Your shared cart</Text>
      {!session ? (
        <View style={styles.card}>
          <Text style={styles.description}>
            Sign in with the Google account you use on the Daisy Foodz website
            to access your cart.
          </Text>
        </View>
      ) : loading && cart.length === 0 ? (
        <ActivityIndicator color="#276b45" />
      ) : cart.length === 0 ? (
        <Text style={styles.description}>Your basket is waiting.</Text>
      ) : (
        <>
          {cart.map(({ product, quantity }) => (
            <View key={product.id} style={styles.card}>
              <Text style={styles.productEmoji}>{product.emoji}</Text>
              <View style={styles.productCopy}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.price}>
                  {formatPrice(product.price_minor * quantity)}
                </Text>
              </View>
              <View style={styles.quantityControl}>
                <Pressable
                  accessibilityLabel={`Decrease ${product.name} quantity`}
                  disabled={busy}
                  onPress={() => onSetQuantity(product, quantity - 1)}
                  style={styles.quantityButton}
                >
                  <Text style={styles.quantityText}>−</Text>
                </Pressable>
                <Text style={styles.quantityText}>{quantity}</Text>
                <Pressable
                  accessibilityLabel={`Increase ${product.name} quantity`}
                  disabled={busy || quantity >= 20}
                  onPress={() => onSetQuantity(product, quantity + 1)}
                  style={styles.quantityButton}
                >
                  <Text style={styles.quantityText}>+</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalLabel}>{formatPrice(total)}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCart, setLoadingCart] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(`Unable to check sign-in: ${sessionError.message}`);
      setSession(data.session);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void supabase
      .from("products")
      .select("id,slug,name,description,category,price_minor,emoji")
      .eq("is_available", true)
      .order("sort_order")
      .then(({ data, error: productsError }) => {
        if (!active) return;
        if (productsError) {
          setError(`Unable to load the menu: ${productsError.message}`);
        } else {
          setProducts((data ?? []) as Product[]);
        }
        setLoadingProducts(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadCart = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) {
      setCart([]);
      return;
    }

    setLoadingCart(true);
    const { data, error: cartError } = await supabase
      .from("cart_items")
      .select(
        "product_id,quantity,products!inner(id,slug,name,description,category,price_minor,emoji)",
      )
      .eq("user_id", userId);
    if (cartError) {
      setError(`Unable to load your shared cart: ${cartError.message}`);
    } else {
      const rows = (data ?? []) as unknown as CartRow[];
      setCart(rows.map((row) => ({ product: row.products, quantity: row.quantity })));
      setError(null);
    }
    setLoadingCart(false);
  }, [session?.user.id]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      setCart([]);
      return;
    }

    void loadCart();
    const channel = supabase
      .channel(`mobile-cart:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cart_items",
          filter: `user_id=eq.${userId}`,
        },
        () => void loadCart(),
      )
      .subscribe((status, subscriptionError) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setError(
            `Live cart updates are unavailable${subscriptionError?.message ? `: ${subscriptionError.message}` : "."}`,
          );
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadCart, session?.user.id]);

  async function signInWithGoogle() {
    setError(null);
    setBusy(true);
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (oauthError) throw oauthError;
      if (!data.url) throw new Error("Supabase did not return an OAuth URL.");

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success") return;

      const callbackUrl = new URL(result.url);
      const oauthDescription = callbackUrl.searchParams.get("error_description");
      if (oauthDescription) throw new Error(oauthDescription);
      const code = callbackUrl.searchParams.get("code");
      if (!code) {
        throw new Error("Google sign-in returned without an authorization code.");
      }

      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
    } catch (signInError) {
      setError(
        `Google sign-in failed: ${signInError instanceof Error ? signInError.message : String(signInError)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) setError(`Unable to sign out: ${signOutError.message}`);
    } catch (signOutError) {
      setError(
        `Unable to sign out: ${signOutError instanceof Error ? signOutError.message : String(signOutError)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function setProductQuantity(product: Product, quantity: number) {
    const userId = session?.user.id;
    if (!userId) {
      setError("Sign in with your Google account to use a shared cart.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const result =
        quantity <= 0
          ? await supabase
              .from("cart_items")
              .delete()
              .eq("user_id", userId)
              .eq("product_id", product.id)
          : await supabase.from("cart_items").upsert(
              {
                user_id: userId,
                product_id: product.id,
                quantity: Math.min(quantity, 20),
              },
              { onConflict: "user_id,product_id" },
            );
      await loadCart();
      if (result.error) {
        setError(`Unable to save your cart change: ${result.error.message}`);
      }
    } catch (cartError) {
      setError(
        `Unable to save your cart change: ${cartError instanceof Error ? cartError.message : String(cartError)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.product.price_minor * item.quantity,
        0,
      ),
    [cart],
  );
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <SafeAreaProvider>
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>DAISY FOODZ</Text>
            <Text style={styles.tagline}>Good food, good mood.</Text>
          </View>
          {session ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void signOut()}
              style={styles.accountButton}
            >
              <Text style={styles.accountButtonText}>Sign out</Text>
            </Pressable>
          ) : null}
        </View>

        {session && (
          <View style={styles.userBanner}>
            <Text style={styles.userText}>
              Signed in as {session.user.email ?? session.user.id}
            </Text>
          </View>
        )}
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}

        <View style={styles.navigation}>
          <NavigationContainer>
            <Tab.Navigator
              screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: "#276b45",
                tabBarInactiveTintColor: "#6b716c",
                tabBarStyle: {
                  backgroundColor: "#fbfaf6",
                  borderTopColor: "#edede7",
                  paddingTop: 6,
                  paddingBottom: 8,
                },
              }}
            >
              <Tab.Screen name="Menu">
                {() => (
                  <MenuScreen
                    products={products}
                    loading={loadingProducts}
                    busy={busy}
                    session={session}
                    onAdd={(product) => {
                      const quantity =
                        cart.find((item) => item.product.id === product.id)
                          ?.quantity ?? 0;
                      void setProductQuantity(product, quantity + 1);
                    }}
                  />
                )}
              </Tab.Screen>
              <Tab.Screen
                name="Cart"
                options={{ tabBarBadge: cartCount || undefined }}
              >
                {() => (
                  <CartScreen
                    session={session}
                    loading={loadingCart}
                    cart={cart}
                    busy={busy}
                    total={total}
                    onSetQuantity={(product, quantity) =>
                      void setProductQuantity(product, quantity)
                    }
                  />
                )}
              </Tab.Screen>
            </Tab.Navigator>
          </NavigationContainer>
        </View>

        {!session && (
          <View style={styles.loginPanel}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void signInWithGoogle()}
              style={[styles.loginButton, busy && styles.disabled]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Continue with Google</Text>
              )}
            </Pressable>
            <Text selectable style={styles.redirectText}>
              Supabase mobile redirect URL: {redirectTo}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fbfaf6" },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { color: "#276b45", fontSize: 17, fontWeight: "800", letterSpacing: 1.5 },
  tagline: { color: "#6b716c", fontSize: 13, marginTop: 4 },
  accountButton: { borderColor: "#276b45", borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 13 },
  accountButtonText: { color: "#276b45", fontWeight: "700" },
  navigation: { flex: 1 },
  userBanner: { marginHorizontal: 20, marginTop: 12, padding: 10, backgroundColor: "#edf4ed", borderRadius: 10 },
  userText: { color: "#276b45", fontSize: 12 },
  error: { marginHorizontal: 20, marginTop: 12, color: "#a32c24", fontSize: 13 },
  content: { padding: 20, paddingBottom: 30, gap: 12 },
  heading: { color: "#252923", fontSize: 24, fontWeight: "800", marginBottom: 4 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#edede7" },
  productEmoji: { fontSize: 29 },
  productCopy: { flex: 1, gap: 4 },
  productName: { color: "#252923", fontSize: 15, fontWeight: "700" },
  description: { color: "#6b716c", fontSize: 12, lineHeight: 17 },
  price: { color: "#276b45", fontSize: 13, fontWeight: "700" },
  addButton: { backgroundColor: "#276b45", paddingVertical: 9, paddingHorizontal: 13, borderRadius: 18 },
  addButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  signInPrompt: { color: "#6b716c", fontSize: 13, lineHeight: 19, marginTop: 2 },
  quantityControl: { flexDirection: "row", alignItems: "center", gap: 12 },
  quantityButton: { minWidth: 30, minHeight: 32, alignItems: "center", justifyContent: "center", backgroundColor: "#edf4ed", borderRadius: 16 },
  quantityText: { color: "#276b45", fontWeight: "700", fontSize: 15 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, paddingTop: 8 },
  totalLabel: { color: "#252923", fontWeight: "800", fontSize: 16 },
  loginPanel: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: "#edede7" },
  loginButton: { minHeight: 48, backgroundColor: "#252923", borderRadius: 24, justifyContent: "center", alignItems: "center" },
  loginButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  redirectText: { color: "#777d77", fontSize: 10, lineHeight: 15, marginTop: 8, textAlign: "center" },
});
