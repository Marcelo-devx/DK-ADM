import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye, FileDown, CheckCircle2, Pencil, Trash2, Loader2, AlertTriangle, Truck, Clock, Package,
} from "lucide-react";

interface SupplierOrder {
  id: number;
  supplier_name: string;
  created_at: string;
  total_cost: number;
  received_total_cost: number;
  status: string;
  notes?: string | null;
}

interface SupplierOrderMobileCardProps {
  order: SupplierOrder;
  isDownloading: boolean;
  onView: (order: SupplierOrder) => void;
  onDownload: (order: SupplierOrder) => void;
  onReceive: (order: SupplierOrder) => void;
  onEdit: (order: SupplierOrder) => void;
  onDelete: (order: SupplierOrder) => void;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const getStatusConfig = (status: string) => {
  switch (status) {
    case "Pendente":
      return { label: "Pendente", className: "bg-yellow-100 text-yellow-800 border-yellow-300", borderClass: "border-l-yellow-400" };
    case "Recebido":
      return { label: "Recebido", className: "bg-green-100 text-green-800 border-green-300", borderClass: "border-l-green-500" };
    case "Recebido com Divergência":
      return { label: "Divergência", className: "bg-orange-100 text-orange-800 border-orange-300", borderClass: "border-l-orange-500" };
    case "Cancelado":
      return { label: "Cancelado", className: "bg-red-100 text-red-800 border-red-300", borderClass: "border-l-red-400" };
    default:
      return { label: status, className: "bg-gray-100 text-gray-700 border-gray-200", borderClass: "border-l-gray-300" };
  }
};

export const SupplierOrderMobileCard = ({
  order,
  isDownloading,
  onView,
  onDownload,
  onReceive,
  onEdit,
  onDelete,
}: SupplierOrderMobileCardProps) => {
  const statusConfig = getStatusConfig(order.status);
  const isPending = order.status === "Pendente";
  const isProcessed = order.status === "Recebido" || order.status === "Recebido com Divergência";
  const hasDivergence = order.status === "Recebido com Divergência";
  const diff = isProcessed && order.received_total_cost > 0
    ? order.received_total_cost - order.total_cost
    : null;

  return (
    <div
      className={cn(
        "rounded-xl border shadow-sm bg-white mb-2 overflow-hidden transition-all active:scale-[0.99]",
        "border-l-4",
        statusConfig.borderClass
      )}
    >
      {/* Topo: ID + fornecedor + status */}
      <button className="w-full text-left p-3 pb-2" onClick={() => onView(order)}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-mono font-black text-sm text-gray-900">#{order.id}</span>
              <Badge variant="outline" className={cn("text-[10px] px-2 py-0 font-bold border", statusConfig.className)}>
                {hasDivergence && <AlertTriangle className="w-2.5 h-2.5 mr-1" />}
                {statusConfig.label}
              </Badge>
            </div>
            <p className="font-bold text-sm text-gray-800 truncate">{order.supplier_name}</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {new Date(order.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit", month: "short", year: "numeric",
              })}
            </p>
          </div>

          {/* Valores */}
          <div className="text-right shrink-0">
            <p className="text-[9px] font-bold uppercase text-gray-400 leading-none">Total Pedido</p>
            <p className="text-lg font-black text-gray-900">{formatCurrency(order.total_cost)}</p>
            {isProcessed && order.received_total_cost > 0 && (
              <div className="mt-0.5">
                <p className="text-[9px] font-bold uppercase text-gray-400 leading-none">Recebido</p>
                <p className={cn("text-sm font-black", hasDivergence ? "text-orange-600" : "text-green-600")}>
                  {formatCurrency(order.received_total_cost)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Divergência */}
        {diff !== null && Math.abs(diff) > 0.01 && (
          <div className={cn(
            "flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-lg text-xs font-bold",
            diff < 0 ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
          )}>
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Diferença: {diff > 0 ? "+" : ""}{formatCurrency(diff)}
          </div>
        )}

        {/* Observações */}
        {order.notes && (
          <p className="text-[11px] text-muted-foreground mt-1.5 italic truncate">
            📝 {order.notes}
          </p>
        )}
      </button>

      {/* Ações */}
      <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-2">
        {/* Ver detalhes */}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-3 text-primary gap-1.5 text-xs font-semibold"
          onClick={() => onView(order)}
        >
          <Eye className="w-3.5 h-3.5" /> Ver
        </Button>

        {/* PDF */}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-3 text-gray-600 gap-1.5 text-xs font-semibold"
          onClick={() => onDownload(order)}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileDown className="w-3.5 h-3.5" />
          )}
          PDF
        </Button>

        {/* Conferir — só quando Pendente */}
        {isPending && (
          <Button
            size="sm"
            className="h-9 px-3 bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs font-bold ml-auto"
            onClick={() => onReceive(order)}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Conferir
          </Button>
        )}

        {/* Editar — só quando Pendente */}
        {isPending && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 gap-1.5 text-xs font-semibold"
            onClick={() => onEdit(order)}
          >
            <Pencil className="w-3.5 h-3.5" /> Editar
          </Button>
        )}

        {/* Excluir */}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 text-red-500 hover:bg-red-50 ml-auto"
          onClick={() => onDelete(order)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
