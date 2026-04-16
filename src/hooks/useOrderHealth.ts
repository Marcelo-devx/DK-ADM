import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/utils/error-translator";

export type PipelineStepStatus = "success" | "error" | "pending" | "warning";

export interface PipelineStep {
  key: string;
  label: string;
  icon: string;
  status: PipelineStepStatus;
  timestamp?: string;
  responseCode?: number | null;
  rawDetails?: string | null;
  rawPayload?: any;
  eventType?: string;
  logStatus?: string; // raw status from DB
  translatedError?: {
    title: string;
    description: string;
    suggestion: string;
    severity: "critical" | "warning" | "info";
  };
}

export interface OrderHealthEntry {
  orderId: number;
  customerName: string;
  customerEmail: string | null;
  totalPrice: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  hasError: boolean;
  steps: PipelineStep[];
  errorCount: number;
  rawLogs: any[]; // all logs for this order, for debugging
}

// ─────────────────────────────────────────────────────────────────────────────
// Extract order_id from a log's payload — handles all known structures
// ─────────────────────────────────────────────────────────────────────────────
function extractOrderId(log: any): string | null {
  const p = log.payload;
  if (!p) return null;

  // Structure 1: payload.data.id  (order_created sent/success with full payload)
  if (p?.data?.id != null) return String(p.data.id);

  // Structure 2: payload.payload.order_id  (order_created sending/success with summary)
  if (p?.payload?.order_id != null) return String(p.payload.order_id);

  // Structure 3: payload.order_id  (mercadopago_payment_attempt, api_payment_confirmed)
  if (p?.order_id != null) return String(p.order_id);

  // Structure 4: payload.id  (order_created processing — raw order row)
  if (p?.id != null && typeof p.id === "number") return String(p.id);

  // Structure 5: details contains "Order XXXX" or "Pedido #XXXX"
  const d = log.details ?? "";
  const m = d.match(/(?:Order|Pedido\s*#?)\s*(\d+)/i);
  if (m) return m[1];

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Map a raw log status to a PipelineStepStatus
// ─────────────────────────────────────────────────────────────────────────────
function mapLogStatus(eventType: string, rawStatus: string): PipelineStepStatus {
  const s = (rawStatus ?? "").toLowerCase();

  // Explicit error
  if (s === "error") return "error";

  // Explicit success variants
  if (
    s === "success" ||
    s === "sent" ||
    s === "approved" ||
    s === "processed" ||
    s === "received" ||
    s === "fetched" ||
    s === "authorized"
  )
    return "success";

  // In-progress / intermediate
  if (s === "sending" || s === "processing" || s === "in_process" || s === "trigger_fired")
    return "pending";

  // Rejected / unauthorized → error
  if (s === "rejected" || s === "unauthorized") return "error";

  // Ignored / no_action → warning (not a hard error, but worth noting)
  if (s === "ignored" || s === "no_action") return "warning";

  return "pending";
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline templates per payment method
// Each step lists the event_types that represent it
// ─────────────────────────────────────────────────────────────────────────────
interface StepTemplate {
  key: string;
  label: string;
  icon: string;
  // event_types that map to this step
  eventTypes: string[];
  // if true, this step is considered done just because the order exists (no log needed)
  impliedByOrderExistence?: boolean;
}

function getPipelineTemplate(paymentMethod: string): StepTemplate[] {
  const m = (paymentMethod ?? "").toLowerCase();

  // ── PIX ──────────────────────────────────────────────────────────────────
  if (m.includes("pix")) {
    return [
      {
        key: "order_created",
        label: "Pedido Criado",
        icon: "📦",
        eventTypes: ["order_created"],
        // order_created and N8N notification are the SAME event in this system.
        // The trigger fires, sends to N8N, and logs as order_created.
        // So this single step covers both "order created" AND "N8N notified".
        impliedByOrderExistence: true,
      },
      {
        key: "pix_generated",
        label: "PIX Gerado",
        icon: "💰",
        eventTypes: ["mercadopago_preference", "mercadopago_payment_attempt"],
      },
      {
        key: "payment_confirmed",
        label: "Pagamento Confirmado",
        icon: "✅",
        eventTypes: [
          "mercadopago_payment_processed",
          "api_payment_confirmed",
          "order_paid",
        ],
      },
      {
        key: "order_finalized",
        label: "Pedido Finalizado",
        icon: "🎉",
        eventTypes: ["order_delivered"],
      },
    ];
  }

  // ── CARTÃO ────────────────────────────────────────────────────────────────
  if (
    m.includes("cartão") ||
    m.includes("cartao") ||
    m.includes("card") ||
    m.includes("crédito") ||
    m.includes("credito") ||
    m.includes("mercadopago")
  ) {
    return [
      {
        key: "order_created",
        label: "Pedido Criado",
        icon: "📦",
        eventTypes: ["order_created"],
        impliedByOrderExistence: true,
      },
      {
        key: "mp_processing",
        label: "MP Processando",
        icon: "💳",
        eventTypes: [
          "mercadopago_preference",
          "mercadopago_notification",
          "mercadopago_payment_fetch",
        ],
      },
      {
        key: "payment_result",
        label: "Resultado Pagamento",
        icon: "🏦",
        eventTypes: [
          "mercadopago_payment_attempt",
          "mercadopago_payment_processed",
          "api_payment_confirmed",
        ],
      },
      {
        key: "order_finalized",
        label: "Pedido Finalizado",
        icon: "🎉",
        eventTypes: ["order_paid", "order_delivered"],
      },
    ];
  }

  // ── CRYPTO ────────────────────────────────────────────────────────────────
  if (m.includes("crypto") || m.includes("cripto")) {
    return [
      {
        key: "order_created",
        label: "Pedido Criado",
        icon: "📦",
        eventTypes: ["order_created"],
        impliedByOrderExistence: true,
      },
      {
        key: "crypto_pending",
        label: "Aguardando Crypto",
        icon: "🪙",
        eventTypes: ["crypto_payment"],
      },
      {
        key: "payment_confirmed",
        label: "Confirmado",
        icon: "✅",
        eventTypes: ["api_payment_confirmed", "order_paid"],
      },
      {
        key: "order_finalized",
        label: "Finalizado",
        icon: "🎉",
        eventTypes: ["order_delivered"],
      },
    ];
  }

  // ── GENERIC FALLBACK ──────────────────────────────────────────────────────
  return [
    {
      key: "order_created",
      label: "Pedido Criado",
      icon: "📦",
      eventTypes: ["order_created"],
      impliedByOrderExistence: true,
    },
    {
      key: "payment",
      label: "Pagamento",
      icon: "💰",
      eventTypes: [
        "mercadopago_preference",
        "mercadopago_payment_attempt",
        "mercadopago_notification",
      ],
    },
    {
      key: "payment_confirmed",
      label: "Confirmado",
      icon: "✅",
      eventTypes: [
        "mercadopago_payment_processed",
        "api_payment_confirmed",
        "order_paid",
      ],
    },
    {
      key: "order_finalized",
      label: "Finalizado",
      icon: "🎉",
      eventTypes: ["order_delivered"],
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the pipeline for a single order
// ─────────────────────────────────────────────────────────────────────────────
function buildPipeline(order: any, orderLogs: any[]): PipelineStep[] {
  const template = getPipelineTemplate(order.payment_method ?? "");

  return template.map((step): PipelineStep => {
    // Find all logs matching this step's event types
    const matchingLogs = orderLogs
      .filter((log) => step.eventTypes.includes(log.event_type))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

    const latestLog = matchingLogs[0];

    // ── No log found ──────────────────────────────────────────────────────
    if (!latestLog) {
      // "Pedido Criado" is always green if the order exists
      if (step.impliedByOrderExistence) {
        return {
          key: step.key,
          label: step.label,
          icon: step.icon,
          status: "success",
          timestamp: order.created_at,
          logStatus: "implied",
        };
      }

      // For payment steps: if order status already shows it's paid/finalized,
      // mark as success even without a log
      const orderStatus = (order.status ?? "").toLowerCase();
      if (
        step.key === "payment_confirmed" &&
        (orderStatus.includes("pago") ||
          orderStatus.includes("finaliz") ||
          orderStatus.includes("entregue"))
      ) {
        return {
          key: step.key,
          label: step.label,
          icon: step.icon,
          status: "success",
          timestamp: order.created_at,
          logStatus: "implied_by_status",
        };
      }

      if (
        step.key === "order_finalized" &&
        (orderStatus.includes("finaliz") || orderStatus.includes("entregue"))
      ) {
        return {
          key: step.key,
          label: step.label,
          icon: step.icon,
          status: "success",
          timestamp: order.created_at,
          logStatus: "implied_by_status",
        };
      }

      return {
        key: step.key,
        label: step.label,
        icon: step.icon,
        status: "pending",
      };
    }

    // ── Log found — map its status ────────────────────────────────────────
    const mappedStatus = mapLogStatus(latestLog.event_type, latestLog.status);

    if (mappedStatus === "error") {
      const translated = translateError(
        latestLog.event_type,
        latestLog.response_code,
        latestLog.details
      );
      return {
        key: step.key,
        label: step.label,
        icon: step.icon,
        status: "error",
        timestamp: latestLog.created_at,
        responseCode: latestLog.response_code,
        rawDetails: latestLog.details,
        rawPayload: latestLog.payload,
        eventType: latestLog.event_type,
        logStatus: latestLog.status,
        translatedError: translated,
      };
    }

    return {
      key: step.key,
      label: step.label,
      icon: step.icon,
      status: mappedStatus,
      timestamp: latestLog.created_at,
      responseCode: latestLog.response_code,
      rawDetails: latestLog.details,
      rawPayload: latestLog.payload,
      eventType: latestLog.event_type,
      logStatus: latestLog.status,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main hook
// ─────────────────────────────────────────────────────────────────────────────
export function useOrderHealth(limit = 60) {
  return useQuery({
    queryKey: ["orderHealth", limit],
    queryFn: async (): Promise<OrderHealthEntry[]> => {
      // 1. Fetch recent orders
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(
          "id, created_at, user_id, total_price, payment_method, status, guest_email, shipping_address"
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (ordersError) throw ordersError;
      if (!orders || orders.length === 0) return [];

      // 2. Fetch all integration logs (large batch — covers all orders)
      const { data: logs, error: logsError } = await supabase
        .from("integration_logs")
        .select(
          "id, created_at, event_type, status, response_code, details, payload"
        )
        .order("created_at", { ascending: false })
        .limit(2000);

      if (logsError) throw logsError;
      const allLogs = logs ?? [];

      // 3. Build a map: orderId → logs[]
      const logsByOrder = new Map<string, any[]>();
      for (const log of allLogs) {
        const oid = extractOrderId(log);
        if (!oid) continue;
        if (!logsByOrder.has(oid)) logsByOrder.set(oid, []);
        logsByOrder.get(oid)!.push(log);
      }

      // 4. Fetch profiles for customer names
      const userIds = orders.map((o) => o.user_id).filter(Boolean);
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", userIds);
        profiles = profileData ?? [];
      }
      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      // 5. Build entries
      return orders.map((order): OrderHealthEntry => {
        const profile = profileMap.get(order.user_id);
        const addr = order.shipping_address as any;
        const customerName = profile
          ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
            "Cliente"
          : addr?.full_name ??
            addr?.first_name ??
            order.guest_email ??
            "Cliente";

        const orderLogs = logsByOrder.get(String(order.id)) ?? [];
        const steps = buildPipeline(order, orderLogs);
        const hasError = steps.some((s) => s.status === "error");
        const errorCount = steps.filter((s) => s.status === "error").length;

        return {
          orderId: order.id,
          customerName,
          customerEmail: order.guest_email ?? null,
          totalPrice: Number(order.total_price),
          paymentMethod: order.payment_method ?? "Pix",
          status: order.status,
          createdAt: order.created_at,
          hasError,
          steps,
          errorCount,
          rawLogs: orderLogs,
        };
      });
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Error count for sidebar badge
// ─────────────────────────────────────────────────────────────────────────────
export function useOrderHealthErrorCount() {
  return useQuery({
    queryKey: ["orderHealthErrorCount"],
    queryFn: async (): Promise<number> => {
      const { data: logs, error } = await supabase
        .from("integration_logs")
        .select("id, payload, details")
        .eq("status", "error")
        .gte(
          "created_at",
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        );

      if (error) throw error;

      const orderIds = new Set(
        (logs ?? []).map((l) => extractOrderId(l)).filter(Boolean)
      );
      return orderIds.size;
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });
}
