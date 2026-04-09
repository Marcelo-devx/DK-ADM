"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Package, Loader2, Check, ChevronsUpDown, AlertCircle } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface BreakdownItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitPixPrice: number;
  totalPixPrice: number;
}

interface CompositionTabProps {
  promotionId: number | undefined;
  onNext: (surplus: number, totalBasePrice: number, totalBasePixPrice: number, breakdown: BreakdownItem[]) => void;
}

interface ProductOption {
  id: number;
  name: string;
  stock_quantity: number;
  price: number;
  pix_price: number | null;
  variants?: VariantRow[];
}

interface VariantRow {
  id: string;
  flavor_id: number | null;
  flavors?: { name: string } | { name: string }[] | null;
  volume_ml: number | null;
  stock_quantity: number;
  price: number;
  pix_price: number | null;
  color?: string | null;
  ohms?: string | null;
  size?: string | null;
}

interface PromotionItem {
  id: number;
  product_id: number;
  variant_id: string | null;
  quantity: number;
  products: {
    name: string;
    price: number;
    pix_price: number | null;
    stock_quantity: number;
  };
  product_variants?: {
    flavors?: { name: string } | { name: string }[] | null;
    volume_ml: number | null;
    price: number;
    pix_price: number | null;
    stock_quantity: number;
    color?: string | null;
    ohms?: string | null;
    size?: string | null;
  } | null;
}

/** Monta o label completo de uma variação combinando todos os campos disponíveis */
function getVariantLabel(variant: {
  flavors?: { name: string } | { name: string }[] | null;
  volume_ml?: number | null;
  color?: string | null;
  ohms?: string | null;
  size?: string | null;
}): string {
  const parts: string[] = [];

  const flavorName = Array.isArray(variant.flavors)
    ? variant.flavors[0]?.name
    : variant.flavors?.name;

  if (flavorName) parts.push(flavorName);
  if (variant.color) parts.push(variant.color);
  if (variant.ohms) parts.push(variant.ohms);
  if (variant.size) parts.push(variant.size);
  if (variant.volume_ml) parts.push(`${variant.volume_ml}ml`);

  return parts.length > 0 ? parts.join(" / ") : "Padrão";
}

function removeDiacriticsSafe(input: string) {
  try {
    return input.normalize("NFD").replace(/\p{M}/gu, "");
  } catch (e) {
    return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
}

export const CompositionTab = ({ promotionId, onNext }: CompositionTabProps) => {
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("none");
  const [quantity, setQuantity] = useState<number>(1);
  const [openProductSearch, setOpenProductSearch] = useState(false);
  const [productSearch, setProductSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(productSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  // 1. Buscar Produtos Disponíveis
  const { data: products } = useQuery({
    queryKey: ["productsForComposition", debouncedSearch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id, name, stock_quantity, price, pix_price,
          variants:product_variants!product_variants_product_id_fkey(
            id, flavor_id, volume_ml, stock_quantity, price, pix_price,
            color, ohms, size,
            flavors!product_variants_flavor_id_fkey(name)
          )
        `)
        .eq("is_visible", true)
        .order("name");

      if (error) throw error;
      return data as unknown as ProductOption[];
    },
  });

  // 2. Buscar Itens já no Kit
  const { data: items, isLoading } = useQuery({
    queryKey: ["promotionItems", promotionId],
    queryFn: async () => {
      if (!promotionId) return [];
      const { data, error } = await supabase
        .from("promotion_items")
        .select(`
          id, product_id, variant_id, quantity,
          products(name, price, pix_price, stock_quantity),
          product_variants(
            volume_ml, price, pix_price, stock_quantity,
            color, ohms, size,
            flavors(name)
          )
        `)
        .eq("promotion_id", promotionId);
      if (error) throw error;
      return data as unknown as PromotionItem[];
    },
    enabled: !!promotionId,
  });

  // Mutations
  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!promotionId) throw new Error("Salve a promoção antes de adicionar itens.");

      const { error } = await supabase.rpc("add_item_to_kit_and_lock_stock", {
        p_promotion_id: promotionId,
        p_product_id: Number(selectedProductId),
        p_variant_id: selectedVariantId === "none" ? null : selectedVariantId,
        p_quantity_per_kit: quantity,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionItems", promotionId] });
      queryClient.invalidateQueries({ queryKey: ["productsForComposition"] });
      showSuccess("Item adicionado e estoque reservado!");
      setQuantity(1);
      setSelectedProductId("");
      setSelectedVariantId("none");
    },
    onError: (err: any) => showError(err.message),
  });

  const removeItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc("remove_item_from_kit_and_unlock_stock", {
        p_item_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionItems", promotionId] });
      queryClient.invalidateQueries({ queryKey: ["productsForComposition"] });
      showSuccess("Item removido e estoque devolvido.");
    },
    onError: (err: any) => showError(err.message),
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const handleNext = () => {
    if (!items || items.length === 0) {
      showError("⚠️ Erro de validação: Você precisa adicionar pelo menos um produto ao kit antes de continuar.");
      return;
    }

    let totalBase = 0;
    let totalBasePix = 0;
    let minStockLimit = Number.MAX_SAFE_INTEGER;
    const breakdown: BreakdownItem[] = [];

    items.forEach((item) => {
      const entity = item.product_variants || item.products;
      const price = entity.price || 0;
      const pixPrice = entity.pix_price || price;
      const currentStock = entity.stock_quantity;

      const variantLabel = item.product_variants
        ? getVariantLabel(item.product_variants)
        : null;

      const itemName = variantLabel
        ? `${item.products.name} - ${variantLabel}`
        : item.products.name;

      totalBase += price * item.quantity;
      totalBasePix += pixPrice * item.quantity;

      breakdown.push({
        name: itemName,
        quantity: item.quantity,
        unitPrice: price,
        totalPrice: price * item.quantity,
        unitPixPrice: pixPrice,
        totalPixPrice: pixPrice * item.quantity,
      });

      const possibleKitsWithThisItem = Math.floor(currentStock / item.quantity);
      if (possibleKitsWithThisItem < minStockLimit) {
        minStockLimit = possibleKitsWithThisItem;
      }
    });

    const surplus = minStockLimit === Number.MAX_SAFE_INTEGER ? 0 : minStockLimit;
    onNext(surplus, totalBase, totalBasePix, breakdown);
  };

  if (!promotionId) return null;

  const filteredProducts = products?.filter((p) => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return true;
    return removeDiacriticsSafe(p.name.toLowerCase()).includes(removeDiacriticsSafe(term));
  });

  useEffect(() => {
    if (!openProductSearch) setProductSearch("");
  }, [openProductSearch]);

  const selectedProduct = products?.find((p) => String(p.id) === selectedProductId);

  const { data: productVariants } = useQuery<VariantRow[]>({
    queryKey: ["productVariants", selectedProductId],
    queryFn: async () => {
      if (!selectedProductId) return [] as VariantRow[];
      const { data, error } = await supabase
        .from("product_variants")
        .select(`id, flavor_id, volume_ml, stock_quantity, price, pix_price, color, ohms, size, flavors(name)`)
        .eq("product_id", Number(selectedProductId))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as VariantRow[];
    },
    enabled: !!selectedProductId,
  });

  const allVariants = (productVariants ?? (selectedProduct?.variants as any) ?? []) as VariantRow[];
  const hasVariants = allVariants.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2 pb-2 border-b">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-bold text-gray-700 uppercase">2. Composição do Kit</h3>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="text-red-500">*</span> Pelo menos 1 produto
        </div>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-800">
          Você precisa adicionar pelo menos um produto à composição do kit antes de continuar para a etapa de precificação.
        </AlertDescription>
      </Alert>

      {/* Formulário para adicionar itens */}
      <div className="bg-gray-50 p-4 rounded-lg border">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5 space-y-1">
            <Label className="text-xs font-medium">Produto</Label>

            <Popover open={openProductSearch} onOpenChange={setOpenProductSearch}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openProductSearch}
                  className="w-full h-10 justify-between text-sm"
                >
                  {selectedProductId
                    ? products?.find((p) => String(p.id) === selectedProductId)?.name
                    : "Buscar produto..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Digite para buscar..."
                    value={productSearch}
                    onValueChange={setProductSearch}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum produto ativo encontrado.</CommandEmpty>
                    <CommandGroup>
                      {filteredProducts?.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.name}
                          onSelect={() => {
                            setSelectedProductId(String(p.id));
                            setSelectedVariantId("none");
                            setOpenProductSearch(false);
                            setProductSearch("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedProductId === String(p.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="md:col-span-4 space-y-1">
            <Label className="text-xs font-medium">Variação</Label>
            <Select
              value={selectedVariantId}
              onValueChange={setSelectedVariantId}
              disabled={!selectedProductId}
            >
              <SelectTrigger className="h-10 text-sm">
                <SelectValue
                  placeholder={
                    !selectedProductId
                      ? "Selecione prod..."
                      : hasVariants
                      ? "Selecione uma variação..."
                      : "Produto sem variações"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {!hasVariants && selectedProduct && (
                  <SelectItem value="none">Produto Base</SelectItem>
                )}

                {hasVariants &&
                  allVariants.map((v) => {
                    const hasStock = v.stock_quantity > 0;
                    const stockText = hasStock ? `${v.stock_quantity} un.` : "Sem estoque";
                    const label = getVariantLabel(v);
                    return (
                      <SelectItem key={v.id} value={v.id}>
                        <div className="flex items-center gap-2">
                          <span className="flex-1">{label}</span>
                          <Badge
                            variant={hasStock ? "outline" : "secondary"}
                            className={cn(
                              "text-[10px] h-5 px-1.5",
                              !hasStock && "bg-red-50 text-red-600 border-red-200"
                            )}
                          >
                            {stockText}
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 space-y-1">
            <Label className="text-xs font-medium">Qtd p/ Kit</Label>
            <Input
              type="number"
              min={1}
              className="h-10 text-sm"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>

          <div className="md:col-span-1">
            <Button
              type="button"
              size="sm"
              className="w-full h-10 bg-blue-600 hover:bg-blue-700"
              disabled={
                !selectedProductId ||
                addItemMutation.isPending ||
                (hasVariants && selectedVariantId === "none")
              }
              onClick={() => {
                const selectedVariant = allVariants.find((v) => v.id === selectedVariantId);
                if (selectedVariant && selectedVariant.stock_quantity <= 0) {
                  showError("Atenção: Esta variação não tem estoque disponível no momento.");
                }
                addItemMutation.mutate();
              }}
            >
              {addItemMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabela de itens */}
      <div className="border rounded-md bg-white overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow className="h-10">
              <TableHead className="h-10 text-xs font-semibold">Produto</TableHead>
              <TableHead className="h-10 text-xs font-semibold">Variação</TableHead>
              <TableHead className="h-10 text-xs font-semibold text-center">Qtd</TableHead>
              <TableHead className="h-10 text-xs font-semibold text-right">Preço Unit.</TableHead>
              <TableHead className="h-10 text-xs font-semibold text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-xs py-4">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : items?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                  Adicione produtos para compor este kit.
                </TableCell>
              </TableRow>
            ) : (
              items?.map((item) => {
                const entity = item.product_variants || item.products;
                const unitPrice = entity.price || 0;
                const variantLabel = item.product_variants
                  ? getVariantLabel(item.product_variants)
                  : null;

                return (
                  <TableRow key={item.id} className="h-10 hover:bg-gray-50">
                    <TableCell className="text-sm font-medium py-2">{item.products.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground py-2">
                      {variantLabel ? (
                        <span className="font-medium text-gray-700">{variantLabel}</span>
                      ) : (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          Produto Base
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-bold text-sm py-2">{item.quantity}</TableCell>
                    <TableCell className="text-right text-sm py-2 text-muted-foreground">
                      {formatCurrency(unitPrice)}
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeItemMutation.mutate(item.id)}
                        disabled={removeItemMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Resumo */}
      {items && items.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">
              <span className="font-semibold text-blue-700">{items.length}</span> itens no kit
            </span>
            <Button
              type="button"
              onClick={handleNext}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Avançar →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};