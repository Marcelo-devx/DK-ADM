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

interface Variant {
  id: string;
  flavor_id: number | null;
  volume_ml: number | null;
  color: string | null;
  ohms: string | null;
  size: string | null;
  sku: string | null;
  price: number;
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
    .order('price', { ascending: true });

  if (error) throw error;
  return data as any[];
};

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

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="h-6 w-6 text-primary" /> 
            Variações: {productName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto mt-4 border rounded-lg">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <p className="p-4 text-red-500 text-center">Erro ao carregar variações.</p>
          ) : variants && variants.length > 0 ? (
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
                {variants.map((v) => (
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
          ) : (
            <p className="p-10 text-center text-muted-foreground">Nenhuma variação encontrada.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};