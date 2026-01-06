import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertCircle, TrendingUp } from "lucide-react";
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
  products: {
    name: string;
    cost_price: number | null;
  } | null;
  product_variants: {
    cost_price: number | null;
    volume_ml: number | null;
    flavors: { name: string } | null;
  } | null;
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
  onConfirm: (finalItems: { product_id: number, variant_id: string | null, quantity: number, unit_cost: number }[]) => void;
  isSubmitting: boolean;
}

const fetchSupplierOrderItems = async (orderId: number): Promise<SupplierOrderItem[]> => {
  const { data, error } = await supabase
    .from("supplier_order_items")
    .select(`
      id,
      product_id,
      variant_id,
      quantity,
      unit_cost,
      products (name, cost_price),
      product_variants (cost_price, volume_ml, flavors(name))
    `)
    .eq("supplier_order_id", orderId);
  
  if (error) throw error;
  return data as any;
};

export const SupplierOrderReceiveModal = ({ 
  order, 
  isOpen, 
  onClose, 
  onConfirm, 
  isSubmitting 
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
      items.forEach(item => {
        initialChecked[item.id] = false;
        initialQtys[item.id] = item.quantity;
      });
      setCheckedItems(initialChecked);
      setReceivedQuantities(initialQtys);
    }
  }, [items]);

  const handleToggleCheck = (id: number) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleQtyChange = (id: number, val: string) => {
    const num = parseInt(val) || 0;
    setReceivedQuantities(prev => ({ ...prev, [id]: num }));
  };

  const handleCheckAll = () => {
    const allChecked: Record<number, boolean> = {};
    items?.forEach(item => {
      allChecked[item.id] = true;
    });
    setCheckedItems(allChecked);
  };

  const handleFinalConfirm = () => {
    if (!items) return;
    
    const itemsToProcess = items
      .filter(item => checkedItems[item.id])
      .map(item => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: receivedQuantities[item.id],
        unit_cost: item.unit_cost
      }));

    if (itemsToProcess.length === 0) {
      alert("Por favor, marque pelo menos um item como conferido antes de confirmar.");
      return;
    }

    onConfirm(itemsToProcess);
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const totalConferido = items?.reduce((acc, item) => {
    if (checkedItems[item.id]) {
      return acc + (receivedQuantities[item.id] * item.unit_cost);
    }
    return acc;
  }, 0) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
                Conferência de Carga #{order.id}
              </DialogTitle>
              <DialogDescription className="text-base">
                Clique nos itens conforme for retirando da embalagem para confirmar a entrada.
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleCheckAll} disabled={isSubmitting}>
              Marcar Tudo como Chegou
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : error ? (
            <p className="text-red-500">Erro ao carregar itens: {(error as Error).message}</p>
          ) : (
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
                    const newCost = item.unit_cost;
                    const isHigher = newCost > currentCost;

                    let displayName = item.products?.name || "Produto Removido";
                    if (item.product_variants) {
                        const v = item.product_variants;
                        const flavor = v.flavors?.name;
                        displayName += `${flavor ? ` - ${flavor}` : ""}${v.volume_ml ? ` (${v.volume_ml}ml)` : ""}`;
                    }

                    return (
                      <TableRow 
                        key={item.id} 
                        className={cn(
                          "transition-colors cursor-pointer",
                          isChecked ? "bg-green-50/50 hover:bg-green-50" : "hover:bg-gray-50"
                        )}
                        onClick={() => handleToggleCheck(item.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={isChecked} 
                            onCheckedChange={() => handleToggleCheck(item.id)}
                            className="h-6 w-6"
                          />
                        </TableCell>
                        <TableCell className="font-semibold text-xs">
                          {displayName}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground font-medium">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Input 
                            type="number" 
                            value={receivedQuantities[item.id]} 
                            onChange={(e) => handleQtyChange(item.id, e.target.value)}
                            className={cn(
                                "h-9 text-center font-bold",
                                receivedQuantities[item.id] !== item.quantity && "border-orange-500 text-orange-600 bg-orange-50"
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {formatCurrency(newCost)}
                        </TableCell>
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
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Alert variant="default" className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <p className="text-yellow-700 text-xs">
                  Itens <b>não marcados</b> não entrarão no estoque. Ajustes de quantidade refletirão diretamente na variação específica.
                </p>
              </Alert>
              <div className="flex flex-col items-end justify-center p-4 bg-primary/5 rounded-xl border border-primary/10">
                <p className="text-xs text-muted-foreground uppercase font-bold">Total Conferido</p>
                <p className="text-3xl font-black text-primary">
                  {formatCurrency(totalConferido)}
                </p>
              </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button 
            className="bg-green-600 hover:bg-green-700 text-white font-bold h-12 px-8 text-lg" 
            onClick={handleFinalConfirm} 
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando Entrada...</>
            ) : (
              "Confirmar Recebimento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};