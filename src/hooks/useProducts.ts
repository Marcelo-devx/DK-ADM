import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productService } from "@/services/productService";
import { showSuccess, showError } from "@/utils/toast";

export const useProducts = () => {
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: productService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess("Produto criado com sucesso!");
    },
    onError: (err: any) => showError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => productService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess("Produto atualizado!");
    },
    onError: (err: any) => showError(err.message),
  });

  return { 
    products, 
    isLoading, 
    createProduct: createMutation.mutate, 
    updateProduct: updateMutation.mutate 
  };
};