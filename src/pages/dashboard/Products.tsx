import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ProductForm } from "../../components/dashboard/product-form";
import { showSuccess, showError } from "../../utils/toast";
import { Search } from "lucide-react";
import * as XLSX from 'xlsx';
import { ImportConfirmationModal, ProductImportData } from "@/components/dashboard/ImportConfirmationModal";
import { ImportResultModal } from "@/components/dashboard/ImportResultModal";
import { mapRowKeys } from "@/utils/excel-utils";
import { ProductVariantViewer } from "@/components/dashboard/ProductVariantViewer";
import { ProductActions } from "@/components/dashboard/products/ProductActions";
import { ProductTable } from "@/components/dashboard/products/ProductTable";
import { ExtendedProduct } from "@/components/dashboard/products/types";

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
  
  return data.map(p => {
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

const cleanAndParseFloat = (value: any): number => {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const cleaned = value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(/,/g, '.');
        return parseFloat(cleaned) || 0;
    }
    return 0;
};

const ProductsPage = () => {
  const queryClient = useQueryClient();
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ExtendedProduct | null>(null);
  
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [isVariantViewerOpen, setIsVariantViewerOpen] = useState(false);
  const [productToViewVariants, setProductToViewVariants] = useState<{ id: number, name: string } | null>(null);

  const [isImportConfirmationModalOpen, setIsImportConfirmationModalOpen] = useState(false);
  const [productsToConfirm, setProductsToConfirm] = useState<ProductImportData[]>([]);
  
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const { data: products, isLoading: isLoadingProducts } = useQuery<ExtendedProduct[]>({
    queryKey: ["products"],
    queryFn: fetchProducts,
    refetchOnWindowFocus: false,
  });

  const { data: categories, isLoading: isLoadingCategories } = useQuery({
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

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    return products.filter(product => {
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      const matchesBrand = brandFilter === 'all' || product.brand === brandFilter;
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (product.sku?.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchesCategory && matchesBrand && matchesSearch;
    });
  }, [products, categoryFilter, brandFilter, searchTerm]);

  const addProductMutation = useMutation({
    mutationFn: async (newProduct: any) => {
      const { error } = await supabase.from("products").insert([newProduct]);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess("Produto adicionado!");
      setIsProductModalOpen(false);
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
      setIsEditModalOpen(false);
    },
    onError: (error) => showError(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: number) => {
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsDeleteAlertOpen(false);
      showSuccess("Produto removido com sucesso!");
    },
    onError: (error) => {
      showError(`Erro ao remover produto: ${error.message}`);
    },
  });

  const handleDeleteConfirm = () => {
    if (!selectedProduct) return;
    deleteMutation.mutate(selectedProduct.id);
  };

  const bulkInsertMutation = useMutation({
    mutationFn: async (products: ProductImportData[]) => {
      const { data, error } = await supabase.functions.invoke("bulk-product-upsert", { body: { products } });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsImportConfirmationModalOpen(false);
      setProductsToConfirm([]);
      setImportResult(data.details);
      setIsResultModalOpen(true);
    },
    onError: (error) => {
      showError(`Erro ao processar: ${error.message}`);
    },
  });

  const handleImportXLSX = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
        
        const productsToInsert: ProductImportData[] = json.map(mapRowKeys).map((row: any) => ({
            sku: row.sku || '',
            name: row.nome,
            description: row.descricao || null,
            cost_price: cleanAndParseFloat(row.precodecusto) || null,
            price: cleanAndParseFloat(row.precodevenda),
            pix_price: cleanAndParseFloat(row.precopix) || null,
            stock_quantity: parseInt(row.estoque, 10) || 0,
            category: row.categoria || null,
            sub_category: row.subcategoria || null,
            brand: row.marca || null,
            image_url: row.imagem || null,
            is_visible: row.publicadosimnao?.toLowerCase() === 'sim',
            flavor_names: row.sabores || '' 
        }));
        setProductsToConfirm(productsToInsert);
        setIsImportConfirmationModalOpen(true);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const handleExportXLSX = () => {
    if (!products?.length) return;
    const headers = ["SKU", "Nome", "Sabores", "Descrição", "Preço de Custo", "Preço de Venda", "Preço Pix", "Estoque", "Categoria", "Sub-categoria", "Marca", "Imagem", "Publicado (Sim/Não)"];
    const data = products.map(p => [
        p.sku || '', 
        p.name,
        '', 
        p.description || '', 
        p.cost_price || 0, 
        p.price, 
        p.pix_price || 0,
        p.stock_quantity, 
        p.category || '', 
        p.sub_category || '', 
        p.brand || '', 
        p.image_url || '', 
        p.is_visible ? 'Sim' : 'Não'
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Produtos");
    XLSX.writeFile(workbook, "produtos_tabacaria.xlsx");
  };

  const handleDownloadTemplate = () => {
    const headers = ["SKU", "Nome", "Sabores", "Descrição", "Preço de Custo", "Preço de Venda", "Preço Pix", "Estoque", "Categoria", "Sub-categoria", "Marca", "Imagem", "Publicado (Sim/Não)"];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "template_importacao_produtos.xlsx");
  };

  return (
    <div className="pb-20">
      <div className="flex flex-col gap-6 mb-8">
        
        {/* COMPONENTE DE AÇÕES */}
        <ProductActions 
            totalProducts={filteredProducts.length}
            onAddProduct={() => setIsProductModalOpen(true)}
            onImport={handleImportXLSX}
            onExport={handleExportXLSX}
            onDownloadTemplate={handleDownloadTemplate}
        />

        {/* FILTROS */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-white p-4 rounded-xl border shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar produto ou SKU..." className="pl-9 bg-gray-50/50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="bg-gray-50/50"><SelectValue placeholder="Todas as Marcas" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas as Marcas</SelectItem>{brands?.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="bg-gray-50/50"><SelectValue placeholder="Todas as Categorias" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas as Categorias</SelectItem>{categories?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex items-center justify-end"><span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{filteredProducts?.length || 0} encontrados</span></div>
        </div>
      </div>

      {/* TABELA MODULARIZADA */}
      <ProductTable 
        products={filteredProducts}
        isLoading={isLoadingProducts}
        onEdit={(p) => { setSelectedProduct(p); setIsEditModalOpen(true); }}
        onDelete={(p) => { setSelectedProduct(p); setIsDeleteAlertOpen(true); }}
        onViewVariants={(p) => { setProductToViewVariants(p); setIsVariantViewerOpen(true); }}
      />

      {/* MODAL DE CRIAÇÃO (COM TRAVA DE FECHAMENTO) */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent 
            className="max-w-4xl max-h-[90vh] overflow-y-auto"
            onInteractOutside={(e) => e.preventDefault()} // Impede fechar ao clicar fora
            onEscapeKeyDown={(e) => e.preventDefault()} // Impede fechar com ESC (opcional)
        >
            <DialogHeader><DialogTitle>Adicionar Novo Produto</DialogTitle></DialogHeader>
            <ProductForm 
                onSubmit={(v) => addProductMutation.mutate(v)} 
                isSubmitting={addProductMutation.isPending} 
                categories={categories || []} 
                isLoadingCategories={isLoadingCategories} 
                subCategories={subCategories || []} 
                isLoadingSubCategories={false} 
                brands={brands || []} 
                isLoadingBrands={isLoadingBrands} 
                existingProducts={products}
            />
        </DialogContent>
      </Dialog>

      {/* MODAL DE EDIÇÃO (COM TRAVA DE FECHAMENTO) */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent 
            className="max-w-4xl max-h-[90vh] overflow-y-auto"
            onInteractOutside={(e) => e.preventDefault()} 
            onEscapeKeyDown={(e) => e.preventDefault()}
        >
            <DialogHeader><DialogTitle>Editar: {selectedProduct?.name}</DialogTitle></DialogHeader>
            <ProductForm 
                onSubmit={(v) => selectedProduct && updateProductMutation.mutate({ productId: selectedProduct.id, values: v })} 
                isSubmitting={updateProductMutation.isPending} 
                categories={categories || []} 
                isLoadingCategories={isLoadingCategories} 
                subCategories={subCategories || []} 
                isLoadingSubCategories={false} 
                brands={brands || []} 
                isLoadingBrands={isLoadingBrands} 
                initialData={selectedProduct ? { ...selectedProduct, sku: selectedProduct.sku || '', description: selectedProduct.description || '', category: selectedProduct.category || '', sub_category: selectedProduct.sub_category || '', brand: selectedProduct.brand || '', image_url: selectedProduct.image_url || '', cost_price: selectedProduct.cost_price || 0, pix_price: selectedProduct.pix_price || 0 } : undefined} 
                existingProducts={products}
            />
        </DialogContent>
      </Dialog>
      
      {productToViewVariants && <ProductVariantViewer productId={productToViewVariants.id} productName={productToViewVariants.name} isOpen={isVariantViewerOpen} onClose={() => setIsVariantViewerOpen(false)} />}
      
      <ImportConfirmationModal 
        isOpen={isImportConfirmationModalOpen} 
        onClose={() => setIsImportConfirmationModalOpen(false)} 
        productsToImport={productsToConfirm} 
        onConfirm={() => bulkInsertMutation.mutate(productsToConfirm)} 
        isSubmitting={bulkInsertMutation.isPending} 
      />

      <ImportResultModal 
        isOpen={isResultModalOpen} 
        onClose={() => setIsResultModalOpen(false)} 
        result={importResult} 
      />

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso removerá permanentemente o produto "{selectedProduct?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700">
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductsPage;