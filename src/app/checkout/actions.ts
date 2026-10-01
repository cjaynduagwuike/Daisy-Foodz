"use server";

import { createClient } from "@/lib/supabase/server";
import { sendOrderConfirmation } from "@/lib/mailgun";
import type { OrderEmail } from "@/lib/mailgun";

type CheckoutItem = { productId: string; quantity: number };
type CheckoutInput = {
  customerName: string;
  phone: string;
  address: string;
  city: string;
  deliveryNotes: string;
  items: CheckoutItem[];
};

export type CheckoutResult =
  | { status: "error"; message: string; unauthorized?: boolean }
  | {
      status: "success";
      orderId: string;
      emailSent: boolean;
      emailError: string | null;
    };

function isCheckoutItem(value: unknown): value is CheckoutItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.productId === "string" &&
    /^[0-9a-f-]{36}$/i.test(item.productId) &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1 &&
    item.quantity <= 20
  );
}

function validateInput(input: unknown): input is CheckoutInput {
  if (!input || typeof input !== "object") {
    return false;
  }

  const checkout = input as Record<string, unknown>;
  if (
    typeof checkout.customerName !== "string" ||
    typeof checkout.phone !== "string" ||
    typeof checkout.address !== "string" ||
    typeof checkout.city !== "string" ||
    typeof checkout.deliveryNotes !== "string" ||
    !Array.isArray(checkout.items)
  ) {
    return false;
  }
  if (
    !checkout.customerName.trim() ||
    !checkout.phone.trim() ||
    !checkout.address.trim() ||
    !checkout.city.trim() ||
    checkout.customerName.length > 120 ||
    checkout.phone.length > 40 ||
    checkout.address.length > 500 ||
    checkout.city.length > 120 ||
    checkout.deliveryNotes.length > 500
  ) {
    return false;
  }
  if (
    checkout.items.length === 0 ||
    checkout.items.length > 30 ||
    !checkout.items.every(isCheckoutItem)
  ) {
    return false;
  }
  return true;
}

export async function placeOrder(input: unknown): Promise<CheckoutResult> {
  if (!validateInput(input)) {
    return {
      status: "error",
      message:
        "Your delivery details or cart are invalid. Review them and try again.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      status: "error",
      message: "We couldn't verify your sign-in. Check your connection and try again.",
    };
  }
  if (!user?.email) {
    return {
      status: "error",
      message: "Sign in with Google before placing an order.",
      unauthorized: true,
    };
  }

  const { data: orderId, error: orderError } = await supabase.rpc(
    "create_order",
    {
      p_items: input.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      })),
      p_customer_name: input.customerName.trim(),
      p_phone: input.phone.trim(),
      p_address: input.address.trim(),
      p_city: input.city.trim(),
      p_delivery_notes: input.deliveryNotes.trim(),
    } as never,
  );

  if (orderError || !orderId) {
    return {
      status: "error",
      message: orderError
        ? `We couldn't save your order: ${orderError.message}`
        : "We couldn't save your order. Please try again.",
    };
  }

  const { data: linesData, error: linesError } = await supabase
    .from("order_items")
    .select("product_name, quantity, line_total_minor")
    .eq("order_id", orderId);

  if (linesError) {
    return {
      status: "success",
      orderId,
      emailSent: false,
      emailError: "Your order was saved, but its confirmation email could not be prepared. Contact us with your order reference.",
    };
  }

  const lines = (linesData ?? []) as Array<{
    product_name: string;
    quantity: number;
    line_total_minor: number;
  }>;

  const { data: savedOrderData, error: savedOrderError } = await supabase
    .from("orders")
    .select("customer_name, total_minor")
    .eq("id", orderId)
    .single();

  const savedOrder = savedOrderData as
    | {
        customer_name: string;
        total_minor: number;
      }
    | null;

  if (savedOrderError || !savedOrder) {
    return {
      status: "success",
      orderId,
      emailSent: false,
      emailError: "Your order was saved, but its confirmation email could not be prepared. Contact us with your order reference.",
    };
  }

  const email: OrderEmail = {
    orderId,
    customerEmail: user.email,
    customerName: savedOrder.customer_name,
    totalMinor: savedOrder.total_minor,
    items: lines.map((line) => ({
      name: line.product_name,
      quantity: line.quantity,
      lineTotalMinor: line.line_total_minor,
    })),
  };
  const mailResult = await sendOrderConfirmation(email);

  return {
    status: "success",
    orderId,
    emailSent: mailResult.sent,
    emailError: mailResult.sent ? null : mailResult.error,
  };
}
