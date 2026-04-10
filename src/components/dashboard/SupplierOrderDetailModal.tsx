import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { FileDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { showSuccess, showError } from "@/utils/toast";

interface SupplierOrderItem {
  id: number;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
  variant_id?: string | null;
  product_id?: number | null;
  variant_name?: string | null;
  products: {
    name: string;
  } | null;
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
  // First fetch the basic items (product info included)
  const { data: itemsData, error: itemsError } = await supabase
    .from("supplier_order_items")
    .select(`id, quantity, received_quantity, unit_cost, variant_id, product_id, variant_name, products(name)`)
    .eq("supplier_order_id", orderId);

  if (itemsError) throw itemsError;

  const items: SupplierOrderItem[] = (itemsData || []) as any;

  // If all items have variant_name, no need to enrich
  if (items.every(it => it.variant_name && it.variant_name.trim() !== '')) {
    return items;
  }

  // Collect variant ids present (only for items without variant_name)
  const variantIds = Array.from(new Set(items.filter(i => i.variant_id && !i.variant_name).map(i => i.variant_id))) as string[];

  if (variantIds.length === 0) {
    return items;
  }

  // Fetch variants by id with ALL fields including color, ohms, size
  const { data: variantsData, error: variantsError } = await supabase
    .from("product_variants")
    .select("id, volume_ml, color, ohms, size, flavors (name)")
    .in("id", variantIds as any);

  if (variantsError) {
    // If we can't fetch variants, return items without variant info but don't fail entire flow
    return items;
  }

  const variantsById: Record<string, any> = {};
  (variantsData || []).forEach((v: any) => {
    variantsById[v.id] = v;
  });

  // Attach variant info to items (only for items without variant_name)
  const enriched = items.map(it => {
    if (it.variant_name && it.variant_name.trim() !== '') {
      return it; // Already has full variant name
    }
    return {
      ...it,
      product_variants: it.variant_id ? variantsById[it.variant_id] ?? null : null,
    };
  });

  return enriched;
};

export const SupplierOrderDetailModal = ({ order, isOpen, onClose }: SupplierOrderDetailModalProps) => {
  const { data: items, isLoading } = useQuery({
    queryKey: ["supplierOrderItems", order.id],
    queryFn: () => fetchSupplierOrderItems(order.id),
    enabled: isOpen,
  });

  const isProcessed = order.status === 'Recebido' || order.status === 'Recebido com Divergência';
  const diffTotal = order.received_total_cost - order.total_cost;
  
  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const handleDownload = () => {
    if (!items || items.length === 0) return;

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      
      // Header - mais profissional em paisagem
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(`PEDIDO AO FORNECEDOR #${order.id}`, 14, 20);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text(`Fornecedor: ${order.supplier_name}`, 14, 28);
      doc.text(`Status: ${order.status}`, 14, 34);
      doc.text(`Data do Pedido: ${new Date(order.order_date).toLocaleDateString("pt-BR")}`, 14, 40);

      if (order.notes) {
          doc.setFontSize(9);
          doc.setTextColor(60);
          doc.text(`Observações: ${order.notes}`, 14, 48, { maxWidth: 260 });
      }

      // Função auxiliar para montar nome completo da variação
      const buildVariantLabel = (v: any): string => {
        if (!v) return '';
        const parts: string[] = [];
        if (v.color)   parts.push(v.color);
        if (v.size)    parts.push(v.size);
        if (v.ohms)    parts.push(`${v.ohms}Ω`);
        const flavor = Array.isArray(v.flavors) ? v.flavors[0]?.name : v.flavors?.name;
        if (flavor)    parts.push(flavor);
        const suffix = v.volume_ml ? ` ${v.volume_ml}ml` : '';
        return parts.length > 0 ? ` - ${parts.join(' / ')}${suffix}` : suffix;
      };

      const tableHeaders = [["Produto / Variação", "Qtd. Pedida", "Qtd. Recebida", "Diferença", "Custo Unit.", "Subtotal Real"]];
      const tableRows = items.map(item => {
        let displayName = item.products?.name || "Produto Removido";
        
        // Se já tem variant_name salvo (mais confiável), usa-o
        if (item.variant_name && item.variant_name.trim() !== '') {
          displayName += ` - ${item.variant_name}`;
        } 
        // Caso contrário, monta usando os dados da variação
        else if (item.product_variants) {
          const v = item.product_variants as any;
          displayName += buildVariantLabel(v);
        }
        
        return [
          displayName,
          item.quantity.toString(),
          isProcessed ? item.received_quantity.toString() : "-",
          isProcessed ? (item.received_quantity - item.quantity).toString() : "-",
          formatCurrency(item.unit_cost),
          formatCurrency(isProcessed ? (item.received_quantity * item.unit_cost) : (item.quantity * item.unit_cost))
        ];
      });

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: order.notes ? 56 : 48,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 100 }, // Produto - mais largo
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 25, halign: 'center' },
          4: { cellWidth: 35, halign: 'right' },
          5: { cellWidth: 35, halign: 'right' }
        },
        foot: [["", "", "", "", "TOTAL:", formatCurrency(isProcessed ? order.received_total_cost : order.total_cost)]],
        footStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 9 },
        margin: { top: 50, left: 14, right: 14, bottom: 20 }
      });

      doc.save(`pedido_fornecedor_${order.id}.pdf`);
      showSuccess("PDF gerado com sucesso!");
    } catch (err: any) {
      showError(`Erro ao gerar PDF: ${err.message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div className="flex-1">
            <DialogTitle className="text-xl flex items-center gap-2">
              Pedido #{order.id} 
              {order.status === 'Recebido com Divergência' && <AlertTriangle className="h-5 w-5 text-orange-500" />}
            </DialogTitle>
            <DialogDescription>
              {order.supplier_name} • {new Date(order.order_date).toLocaleDateString("pt-BR")}
            </DialogDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={isLoading} className="mr-8">
            <FileDown className="w-4 h-4 mr-2" /> Baixar PDF
          </Button>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {isProcessed && Math.abs(diffTotal) > 0.01 && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-4">
               <AlertTriangle className="h-10 w-10 text-orange-500" />
               <div>
                  <h4 className="font-bold text-orange-800">Divergência Detectada</h4>
                  <p className="text-sm text-orange-700">
                    O valor recebido foi <strong>{formatCurrency(Math.abs(diffTotal))}</strong> {diffTotal < 0 ? "menor" : "maior"} que o pedido original. Use o PDF acima para contestação com o fornecedor.
                  </p>
               </div>
            </div>
          )}

          <div className="border rounded-xl overflow-hidden">
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
                {isLoading ? (
                  <TableRow><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                ) : items?.map((item) => {
                  const diff = (item.received_quantity || 0) - item.quantity;

                  let displayName = item.products?.name || "Produto Removido";
                  if (item.product_variants) {
                    const v: any = item.product_variants;
                    const flavor = Array.isArray(v.flavors) ? v.flavors[0]?.name : v.flavors?.name;
                    const volumeLabel = v.volume_ml ? `${v.volume_ml}ml` : "";
                    displayName += `${flavor ? ` - ${flavor}` : ""}${volumeLabel ? ` (${volumeLabel})` : ""}`;
                  }

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-bold text-gray-500 mb-1">OBSERVAÇÕES DO PEDIDO:</p>
                <p className="text-sm italic">{order.notes || "Nenhuma observação registrada."}</p>
            </div>
            <div className="space-y-2">
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
                    <span className="font-bold">Total Final:</span>
                    <span className="text-2xl font-black text-primary">
                        {formatCurrency(isProcessed ? order.received_total_cost : order.total_cost)}
                    </span>
                </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};