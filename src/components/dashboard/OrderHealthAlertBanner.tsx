import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { OrderHealthEntry } from "@/hooks/useOrderHealth";
import { cn } from "@/lib/utils";

interface OrderHealthAlertBannerProps {
  entries: OrderHealthEntry[];
  onFilterErrors: () => void;
}

export function OrderHealthAlertBanner({ entries, onFilterErrors }: OrderHealthAlertBannerProps) {
  const errorOrders = entries.filter((e) => e.hasError);
  const hasErrors = errorOrders.length > 0;

  if (!hasErrors) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border-2 border-green-300 shadow-sm">
        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-green-800">
            ✅ Todos os pedidos estão saudáveis
          </p>
          <p className="text-xs text-green-600">
            Nenhum erro de integração detectado nos últimos pedidos.
          </p>
        </div>
      </div>
    );
  }

  const criticalOrders = errorOrders.filter((e) =>
    e.steps.some(
      (s) => s.translatedError?.severity === "critical"
    )
  );

  return (
    <div className="rounded-xl border-2 border-red-400 bg-red-50 shadow-lg overflow-hidden">
      {/* Main alert bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-red-500">
        <AlertTriangle className="w-5 h-5 text-white flex-shrink-0 animate-bounce" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white">
            🚨 {errorOrders.length} {errorOrders.length === 1 ? "pedido com erro" : "pedidos com erro"} agora
            {criticalOrders.length > 0 && (
              <span className="ml-2 text-red-100 font-normal">
                ({criticalOrders.length} crítico{criticalOrders.length > 1 ? "s" : ""})
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onFilterErrors}
          className="flex items-center gap-1 text-xs font-bold text-white underline underline-offset-2 hover:text-red-100 flex-shrink-0"
        >
          Ver todos
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Order list */}
      <div className="px-4 py-2 flex flex-wrap gap-2">
        {errorOrders.slice(0, 8).map((e) => {
          const criticalStep = e.steps.find(
            (s) => s.status === "error" && s.translatedError?.severity === "critical"
          );
          const anyErrorStep = e.steps.find((s) => s.status === "error");
          const errorStep = criticalStep ?? anyErrorStep;

          return (
            <div
              key={e.orderId}
              className="flex items-center gap-1.5 bg-white border border-red-200 rounded-lg px-2.5 py-1.5 shadow-sm"
            >
              <span className="text-xs font-black text-red-700">#{e.orderId}</span>
              <span className="text-[10px] text-gray-500">{e.paymentMethod}</span>
              {errorStep?.translatedError && (
                <span className="text-[10px] text-red-600 font-semibold hidden sm:block">
                  · {errorStep.translatedError.title}
                </span>
              )}
            </div>
          );
        })}
        {errorOrders.length > 8 && (
          <div className="flex items-center px-2.5 py-1.5">
            <span className="text-xs text-red-500 font-bold">+{errorOrders.length - 8} mais</span>
          </div>
        )}
      </div>
    </div>
  );
}
