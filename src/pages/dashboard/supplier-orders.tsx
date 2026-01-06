"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Truck, CheckCircle2, Loader2, Eye, FileDown, AlertTriangle, Trash2 } from "lucide-react";
import { SupplierOrderForm } from "@/components/dashboard/supplier-order-form";
import { SupplierOrderDetailModal } from "@/components/dashboard/SupplierOrderDetailModal";
import { SupplierOrderReceiveModal } from "@/components/dashboard/SupplierOrderReceiveModal";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fetchSupplierOrders = async () => {
  const { data, error } = await supabase
    .from("supplier_orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

const fetchProductsWithVariants = async () => {
  // Busca produtos e suas variações com os nomes dos sabores
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, 
      name, 
      stock_quantity, 
      cost_price,
      product_variants (
        id,
        flavor_id,
        volume_ml,
        price,
        cost_price,
        stock_quantity,
        flavors (name)
      )
    `)
    .order("name");
  
  if (error) throw error;

  // Flattening: Se o produto tiver variações, mostramos as variações. 
  // Se não tiver, mostramos o produto base.
  const flattened: any[] = [];
  data.forEach((p: any) => {
    if (p.product_variants && p.product_variants.length > 0) {
      p.product_variants.forEach((v: any) => {
        const flavorName = v.flavors?.name || "";
        const volumeLabel = v.volume_ml ? `${v.volume_ml}ml` : "";
        flattened.push({
          id: p.id,
          variant_id: v.id,
          name: `${p.name}${flavorName ? ` - ${flavorName}` : ""}${volumeLabel ? ` (${volumeLabel})` : ""}`,
          stock_quantity: v.stock_quantity,
          cost_price: v.cost_price || p.cost_price,
          is_variant: true
        });
      });
    } else {
      flattened.push({
        id: p.id,
        variant_id: null,
        name: p.name,
        stock_quantity: p.stock_quantity,
        cost_price: p.cost_price,
        is_variant: false
      });
    }
  });

  return flattened;
};

const SupplierOrdersPage = () => {
  const queryClient = useQueryClient();
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const { data: orders, isLoading: isLoadingOrders } = useQuery({ 
    queryKey: ["supplierOrders"], 
    queryFn: fetchSupplierOrders 
  });
  
  const { data: selectableItems } = useQuery({ 
    queryKey: ["selectableItemsForSupplierOrder"], 
    queryFn: fetchProductsWithVariants 
  });

  const createOrderMutation = useMutation({
    mutationFn: async (values: any) => {
      const total = values.items.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.unit_cost)), 0);
      
      const { data: order, error: orderError } = await supabase
        .from("supplier_orders")
        .insert({
          supplier_name: values.supplier_name,
          notes: values.notes,
          total_cost: total,
          status: "Pendente"
        })
        .select()
        .single();
      
      if (orderError) throw orderError;

      const itemsToInsert = values.items.map((item: any) => ({
        supplier_order_id: order.id,
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        quantity: item.quantity,
        unit_cost: item.unit_cost
      }));

      const { error: itemsError } = await supabase.from("supplier_order_items").insert(itemsToInsert);
      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplierOrders"] });
      setIsOrderModalOpen(false);
      showSuccess("Pedido de compra registrado!");
    },
    onError: (err: any) => showError(`Erro ao criar pedido: ${err.message}`),
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const { error } = await supabase.from("supplier_orders").delete().eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplierOrders"] });
      setIsDeleteAlertOpen(false);
      showSuccess("Pedido removido com sucesso!");
    },
    onError: (err: any) => showError(`Erro ao deletar: ${err.message}`),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, itemsToProcess }: { id: number; status: string; itemsToProcess?: any[] }) => {
      let finalStatus = status;
      let receivedTotal = 0;

      if (status === 'Recebido' && itemsToProcess) {
        receivedTotal = itemsToProcess.reduce((acc, item) => acc + (item.quantity * item.unit_cost), 0);
        
        const { data: originalOrder } = await supabase.from('supplier_orders').select('total_cost').eq('id', id).single();
        
        if (Math.abs(receivedTotal - (originalOrder?.total_cost || 0)) > 0.01) {
          finalStatus = 'Recebido com Divergência';
        }

        for (const item of itemsToProcess) {
          // Atualiza a quantidade recebida no item do pedido
          await supabase
            .from('supplier_order_items')
            .update({ received_quantity: item.quantity })
            .match({ 
              supplier_order_id: id, 
              product_id: item.product_id,
              ...(item.variant_id ? { variant_id: item.variant_id } : {})
            });

          // Se for uma variação, atualiza o estoque da variação
          if (item.variant_id) {
            const { data: variant } = await supabase
              .from("product_variants")
              .select("stock_quantity, cost_price")
              .eq("id", item.variant_id)
              .single();
            
            if (variant) {
              const newQuantity = (variant.stock_quantity || 0) + item.quantity;
              const updateData: any = { stock_quantity: newQuantity };
              if (item.unit_cost > (variant.cost_price || 0)) {
                  updateData.cost_price = item.unit_cost;
              }
              await supabase.from("product_variants").update(updateData).eq("id", item.variant_id);
            }
          } else {
            // Se for produto simples, atualiza o estoque do produto
            const { data: product } = await supabase
              .from("products")
              .select("stock_quantity, cost_price")
              .eq("id", item.product_id)
              .single();
            
            if (product) {
              const newQuantity = (product.stock_quantity || 0) + item.quantity;
              const updateData: any = { stock_quantity: newQuantity };
              if (item.unit_cost > (product.cost_price || 0)) {
                  updateData.cost_price = item.unit_cost;
              }
              await supabase.from("products").update(updateData).eq("id", item.product_id);
            }
          }
        }
      }

      const updatePayload: any = { status: finalStatus };
      if (receivedTotal > 0) updatePayload.received_total_cost = receivedTotal;

      const { error } = await supabase.from("supplier_orders").update(updatePayload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplierOrders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["productVariants"] });
      setIsReceiveModalOpen(false);
      showSuccess("Operação finalizada!");
    },
    onError: (err: any) => showError(`Erro: ${err.message}`),
  });

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handleDownloadOrder = async (order: any) => {
    setDownloadingId(order.id);
    try {
      // Busca itens incluindo info de variações para o relatório
      const { data: items, error } = await supabase
        .from("supplier_order_items")
        .select(`
          quantity, 
          received_quantity, 
          unit_cost, 
          variant_id,
          products(name),
          product_variants(volume_ml, flavors(name))
        `)
        .eq("supplier_order_id", order.id);

      if (error) throw error;

      const isProcessed = order.status === 'Recebido' || order.status === 'Recebido com Divergência';
      const doc = new jsPDF();
      
      doc.setFontSize(20);
      doc.text(`RELATÓRIO PEDIDO #${order.id}`, 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Fornecedor: ${order.supplier_name}`, 14, 32);
      doc.text(`Status: ${order.status}`, 14, 38);
      doc.text(`Data: ${new Date(order.created_at).toLocaleDateString("pt-BR")}`, 14, 44);

      const tableHeaders = [["Produto / Variação", "Qtd. Pedida", "Qtd. Recebida", "Custo Unit.", "Subtotal Real"]];
      const tableRows = items.map((item: any) => {
        let displayName = item.products?.name || "Produto Removido";
        if (item.product_variants) {
            const v = item.product_variants;
            const flavor = Array.isArray(v.flavors) ? v.flavors[0]?.name : v.flavors?.name;
            displayName += `${flavor ? ` - ${flavor}` : ""}${v.volume_ml ? ` (${v.volume_ml}ml)` : ""}`;
        }

        return [
          displayName,
          item.quantity,
          isProcessed ? item.received_quantity : "-",
          formatCurrency(item.unit_cost),
          formatCurrency(isProcessed ? (item.received_quantity * item.unit_cost) : (item.quantity * item.unit_cost))
        ];
      });

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 52,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        foot: [["", "", "", "TOTAL:", formatCurrency(isProcessed ? order.received_total_cost : order.total_cost)]],
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }
      });

      doc.save(`pedido_compra_${order.id}.pdf`);
      showSuccess("PDF gerado com sucesso!");
    } catch (err: any) {
      showError(`Erro ao gerar PDF: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pendente": return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendente</Badge>;
      case "Recebido": return <Badge variant="default" className="bg-green-500">Recebido</Badge>;
      case "Recebido com Divergência": return <Badge variant="default" className="bg-orange-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Divergência</Badge>;
      case "Cancelado": return <Badge variant="destructive">Cancelado</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Truck className="h-8 w-8 text-primary" /> Pedidos ao Fornecedor</h1>
        <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
          <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Novo Pedido de Compra</Button></DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Criar Pedido para Fornecedor</DialogTitle></DialogHeader>
            <SupplierOrderForm onSubmit={(v) => createOrderMutation.mutate(v)} isSubmitting={createOrderMutation.isPending} products={selectableItems || []} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Total Pedido</TableHead>
              <TableHead>Total Recebido</TableHead>
              <TableHead>Diferença</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingOrders ? (
              <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            ) : orders && orders.length > 0 ? (
              orders.map((order) => {
                const diff = order.received_total_cost > 0 ? order.received_total_cost - order.total_cost : 0;
                const hasDivergence = Math.abs(diff) > 0.01;
                return (
                  <TableRow key={order.id} className={cn(hasDivergence && "bg-orange-50/20")}>
                    <TableCell className="font-mono font-bold">#{order.id}</TableCell>
                    <TableCell>{order.supplier_name}</TableCell>
                    <TableCell className="font-medium text-muted-foreground">{formatCurrency(order.total_cost)}</TableCell>
                    <TableCell>{order.received_total_cost > 0 ? <span className={cn("font-bold", diff < 0 ? "text-orange-600" : "text-green-600")}>{formatCurrency(order.received_total_cost)}</span> : "-"}</TableCell>
                    <TableCell>{hasDivergence ? <span className={cn("font-bold", diff < 0 ? "text-red-600" : "text-blue-600")}>{formatCurrency(diff)}</span> : "-"}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedOrder(order); setIsDetailModalOpen(true); }} title="Ver Detalhes">
                              <Eye className="h-4 w-4 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadOrder(order)} disabled={downloadingId === order.id} title="Baixar PDF">
                              {downloadingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4 text-muted-foreground" />}
                          </Button>
                          {order.status === 'Pendente' && (
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => { setSelectedOrder(order); setIsReceiveModalOpen(true); }}>
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Conferir
                              </Button>
                          )}
                          <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => { setSelectedOrder(order); setIsDeleteAlertOpen(true); }} title="Excluir Pedido">
                              <Trash2 className="h-4 w-4" />
                          </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow><TableCell colSpan={7} className="text-center py-10">Nenhum pedido.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja excluir?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação removerá o pedido #{selectedOrder?.id} permanentemente do sistema.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteOrderMutation.mutate(selectedOrder.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedOrder && <SupplierOrderDetailModal order={selectedOrder} isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} />}
      {selectedOrder && (
        <SupplierOrderReceiveModal
          order={selectedOrder}
          isOpen={isReceiveModalOpen}
          onClose={() => setIsReceiveModalOpen(false)}
          onConfirm={(itemsToProcess) => updateStatusMutation.mutate({ id: selectedOrder.id, status: 'Recebido', itemsToProcess })}
          isSubmitting={updateStatusMutation.isPending}
        />
      )}
    </div>
  );
};

export default SupplierOrdersPage;