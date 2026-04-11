"use client";

import { useState, useCallback } from "react";
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
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  PlusCircle,
  Truck,
  CheckCircle2,
  Loader2,
  Eye,
  FileDown,
  AlertTriangle,
  Trash2,
  Pencil,
} from "lucide-react";
import { SupplierOrderForm } from "@/components/dashboard/SupplierOrderForm";
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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SelectableItem } from "@/components/dashboard/ProductCombobox";

// ─── Função auxiliar: Custo Médio Ponderado (CMP) ─────────────────────────────
const calcularCMP = (
  estoqueAtual: number,
  custoAtual: number,
  qtdChegando: number,
  custoNovo: number
): number => {
  if (estoqueAtual <= 0) return custoNovo; // estoque zerado: entra o preço novo direto
  const media = (estoqueAtual * custoAtual + qtdChegando * custoNovo) / (estoqueAtual + qtdChegando);
  return Math.ceil(media * 100) / 100; // arredonda para cima no centavo
};

// ─── Busca de pedidos (lista principal) ──────────────────────────────────────
const fetchSupplierOrders = async () => {
  const { data, error } = await supabase
    .from("supplier_orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

// ─── Busca server-side de produtos (chamada a cada digitação) ─────────────────
// Busca variantes diretamente para garantir que TODAS aparecem (não só a primeira)
const searchProducts = async (term: string): Promise<SelectableItem[]> => {
  const trimmed = term.trim();

  // Busca variantes diretamente com join ao produto
  let variantQuery = supabase
    .from("product_variants")
    .select(
      `id, volume_ml, cost_price, stock_quantity, ohms, size, color,
       flavors(name),
       products!inner(id, name, brand, category, cost_price, stock_quantity)`
    )
    .eq("is_active", true)
    .order("id")
    .limit(200);

  if (trimmed) {
    variantQuery = variantQuery.ilike("products.name", `%${trimmed}%`);
  }

  const { data: variantsData, error: variantsError } = await variantQuery;

  // Busca produtos sem variantes
  let productQuery = supabase
    .from("products")
    .select(`id, name, stock_quantity, cost_price, brand, category`)
    .order("name")
    .limit(100);

  if (trimmed) {
    productQuery = productQuery.ilike("name", `%${trimmed}%`);
  }

  const { data: productsData, error: productsError } = await productQuery;

  const flattened: SelectableItem[] = [];

  // Conjunto de product_ids que têm variantes ativas
  const productIdsWithVariants = new Set<number>();

  if (!variantsError && variantsData) {
    variantsData.forEach((v: any) => {
      const p = v.products;
      if (!p) return;
      productIdsWithVariants.add(p.id);

      const flavorName = v.flavors?.name || "";
      const volumeLabel = v.volume_ml ? `${v.volume_ml}ml` : "";
      const ohmsLabel = v.ohms ? `${v.ohms}` : "";
      const sizeLabel = v.size ? `${v.size}` : "";
      const colorLabel = v.color ? v.color : "";

      const nameParts = [colorLabel, sizeLabel, ohmsLabel, flavorName].filter(Boolean);
      const variationName = nameParts.length > 0 ? ` - ${nameParts.join(" / ")}` : "";
      const volumeSuffix = volumeLabel ? ` (${volumeLabel})` : "";

      flattened.push({
        id: p.id,
        variant_id: v.id,
        name: `${p.name}${variationName}${volumeSuffix}`,
        stock_quantity: v.stock_quantity ?? 0,
        cost_price: v.cost_price ?? p.cost_price,
        is_variant: true,
        brand: p.brand ?? null,
        category: p.category ?? null,
        ohms: v.ohms ?? null,
        size: v.size ?? null,
        color: v.color ?? null,
      });
    });
  }

  // Adiciona produtos sem variantes (que não aparecem na query de variantes)
  if (!productsError && productsData) {
    productsData.forEach((p: any) => {
      if (productIdsWithVariants.has(p.id)) return; // já tem variantes, pula
      flattened.push({
        id: p.id,
        variant_id: null,
        name: p.name,
        stock_quantity: p.stock_quantity ?? 0,
        cost_price: p.cost_price,
        is_variant: false,
        brand: p.brand ?? null,
        category: p.category ?? null,
        ohms: null,
        size: null,
        color: null,
      });
    });
  }

  return flattened.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
};

// ─── Helper: monta variant_name completo ──────────────────────────────────────
const buildVariantName = (productName: string | null, variant: any | null): string | null => {
  if (!productName) return null;
  if (!variant) return productName;

  const colorLabel = variant.color || null;
  const ohmsLabel = variant.ohms ? `${variant.ohms}Ω` : null;
  const sizeLabel = variant.size || null;
  const flavorName = variant.flavors?.name || null;
  const volumeMl = variant.volume_ml || null;

  const variantParts = [colorLabel, sizeLabel, ohmsLabel, flavorName].filter(Boolean);
  const suffix = volumeMl ? ` (${volumeMl}ml)` : "";
  return `${productName}${variantParts.length > 0 ? " - " + variantParts.join(" / ") : ""}${suffix}`;
};

// ─── Página principal ─────────────────────────────────────────────────────────
const SupplierOrdersPage = () => {
  const queryClient = useQueryClient();
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editingInitialValues, setEditingInitialValues] = useState<any | null>(null);
  // Itens pré-carregados para edição (para exibir nomes corretos no combobox)
  const [editingPreloadedItems, setEditingPreloadedItems] = useState<SelectableItem[]>([]);

  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ["supplierOrders"],
    queryFn: fetchSupplierOrders,
  });

  // Função de busca memoizada — passada para o formulário
  const handleSearch = useCallback(async (term: string): Promise<SelectableItem[]> => {
    return searchProducts(term);
  }, []);

  // ── Abrir modal de criação ──────────────────────────────────────────────────
  const openCreateOrder = () => {
    setEditingOrderId(null);
    setEditingInitialValues(null);
    setEditingPreloadedItems([]);
    setIsOrderModalOpen(true);
  };

  // ── Abrir modal de edição ───────────────────────────────────────────────────
  const openEditOrder = async (order: any) => {
    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from("supplier_order_items")
        .select("product_id, variant_id, quantity, unit_cost, variant_name, flavor_name, volume_ml")
        .eq("supplier_order_id", order.id);
      if (itemsError) throw itemsError;

      const initial = {
        supplier_name: order.supplier_name || "",
        notes: order.notes || "",
        items: (itemsData || []).map((it: any) => ({
          product_id: Number(it.product_id),
          variant_id: it.variant_id || null,
          quantity: it.quantity,
          unit_cost: it.unit_cost,
        })),
      };

      // Monta itens pré-carregados para exibir nomes corretos nos comboboxes
      const preloaded: SelectableItem[] = (itemsData || []).map((it: any) => ({
        id: Number(it.product_id),
        variant_id: it.variant_id || null,
        name: it.variant_name || `Produto #${it.product_id}`,
        stock_quantity: 0,
        cost_price: it.unit_cost,
        is_variant: !!it.variant_id,
        brand: null,
        category: null,
      }));

      setEditingOrderId(order.id);
      setEditingInitialValues(initial);
      setEditingPreloadedItems(preloaded);
      setIsOrderModalOpen(true);
    } catch (err: any) {
      showError(`Erro ao carregar pedido para edição: ${err.message}`);
    }
  };

  // ── Criar pedido ────────────────────────────────────────────────────────────
  const createOrderMutation = useMutation({
    mutationFn: async (values: any) => {
      const total = values.items.reduce(
        (acc: number, item: any) => acc + Number(item.quantity) * Number(item.unit_cost),
        0
      );

      const { data: order, error: orderError } = await supabase
        .from("supplier_orders")
        .insert({
          supplier_name: values.supplier_name,
          notes: values.notes,
          total_cost: total,
          status: "Pendente",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Busca nomes em paralelo (uma única query por tipo)
      const productIds = [...new Set(values.items.map((i: any) => Number(i.product_id)).filter(Boolean))];
      const variantIds = [...new Set(values.items.map((i: any) => i.variant_id).filter(Boolean))];

      const [productsRes, variantsRes] = await Promise.all([
        productIds.length > 0
          ? supabase.from("products").select("id, name").in("id", productIds as any)
          : Promise.resolve({ data: [] }),
        variantIds.length > 0
          ? supabase
              .from("product_variants")
              .select("id, volume_ml, color, ohms, size, flavors(name)")
              .in("id", variantIds as any)
          : Promise.resolve({ data: [] }),
      ]);

      const productsMap: Record<number, any> = {};
      (productsRes.data || []).forEach((p: any) => { productsMap[p.id] = p; });

      const variantsMap: Record<string, any> = {};
      (variantsRes.data || []).forEach((v: any) => { variantsMap[v.id] = v; });

      const itemsToInsert = values.items.map((item: any) => {
        const productName = productsMap[Number(item.product_id)]?.name || null;
        const variant = item.variant_id ? variantsMap[item.variant_id] : null;
        const flavorName = variant?.flavors?.name || null;
        const volumeMl = variant?.volume_ml || null;
        const variantName = buildVariantName(productName, variant);

        return {
          supplier_order_id: order.id,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          variant_name: variantName,
          flavor_name: flavorName,
          volume_ml: volumeMl,
        };
      });

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

  // ── Atualizar pedido ────────────────────────────────────────────────────────
  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: any }) => {
      const total = values.items.reduce(
        (acc: number, item: any) => acc + Number(item.quantity) * Number(item.unit_cost),
        0
      );

      const { error: updateError } = await supabase
        .from("supplier_orders")
        .update({ supplier_name: values.supplier_name, notes: values.notes, total_cost: total })
        .eq("id", id);
      if (updateError) throw updateError;

      // Remove itens antigos e re-insere
      const { error: deleteError } = await supabase
        .from("supplier_order_items")
        .delete()
        .eq("supplier_order_id", id);
      if (deleteError) throw deleteError;

      // Busca nomes em paralelo
      const productIds = [...new Set(values.items.map((i: any) => Number(i.product_id)).filter(Boolean))];
      const variantIds = [...new Set(values.items.map((i: any) => i.variant_id).filter(Boolean))];

      const [productsRes, variantsRes] = await Promise.all([
        productIds.length > 0
          ? supabase.from("products").select("id, name").in("id", productIds as any)
          : Promise.resolve({ data: [] }),
        variantIds.length > 0
          ? supabase
              .from("product_variants")
              .select("id, volume_ml, color, ohms, size, flavors(name)")
              .in("id", variantIds as any)
          : Promise.resolve({ data: [] }),
      ]);

      const productsMap: Record<number, any> = {};
      (productsRes.data || []).forEach((p: any) => { productsMap[p.id] = p; });

      const variantsMap: Record<string, any> = {};
      (variantsRes.data || []).forEach((v: any) => { variantsMap[v.id] = v; });

      const itemsToInsert = values.items.map((item: any) => {
        const productName = productsMap[Number(item.product_id)]?.name || null;
        const variant = item.variant_id ? variantsMap[item.variant_id] : null;
        const flavorName = variant?.flavors?.name || null;
        const volumeMl = variant?.volume_ml || null;
        const variantName = buildVariantName(productName, variant);

        return {
          supplier_order_id: id,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          variant_name: variantName,
          flavor_name: flavorName,
          volume_ml: volumeMl,
        };
      });

      const { error: itemsError } = await supabase.from("supplier_order_items").insert(itemsToInsert);
      if (itemsError) throw itemsError;

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplierOrders"] });
      setIsOrderModalOpen(false);
      setEditingOrderId(null);
      setEditingInitialValues(null);
      setEditingPreloadedItems([]);
      showSuccess("Pedido atualizado com sucesso!");
    },
    onError: (err: any) => showError(`Erro ao atualizar pedido: ${err.message}`),
  });

  // ── Deletar pedido ──────────────────────────────────────────────────────────
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

  // ── Atualizar status / receber pedido ───────────────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      itemsToProcess,
    }: {
      id: number;
      status: string;
      itemsToProcess?: any[];
    }) => {
      let finalStatus = status;
      let receivedTotal = 0;

      if (status === "Recebido" && itemsToProcess) {
        receivedTotal = itemsToProcess.reduce(
          (acc, item) => acc + item.quantity * item.unit_cost,
          0
        );

        const { data: originalOrder } = await supabase
          .from("supplier_orders")
          .select("total_cost")
          .eq("id", id)
          .single();

        if (Math.abs(receivedTotal - (originalOrder?.total_cost || 0)) > 0.01) {
          finalStatus = "Recebido com Divergência";
        }

        // Atualiza estoque em paralelo
        await Promise.all(
          itemsToProcess.map(async (item) => {
            // Atualiza quantidade recebida no item
            await supabase
              .from("supplier_order_items")
              .update({ received_quantity: item.quantity })
              .match({
                supplier_order_id: id,
                product_id: item.product_id,
                ...(item.variant_id ? { variant_id: item.variant_id } : {}),
              });

            if (item.variant_id) {
              const { data: variant } = await supabase
                .from("product_variants")
                .select("stock_quantity, cost_price")
                .eq("id", item.variant_id)
                .single();

              if (variant) {
                const updateData: any = { stock_quantity: (variant.stock_quantity || 0) + item.quantity };
                updateData.cost_price = calcularCMP(
                  variant.stock_quantity || 0,
                  variant.cost_price || 0,
                  item.quantity,
                  item.unit_cost
                );
                await supabase.from("product_variants").update(updateData).eq("id", item.variant_id);
              }
            } else {
              const { data: product } = await supabase
                .from("products")
                .select("stock_quantity, cost_price")
                .eq("id", item.product_id)
                .single();

              if (product) {
                const updateData: any = { stock_quantity: (product.stock_quantity || 0) + item.quantity };
                updateData.cost_price = calcularCMP(
                  product.stock_quantity || 0,
                  product.cost_price || 0,
                  item.quantity,
                  item.unit_cost
                );
                await supabase.from("products").update(updateData).eq("id", item.product_id);
              }
            }
          })
        );
      }

      const updatePayload: any = { status: finalStatus };
      if (receivedTotal > 0) updatePayload.received_total_cost = receivedTotal;

      const { error } = await supabase.from("supplier_orders").update(updatePayload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplierOrders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsReceiveModalOpen(false);
      showSuccess("Operação finalizada!");
    },
    onError: (err: any) => showError(`Erro: ${err.message}`),
  });

  // ── Download PDF ────────────────────────────────────────────────────────────
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handleDownloadOrder = async (order: any) => {
    setDownloadingId(order.id);
    try {
      // 1. Busca os itens do pedido (sem join de variante para evitar pegar a errada)
      const { data: items, error } = await supabase
        .from("supplier_order_items")
        .select(`id, quantity, received_quantity, unit_cost, variant_id, variant_name, product_id, products(name)`)
        .eq("supplier_order_id", order.id);

      if (error) throw error;

      // 2. Para itens sem variant_name salvo, busca as variantes pelo variant_id exato
      const missingVariantIds = (items || [])
        .filter((it: any) => it.variant_id && (!it.variant_name || it.variant_name.trim() === ''))
        .map((it: any) => it.variant_id as string);

      const variantsMap: Record<string, any> = {};
      if (missingVariantIds.length > 0) {
        const { data: variantsData } = await supabase
          .from("product_variants")
          .select("id, volume_ml, color, ohms, size, flavors(name)")
          .in("id", missingVariantIds);
        (variantsData || []).forEach((v: any) => { variantsMap[v.id] = v; });
      }

      const isProcessed =
        order.status === "Recebido" || order.status === "Recebido com Divergência";
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Header
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(`PEDIDO AO FORNECEDOR #${order.id}`, 14, 20);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text(`Fornecedor: ${order.supplier_name}`, 14, 28);
      doc.text(`Status: ${order.status}`, 14, 34);
      doc.text(`Data: ${new Date(order.created_at).toLocaleDateString("pt-BR")}`, 14, 40);

      const tableRows = (items || []).map((item: any) => {
        let displayName: string;

        // variant_name já contém o nome completo (produto + variação) — caminho feliz
        if (item.variant_name && item.variant_name.trim() !== '') {
          displayName = item.variant_name;
        }
        // Fallback: monta manualmente para itens antigos sem variant_name
        else {
          const productName = item.products?.name || "Produto Removido";
          const variant = item.variant_id ? variantsMap[item.variant_id] : null;
          displayName = buildVariantName(productName, variant) || productName;
        }

        return [
          displayName,
          item.quantity.toString(),
          isProcessed ? item.received_quantity.toString() : "-",
          formatCurrency(item.unit_cost),
          formatCurrency(
            isProcessed
              ? item.received_quantity * item.unit_cost
              : item.quantity * item.unit_cost
          ),
        ];
      });

      autoTable(doc, {
        head: [["Produto / Variação", "Qtd.", isProcessed ? "Recebido" : "-", "Custo Unit.", "Subtotal"]],
        body: tableRows,
        startY: 48,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8, overflow: 'linebreak', valign: 'middle' },
        columnStyles: {
          0: { cellWidth: 'auto', overflow: 'linebreak' },
          1: { cellWidth: 18, halign: 'center' },
          2: { cellWidth: 22, halign: 'center' },
          3: { cellWidth: 36, halign: 'right' },
          4: { cellWidth: 36, halign: 'right' }
        },
        tableWidth: 269,
        foot: [
          [
            "",
            "",
            "",
            "TOTAL:",
            formatCurrency(isProcessed ? order.received_total_cost : order.total_cost),
          ],
        ],
        footStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 9 },
        margin: { top: 50, left: 14, right: 14, bottom: 20 }
      });

      doc.save(`pedido_fornecedor_${order.id}.pdf`);
      showSuccess("PDF gerado com sucesso!");
    } catch (err: any) {
      showError(`Erro ao gerar PDF: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Badge de status ─────────────────────────────────────────────────────────
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pendente":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            Pendente
          </Badge>
        );
      case "Recebido":
        return <Badge className="bg-green-500">Recebido</Badge>;
      case "Recebido com Divergência":
        return (
          <Badge className="bg-orange-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Divergência
          </Badge>
        );
      case "Cancelado":
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Truck className="h-8 w-8 text-primary" /> Pedidos ao Fornecedor
        </h1>
        <div>
          <Button onClick={openCreateOrder}>
            <PlusCircle className="mr-2 h-4 w-4" /> Novo Pedido de Compra
          </Button>

          <Dialog
            open={isOrderModalOpen}
            onOpenChange={(open) => {
              if (!open) {
                setEditingOrderId(null);
                setEditingInitialValues(null);
                setEditingPreloadedItems([]);
              }
              setIsOrderModalOpen(open);
            }}
          >
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingOrderId
                    ? `Editar Pedido #${editingOrderId}`
                    : "Criar Pedido para Fornecedor"}
                </DialogTitle>
              </DialogHeader>
              {isOrderModalOpen && (
                <SupplierOrderForm
                  onSubmit={(v) =>
                    editingOrderId
                      ? updateOrderMutation.mutate({ id: editingOrderId, values: v })
                      : createOrderMutation.mutate(v)
                  }
                  isSubmitting={createOrderMutation.isPending || updateOrderMutation.isPending}
                  onSearch={handleSearch}
                  initialValues={editingInitialValues}
                  preloadedItems={editingPreloadedItems}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabela de pedidos */}
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
              <TableRow>
                <TableCell colSpan={7}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : orders && orders.length > 0 ? (
              orders.map((order) => {
                const diff =
                  order.received_total_cost > 0
                    ? order.received_total_cost - order.total_cost
                    : 0;
                const hasDivergence = Math.abs(diff) > 0.01;
                return (
                  <TableRow key={order.id} className={cn(hasDivergence && "bg-orange-50/20")}>
                    <TableCell className="font-mono font-bold">#{order.id}</TableCell>
                    <TableCell>{order.supplier_name}</TableCell>
                    <TableCell className="font-medium text-muted-foreground">
                      {formatCurrency(order.total_cost)}
                    </TableCell>
                    <TableCell>
                      {order.received_total_cost > 0 ? (
                        <span
                          className={cn(
                            "font-bold",
                            diff < 0 ? "text-orange-600" : "text-green-600"
                          )}
                        >
                          {formatCurrency(order.received_total_cost)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {hasDivergence ? (
                        <span
                          className={cn(
                            "font-bold",
                            diff < 0 ? "text-red-600" : "text-blue-600"
                          )}
                        >
                          {formatCurrency(diff)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsDetailModalOpen(true);
                          }}
                          title="Ver Detalhes"
                        >
                          <Eye className="h-4 w-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadOrder(order)}
                          disabled={downloadingId === order.id}
                          title="Baixar PDF"
                        >
                          {downloadingId === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        {order.status === "Pendente" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => {
                                setSelectedOrder(order);
                                setIsReceiveModalOpen(true);
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Conferir
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-primary border-primary/20 hover:bg-primary/5"
                              onClick={() => openEditOrder(order)}
                            >
                              <Pencil className="h-4 w-4 mr-1" /> Editar
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:bg-red-50"
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsDeleteAlertOpen(true);
                          }}
                          title="Excluir Pedido"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  Nenhum pedido.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirmar exclusão */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja excluir?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o pedido #{selectedOrder?.id} permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteOrderMutation.mutate(selectedOrder.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedOrder && (
        <SupplierOrderDetailModal
          order={selectedOrder}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
        />
      )}
      {selectedOrder && (
        <SupplierOrderReceiveModal
          order={selectedOrder}
          isOpen={isReceiveModalOpen}
          onClose={() => setIsReceiveModalOpen(false)}
          onConfirm={(itemsToProcess) =>
            updateStatusMutation.mutate({
              id: selectedOrder.id,
              status: "Recebido",
              itemsToProcess,
            })
          }
          isSubmitting={updateStatusMutation.isPending}
        />
      )}
    </div>
  );
};

export default SupplierOrdersPage;