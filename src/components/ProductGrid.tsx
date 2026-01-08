import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "./ProductCard";
import { Skeleton } from "./ui/skeleton";
import { PackageX } from "lucide-react";

const fetchPublicProducts = async () => {
  // Filtro essencial: is_visible true E stock_quantity > 0
  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, pix_price, image_url, brand, stock_quantity")
    .eq("is_visible", true)
    .gt("stock_quantity", 0) 
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

export const ProductGrid = () => {
  const { data: products, isLoading } = useQuery({
    queryKey: ["publicProducts"],
    queryFn: fetchPublicProducts,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="py-20 text-center space-y-4 bg-gray-50 rounded-3xl border-2 border-dashed">
        <PackageX className="h-12 w-12 mx-auto text-gray-300" />
        <p className="text-gray-500 font-medium italic">Nenhum produto disponível no momento.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
};