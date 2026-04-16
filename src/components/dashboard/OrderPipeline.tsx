import { useState } from "react";
import { ChevronDown, ChevronUp, CreditCard, QrCode, Bitcoin, Banknote, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PipelineNode } from "./PipelineNode";
import { OrderHealthEntry } from "@/hooks/useOrderHealth";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";

interface OrderPipelineProps {
  entry: OrderHealthEntry;
  defaultExpanded?: boolean;
}

function PaymentMethodIcon({ method }: { method: string }) {
  const m = method.toLowerCase();
  if (m.includes("pix")) return <QrCode className="w-3.5 h-3.5 text-teal-600" />;
  if (m.includes("cartão") || m.includes("cartao") || m.includes("card") || m.includes("crédito")) return <CreditCard className="w-3.5 h-3.5 text-blue-600" />;
  if (m.includes("crypto") || m.includes("cripto")) return <Bitcoin className="w-3.5 h-3.5 text-yellow-600" />;
  return <Banknote className="w-3.5 h-3.5 text-gray-500" />;
}

function paymentBadgeClass(method: string) {
  const m = method.toLowerCase();
  if (m.includes("pix")) return "bg-teal-50 text-teal-700 border-teal-200";
  if (m.includes("cartão") || m.includes("cartao") || m.includes("card") || m.includes("crédito")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (m.includes("crypto") || m.includes("cripto")) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrderPipeline({ entry, defaultExpanded = false }: OrderPipelineProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || entry.hasError);
  const [redispatchingStep, setRedispatchingStep] = useState<string | null>(null);

  const handleRedispatch = async (stepKey: string, eventType: string) => {
    setRedispatchingStep(stepKey);
    try {
      const { data: webhooks } = await supabase
        .from("webhook_configs")
        .select("target_url, trigger_event")
        .eq("trigger_event", eventType)
        .eq("is_active", true)
        .limit(1);

      const targetUrl = webhooks?.[0]?.target_url;
      if (!targetUrl) {
        showError("Nenhum webhook configurado para este evento. Configure na página N8N.");
        return;
      }

      const { error } = await supabase.functions.invoke("test-webhook-endpoint", {
        body: {
          url: targetUrl,
          event_type: eventType,
          method: "POST",
          custom_payload: {
            event: eventType,
            timestamp: new Date().toISOString(),
            data: { id: entry.orderId, redispatch: true },
          },
        },
      });

      if (error) throw error;
      showSuccess(`Webhook re-disparado para o pedido #${entry.orderId}!`);
    } catch (e: any) {
      showError(`Falha ao re-disparar: ${e.message}`);
    } finally {
      setRedispatchingStep(null);
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border-2 transition-all duration-200 overflow-hidden",
        entry.hasError
          ? "border-red-400 shadow-red-100 shadow-lg"
          : "border-gray-200 shadow-sm hover:shadow-md"
      )}
    >
      {/* Card header */}
      <button
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 text-left transition-colors",
          entry.hasError ? "bg-red-50 hover:bg-red-100/70" : "bg-white hover:bg-gray-50"
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Error pulse badge */}
          {entry.hasError && (
            <span className="flex-shrink-0 flex items-center gap-1 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              {entry.errorCount > 1 ? `${entry.errorCount} ERROS` : "ERRO"}
            </span>
          )}

          <span className="font-black text-sm text-gray-800">#{entry.orderId}</span>

          <span className="text-sm text-gray-600 truncate hidden sm:block">{entry.customerName}</span>

          <Badge variant="outline" className={cn("text-[10px] flex items-center gap-1 flex-shrink-0", paymentBadgeClass(entry.paymentMethod))}>
            <PaymentMethodIcon method={entry.paymentMethod} />
            {entry.paymentMethod}
          </Badge>

          <span className="font-bold text-sm text-gray-700 flex-shrink-0">{formatCurrency(entry.totalPrice)}</span>

          <span className="text-[10px] text-gray-400 hidden md:block flex-shrink-0">{formatDate(entry.createdAt)}</span>
        </div>

        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] hidden sm:flex",
              entry.status === "Pago" || entry.status === "Entregue"
                ? "bg-green-50 text-green-700 border-green-200"
                : entry.status === "Cancelado"
                ? "bg-gray-100 text-gray-500 border-gray-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            )}
          >
            {entry.status}
          </Badge>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Pipeline steps */}
      {expanded && (
        <div className={cn(
          "px-4 py-5 border-t",
          entry.hasError ? "bg-red-50/30 border-red-200" : "bg-white border-gray-100"
        )}>
          <div className="flex items-start gap-0 overflow-x-auto pb-2">
            {entry.steps.map((step, idx) => (
              <PipelineNode
                key={step.key}
                step={step}
                isLast={idx === entry.steps.length - 1}
                onRedispatch={
                  step.status === "error"
                    ? () => handleRedispatch(step.key, step.eventType ?? "n8n_order_created")
                    : undefined
                }
                isRedispatching={redispatchingStep === step.key}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
