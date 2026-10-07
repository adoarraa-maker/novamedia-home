import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

type CinetPayCheckResponse = {
  code?: string;
  message?: string;
  data?: {
    status?: string;
    amount?: string | number;
    currency?: string;
    payment_method?: string;
    operator_id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CINETPAY_API_KEY = Deno.env.get("CINETPAY_API_KEY") ?? "";
const CINETPAY_SITE_ID = Deno.env.get("CINETPAY_SITE_ID") ?? "";
const CINETPAY_CHECK_URL = "https://api-checkout.cinetpay.com/v2/payment/check";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase server configuration is missing.");
  }
  if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
    throw new Error("CinetPay configuration is missing.");
  }
}

async function parseBody(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return await req.json();
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    return Object.fromEntries(form.entries());
  }
  const text = await req.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (_error) {
    return {};
  }
}

function transactionFrom(body: Record<string, unknown>) {
  return String(
    body.transaction_id ||
      body.cpm_trans_id ||
      body.cpm_trans_id_payment ||
      body.cinetpay_transaction_id ||
      "",
  ).trim();
}

function accepted(status: unknown) {
  return String(status || "").toUpperCase() === "ACCEPTED";
}

async function checkCinetPay(transactionId: string): Promise<CinetPayCheckResponse> {
  const response = await fetch(CINETPAY_CHECK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: CINETPAY_API_KEY,
      site_id: CINETPAY_SITE_ID,
      transaction_id: transactionId,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || "CinetPay verification failed.");
  }
  return body;
}

async function orderItems(orderId: string) {
  const { data, error } = await supabase
    .from("ecommerce_order_items")
    .select("product_key, product_name, variant, quantity, unit_price, line_total")
    .eq("order_id", orderId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
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
    const body = await parseBody(req);
    const transactionId = transactionFrom(body);
    if (!transactionId) throw new Error("Missing CinetPay transaction id.");

    const { data: order, error: orderError } = await supabase
      .from("ecommerce_orders")
      .select("id, order_code, amount, currency, status, payment_operator, cinetpay_transaction_id")
      .eq("cinetpay_transaction_id", transactionId)
      .single();

    if (orderError || !order) throw new Error("Commande introuvable.");

    const verification = await checkCinetPay(transactionId);
    const payment = verification.data || {};
    const amount = Number(payment.amount ?? order.amount);
    if (amount !== Number(order.amount)) {
      throw new Error("Montant CinetPay différent de la commande.");
    }

    if (!accepted(payment.status)) {
      if (String(payment.status || "").toUpperCase() === "REFUSED") {
        await supabase
          .from("ecommerce_orders")
          .update({ status: "failed", cinetpay_payload: verification })
          .eq("id", order.id)
          .eq("status", "pending");
      }
      return jsonResponse({
        ok: false,
        status: payment.status || "PENDING",
        message: verification.message || "Paiement non encore validé.",
      }, 202);
    }

    const { data: paidOrder, error: finalizeError } = await supabase.rpc("finalize_paid_order", {
      p_order_id: order.id,
      p_transaction_id: transactionId,
      p_cinetpay_payload: verification,
    });

    if (finalizeError) throw finalizeError;

    return jsonResponse({
      ok: true,
      order: {
        id: paidOrder.id,
        order_code: paidOrder.order_code,
        transaction_id: paidOrder.cinetpay_transaction_id,
        amount: paidOrder.amount,
        currency: paidOrder.currency,
        status: paidOrder.status,
        paid_at: paidOrder.paid_at,
        payment_operator: paidOrder.payment_operator,
        items: await orderItems(order.id),
      },
      cinetpay: verification,
    });
  } catch (error) {
    console.error(error);
    return errorResponse(error instanceof Error ? error.message : "Payment confirmation failed", 400);
  }
});
