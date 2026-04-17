import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Ruler, Droplets, Palette, Zap, Maximize } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sortVariantsBySpecification } from "@/utils/variantSort";
import { cn } from "@/lib/utils";

interface Variant {
  id: string;
  flavor_id: number | null;
  volume_ml: number | null;
  color: string | null;
  ohms: string | null;
  size: string | null;
  sku: string | null;
  price: number;
  pix_price?: number | null;
  cost_price?: number | null;
  stock_quantity: number;
  flavors: { name: string } | null;
}

interface ProductVariantViewerProps {
  productId: number;
  productName: string;
  isOpen: boolean;
  onClose: () => void;
}

const fetchVariants = async (productId: number) => {
  const { data, error } = await supabase
    .from("product_variants")
    .select(`*, flavors(name)`)
    .eq("product_id", productId)
    .order("price", { ascending: true });

  if (error) throw error;
  return data as any[];
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

export const ProductVariantViewer = ({
  productId,
  productName,
  isOpen,
  onClose,
}: ProductVariantViewerProps) => {
  const { data: variants, isLoading, error } = useQuery<Variant[]>({
    queryKey: ["productVariantsViewer", productId],
    queryFn: () => fetchVariants(productId),
    enabled: isOpen,
  });

  const sortedVariants = variants ? sortVariantsBySpecification(variants) : [];

  const getSpecLabel = (v: Variant) => {
    const parts: string[] = [];
    if (v.flavors?.name) parts.push(v.flavors.name);
    if (v.color) parts.push(v.color);
    if (v.size) parts.push(v.size);
    if (v.ohms) parts.push(`${v.ohms}Ω`);
    if (v.volume_ml) parts.push(`${v.volume_ml}ml`);
    return parts.length > 0 ? parts.join(" / ") : "Padrão";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-3xl h-[100dvh] md:h-auto md:max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-none md:rounded-lg">
        {/* Header fixo */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b bg-white shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base md:text-xl">
            <Package className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">Variações: {productName}</span>
          </DialogTitle>
          {!isLoading && sortedVariants.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {sortedVariants.length} variação{sortedVariants.length !== 1 ? "ões" : ""} encontrada{sortedVariants.length !== 1 ? "s" : ""}
            </p>
          )}
        </DialogHeader>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <p className="p-8 text-red-500 text-center text-sm">Erro ao carregar variações.</p>
          ) : sortedVariants.length > 0 ? (
            <>
              {/* ── MOBILE: Cards ── */}
              <div className="md:hidden p-3 space-y-2">
                {sortedVariants.map((v) => {
                  const isLow = v.stock_quantity <= 5;
                  const isOut = v.stock_quantity === 0;
                  return (
                    <div
                      key={v.id}
                      className={cn(
                        "rounded-xl border bg-white p-3 shadow-sm",
                        isOut && "border-l-4 border-l-red-400",
                        isLow && !isOut && "border-l-4 border-l-orange-400"
                      )}
                    >
                      {/* Linha 1: especificação + estoque */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-900 leading-tight">
                            {getSpecLabel(v)}
                          </p>
                          {v.sku && (
                            <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                              {v.sku}
                            </span>
                          )}
                        </div>
                        <Badge
                          variant={isOut ? "destructive" : isLow ? "outline" : "secondary"}
                          className={cn(
                            "text-xs font-black px-2 shrink-0",
                            isLow && !isOut && "bg-orange-100 text-orange-700 border-orange-300",
                            !isLow && !isOut && "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {v.stock_quantity} un
                        </Badge>
                      </div>

                      {/* Linha 2: especificações extras */}
                      <div className="flex flex-wrap gap-2 mb-2">
                        {v.flavors?.name && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Droplets className="w-3 h-3 text-primary" /> {v.flavors.name}
                          </span>
                        )}
                        {v.color && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Palette className="w-3 h-3" /> {v.color}
                          </span>
                        )}
                        {v.size && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Maximize className="w-3 h-3" /> {v.size}
                          </span>
                        )}
                        {v.volume_ml && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Ruler className="w-3 h-3" /> {v.volume_ml}ml
                          </span>
                        )}
                        {v.ohms && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Zap className="w-3 h-3" /> {v.ohms}
                          </span>
                        )}
                      </div>

                      {/* Linha 3: preços */}
                      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                        {v.cost_price != null && v.cost_price > 0 && (
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase text-gray-400 leading-none">Custo</span>
                            <span className="text-xs font-semibold text-gray-500">{formatCurrency(v.cost_price)}</span>
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold uppercase text-gray-400 leading-none">Venda</span>
                          <span className="text-sm font-black text-primary">{formatCurrency(v.price)}</span>
                        </div>
                        {v.pix_price != null && v.pix_price > 0 && (
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase text-green-500 leading-none">Pix</span>
                            <span className="text-xs font-black text-green-700">{formatCurrency(v.pix_price)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── DESKTOP: Tabela ── */}
              <div className="hidden md:block border-t">
                <Table>
                  <TableHeader className="bg-gray-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Especificação</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-center">Preço</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedVariants.map((v) => (
                      <TableRow key={v.id} className="hover:bg-gray-50/50">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm flex items-center gap-1">
                              <Droplets className="w-3 h-3 text-primary" /> {v.flavors?.name || "Sem Sabor"}
                            </span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {v.color && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Palette className="w-3 h-3" /> {v.color}
                                </span>
                              )}
                              {v.size && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Maximize className="w-3 h-3" /> {v.size}
                                </span>
                              )}
                              {v.volume_ml && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Ruler className="w-3 h-3" /> {v.volume_ml}ml
                                </span>
                              )}
                              {v.ohms && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Zap className="w-3 h-3" /> {v.ohms}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-[10px] text-muted-foreground bg-gray-100 px-1 rounded">
                            {v.sku || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary">
                          {formatCurrency(v.price)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={v.stock_quantity <= 5 ? "destructive" : "secondary"} className="h-5 text-[10px]">
                            {v.stock_quantity} un
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <p className="p-10 text-center text-muted-foreground text-sm">Nenhuma variação encontrada.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
