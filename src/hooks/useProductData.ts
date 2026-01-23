import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Product } from "@/types"; // Assumindo que você pode mover os tipos para lá ou defini-los aqui

// Definição local se não estiver global
export interface ExtendedProduct {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  pix_price: number | null;
  cost_price: number | null;
  stock_quantity: number;
  category: string | null;
  sub_category: string | null;
  brand: string | null;
  image_url: string | null;
  is_visible: boolean;
  variant_prices?: number[];
  variant_costs?: (number | null)[];
  allocated_in_kits?: number;
  created_at: string;
}

export const useProductData = () => {
  const queryClient = useQueryClient();

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select(`
          *, 
          variants:product_variants(price, cost_price),
          promotion_items (
              quantity,
              promotions (
                  id,
                  name,
                  is_active,
                  stock_quantity
              )
          )
      `)
      .order("created_at", { ascending: false });
    
    if (error) throw new Error(error.message);
    
    return data.map((p: any) => {
      const variantsList = Array.isArray(p.variants) ? p.variants : [];
      const promotionItems = p.promotion_items || [];
      let allocated = 0;
      
      promotionItems.forEach((item: any) => {
          const promo = Array.isArray(item.promotions) ? item.promotions[0] : item.promotions;
          if (promo && promo.stock_quantity > 0) {
              allocated += (item.quantity * promo.stock_quantity);
          }
      });

      return {
          ...p,
          variant_prices: variantsList.map((v: any) => v.price),
          variant_costs: variantsList.map((v: any) => v.cost_price),
          allocated_in_kits: allocated
      };
    }) as ExtendedProduct[];
  };

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
    refetchOnWindowFocus: false,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
        const { data, error } = await supabase.from("categories").select("id, name").order("name");
        if (error) throw error;
        return data;
    },
  });

  const { data: subCategories } = useQuery({
    queryKey: ["subCategories"],
    queryFn: async () => {
        const { data, error } = await supabase.from("sub_categories").select("id, name, category_id").order("name");
        if (error) throw error;
        return data;
    },
  });

  const { data: brands, isLoading: isLoadingBrands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
        const { data, error } = await supabase.from("brands").select("id, name, image_url").order("name");
        if (error) throw error;
        return data;
    },
  });

  const addProductMutation = useMutation({
    mutationFn: async (newProduct: any) => {
      const { error } = await supabase.from("products").insert([newProduct]);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess("Produto adicionado!");
    },
    onError: (error) => showError(error.message),
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ productId, values }: { productId: number; values: any; }) => {
      const { error } = await supabase.from("products").update(values).eq("id", productId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess("Produto atualizado!");
    },
    onError: (error) => showError(error.message),
  });

  const activateAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("products")
        .update({ is_visible: true })
        .not("id", "is", null); // Filtro genérico para afetar todos
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess("Todos os produtos foram ativados!");
    },
    onError: (err: any) => showError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: number) => {
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess("Produto removido com sucesso!");
    },
    onError: (error) => {
      showError(`Erro ao remover produto: ${error.message}`);
    },
  });

  const bulkInsertMutation = useMutation({
    mutationFn: async (products: any[]) => {
      const { data, error } = await supabase.functions.invoke("bulk-product-upsert", { body: { products } });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => {
      showError(`Erro ao processar: ${error.message}`);
    },
  });

  return {
    products,
    categories,
    subCategories,
    brands,
    isLoadingProducts,
    isLoadingBrands,
    addProductMutation,
    updateProductMutation,
    activateAllMutation,
    deleteMutation,
    bulkInsertMutation
  };
};