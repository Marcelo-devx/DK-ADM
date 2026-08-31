import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/dashboard/product-form";
import { useProductData } from "@/hooks/useProductData";
import { supabase } from "@/integrations/supabase/client";

const ProductAddPage = () => {
  const navigate = useNavigate();
  const { products, categories, subCategories, brands, addProductMutation } = useProductData();

  const handleFormSubmit = async (values: any, variantsToClone?: any[], subCategoryIds?: number[]) => {
    const result = await addProductMutation.mutateAsync({ productData: values, variants: variantsToClone });

    const pid = result?.id;
    if (pid && subCategoryIds && subCategoryIds.length > 0) {
      const inserts = subCategoryIds.map(sid => ({ product_id: pid, sub_category_id: sid }));
      await supabase.from('product_sub_categories').insert(inserts);
    }

    navigate("/dashboard/products");
  };

  return (
    <div className="pb-20 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate("/dashboard/products")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Adicionar Novo Produto</h1>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-xl border shadow-sm">
        <ProductForm
          onSubmit={handleFormSubmit}
          isSubmitting={addProductMutation.isPending}
          categories={categories || []}
          isLoadingCategories={false}
          subCategories={subCategories || []}
          isLoadingSubCategories={false}
          brands={brands || []}
          isLoadingBrands={false}
          existingProducts={products || []}
        />
      </div>
    </div>
  );
};

export default ProductAddPage;
