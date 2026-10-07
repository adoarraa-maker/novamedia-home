import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

type CartItem = {
  product_key: string;
  quantity: number;
  variant?: string;
};

type CheckoutBody = {
  operator: "ORANGE_MONEY_BF" | "MOOV_MONEY_BF";
  customer: {
    name: string;
    phone: string;
    area?: string;
  };
  items: CartItem[];
};

type ProductRow = {
  id: string;
  product_key: string;
  name: string;
  stock_quantity: number;
  price_tiers: Array<{ min: number; max: number | null; unit: number; label?: string }>;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CINETPAY_API_KEY = Deno.env.get("CINETPAY_API_KEY") ?? "";
const CINETPAY_SITE_ID = Deno.env.get("CINETPAY_SITE_ID") ?? "";
const CINETPAY_MODE = Deno.env.get("CINETPAY_MODE") ?? "PRODUCTION";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase server configuration is missing.");
  }
  if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
    throw new Error("CinetPay configuration is missing.");
  }
}

function cleanText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 180);
}

function cleanPhone(value: unknown) {
  return String(value ?? "").replace(/[^\d+]/g, "").slice(0, 24);
}

function normalizeBody(body: CheckoutBody) {
  const items = Array.isArray(body.items) ? body.items : [];
  const normalized = items.map((item) => ({
    product_key: cleanText(item.product_key).toLowerCase(),
    quantity: Math.max(1, Math.min(999, Number.parseInt(String(item.quantity), 10) || 1)),
    variant: cleanText(item.variant, "Standard"),
  })).filter((item) => item.product_key);

  if (!normalized.length) throw new Error("Le panier est vide.");
  if (body.operator !== "ORANGE_MONEY_BF" && body.operator !== "MOOV_MONEY_BF") {
    throw new Error("Moyen de paiement non supporté.");
  }

  const customer = {
    name: cleanText(body.customer?.name),
    phone: cleanPhone(body.customer?.phone),
    area: cleanText(body.customer?.area, "Ouagadougou"),
  };
  if (!customer.name) throw new Error("Le nom du client est obligatoire.");
  if (!customer.phone) throw new Error("Le téléphone du client est obligatoire.");

  return { items: normalized, operator: body.operator, customer };
}

function tierFor(product: ProductRow, quantity: number) {
  const tiers = Array.isArray(product.price_tiers) ? product.price_tiers : [];
  const tier = tiers.find((candidate) =>
    quantity >= Number(candidate.min ?? 1) &&
    (candidate.max == null || quantity <= Number(candidate.max))
  );
  if (!tier || typeof tier.unit !== "number") {
    throw new Error(`Prix indisponible pour ${product.product_key}.`);
  }
  return tier;
}

function orderCode() {
  const random = crypto.getRandomValues(new Uint8Array(4));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "DGT-" + Array.from(random).map((byte) => alphabet[byte % alphabet.length]).join("");
}

function transactionId() {
  const random = crypto.getRandomValues(new Uint8Array(5));
  const suffix = Array.from(random).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `DGT-${Date.now()}-${suffix}`;
}

function notifyUrl() {
  return `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/confirm-payment`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    assertEnv();
    const body = normalizeBody(await req.json());
    const productKeys = [...new Set(body.items.map((item) => item.product_key))];

    const { data: products, error: productError } = await supabase
      .from("ecommerce_products")
      .select("id, product_key, name, stock_quantity, price_tiers")
      .in("product_key", productKeys)
      .eq("is_active", true);

    if (productError) throw productError;
    const productByKey = new Map((products ?? []).map((product) => [product.product_key, product as ProductRow]));
    if (productByKey.size !== productKeys.length) {
      throw new Error("Un produit du panier est indisponible.");
    }

    const lines = body.items.map((item) => {
      const product = productByKey.get(item.product_key);
      if (!product) throw new Error(`Produit indisponible: ${item.product_key}`);
      if (product.stock_quantity < item.quantity) {
        throw new Error(`Stock insuffisant pour ${product.name}.`);
      }
      const tier = tierFor(product, item.quantity);
      return {
        product,
        item,
        unit_price: tier.unit,
        line_total: tier.unit * item.quantity,
      };
    });

    const amount = lines.reduce((sum, line) => sum + line.line_total, 0);
    if (amount <= 0) throw new Error("Montant invalide.");

    const txn = transactionId();
    const code = orderCode();
    const { data: order, error: orderError } = await supabase
      .from("ecommerce_orders")
      .insert({
        order_code: code,
        amount,
        currency: "XOF",
        customer_name: body.customer.name,
        customer_phone: body.customer.phone,
        customer_area: body.customer.area,
        payment_operator: body.operator,
        cinetpay_transaction_id: txn,
      })
      .select("id, order_code, amount, currency, cinetpay_transaction_id")
      .single();

    if (orderError) throw orderError;

    const { error: itemError } = await supabase
      .from("ecommerce_order_items")
      .insert(lines.map((line) => ({
        order_id: order.id,
        product_id: line.product.id,
        product_key: line.product.product_key,
        product_name: line.product.name,
        variant: line.item.variant,
        quantity: line.item.quantity,
        unit_price: line.unit_price,
        line_total: line.line_total,
      })));

    if (itemError) throw itemError;

    return jsonResponse({
      order: {
        id: order.id,
        order_code: order.order_code,
        transaction_id: order.cinetpay_transaction_id,
        amount: order.amount,
        currency: order.currency,
        items: lines.map((line) => ({
          product_key: line.product.product_key,
          name: line.product.name,
          variant: line.item.variant,
          quantity: line.item.quantity,
          unit_price: line.unit_price,
          line_total: line.line_total,
        })),
      },
      cinetpay: {
        apiKey: CINETPAY_API_KEY,
        siteId: CINETPAY_SITE_ID,
        mode: CINETPAY_MODE,
        notifyUrl: notifyUrl(),
      },
    });
  } catch (error) {
    console.error(error);
    return errorResponse(error instanceof Error ? error.message : "Checkout failed", 400);
  }
});
