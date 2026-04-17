import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertCircle, TrendingUp, CheckSquare2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface SupplierOrderItem {
  id: number;
  product_id: number;
  variant_id: string | null;
  quantity: number;
  unit_cost: number;
  products: { name: string; cost_price: number | null } | null;
  product_variants: { cost_price: number | null; volume_ml: number | null; flavors: { name: string } | null } | null;
}

interface SupplierOrder {
  id: number;
  supplier_name: string;
  total_cost: number;
}

interface SupplierOrderReceiveModalProps {
  order: SupplierOrder;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (finalItems: { id: number; product_id: number; variant_id: string | null; quantity: number; unit_cost: number }[]) => void;
  isSubmitting: boolean;
}

const fetchSupplierOrderItems = async (orderId: number): Promise<SupplierOrderItem[]> => {
  const { data, error } = await supabase
    .from("supplier_order_items")
    .select(`id, product_id, variant_id, quantity, unit_cost, products (name, cost_price), product_variants (cost_price, volume_ml, flavors(name))`)
    .eq("supplier_order_id", orderId);
  if (error) throw error;
  return data as any;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const SupplierOrderReceiveModal = ({
  order, isOpen, onClose, onConfirm, isSubmitting,
}: SupplierOrderReceiveModalProps) => {
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [receivedQuantities, setReceivedQuantities] = useState<Record<number, number>>({});

  const { data: items, isLoading, error } = useQuery({
    queryKey: ["supplierOrderItemsConfirm", order.id],
    queryFn: () => fetchSupplierOrderItems(order.id),
    enabled: isOpen,
  });

  useEffect(() => {
    if (items) {
      const initialChecked: Record<number, boolean> = {};
      const initialQtys: Record<number, number> = {};
      items.forEach((item) => {
        initialChecked[item.id] = false;
        initialQtys[item.id] = item.quantity;
      });
      setCheckedItems(initialChecked);
      setReceivedQuantities(initialQtys);
    }
  }, [items]);

  const handleToggleCheck = (id: number) => setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  const handleQtyChange = (id: number, val: string) =>
    setReceivedQuantities((prev) => ({ ...prev, [id]: parseInt(val) || 0 }));

  const handleCheckAll = () => {
    const all: Record<number, boolean> = {};
    items?.forEach((item) => { all[item.id] = true; });
    setCheckedItems(all);
  };

  const handleFinalConfirm = () => {
    if (!items) return;
    const itemsToProcess = items
      .filter((item) => checkedItems[item.id])
      .map((item) => ({
        id: item.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: receivedQuantities[item.id],
        unit_cost: item.unit_cost,
      }));
    if (itemsToProcess.length === 0) {
      alert("Marque pelo menos um item como conferido antes de confirmar.");
      return;
    }
    onConfirm(itemsToProcess);
  };

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalConferido =
    items?.reduce((acc, item) => {
      if (checkedItems[item.id]) return acc + receivedQuantities[item.id] * item.unit_cost;
      return acc;
    }, 0) || 0;

  const getDisplayName = (item: SupplierOrderItem) => {
    let name = item.products?.name || "Produto Removido";
    if (item.product_variants) {
      const v = item.product_variants;
      const flavor = v.flavors?.name;
      name += `${flavor ? ` - ${flavor}` : ""}${v.volume_ml ? ` (${v.volume_ml}ml)` : ""}`;
    }
    return name;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="w-full max-w-5xl h-[100dvh] md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-none md:rounded-lg">

        {/* Header fixo */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b bg-white shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base md:text-xl flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                Conferência #{order.id}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Toque nos itens conforme for retirando da embalagem
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckAll}
              disabled={isSubmitting}
              className="shrink-0 gap-1.5 text-xs h-9"
            >
              <CheckSquare2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Marcar Tudo</span>
              <span className="sm:hidden">Tudo</span>
            </Button>
          </div>

          {/* Progresso */}
          {items && items.length > 0 && (
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(checkedCount / items.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold text-gray-600 shrink-0">
                {checkedCount}/{items.length}
              </span>
            </div>
          )}
        </DialogHeader>

        {/* Lista de itens scrollável */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <p className="p-6 text-red-500 text-center text-sm">Erro ao carregar itens.</p>
          ) : (
            <>
              {/* ── MOBILE: Cards de conferência ── */}
              <div className="md:hidden p-3 space-y-2">
                {items?.map((item) => {
                  const isChecked = checkedItems[item.id];
                  const currentCost = item.product_variants?.cost_price || item.products?.cost_price || 0;
                  const isHigher = item.unit_cost > currentCost;
                  const qtyDiff = receivedQuantities[item.id] - item.quantity;
                  const displayName = getDisplayName(item);

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-xl border shadow-sm transition-all duration-200 overflow-hidden",
                        isChecked
                          ? "bg-green-50 border-green-300 border-l-4 border-l-green-500"
                          : "bg-white border-gray-200"
                      )}
                      onClick={() => handleToggleCheck(item.id)}
                    >
                      {/* Linha principal */}
                      <div className="flex items-center gap-3 p-3">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleToggleCheck(item.id)}
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-semibold text-sm leading-tight", isChecked ? "text-green-800" : "text-gray-900")}>
                            {displayName}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              Pedido: <strong>{item.quantity}</strong>
                            </span>
                            <span className="text-xs font-bold text-primary">
                              {formatCurrency(item.unit_cost)}
                            </span>
                            {isHigher && (
                              <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-200 bg-orange-50 gap-1 px-1.5 py-0">
                                <TrendingUp className="w-2.5 h-2.5" /> Sobe custo
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Input de quantidade recebida — só aparece quando marcado */}
                      {isChecked && (
                        <div
                          className="px-3 pb-3 flex items-center gap-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-xs font-bold text-green-700 shrink-0">Qtd. recebida:</span>
                          <Input
                            type="number"
                            value={receivedQuantities[item.id]}
                            onChange={(e) => handleQtyChange(item.id, e.target.value)}
                            className={cn(
                              "h-10 text-center font-black text-base w-24",
                              qtyDiff !== 0 && "border-orange-400 text-orange-700 bg-orange-50"
                            )}
                          />
                          {qtyDiff !== 0 && (
                            <span className={cn("text-xs font-bold", qtyDiff < 0 ? "text-red-600" : "text-blue-600")}>
                              {qtyDiff > 0 ? `+${qtyDiff}` : qtyDiff} un
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── DESKTOP: Tabela ── */}
              <div className="hidden md:block p-4">
                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-gray-100">
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Produto / Variação</TableHead>
                        <TableHead className="text-center">Pedida</TableHead>
                        <TableHead className="text-center w-[120px]">Recebida</TableHead>
                        <TableHead className="text-center">Custo Unit.</TableHead>
                        <TableHead className="text-center">Status Preço</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items?.map((item) => {
                        const isChecked = checkedItems[item.id];
                        const currentCost = item.product_variants?.cost_price || item.products?.cost_price || 0;
                        const isHigher = item.unit_cost > currentCost;
                        const displayName = getDisplayName(item);
                        return (
                          <TableRow
                            key={item.id}
                            className={cn("transition-colors cursor-pointer", isChecked ? "bg-green-50/50 hover:bg-green-50" : "hover:bg-gray-50")}
                            onClick={() => handleToggleCheck(item.id)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox checked={isChecked} onCheckedChange={() => handleToggleCheck(item.id)} className="h-6 w-6" />
                            </TableCell>
                            <TableCell className="font-semibold text-xs">{displayName}</TableCell>
                            <TableCell className="text-center text-muted-foreground font-medium">{item.quantity}</TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <Input
                                type="number"
                                value={receivedQuantities[item.id]}
                                onChange={(e) => handleQtyChange(item.id, e.target.value)}
                                className={cn("h-9 text-center font-bold", receivedQuantities[item.id] !== item.quantity && "border-orange-500 text-orange-600 bg-orange-50")}
                              />
                            </TableCell>
                            <TableCell className="text-center font-medium">{formatCurrency(item.unit_cost)}</TableCell>
                            <TableCell className="text-center">
                              {isHigher ? (
                                <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                                  <TrendingUp className="w-3 h-3 mr-1" /> Sobe Custo
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Sem alteração</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}

          {/* Aviso */}
          <div className="mx-4 mb-2">
            <Alert variant="default" className="bg-yellow-50 border-yellow-200 py-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700 text-xs">
                Itens <b>não marcados</b> não entrarão no estoque.
              </AlertDescription>
            </Alert>
          </div>
        </div>

        {/* Footer fixo — total + botão confirmar */}
        <div className="border-t bg-white px-4 py-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground leading-none">Total Conferido</p>
              <p className="text-2xl font-black text-primary">{formatCurrency(totalConferido)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="h-12 px-4">
                Cancelar
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white font-bold h-12 px-5 md:px-8 text-sm md:text-base gap-2"
                onClick={handleFinalConfirm}
                disabled={isSubmitting || isLoading || checkedCount === 0}
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Confirmar ({checkedCount})</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
