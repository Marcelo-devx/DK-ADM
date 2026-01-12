import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { ProductForm } from "../../components/dashboard/product-form";
import { showSuccess, showError } from "../../utils/toast";
import { PlusCircle, MoreHorizontal, ImageOff, FileDown, Upload, FileUp, Star, Search, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import * as XLSX from 'xlsx';
import { ImportConfirmationModal } from "@/components/dashboard/ImportConfirmationModal";
import { mapRowKeys } from "@/utils/excel-utils";
import { ProductVariantViewer } from "@/components/dashboard/ProductVariantViewer";
import { cn } from "@/lib/utils";

type Product = {
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
};

type ProductImportData = Omit<Product, 'id' | 'variant_prices' | 'variant_costs'>;

type Category = {
  id: number;
  name: string;
};

type SubCategory = {
  id: number;
  name: string;
  category_id: number;
};

type Brand = {
  id: number;
  name: string;
  image_url: string | null;
};

const fetchProducts = async () => {
  const { data, error } = await supabase
    .from("products")
    .select(`
        *, 
        variants:product_variants(price, cost_price)
    `)
    .order("created_at", { ascending: false });
  
  if (error) throw new Error(error.message);
  
  return data.map(p => {
    const variantsList = Array.isArray(p.variants) ? p.variants : [];
    
    return {
        ...p,
        variant_prices: variantsList.map((v: any) => v.price),
        variant_costs: variantsList.map((v: any) => v.cost_price),
    };
  }) as Product[];
};

const fetchCategories = async () => {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
};

const fetchSubCategories = async () => {
  const { data, error } = await supabase
    .from("sub_categories")
    .select("id, name, category_id")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
};

const fetchBrands = async () => {
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, image_url")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
};

const cleanAndParseFloat = (value: any): number => {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const cleaned = value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(/,/g, '.');
        return parseFloat(cleaned);
    }
    return 0;
};

const ProductsPage = () => {
  const queryClient = useQueryClient();
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product | null, direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc'
  });

  const [isVariantViewerOpen, setIsVariantViewerOpen] = useState(false);
  const [productToViewVariants, setProductToViewVariants] = useState<{ id: number, name: string } | null>(null);

  const [isImportConfirmationModalOpen, setIsImportConfirmationModalOpen] = useState(false);
  const [productsToConfirm, setProductsToConfirm] = useState<ProductImportData[]>([]);

  const { data: products, isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: fetchProducts,
    refetchOnWindowFocus: false,
  });

  const { data: categories, isLoading: isLoadingCategories } = useQuery<
    Category[]
  >({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    refetchOnWindowFocus: false,
  });

  const { data: subCategories, isLoading: isLoadingSubCategories } = useQuery<
    SubCategory[]
  >({
    queryKey: ["subCategories"],
    queryFn: fetchSubCategories,
    refetchOnWindowFocus: false,
  });

  const { data: brands, isLoading: isLoadingBrands } = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: fetchBrands,
    refetchOnWindowFocus: false,
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    let result = products.filter(product => {
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      const matchesBrand = brandFilter === 'all' || product.brand === brandFilter;
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (product.sku?.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchesCategory && matchesBrand && matchesSearch;
    });

    if (sortConfig.key) {
        result.sort((a, b) => {
            const aVal = a[sortConfig.key!] ?? "";
            const bVal = b[sortConfig.key!] ?? "";
            
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return result;
  }, [products, categoryFilter, brandFilter, searchTerm, sortConfig]);

  const handleSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const addProductMutation = useMutation({
    mutationFn: async (newProduct: any) => {
      const productData = { ...newProduct };
      if (!productData.sku || productData.sku.trim() === "") delete productData.sku;
      if (!productData.image_url || productData.image_url.trim() === "") productData.image_url = null;
      const { error } = await supabase.from("products").insert([productData]);
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
      const updates = { ...values };
      if (updates.sku === "") updates.sku = null;
      if (updates.image_url === "") updates.image_url = null;
      const { error } = await supabase.from("products").update(updates).eq("id", productId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess("Produto atualizado!");
      setIsEditModalOpen(false);
    },
    onError: (error) => showError(error.message),
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess("Produto removido!");
      setIsDeleteAlertOpen(false);
    },
  });

  const bulkInsertMutation = useMutation({
    mutationFn: async (products: ProductImportData[]) => {
      const { data, error } = await supabase.functions.invoke("bulk-product-upsert", { body: { products } });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess(data.message);
      setIsImportConfirmationModalOpen(false);
    },
  });

  const handleAddProduct = (values: any) => addProductMutation.mutate(values);
  const handleUpdateProduct = (values: any) => selectedProduct && updateProductMutation.mutate({ productId: selectedProduct.id, values });
  const handleDeleteConfirm = () => selectedProduct && deleteProductMutation.mutate(selectedProduct.id);
  const handleVisibilityChange = (product: Product, newStatus: boolean) => updateProductMutation.mutate({ productId: product.id, values: { is_visible: newStatus } });

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const openVariantViewer = (product: Product) => {
      setProductToViewVariants({ id: product.id, name: product.name });
      setIsVariantViewerOpen(true);
  };

  const getPriceDisplay = (product: Product, isCost: boolean = false) => {
    if (!product) return "-";
    const costsArray = Array.isArray(product.variant_costs) ? product.variant_costs : [];
    const pricesArray = Array.isArray(product.variant_prices) ? product.variant_prices : [];
    const values = isCost ? (costsArray.filter(v => v !== null) as number[]) : (pricesArray.filter(v => v !== null) as number[]);
    const baseValue = isCost ? (product.cost_price ?? 0) : (product.price ?? 0);
    if (values.length === 0) return formatCurrency(baseValue);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={() => openVariantViewer(product)} className="flex items-center gap-1 hover:bg-primary/5 p-1 rounded-md transition-colors cursor-help group">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 group-hover:scale-110" />
                <span className="font-bold text-xs">{min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent><p>Clique para ver as {values.length} opções</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const handleExportXLSX = () => {
    if (!products?.length) return;
    const headers = ["SKU", "Nome", "Descrição", "Preço de Custo", "Preço de Venda", "Preço Pix", "Estoque", "Categoria", "Sub-categoria", "Marca", "Imagem", "Publicado (Sim/Não)"];
    const data = products.map(p => [
        p.sku || '', 
        p.name, 
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

  const handleImportXLSX = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
        const productsToInsert = json.map(mapRowKeys).map((row: any) => ({
            sku: row.sku || '',
            name: row.nome,
            price: cleanAndParseFloat(row.preçodevenda),
            pix_price: cleanAndParseFloat(row.preçopix) || null,
            stock_quantity: parseInt(row.estoque, 10) || 0,
            description: row.descrição || null,
            cost_price: cleanAndParseFloat(row.preçodecusto) || null,
            category: row.categoria || null,
            sub_category: row.subcategoria || null,
            brand: row.marca || null,
            image_url: row.imagem || null,
            is_visible: row.publicado?.toLowerCase() === 'sim',
        }));
        setProductsToConfirm(productsToInsert);
        setIsImportConfirmationModalOpen(true);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const headers = ["SKU", "Nome", "Descrição", "Preço de Custo", "Preço de Venda", "Preço Pix", "Estoque", "Categoria", "Sub-categoria", "Marca", "Imagem", "Publicado (Sim/Não)"];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "template_importacao_produtos.xlsx");
  };

  const renderSortIcon = (key: keyof Product) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="ml-2 h-4 w-4 text-primary" /> : <ChevronDown className="ml-2 h-4 w-4 text-primary" />;
  };

  return (
    <div>
      <div className="flex flex-col gap-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Produtos</h1>
            {!isLoadingProducts && (
              <Badge variant="secondary" className="h-7 px-3 text-sm font-bold bg-gray-100 text-gray-700">
                {filteredProducts.length} itens
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handleDownloadTemplate}><Upload className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Baixar modelo (v2)</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => document.getElementById('import-input')?.click()}><FileUp className="h-4 w-4" /><input type="file" id="import-input" className="hidden" onChange={handleImportXLSX} /></Button></TooltipTrigger><TooltipContent><p>Importar Planilha</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handleExportXLSX}><FileDown className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Exportar Catálogo</p></TooltipContent></Tooltip>
            </TooltipProvider>
            
            <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
              <DialogTrigger asChild><Button><PlusCircle className="w-4 h-4 mr-2" />Adicionar Produto</Button></DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Adicionar Novo Produto</DialogTitle></DialogHeader>
                <ProductForm 
                    onSubmit={handleAddProduct} 
                    isSubmitting={addProductMutation.isPending} 
                    categories={categories || []} 
                    isLoadingCategories={isLoadingCategories} 
                    subCategories={subCategories || []} 
                    isLoadingSubCategories={isLoadingSubCategories} 
                    brands={brands || []} 
                    isLoadingBrands={isLoadingBrands}
                    existingProducts={products}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-white p-4 rounded-lg border shadow-sm">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Pesquisar produto ou SKU..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          <Select value={brandFilter} onValueChange={setBrandFilter}><SelectTrigger><SelectValue placeholder="Todas as Marcas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as Marcas</SelectItem>{brands?.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent></Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger><SelectValue placeholder="Todas as Categorias" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as Categorias</SelectItem>{categories?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent></Select>
          <div className="flex items-center justify-end"><span className="text-xs text-muted-foreground font-medium">{filteredProducts?.length || 0} encontrados</span></div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[64px]">Imagem</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                <div className="flex items-center">Nome {renderSortIcon('name')}</div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('category')}>
                <div className="flex items-center">Categoria {renderSortIcon('category')}</div>
              </TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Custo</TableHead>
              <TableHead>Venda</TableHead>
              <TableHead className="text-green-600">Pix</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingProducts ? (
              <TableRow><TableCell colSpan={11} className="text-center">Carregando...</TableCell></TableRow>
            ) : filteredProducts && filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.image_url ? <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded-md object-cover" /> : <div className="h-12 w-12 rounded-md bg-gray-100 flex items-center justify-center"><ImageOff className="h-5 w-5 text-gray-400" /></div>}</TableCell>
                  <TableCell className="font-mono text-[10px] font-bold">#{product.sku || product.id}</TableCell>
                  <TableCell className="font-medium text-xs max-w-[200px] truncate">{product.name}</TableCell>
                  <TableCell className="text-xs">{product.category || "N/A"}</TableCell>
                  <TableCell className="text-xs">{product.brand || "N/A"}</TableCell>
                  <TableCell className="text-xs">{getPriceDisplay(product, true)}</TableCell>
                  <TableCell className="text-xs">{getPriceDisplay(product)}</TableCell>
                  <TableCell className="text-xs font-bold text-green-700">
                    {product.pix_price ? formatCurrency(product.pix_price) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.stock_quantity <= 5 ? "destructive" : "secondary"} className="h-5 text-[10px]">
                        {product.stock_quantity} un
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={product.is_visible} onCheckedChange={(s) => handleVisibilityChange(product, s)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedProduct(product); setIsEditModalOpen(true); }}><MoreHorizontal className="h-4 w-4 text-primary" /></Button>
                  </TableCell>
                </TableRow>
              ))
            ) : <TableRow><TableCell colSpan={11} className="text-center py-10">Nenhum produto.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Editar: {selectedProduct?.name}</DialogTitle></DialogHeader>
          <ProductForm 
            onSubmit={handleUpdateProduct} 
            isSubmitting={updateProductMutation.isPending} 
            categories={categories || []} 
            isLoadingCategories={isLoadingCategories} 
            subCategories={subCategories || []} 
            isLoadingSubCategories={isLoadingSubCategories} 
            brands={brands || []} 
            isLoadingBrands={isLoadingBrands} 
            initialData={selectedProduct ? { ...selectedProduct, sku: selectedProduct.sku || '', description: selectedProduct.description || '', category: selectedProduct.category || '', sub_category: selectedProduct.sub_category || '', brand: selectedProduct.brand || '', image_url: selectedProduct.image_url || '', cost_price: selectedProduct.cost_price || 0, pix_price: selectedProduct.pix_price || 0 } : undefined} 
            existingProducts={products}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Tem certeza?</AlertDialogTitle><AlertDialogDescription>Essa ação removerá permanentemente o produto.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm}>Remover</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <ImportConfirmationModal isOpen={isImportConfirmationModalOpen} onClose={() => setIsImportConfirmationModalOpen(false)} productsToImport={productsToConfirm} onConfirm={() => bulkInsertMutation.mutate(productsToConfirm)} isSubmitting={bulkInsertMutation.isPending} />
      {productToViewVariants && <ProductVariantViewer productId={productToViewVariants.id} productName={productToViewVariants.name} isOpen={isVariantViewerOpen} onClose={() => setIsVariantViewerOpen(false)} />}
    </div>
  );
};

export default ProductsPage;