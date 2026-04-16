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
  // if true, infer success from order status values
  impliedByOrderStatus?: string[];
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
        impliedByOrderExistence: true,
      },
      {
        // N8N is notified via the order_created event (same trigger).
        // We show it as a separate node but feed it from the same logs.
        // If there's a log with status sent/success → green.
        // If no log but order exists → "Sem registro" (warning, not error).
        key: "n8n_notified",
        label: "N8N Notificado",
        icon: "🔔",
        eventTypes: ["order_created"],
      },
      {
        key: "pix_generated",
        label: "PIX Gerado",
        icon: "💰",
        eventTypes: ["mercadopago_preference", "mercadopago_payment_attempt", "mercadopago_notification"],
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
        impliedByOrderStatus: ["pago", "finaliz", "entregue"],
      },
      {
        key: "order_paid",
        label: "Pedido Pago",
        icon: "🎉",
        eventTypes: ["order_paid", "order_delivered", "api_payment_confirmed"],
        impliedByOrderStatus: ["pago", "finaliz", "entregue"],
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
        key: "n8n_notified",
        label: "N8N Notificado",
        icon: "🔔",
        eventTypes: ["order_created"],
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
        impliedByOrderStatus: ["pago", "finaliz", "entregue"],
      },
      {
        key: "order_finalized",
        label: "Pedido Finalizado",
        icon: "🎉",
        eventTypes: ["order_paid", "order_delivered"],
        impliedByOrderStatus: ["finaliz", "entregue"],
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
        key: "n8n_notified",
        label: "N8N Notificado",
        icon: "🔔",
        eventTypes: ["order_created"],
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
        impliedByOrderStatus: ["pago", "finaliz"],
      },
      {
        key: "order_finalized",
        label: "Finalizado",
        icon: "🎉",
        eventTypes: ["order_delivered"],
        impliedByOrderStatus: ["finaliz", "entregue"],
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
      key: "n8n_notified",
      label: "N8N Notificado",
      icon: "🔔",
      eventTypes: ["order_created"],
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
      impliedByOrderStatus: ["pago", "finaliz", "entregue"],
    },
    {
      key: "order_paid",
      label: "Pedido Pago",
      icon: "🎉",
      eventTypes: ["order_paid", "order_delivered"],
      impliedByOrderStatus: ["pago", "finaliz", "entregue"],
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the pipeline for a single order
// ─────────────────────────────────────────────────────────────────────────────
function buildPipeline(order: any, orderLogs: any[]): PipelineStep[] {
  const template = getPipelineTemplate(order.payment_method ?? "");
  const orderStatus = (order.status ?? "").toLowerCase();

  return template.map((step): PipelineStep => {
    // Find all logs matching this step's event types
    const matchingLogs = orderLogs
      .filter((log) => step.eventTypes.includes(log.event_type))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

    const latestLog = matchingLogs[0];

    // ── Special: "Pedido Criado" — always green if order exists ──────────
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

    // ── Special: "N8N Notificado" — fed by order_created logs ────────────
    // The order_created event IS the N8N notification trigger.
    // If we have a sent/success log → green.
    // If no log at all → warning (no record, but may have happened).
    if (step.key === "n8n_notified") {
      if (latestLog) {
        const s = mapLogStatus(latestLog.event_type, latestLog.status);
        if (s === "error") {
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
        // sent / success / processing → green (it fired)
        return {
          key: step.key,
          label: step.label,
          icon: step.icon,
          status: "success",
          timestamp: latestLog.created_at,
          rawDetails: latestLog.details,
          rawPayload: latestLog.payload,
          eventType: latestLog.event_type,
          logStatus: latestLog.status,
        };
      }
      // No log — show as warning: "Sem registro de disparo"
      return {
        key: step.key,
        label: step.label,
        icon: step.icon,
        status: "warning",
        logStatus: "no_log",
      };
    }

    // ── Infer from order status ───────────────────────────────────────────
    if (step.impliedByOrderStatus) {
      const matchesStatus = step.impliedByOrderStatus.some((s) =>
        orderStatus.includes(s)
      );
      if (matchesStatus && !latestLog) {
        return {
          key: step.key,
          label: step.label,
          icon: step.icon,
          status: "success",
          timestamp: order.created_at,
          logStatus: "implied_by_status",
        };
      }
    }

    // ── No log found ──────────────────────────────────────────────────────
    if (!latestLog) {
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