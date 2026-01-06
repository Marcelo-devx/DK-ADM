import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf } from "lucide-react";
import { Badge } from "@/components/ui/badge"; // Importação adicionada

interface Flavor {
  id: number;
  name: string;
  is_visible: boolean;
}

interface ProductFlavor {
  id: number; // ID da tabela product_flavors
  flavor_id: number;
  is_visible: boolean;
}

interface ProductFlavorManagerProps {
  productId: number | undefined;
}

const fetchFlavors = async () => {
  const { data, error } = await supabase
    .from("flavors")
    .select("id, name, is_visible")
    .order("name");
  if (error) throw new Error(error.message);
  return data as Flavor[];
};

const fetchProductFlavors = async (productId: number) => {
  const { data, error } = await supabase
    .from("product_flavors")
    .select("id, flavor_id, is_visible")
    .eq("product_id", productId);
  if (error) throw new Error(error.message);
  return data as ProductFlavor[];
};

export const ProductFlavorManager = ({ productId }: ProductFlavorManagerProps) => {
  const queryClient = useQueryClient();
  const queryKey = ["productFlavors", productId];

  const { data: allFlavors, isLoading: isLoadingAllFlavors } = useQuery<Flavor[]>({
    queryKey: ["allFlavors"],
    queryFn: fetchFlavors,
  });

  const { data: productFlavors, isLoading: isLoadingProductFlavors } = useQuery<ProductFlavor[]>({
    queryKey,
    queryFn: () => fetchProductFlavors(productId!),
    enabled: !!productId,
  });

  const mutation = useMutation({
    mutationFn: async ({ flavorId, isChecked, isVisible }: { flavorId: number; isChecked: boolean; isVisible: boolean }) => {
      if (!productId) throw new Error("Product ID is required for flavor management.");

      const existingAssociation = productFlavors?.find(pf => pf.flavor_id === flavorId);

      if (isChecked) {
        // Create or update association
        if (existingAssociation) {
          // Update visibility if already exists
          if (existingAssociation.is_visible !== isVisible) {
            const { error } = await supabase
              .from("product_flavors")
              .update({ is_visible: isVisible })
              .eq("id", existingAssociation.id);
            if (error) throw error;
          }
        } else {
          // Insert new association
          const { error } = await supabase
            .from("product_flavors")
            .insert({ product_id: productId, flavor_id: flavorId, is_visible: isVisible });
          if (error) throw error;
        }
      } else {
        // Delete association
        if (existingAssociation) {
          const { error } = await supabase
            .from("product_flavors")
            .delete()
            .eq("id", existingAssociation.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      showSuccess("Sabores do produto atualizados!");
    },
    onError: (error: Error) => {
      showError(`Erro ao atualizar sabores: ${error.message}`);
    },
  });

  const handleToggleFlavor = (flavorId: number, isChecked: boolean) => {
    const currentVisibility = productFlavors?.find(pf => pf.flavor_id === flavorId)?.is_visible ?? true;
    mutation.mutate({ flavorId, isChecked, isVisible: currentVisibility });
  };

  const handleToggleVisibility = (flavorId: number, isVisible: boolean) => {
    const isChecked = productFlavors?.some(pf => pf.flavor_id === flavorId) ?? false;
    if (!isChecked) {
        // If trying to set visibility but not checked, check it first.
        mutation.mutate({ flavorId, isChecked: true, isVisible });
    } else {
        mutation.mutate({ flavorId, isChecked: true, isVisible });
    }
  };

  if (!productId) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
            <Leaf className="h-5 w-5" /> Gerenciamento de Sabores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Salve o produto primeiro para gerenciar os sabores.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoadingAllFlavors || isLoadingProductFlavors) {
    return <Skeleton className="h-64 w-full" />;
  }

  const associatedFlavors = new Map(productFlavors?.map(pf => [pf.flavor_id, pf]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
            <Leaf className="h-5 w-5" /> Sabores Disponíveis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {allFlavors && allFlavors.length > 0 ? (
          <div className="grid gap-4">
            {allFlavors.map((flavor) => {
              const isAssociated = associatedFlavors.has(flavor.id);
              const association = associatedFlavors.get(flavor.id);
              const isVisible = association?.is_visible ?? true;

              return (
                <div key={flavor.id} className="flex items-center justify-between border-b pb-2 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`flavor-${flavor.id}`}
                      checked={isAssociated}
                      onCheckedChange={(checked) => handleToggleFlavor(flavor.id, checked as boolean)}
                      disabled={mutation.isPending}
                    />
                    <Label htmlFor={`flavor-${flavor.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {flavor.name}
                      {!flavor.is_visible && <Badge variant="destructive" className="ml-2">Oculto (Global)</Badge>}
                    </Label>
                  </div>
                  {isAssociated && (
                    <div className="flex items-center space-x-2">
                        <Label className="text-xs text-muted-foreground">Visível no Produto</Label>
                        <Switch
                            checked={isVisible}
                            onCheckedChange={(checked) => handleToggleVisibility(flavor.id, checked)}
                            disabled={mutation.isPending || !flavor.is_visible}
                        />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum sabor base cadastrado. Cadastre sabores na página de Sabores.
          </p>
        )}
      </CardContent>
    </Card>
  );
};