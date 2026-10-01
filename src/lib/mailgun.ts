export type MailResult =
  | { sent: true }
  | { sent: false; error: string };

export type OrderEmail = {
  orderId: string;
  customerEmail: string;
  customerName: string;
  totalMinor: number;
  items: Array<{ name: string; quantity: number; lineTotalMinor: number }>;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function formatNaira(minorUnits: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(minorUnits / 100);
}

export async function sendOrderConfirmation(
  order: OrderEmail,
): Promise<MailResult> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM_EMAIL;

  if (!apiKey || !domain || !from) {
    return {
      sent: false,
      error:
        "Order saved, but email is not configured. Set MAILGUN_API_KEY, MAILGUN_DOMAIN, and MAILGUN_FROM_EMAIL.",
    };
  }

  const url = `https://api.mailgun.net/v3/${encodeURIComponent(domain)}/messages`;
  const rows = order.items
    .map(
      (item) =>
        `<li>${escapeHtml(item.name)} × ${item.quantity}: ${formatNaira(item.lineTotalMinor)}</li>`,
    )
    .join("");
  const subject = `Daisy Foodz order confirmation ${order.orderId.slice(0, 8)}`;
  const text = [
    `Hi ${order.customerName},`,
    "",
    "Thanks for your order. We have received it and will deliver it to the address you provided.",
    ...order.items.map(
      (item) => `${item.name} × ${item.quantity}: ${formatNaira(item.lineTotalMinor)}`,
    ),
    `Total: ${formatNaira(order.totalMinor)}`,
    `Order reference: ${order.orderId}`,
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(order.customerName)},</p><p>Thanks for your order. We have received it and will deliver it to the address you provided.</p><ul>${rows}</ul><p><strong>Total: ${formatNaira(order.totalMinor)}</strong></p><p>Order reference: ${escapeHtml(order.orderId)}</p>`;
  const body = new URLSearchParams({
    from,
    to: order.customerEmail,
    subject,
    text,
    html,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        sent: false,
        error: `Order saved, but Mailgun rejected the confirmation email (HTTP ${response.status}).`,
      };
    }
  } catch {
    return {
      sent: false,
      error: "Order saved, but Mailgun could not be reached to send the confirmation email.",
    };
  }

  return { sent: true };
}
