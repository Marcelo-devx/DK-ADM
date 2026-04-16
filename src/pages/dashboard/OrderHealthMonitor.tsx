import { useState, useEffect, useRef } from "react";
import { Activity, RefreshCw, Search, Filter, AlertTriangle, CheckCircle2, QrCode, CreditCard, Bitcoin, Loader2, HeartPulse } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrderHealth } from "@/hooks/useOrderHealth";
import { OrderPipeline } from "@/components/dashboard/OrderPipeline";
import { OrderHealthAlertBanner } from "@/components/dashboard/OrderHealthAlertBanner";
import { cn } from "@/lib/utils";

type FilterType = "all" | "errors" | "pix" | "card" | "crypto" | "healthy";

const REFRESH_INTERVAL = 15;

export default function OrderHealthMonitor() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const { data: entries = [], isLoading, isFetching, refetch, dataUpdatedAt } = useOrderHealth(60);

  // Countdown timer for auto-refresh indicator
  useEffect(() => {
    setCountdown(REFRESH_INTERVAL);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          return REFRESH_INTERVAL;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [dataUpdatedAt]);

  const handleManualRefresh = () => {
    refetch();
    setCountdown(REFRESH_INTERVAL);
  };

  const handleFilterErrors = () => setFilter("errors");

  // Apply filters
  const filtered = entries.filter((entry) => {
    // Search by order ID or customer name
    if (search) {
      const q = search.toLowerCase();
      const matchId = String(entry.orderId).includes(q);
      const matchName = entry.customerName.toLowerCase().includes(q);
      const matchEmail = (entry.customerEmail ?? "").toLowerCase().includes(q);
      if (!matchId && !matchName && !matchEmail) return false;
    }

    const method = entry.paymentMethod.toLowerCase();

    switch (filter) {
      case "errors":
        return entry.hasError;
      case "healthy":
        return !entry.hasError;
      case "pix":
        return method.includes("pix");
      case "card":
        return method.includes("cartão") || method.includes("cartao") || method.includes("card") || method.includes("crédito");
      case "crypto":
        return method.includes("crypto") || method.includes("cripto");
      default:
        return true;
    }
  });

  // Sort: errors first
  const sorted = [...filtered].sort((a, b) => {
    if (a.hasError && !b.hasError) return -1;
    if (!a.hasError && b.hasError) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const errorCount = entries.filter((e) => e.hasError).length;
  const healthyCount = entries.filter((e) => !e.hasError).length;

  return (
    <div className="space-y-5 pb-20">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black flex items-center gap-2 text-gray-900">
          <HeartPulse className="w-7 h-7 text-red-500" />
          Monitor de Pedidos
        </h1>
        <p className="text-sm text-muted-foreground">
          Linha de execução em tempo real para cada pedido — PIX, Cartão, N8N e Mercado Pago.
        </p>
      </div>

      {/* Global alert banner */}
      {!isLoading && (
        <OrderHealthAlertBanner entries={entries} onFilterErrors={handleFilterErrors} />
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por #ID ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: "all", label: "Todos", count: entries.length },
              { key: "errors", label: "🚨 Com Erro", count: errorCount, danger: true },
              { key: "healthy", label: "✅ Saudáveis", count: healthyCount },
              { key: "pix", label: "PIX" },
              { key: "card", label: "Cartão" },
              { key: "crypto", label: "Crypto" },
            ] as Array<{ key: FilterType; label: string; count?: number; danger?: boolean }>
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                filter === f.key
                  ? f.danger
                    ? "bg-red-500 text-white border-red-500 shadow"
                    : "bg-gray-900 text-white border-gray-900 shadow"
                  : f.danger && errorCount > 0
                  ? "bg-red-50 text-red-700 border-red-300 hover:bg-red-100"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              )}
            >
              {f.label}
              {f.count !== undefined && (
                <span className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black",
                  filter === f.key
                    ? "bg-white/20 text-white"
                    : f.danger && errorCount > 0
                    ? "bg-red-200 text-red-800"
                    : "bg-gray-100 text-gray-600"
                )}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <span className="text-[11px] text-gray-400 hidden sm:block">
            Atualiza em <span className="font-bold text-gray-600">{countdown}s</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isFetching}
            className="h-9"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isFetching && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border rounded-xl p-3 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-black text-gray-800">{entries.length}</p>
          <p className="text-[10px] text-gray-400">pedidos monitorados</p>
        </div>
        <div className={cn("border rounded-xl p-3 shadow-sm", errorCount > 0 ? "bg-red-50 border-red-300" : "bg-white")}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Com Erro</p>
          <p className={cn("text-2xl font-black", errorCount > 0 ? "text-red-600" : "text-gray-800")}>{errorCount}</p>
          <p className="text-[10px] text-gray-400">precisam de atenção</p>
        </div>
        <div className="bg-white border rounded-xl p-3 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Saudáveis</p>
          <p className="text-2xl font-black text-green-600">{healthyCount}</p>
          <p className="text-[10px] text-gray-400">sem problemas</p>
        </div>
        <div className="bg-white border rounded-xl p-3 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Taxa de Sucesso</p>
          <p className="text-2xl font-black text-gray-800">
            {entries.length > 0 ? Math.round((healthyCount / entries.length) * 100) : 100}%
          </p>
          <p className="text-[10px] text-gray-400">das integrações</p>
        </div>
      </div>

      {/* Pipeline list */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando pedidos e logs de integração...</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Activity className="w-10 h-10 text-gray-300" />
          <p className="text-base font-bold text-gray-400">Nenhum pedido encontrado</p>
          <p className="text-sm text-gray-400">
            {search ? "Tente outro termo de busca." : "Nenhum pedido corresponde ao filtro selecionado."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((entry) => (
            <OrderPipeline
              key={entry.orderId}
              entry={entry}
              defaultExpanded={entry.hasError}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      {!isLoading && entries.length > 0 && (
        <p className="text-center text-[11px] text-gray-400">
          Exibindo os {entries.length} pedidos mais recentes · Auto-refresh a cada {REFRESH_INTERVAL}s
        </p>
      )}
    </div>
  );
}
