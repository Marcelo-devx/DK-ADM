import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, AlertTriangle, Package, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { showSuccess, showError } from "@/utils/toast";

interface SupplierOrderItem {
  id: number;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
  variant_id?: string | null;
  product_id?: number | null;
  variant_name?: string | null;
  products: { name: string } | null;
  product_variants?: {
    id?: string;
    volume_ml?: number | null;
    color?: string | null;
    ohms?: string | null;
    size?: string | null;
    flavors?: { name?: string } | { name?: string }[] | null;
  } | null;
}

interface SupplierOrder {
  id: number;
  supplier_name: string;
  order_date: string;
  total_cost: number;
  received_total_cost: number;
  status: string;
  notes: string | null;
}

interface SupplierOrderDetailModalProps {
  order: SupplierOrder;
  isOpen: boolean;
  onClose: () => void;
}

const fetchSupplierOrderItems = async (orderId: number): Promise<SupplierOrderItem[]> => {
  const { data: itemsData, error: itemsError } = await supabase
    .from("supplier_order_items")
    .select(`id, quantity, received_quantity, unit_cost, variant_id, product_id, variant_name, products(name)`)
    .eq("supplier_order_id", orderId);

  if (itemsError) throw itemsError;
  const items: SupplierOrderItem[] = (itemsData || []) as any;

  if (items.every((it) => it.variant_name && it.variant_name.trim() !== "")) return items;

  const variantIds = Array.from(
    new Set(items.filter((i) => i.variant_id && !i.variant_name).map((i) => i.variant_id))
  ) as string[];

  if (variantIds.length === 0) return items;

  const { data: variantsData } = await supabase
    .from("product_variants")
    .select("id, volume_ml, color, ohms, size, flavors (name)")
    .in("id", variantIds as any);

  const variantsById: Record<string, any> = {};
  (variantsData || []).forEach((v: any) => { variantsById[v.id] = v; });

  return items.map((it) => {
    if (it.variant_name && it.variant_name.trim() !== "") return it;
    return { ...it, product_variants: it.variant_id ? variantsById[it.variant_id] ?? null : null };
  });
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const getDisplayName = (item: SupplierOrderItem): string => {
  if (item.variant_name && item.variant_name.trim() !== "") return item.variant_name;
  let name = item.products?.name || "Produto Removido";
  if (item.product_variants) {
    const v: any = item.product_variants;
    const parts: string[] = [];
    if (v.color) parts.push(v.color);
    if (v.size) parts.push(v.size);
    if (v.ohms) parts.push(`${v.ohms}Ω`);
    const flavor = Array.isArray(v.flavors) ? v.flavors[0]?.name : v.flavors?.name;
    if (flavor) parts.push(flavor);
    const suffix = v.volume_ml ? ` ${v.volume_ml}ml` : "";
    if (parts.length > 0 || suffix) name += ` - ${parts.join(" / ")}${suffix}`;
  }
  return name;
};

export const SupplierOrderDetailModal = ({ order, isOpen, onClose }: SupplierOrderDetailModalProps) => {
  const { data: items, isLoading } = useQuery({
    queryKey: ["supplierOrderItems", order.id],
    queryFn: () => fetchSupplierOrderItems(order.id),
    enabled: isOpen,
  });

  const isProcessed = order.status === "Recebido" || order.status === "Recebido com Divergência";
  const hasDivergence = order.status === "Recebido com Divergência";
  const diffTotal = order.received_total_cost - order.total_cost;

  const handleDownload = () => {
    if (!items || items.length === 0) return;
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(22); doc.setFont("helvetica", "bold");
      doc.text(`PEDIDO AO FORNECEDOR #${order.id}`, 14, 20);
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(80);
      doc.text(`Fornecedor: ${order.supplier_name}`, 14, 28);
      doc.text(`Status: ${order.status}`, 14, 34);
      doc.text(`Data do Pedido: ${new Date(order.order_date).toLocaleDateString("pt-BR")}`, 14, 40);
      if (order.notes) { doc.setFontSize(9); doc.setTextColor(60); doc.text(`Observações: ${order.notes}`, 14, 48, { maxWidth: 260 }); }

      const tableRows = items.map((item) => {
        const displayName = getDisplayName(item);
        const diff = (item.received_quantity || 0) - item.quantity;
        return [
          displayName,
          item.quantity.toString(),
          isProcessed ? item.received_quantity.toString() : "-",
          isProcessed ? (diff === 0 ? "-" : diff > 0 ? `+${diff}` : String(diff)) : "-",
          formatCurrency(item.unit_cost),
          formatCurrency(isProcessed ? item.received_quantity * item.unit_cost : item.quantity * item.unit_cost),
        ];
      });

      autoTable(doc, {
        head: [["Produto / Variação", "Qtd. Pedida", "Qtd. Recebida", "Diferença", "Custo Unit.", "Subtotal"]],
        body: tableRows,
        startY: order.notes ? 56 : 48,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8, overflow: "linebreak", valign: "middle" },
        columnStyles: {
          0: { cellWidth: "auto" }, 1: { cellWidth: 18, halign: "center" },
          2: { cellWidth: 20, halign: "center" }, 3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 34, halign: "right" }, 5: { cellWidth: 34, halign: "right" },
        },
        tableWidth: 269,
        foot: [["", "", "", "", "TOTAL:", formatCurrency(isProcessed ? order.received_total_cost : order.total_cost)]],
        footStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: "bold", fontSize: 9 },
        margin: { top: 50, left: 14, right: 14, bottom: 20 },
      });

      doc.save(`pedido_fornecedor_${order.id}.pdf`);
      showSuccess("PDF gerado com sucesso!");
    } catch (err: any) {
      showError(`Erro ao gerar PDF: ${err.message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl h-[100dvh] md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-none md:rounded-lg">

        {/* Header fixo */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b bg-white shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base md:text-xl flex items-center gap-2">
                Pedido #{order.id}
                {hasDivergence && <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />}
              </DialogTitle>
              <DialogDescription className="text-xs md:text-sm mt-0.5">
                {order.supplier_name} • {new Date(order.order_date).toLocaleDateString("pt-BR")}
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={isLoading} className="shrink-0 gap-1.5 text-xs h-9">
              <FileDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Baixar PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </div>

          {/* Resumo de valores no header */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase text-gray-400 leading-none">Total Pedido</span>
              <span className="text-sm font-black text-gray-800">{formatCurrency(order.total_cost)}</span>
            </div>
            {isProcessed && order.received_total_cost > 0 && (
              <>
                <div className="w-px h-6 bg-gray-200" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase text-gray-400 leading-none">Recebido</span>
                  <span className={cn("text-sm font-black", hasDivergence ? "text-orange-600" : "text-green-600")}>
                    {formatCurrency(order.received_total_cost)}
                  </span>
                </div>
                {Math.abs(diffTotal) > 0.01 && (
                  <>
                    <div className="w-px h-6 bg-gray-200" />
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold uppercase text-gray-400 leading-none">Diferença</span>
                      <span className={cn("text-sm font-black flex items-center gap-1", diffTotal < 0 ? "text-red-600" : "text-blue-600")}>
                        {diffTotal < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        {diffTotal > 0 ? "+" : ""}{formatCurrency(diffTotal)}
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </DialogHeader>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto">

          {/* Alerta de divergência */}
          {isProcessed && Math.abs(diffTotal) > 0.01 && (
            <div className="mx-4 mt-3 p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-orange-800 text-sm">Divergência Detectada</p>
                <p className="text-xs text-orange-700 mt-0.5">
                  O valor recebido foi <strong>{formatCurrency(Math.abs(diffTotal))}</strong>{" "}
                  {diffTotal < 0 ? "menor" : "maior"} que o pedido. Use o PDF para contestação.
                </p>
              </div>
            </div>
          )}

          {/* Observações */}
          {order.notes && (
            <div className="mx-4 mt-3 p-3 bg-gray-50 rounded-xl border text-sm text-muted-foreground italic">
              📝 {order.notes}
            </div>
          )}

          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              {/* ── MOBILE: Cards de itens ── */}
              <div className="md:hidden p-3 space-y-2 mt-1">
                {items?.map((item) => {
                  const displayName = getDisplayName(item);
                  const diff = (item.received_quantity || 0) - item.quantity;
                  const hasDiff = isProcessed && diff !== 0;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-xl border bg-white p-3 shadow-sm",
                        hasDiff && diff < 0 && "border-l-4 border-l-red-400",
                        hasDiff && diff > 0 && "border-l-4 border-l-blue-400"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-semibold text-sm text-gray-900 leading-tight flex-1">{displayName}</p>
                        <span className="text-sm font-black text-primary shrink-0">
                          {formatCurrency(item.unit_cost)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-bold uppercase text-gray-400 leading-none">Pedido</span>
                          <span className="text-sm font-bold text-gray-700">{item.quantity}</span>
                        </div>

                        {isProcessed && (
                          <>
                            <div className="w-px h-6 bg-gray-200" />
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] font-bold uppercase text-gray-400 leading-none">Chegou</span>
                              <span className={cn("text-sm font-bold", diff < 0 ? "text-red-600" : diff > 0 ? "text-blue-600" : "text-green-600")}>
                                {item.received_quantity}
                              </span>
                            </div>
                            {diff !== 0 && (
                              <>
                                <div className="w-px h-6 bg-gray-200" />
                                <div className="flex flex-col items-center">
                                  <span className="text-[9px] font-bold uppercase text-gray-400 leading-none">Dif.</span>
                                  <span className={cn("text-sm font-black", diff < 0 ? "text-red-600" : "text-blue-600")}>
                                    {diff > 0 ? `+${diff}` : diff}
                                  </span>
                                </div>
                              </>
                            )}
                          </>
                        )}

                        <div className="ml-auto">
                          <span className="text-[9px] font-bold uppercase text-gray-400 leading-none block text-right">Subtotal</span>
                          <span className="text-sm font-bold text-gray-700">
                            {formatCurrency(
                              isProcessed
                                ? item.received_quantity * item.unit_cost
                                : item.quantity * item.unit_cost
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── DESKTOP: Tabela ── */}
              <div className="hidden md:block mx-4 mt-4 border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd. Pedida</TableHead>
                      {isProcessed && <TableHead className="text-center">Qtd. Chegou</TableHead>}
                      {isProcessed && <TableHead className="text-center">Diferença</TableHead>}
                      <TableHead className="text-right">Custo Unit.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items?.map((item) => {
                      const displayName = getDisplayName(item);
                      const diff = (item.received_quantity || 0) - item.quantity;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{displayName}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          {isProcessed && (
                            <TableCell className={cn("text-center font-bold", diff < 0 ? "text-red-600" : "text-green-600")}>
                              {item.received_quantity}
                            </TableCell>
                          )}
                          {isProcessed && (
                            <TableCell className={cn("text-center font-bold", diff < 0 ? "text-red-600" : "")}>
                              {diff === 0 ? "-" : diff > 0 ? `+${diff}` : diff}
                            </TableCell>
                          )}
                          <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Totais */}
          <div className="mx-4 mt-4 mb-6 p-4 bg-gray-50 rounded-xl border space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor Original do Pedido:</span>
              <span className="font-medium">{formatCurrency(order.total_cost)}</span>
            </div>
            {isProcessed && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor Real Recebido:</span>
                <span className="font-bold text-primary">{formatCurrency(order.received_total_cost)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm">Total Final:</span>
              <span className="text-2xl font-black text-primary">
                {formatCurrency(isProcessed ? order.received_total_cost : order.total_cost)}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
