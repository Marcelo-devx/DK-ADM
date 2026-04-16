import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError, getEventLabel } from "@/utils/error-translator";

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
}

// Define the pipeline steps per payment method
function getPipelineTemplate(paymentMethod: string): Array<{ key: string; label: string; icon: string; eventTypes: string[] }> {
  const method = (paymentMethod ?? "").toLowerCase();

  if (method.includes("pix")) {
    return [
      { key: "order_created", label: "Pedido Criado", icon: "📦", eventTypes: ["order_created"] },
      { key: "n8n_notified", label: "N8N Notificado", icon: "🔔", eventTypes: ["n8n_webhook", "n8n_order_created", "webhook_sent"] },
      { key: "pix_generated", label: "PIX Gerado", icon: "💰", eventTypes: ["pix_generated", "mercadopago_payment"] },
      { key: "payment_confirmed", label: "Pagamento Confirmado", icon: "✅", eventTypes: ["pix_payment_confirmed", "order_updated"] },
      { key: "email_sent", label: "E-mail Enviado", icon: "📬", eventTypes: ["email_sent"] },
    ];
  }

  if (method.includes("cartão") || method.includes("cartao") || method.includes("card") || method.includes("crédito") || method.includes("credito")) {
    return [
      { key: "order_created", label: "Pedido Criado", icon: "📦", eventTypes: ["order_created"] },
      { key: "n8n_notified", label: "N8N Notificado", icon: "🔔", eventTypes: ["n8n_webhook", "n8n_order_created", "webhook_sent"] },
      { key: "mp_processing", label: "MP Processando", icon: "💳", eventTypes: ["card_payment_initiated", "mercadopago_payment"] },
      { key: "payment_result", label: "Resultado Pagamento", icon: "🏦", eventTypes: ["card_payment_approved", "card_payment_rejected", "mercadopago_webhook"] },
      { key: "email_sent", label: "E-mail Enviado", icon: "📬", eventTypes: ["email_sent"] },
    ];
  }

  if (method.includes("crypto") || method.includes("cripto")) {
    return [
      { key: "order_created", label: "Pedido Criado", icon: "📦", eventTypes: ["order_created"] },
      { key: "n8n_notified", label: "N8N Notificado", icon: "🔔", eventTypes: ["n8n_webhook", "n8n_order_created", "webhook_sent"] },
      { key: "crypto_pending", label: "Aguardando Crypto", icon: "🪙", eventTypes: ["crypto_payment"] },
      { key: "payment_confirmed", label: "Confirmado", icon: "✅", eventTypes: ["order_updated"] },
      { key: "email_sent", label: "E-mail Enviado", icon: "📬", eventTypes: ["email_sent"] },
    ];
  }

  // Generic fallback
  return [
    { key: "order_created", label: "Pedido Criado", icon: "📦", eventTypes: ["order_created"] },
    { key: "n8n_notified", label: "N8N Notificado", icon: "🔔", eventTypes: ["n8n_webhook", "n8n_order_created", "webhook_sent"] },
    { key: "payment", label: "Pagamento", icon: "💰", eventTypes: ["mercadopago_payment", "pix_generated", "card_payment_initiated"] },
    { key: "payment_confirmed", label: "Confirmado", icon: "✅", eventTypes: ["order_updated", "pix_payment_confirmed", "card_payment_approved"] },
    { key: "email_sent", label: "E-mail Enviado", icon: "📬", eventTypes: ["email_sent"] },
  ];
}

function buildPipeline(
  order: any,
  logs: any[]
): PipelineStep[] {
  const template = getPipelineTemplate(order.payment_method ?? "");
  const orderLogs = logs.filter((log) => {
    // Match by order_id inside payload JSONB or by a direct order_id field
    const payload = log.payload;
    if (!payload) return false;
    const id = payload?.data?.id ?? payload?.order_id ?? payload?.id;
    return String(id) === String(order.id);
  });

  return template.map((step) => {
    // Find the most recent log matching this step's event types
    const matchingLogs = orderLogs
      .filter((log) => step.eventTypes.includes(log.event_type))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const latestLog = matchingLogs[0];

    if (!latestLog) {
      // Special case: order_created step — if the order exists, it was created
      if (step.key === "order_created") {
        return {
          key: step.key,
          label: step.label,
          icon: step.icon,
          status: "success" as PipelineStepStatus,
          timestamp: order.created_at,
        };
      }
      return {
        key: step.key,
        label: step.label,
        icon: step.icon,
        status: "pending" as PipelineStepStatus,
      };
    }

    if (latestLog.status === "error") {
      const translated = translateError(
        latestLog.event_type,
        latestLog.response_code,
        latestLog.details
      );
      return {
        key: step.key,
        label: step.label,
        icon: step.icon,
        status: "error" as PipelineStepStatus,
        timestamp: latestLog.created_at,
        responseCode: latestLog.response_code,
        rawDetails: latestLog.details,
        rawPayload: latestLog.payload,
        eventType: latestLog.event_type,
        translatedError: translated,
      };
    }

    return {
      key: step.key,
      label: step.label,
      icon: step.icon,
      status: "success" as PipelineStepStatus,
      timestamp: latestLog.created_at,
      responseCode: latestLog.response_code,
      rawDetails: latestLog.details,
      rawPayload: latestLog.payload,
      eventType: latestLog.event_type,
    };
  });
}

export function useOrderHealth(limit = 50) {
  return useQuery({
    queryKey: ["orderHealth", limit],
    queryFn: async (): Promise<OrderHealthEntry[]> => {
      // Fetch recent orders
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, created_at, user_id, total_price, payment_method, status, guest_email, shipping_address")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (ordersError) throw ordersError;
      if (!orders || orders.length === 0) return [];

      // Fetch integration logs for these orders
      // Logs store order_id inside payload->data->id
      const { data: logs, error: logsError } = await supabase
        .from("integration_logs")
        .select("id, created_at, event_type, status, response_code, details, payload")
        .order("created_at", { ascending: false })
        .limit(500);

      if (logsError) throw logsError;

      const allLogs = logs ?? [];

      // Fetch profiles for customer names
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

      return orders.map((order) => {
        const profile = profileMap.get(order.user_id);
        const addr = order.shipping_address as any;
        const customerName =
          profile
            ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Cliente"
            : addr?.full_name ?? addr?.name ?? order.guest_email ?? "Cliente";

        const steps = buildPipeline(order, allLogs);
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
        };
      });
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });
}

export function useOrderHealthErrorCount() {
  return useQuery({
    queryKey: ["orderHealthErrorCount"],
    queryFn: async (): Promise<number> => {
      const { data: logs, error } = await supabase
        .from("integration_logs")
        .select("id, payload")
        .eq("status", "error")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      // Count distinct order IDs with errors in last 24h
      const orderIds = new Set(
        (logs ?? [])
          .map((l) => l.payload?.data?.id ?? l.payload?.order_id)
          .filter(Boolean)
      );
      return orderIds.size;
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });
}
