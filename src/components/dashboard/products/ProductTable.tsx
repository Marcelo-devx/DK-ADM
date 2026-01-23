import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ImageOff, Lock, MoreHorizontal, Pencil, Trash2, Star } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExtendedProduct } from "@/hooks/useProductData";

interface ProductTableProps {
  isLoading: boolean;
  products: ExtendedProduct[];
  onEdit: (product: ExtendedProduct) => void;
  onDelete: (product: ExtendedProduct) => void;
  onViewVariants: (product: { id: number; name: string }) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

export const ProductTable = ({ isLoading, products, onEdit, onDelete, onViewVariants }: ProductTableProps) => {
  const getPriceDisplay = (product: ExtendedProduct, isCost: boolean = false) => {
    if (!product) return "-";
    const costsArray = Array.isArray(product.variant_costs) ? product.variant_costs : [];
    const pricesArray = Array.isArray(product.variant_prices) ? product.variant_prices : [];
    const values = isCost ? (costsArray.filter(v => v !== null) as number[]) : (pricesArray.filter(v => v !== null) as number[]);
    const baseValue = isCost ? (product.cost_price ?? 0) : (product.price ?? 0);
    
    if (values.length === 0) return formatCurrency(baseValue);
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={() => onViewVariants({ id: product.id, name: product.name })} className="flex items-center gap-1 hover:bg-primary/5 p-1 rounded-md transition-colors cursor-help group">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 group-hover:scale-110" />
                <span className="font-bold text-xs">{min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent><p>Clique para ver as {values.length} variações</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <Table>
        <TableHeader className="bg-gray-50/50">
          <TableRow>
            <TableHead className="w-[64px]">Imagem</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Custo</TableHead>
            <TableHead>Venda</TableHead>
            <TableHead className="text-green-600">Pix</TableHead>
            <TableHead>Estoque Disponível</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={10} className="text-center py-10"><RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
          ) : products && products.length > 0 ? (
            products.map((product) => (
              <TableRow key={product.id} className="hover:bg-gray-50/50 transition-colors">
                <TableCell>{product.image_url ? <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded-lg object-cover shadow-sm border" /> : <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center border border-dashed"><ImageOff className="h-5 w-5 text-gray-400" /></div>}</TableCell>
                <TableCell className="font-mono text-[10px] font-black text-gray-500">#{product.sku || product.id}</TableCell>
                <TableCell className="font-bold text-xs truncate max-w-[200px] text-gray-800">{product.name}</TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground">{product.category || "N/A"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{getPriceDisplay(product, true)}</TableCell>
                <TableCell className="text-xs font-bold text-gray-700">{getPriceDisplay(product)}</TableCell>
                <TableCell className="text-xs font-black text-green-700">{product.pix_price ? formatCurrency(product.pix_price) : '-'}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                      <Badge variant={product.stock_quantity <= 5 ? "destructive" : "secondary"} className="h-5 text-[10px] w-fit font-black">
                          {product.stock_quantity} un
                      </Badge>
                      {product.allocated_in_kits ? (
                          <Badge variant="outline" className="h-5 text-[9px] w-fit bg-amber-50 text-amber-700 border-amber-200 gap-1 font-bold" title="Quantidade reservada em Kits">
                              <Lock className="w-2.5 h-2.5" /> + {product.allocated_in_kits} em Kits
                          </Badge>
                      ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="hover:bg-primary/5">
                        <MoreHorizontal className="h-4 w-4 text-primary" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => onEdit(product)}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600" onSelect={() => onDelete(product)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          ) : <TableRow><TableCell colSpan={10} className="text-center py-20 text-muted-foreground italic">Nenhum produto encontrado.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};