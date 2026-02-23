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
import { useState, useEffect } from "react";

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
  
  // URL State Helpers
  const mode = searchParams.get("mode"); // 'create' | 'edit' | 'delete' | 'variants' | 'import-confirm' | 'import-result'
  const targetId = searchParams.get("id");
  
  const selectedProduct = products.find(p => String(p.id) === targetId);

  const handleClose = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("mode");
    newParams.delete("id");
    setSearchParams(newParams);
  };

  const handleFormSubmit = async (values: any, variantsToClone?: any[]) => {
    if (mode === 'edit' && selectedProduct) {
      await updateProductMutation.mutateAsync({ productId: selectedProduct.id, values });
    } else {
      // Passa as variações para a mutação de criação
      await addProductMutation.mutateAsync({ productData: values, variants: variantsToClone });
    }
    handleClose(); // Fecha apenas após sucesso (o mutation faz throw se errar)
  };

  return (
    <>
      {/* ADD / EDIT MODAL */}
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
            initialData={selectedProduct ? { ...selectedProduct, sku: selectedProduct.sku || '', description: selectedProduct.description || '', category: selectedProduct.category || '', sub_category: selectedProduct.sub_category || '', brand: selectedProduct.brand || '', image_url: selectedProduct.image_url || '', cost_price: selectedProduct.cost_price || 0, pix_price: selectedProduct.pix_price || 0 } : undefined} 
            existingProducts={products}
          />
        </DialogContent>
      </Dialog>

      {/* DELETE ALERT */}
      <AlertDialog open={mode === 'delete' && !!selectedProduct} onOpenChange={(open) => !open && handleClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedProduct?.name}"? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (selectedProduct) {
                  await deleteMutation.mutateAsync(selectedProduct.id);
                  handleClose();
                }
              }}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* VARIANTS VIEWER */}
      {selectedProduct && mode === 'variants' && (
        <ProductVariantViewer 
          productId={selectedProduct.id} 
          productName={selectedProduct.name} 
          isOpen={true} 
          onClose={handleClose} 
        />
      )}

      {/* IMPORT CONFIRMATION */}
      <ImportConfirmationModal 
        isOpen={mode === 'import-confirm'} 
        onClose={() => { setProductsToConfirm([]); handleClose(); }} 
        productsToImport={productsToConfirm} 
        onConfirm={async () => {
            const res = await bulkInsertMutation.mutateAsync(productsToConfirm);
            setProductsToConfirm([]);
            setImportResult(res.details);
            const params = new URLSearchParams(searchParams);
            params.set("mode", "import-result");
            setSearchParams(params);
        }} 
        isSubmitting={bulkInsertMutation.isPending} 
      />

      {/* IMPORT RESULT */}
      <ImportResultModal 
        isOpen={mode === 'import-result'} 
        onClose={() => { setImportResult(null); handleClose(); }} 
        result={importResult} 
      />
    </>
  );
};