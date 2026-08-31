"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface PendingItemRow {
  itemId: number | string;
  orderId: number | null;
  supplierName: string;
  displayName: string;
  orderedQuantity: number;
  currentStock: number;
  isExtra?: boolean;
  productId?: number;
}

// ─── Busca: pedidos pendentes + itens + estoque atual ──────────────────────
const fetchPendingItems = async (): Promise<PendingItemRow[]> => {
  // 1. Pedidos ainda "Aguardando" (status = Pendente)
  const { data: orders, error: ordersError } = await supabase
    .from("supplier_orders")
    .select("id, supplier_name")
    .eq("status", "Pendente")
    .order("id", { ascending: false });
  if (ordersError) throw ordersError;
  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const supplierByOrderId: Record<number, string> = {};
  orders.forEach((o) => { supplierByOrderId[o.id] = o.supplier_name; });

  // 2. Itens desses pedidos
  const { data: items, error: itemsError } = await supabase
    .from("supplier_order_items")
    .select("id, supplier_order_id, product_id, variant_id, quantity, variant_name")
    .in("supplier_order_id", orderIds);
  if (itemsError) throw itemsError;
  if (!items || items.length === 0) return [];

  // 3. Estoque atual: produtos e variantes envolvidos
  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
  const variantIds = [...new Set(items.map((i) => i.variant_id).filter(Boolean))];

  const [productsRes, variantsRes] = await Promise.all([
    productIds.length > 0
      ? supabase.from("products").select("id, name, stock_quantity").in("id", productIds as any)
      : Promise.resolve({ data: [] as any[] }),
    variantIds.length > 0
      ? supabase.from("product_variants").select("id, stock_quantity").in("id", variantIds as any)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const productStockById: Record<number, { name: string; stock: number }> = {};
  (productsRes.data || []).forEach((p: any) => {
    productStockById[p.id] = { name: p.name, stock: p.stock_quantity ?? 0 };
  });

  const variantStockById: Record<string, number> = {};
  (variantsRes.data || []).forEach((v: any) => {
    variantStockById[v.id] = v.stock_quantity ?? 0;
  });

  // 4. Monta a lista achatada
  return items.map((item: any) => {
    const product = productStockById[item.product_id];
    const displayName = item.variant_name || product?.name || `Produto #${item.product_id}`;
    const currentStock = item.variant_id
      ? variantStockById[item.variant_id] ?? 0
      : product?.stock ?? 0;

    return {
      itemId: item.id,
      orderId: item.supplier_order_id,
      supplierName: supplierByOrderId[item.supplier_order_id] || "-",
      displayName,
      orderedQuantity: item.quantity,
      currentStock,
      productId: item.product_id,
    };
  });
};

// ─── Busca extra: produtos que batem com o termo mas não têm pedido pendente ──
const fetchMatchingProductsWithoutPendingOrder = async (
  term: string,
  excludeProductIds: number[],
): Promise<PendingItemRow[]> => {
  if (!term) return [];

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, brand, stock_quantity")
    .or(`name.ilike.%${term}%,brand.ilike.%${term}%`)
    .limit(50);
  if (error) throw error;
  if (!products || products.length === 0) return [];

  const excludeSet = new Set(excludeProductIds);

  return products
    .filter((p) => !excludeSet.has(p.id))
    .map((p) => ({
      itemId: `extra-${p.id}`,
      orderId: null,
      supplierName: p.brand || "-",
      displayName: p.name,
      orderedQuantity: 0,
      currentStock: p.stock_quantity ?? 0,
      isExtra: true,
    }));
};

// ─── Página ─────────────────────────────────────────────────────────────────
const PedidosPendentes = () => {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["pendingSupplierOrderItems"],
    queryFn: fetchPendingItems,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim().toLowerCase());
    }, 350);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  const pendingProductIds = useMemo(() => {
    return [...new Set((rows || []).map((r) => r.productId).filter((id): id is number => !!id))];
  }, [rows]);

  const { data: extraRows } = useQuery({
    queryKey: ["extraProductsForPendingSearch", debouncedSearchTerm, pendingProductIds],
    queryFn: () => fetchMatchingProductsWithoutPendingOrder(debouncedSearchTerm, pendingProductIds),
    enabled: debouncedSearchTerm.length >= 2 && supplierFilter === "all" && !!rows,
  });

  const supplierOptions = useMemo(() => {
    const names = new Set((rows || []).map((r) => r.supplierName));
    return Array.from(names).sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    const term = searchTerm.trim().toLowerCase();
    const pendingMatches = rows.filter((row) => {
      const matchesSupplier = supplierFilter === "all" || row.supplierName === supplierFilter;
      const matchesTerm =
        !term ||
        row.displayName.toLowerCase().includes(term) ||
        row.supplierName.toLowerCase().includes(term) ||
        String(row.orderId).includes(term);
      return matchesSupplier && matchesTerm;
    });

    if (term.length >= 2 && supplierFilter === "all" && extraRows && extraRows.length > 0) {
      return [...pendingMatches, ...extraRows];
    }

    return pendingMatches;
  }, [rows, searchTerm, supplierFilter, extraRows]);

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          <span>Pedido Pendente</span>
        </h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Itens de pedidos ao fornecedor que ainda estão aguardando recebimento, com o estoque atual ao lado para conferência. Assim que um pedido deixa de estar "Pendente", seus itens saem automaticamente desta lista.
      </p>

      {/* ── Filtros ── */}
      <div className="flex flex-col md:flex-row gap-2 md:items-center bg-white p-3 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por produto, fornecedor ou nº do pedido..."
            className="pl-9"
          />
        </div>
        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-full md:w-56">
            <SelectValue placeholder="Fornecedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os fornecedores</SelectItem>
            {supplierOptions.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── MOBILE: Cards ── */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white h-20 animate-pulse bg-gray-100" />
          ))
        ) : filteredRows.length > 0 ? (
          filteredRows.map((row) => (
            <div key={row.itemId} className="rounded-xl border bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm text-gray-900 leading-tight flex-1">{row.displayName}</p>
                {row.isExtra ? (
                  <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 shrink-0">
                    Sem pedido
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 shrink-0">
                    Aguardando
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {row.isExtra ? row.supplierName : `Pedido #${row.orderId} · ${row.supplierName}`}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase text-gray-400 leading-none">Qtd. Pedida</span>
                  <span className="text-sm font-bold text-gray-700">{row.orderedQuantity}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase text-gray-400 leading-none">Estoque Atual</span>
                  <span
                    className={cn(
                      "text-sm font-bold",
                      row.currentStock <= 0 ? "text-red-600" : "text-green-600"
                    )}
                  >
                    {row.currentStock}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-xl border shadow-sm p-10 text-center text-muted-foreground text-sm">
            {rows && rows.length > 0 ? "Nenhum item encontrado para os filtros aplicados." : "Nenhum item pendente no momento."}
          </div>
        )}
      </div>

      {/* ── DESKTOP: Tabela ── */}
      <div className="hidden md:block bg-white p-4 rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto / Variação</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-center">Qtd. Pedida</TableHead>
              <TableHead className="text-center">Estoque Atual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
              </TableRow>
            ) : filteredRows.length > 0 ? (
              filteredRows.map((row) => (
                <TableRow key={row.itemId} className={row.isExtra ? "text-muted-foreground" : undefined}>
                  <TableCell className="font-medium">{row.displayName}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {row.isExtra ? "-" : `#${row.orderId}`}
                  </TableCell>
                  <TableCell>{row.supplierName}</TableCell>
                  <TableCell className="text-center font-bold">{row.orderedQuantity}</TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        "font-bold",
                        row.currentStock <= 0 ? "text-red-600" : "text-green-600"
                      )}
                    >
                      {row.currentStock}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  {rows && rows.length > 0 ? "Nenhum item encontrado para os filtros aplicados." : "Nenhum item pendente no momento."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PedidosPendentes;
