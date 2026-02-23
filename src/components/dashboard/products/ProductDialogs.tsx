import { useSearchParams } from "react-router-dom";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { ProductForm } from "../product-form";
import { ExtendedProduct, useProductData } from "@/hooks/useProductData";
import { ProductVariantViewer } from "../ProductVariantViewer";
import { ImportConfirmationModal } from "../ImportConfirmationModal";
import { ImportResultModal } from "../ImportResultModal";
import { supabase } from "@/integrations/supabase/client";

interface ProductDialogsProps {
  products: ExtendedProduct[];
  categories: any[];
  subCategories: any[];
  brands: any[];
  productsToConfirm: any[];
  importResult: any;
  setImportResult: (res: any) => void;
  setProductsToConfirm: (prods: any[]) => void;
}

export const ProductDialogs = ({ 
  products, categories, subCategories, brands,
  productsToConfirm, importResult, setImportResult, setProductsToConfirm
}: ProductDialogsProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addProductMutation, updateProductMutation, deleteMutation, bulkInsertMutation } = useProductData();
  
  const mode = searchParams.get("mode");
  const targetId = searchParams.get("id");
  const selectedProduct = products.find(p => String(p.id) === targetId);

  const handleClose = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("mode");
    newParams.delete("id");
    setSearchParams(newParams);
  };

  const handleFormSubmit = async (values: any, variantsToClone?: any[], subCategoryIds?: number[]) => {
    let result: any;
    
    if (mode === 'edit' && selectedProduct) {
      result = await updateProductMutation.mutateAsync({ productId: selectedProduct.id, values });
    } else {
      result = await addProductMutation.mutateAsync({ productData: values, variants: variantsToClone });
    }

    // Sincroniza Sub-categorias
    const pid = mode === 'edit' ? selectedProduct?.id : result?.id;
    if (pid && subCategoryIds) {
        // Limpa antigas
        await supabase.from('product_sub_categories').delete().eq('product_id', pid);
        // Insere novas
        if (subCategoryIds.length > 0) {
            const inserts = subCategoryIds.map(sid => ({ product_id: pid, sub_category_id: sid }));
            await supabase.from('product_sub_categories').insert(inserts);
        }
    }
    
    handleClose();
  };

  return (
    <>
      <Dialog open={mode === 'create' || (mode === 'edit' && !!selectedProduct)} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === 'edit' ? `Editar: ${selectedProduct?.name}` : "Adicionar Novo Produto"}</DialogTitle>
          </DialogHeader>
          <ProductForm 
            onSubmit={handleFormSubmit} 
            isSubmitting={addProductMutation.isPending || updateProductMutation.isPending} 
            categories={categories || []} 
            isLoadingCategories={false} 
            subCategories={subCategories || []} 
            isLoadingSubCategories={false} 
            brands={brands || []} 
            isLoadingBrands={false} 
            initialData={selectedProduct ? { 
                ...selectedProduct, 
                sku: selectedProduct.sku || '', 
                description: selectedProduct.description || '', 
                category: selectedProduct.category || '', 
                brand: selectedProduct.brand || '', 
                image_url: selectedProduct.image_url || '', 
                cost_price: selectedProduct.cost_price || 0, 
                pix_price: selectedProduct.pix_price || 0 
            } : undefined} 
            existingProducts={products}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={mode === 'delete' && !!selectedProduct} onOpenChange={(open) => !open && handleClose()}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600" onClick={async () => { if (selectedProduct) { await deleteMutation.mutateAsync(selectedProduct.id); handleClose(); } }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedProduct && mode === 'variants' && (<ProductVariantViewer productId={selectedProduct.id} productName={selectedProduct.name} isOpen={true} onClose={handleClose} />)}
    </>
  );
};