import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ImageOff, MoreHorizontal, Pencil, Trash2, Star, Lock, Eye, EyeOff, Package,
} from "lucide-react";
import { ExtendedProduct } from "@/hooks/useProductData";

interface ProductMobileCardProps {
  product: ExtendedProduct;
  onEdit: (product: ExtendedProduct) => void;
  onDelete: (product: ExtendedProduct) => void;
  onViewVariants: (product: { id: number; name: string }) => void;
  onToggleVisibility?: (productId: number, isVisible: boolean) => void;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

export const ProductMobileCard = ({
  product,
  onEdit,
  onDelete,
  onViewVariants,
  onToggleVisibility,
}: ProductMobileCardProps) => {
  const costsArray = Array.isArray(product.variant_costs) ? product.variant_costs : [];
  const pricesArray = Array.isArray(product.variant_prices) ? product.variant_prices : [];
  const costValues = costsArray.filter((v) => v != null && Number(v) > 0) as number[];
  const priceValues = pricesArray.filter((v) => v !== null) as number[];

  const displayCost =
    costValues.length > 0
      ? costValues.reduce((a, b) => Number(a) + Number(b), 0) / costValues.length
      : product.cost_price ?? 0;

  const displayPrice =
    priceValues.length > 0 ? Math.max(...priceValues) : product.price ?? 0;

  const hasVariants = priceValues.length > 0 || costValues.length > 0;

  const variantTotal = Number(product.variant_stock_total || 0);
  const displayStock = variantTotal > 0 ? variantTotal : product.stock_quantity || 0;
  const isLowStock = displayStock <= 5;
  const isOutOfStock = displayStock === 0;

  return (
    <div
      className={cn(
        "rounded-xl border shadow-sm p-3 mb-2 bg-white transition-all active:scale-[0.99]",
        isOutOfStock && "border-l-4 border-l-red-400",
        isLowStock && !isOutOfStock && "border-l-4 border-l-orange-400",
        !product.is_visible && "opacity-70"
      )}
    >
      {/* Top row: imagem + info principal + switch + menu */}
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <div className="shrink-0">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-14 w-14 rounded-lg object-cover border shadow-sm"
            />
          ) : (
            <div className="h-14 w-14 rounded-lg bg-gray-100 border border-dashed flex items-center justify-center">
              <ImageOff className="h-5 w-5 text-gray-400" />
            </div>
          )}
        </div>

        {/* Info central */}
        <button
          className="flex-1 text-left min-w-0"
          onClick={() => hasVariants && onViewVariants({ id: product.id, name: product.name })}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            {hasVariants && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />}
            <p className="font-bold text-sm text-gray-900 leading-tight truncate">{product.name}</p>
          </div>
          <p className="text-[11px] font-mono text-gray-400 font-bold">
            #{product.sku || product.id}
          </p>
          {product.category && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{product.category}</p>
          )}
        </button>

        {/* Switch visibilidade + menu */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex flex-col items-center gap-0.5">
            <Switch
              checked={product.is_visible}
              onCheckedChange={(checked) => onToggleVisibility?.(product.id, checked)}
              className="scale-90 data-[state=checked]:bg-green-500"
            />
            <span className={cn("text-[9px] font-bold", product.is_visible ? "text-green-600" : "text-gray-400")}>
              {product.is_visible ? "Ativo" : "Oculto"}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onEdit(product)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              {hasVariants && (
                <DropdownMenuItem onSelect={() => onViewVariants({ id: product.id, name: product.name })}>
                  <Star className="mr-2 h-4 w-4 text-yellow-500" /> Ver Variações
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => onToggleVisibility?.(product.id, !product.is_visible)}
              >
                {product.is_visible ? (
                  <><EyeOff className="mr-2 h-4 w-4" /> Ocultar</>
                ) : (
                  <><Eye className="mr-2 h-4 w-4" /> Publicar</>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600" onSelect={() => onDelete(product)}>
                <Trash2 className="mr-2 h-4 w-4" /> Remover
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Preços + Estoque */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {/* Preços */}
        <div className="flex items-center gap-2 flex-wrap">
          {displayCost > 0 && (
            <div className="flex flex-col items-start">
              <span className="text-[9px] font-bold uppercase text-gray-400 leading-none">Custo</span>
              <span className="text-xs font-semibold text-gray-500">{formatCurrency(displayCost)}</span>
            </div>
          )}
          {displayPrice > 0 && (
            <div className="flex flex-col items-start">
              <span className="text-[9px] font-bold uppercase text-gray-400 leading-none">Venda</span>
              <span className="text-xs font-bold text-gray-800">{formatCurrency(displayPrice)}</span>
            </div>
          )}
          {product.pix_price && product.pix_price > 0 && (
            <div className="flex flex-col items-start">
              <span className="text-[9px] font-bold uppercase text-green-500 leading-none">Pix</span>
              <span className="text-xs font-black text-green-700">{formatCurrency(product.pix_price)}</span>
            </div>
          )}
        </div>

        {/* Estoque */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge
            variant={isOutOfStock ? "destructive" : isLowStock ? "outline" : "secondary"}
            className={cn(
              "text-[11px] font-black px-2 py-0.5 flex items-center gap-1",
              isLowStock && !isOutOfStock && "bg-orange-100 text-orange-700 border-orange-300",
              !isLowStock && !isOutOfStock && "bg-emerald-100 text-emerald-700"
            )}
          >
            <Package className="w-3 h-3" />
            {displayStock} un
          </Badge>
          {product.allocated_in_kits ? (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200 gap-1 font-bold"
            >
              <Lock className="w-2.5 h-2.5" />+{product.allocated_in_kits} kits
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
};
