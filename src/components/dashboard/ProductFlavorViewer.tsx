import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Leaf } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FlavorAssociation {
  flavor_id: number;
  is_visible: boolean;
  flavors: {
    name: string;
  };
}

interface ProductFlavorViewerProps {
  productId: number;
  productName: string;
  isOpen: boolean;
  onClose: () => void;
}

const fetchProductFlavors = async (productId: number) => {
  const { data, error } = await supabase
    .from("product_flavors")
    .select(`
      flavor_id,
      is_visible,
      flavors (name)
    `)
    .eq("product_id", productId);
    // Removendo .order("flavors.name") para evitar erro de parsing

  if (error) throw new Error(error.message);
  return data as unknown as FlavorAssociation[];
};

export const ProductFlavorViewer = ({
  productId,
  productName,
  isOpen,
  onClose,
}: ProductFlavorViewerProps) => {
  const { data: flavors, isLoading, error } = useQuery({
    queryKey: ["productFlavorsViewer", productId],
    queryFn: () => fetchProductFlavors(productId),
    enabled: isOpen,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-green-600" /> Sabores de {productName}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 min-h-[100px]">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          ) : error ? (
            <p className="text-red-500">Erro ao carregar sabores: {error.message}</p>
          ) : flavors && flavors.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {flavors.map((association) => (
                <Badge 
                  key={association.flavor_id} 
                  variant={association.is_visible ? "default" : "secondary"}
                  className="text-sm"
                >
                  {association.flavors.name}
                  {!association.is_visible && " (Oculto)"}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhum sabor associado a este produto.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};