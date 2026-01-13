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
        }));
        setProductsToConfirm(productsToInsert);
        setIsImportConfirmationModalOpen(true);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
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

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

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
            <button onClick={() => { setProductToViewVariants({ id: product.id, name: product.name }); setIsVariantViewerOpen(true); }} className="flex items-center gap-1 hover:bg-primary/5 p-1 rounded-md transition-colors cursor-help group">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 group-hover:scale-110" />
                <span className="font-bold text-xs">{min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent><p>Clique para ver as {values.length} variações</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div>
      <div className="flex flex-col gap-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Produtos</h1>
            {!isLoadingProducts && <Badge variant="secondary" className="h-7 px-3 text-sm font-bold bg-gray-100 text-gray-700">{filteredProducts.length} itens</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => {
                const headers = ["SKU", "Nome", "Descrição", "Preço de Custo", "Preço de Venda", "Preço Pix", "Estoque", "Categoria", "Sub-categoria", "Marca", "Imagem", "Publicado (Sim/Não)"];
                const worksheet = XLSX.utils.aoa_to_sheet([headers]);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
                XLSX.writeFile(workbook, "template_importacao.xlsx");
              }}><Upload className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Baixar Modelo</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => document.getElementById('import-input')?.click()}><FileUp className="h-4 w-4" /><input type="file" id="import-input" className="hidden" onChange={handleImportXLSX} /></Button></TooltipTrigger><TooltipContent><p>Importar Planilha</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handleExportXLSX}><FileDown className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Exportar Catálogo</p></TooltipContent></Tooltip>
            </TooltipProvider>
            
            <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
              <DialogTrigger asChild><Button><PlusCircle className="w-4 h-4 mr-2" />Adicionar Produto</Button></DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Adicionar Novo Produto</DialogTitle></DialogHeader>
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
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Custo</TableHead>
              <TableHead>Venda</TableHead>
              <TableHead className="text-green-600">Pix</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingProducts ? (
              <TableRow><TableCell colSpan={10} className="text-center">Carregando...</TableCell></TableRow>
            ) : filteredProducts && filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.image_url ? <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded-md object-cover" /> : <div className="h-12 w-12 rounded-md bg-gray-100 flex items-center justify-center"><ImageOff className="h-5 w-5 text-gray-400" /></div>}</TableCell>
                  <TableCell className="font-mono text-[10px] font-bold">#{product.sku || product.id}</TableCell>
                  <TableCell className="font-medium text-xs truncate max-w-[200px]">{product.name}</TableCell>
                  <TableCell className="text-xs">{product.category || "N/A"}</TableCell>
                  <TableCell className="text-xs">{getPriceDisplay(product, true)}</TableCell>
                  <TableCell className="text-xs font-medium">{getPriceDisplay(product)}</TableCell>
                  <TableCell className="text-xs font-bold text-green-700">{product.pix_price ? formatCurrency(product.pix_price) : '-'}</TableCell>
                  <TableCell><Badge variant={product.stock_quantity <= 5 ? "destructive" : "secondary"} className="h-5 text-[10px]">{product.stock_quantity} un</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedProduct(product); setIsEditModalOpen(true); }}><MoreHorizontal className="h-4 w-4 text-primary" /></Button>
                  </TableCell>
                </TableRow>
              ))
            ) : <TableRow><TableCell colSpan={10} className="text-center py-10">Nenhum produto.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Editar: {selectedProduct?.name}</DialogTitle></DialogHeader>
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
      <ImportConfirmationModal isOpen={isImportConfirmationModalOpen} onClose={() => setIsImportConfirmationModalOpen(false)} productsToImport={productsToConfirm} onConfirm={() => bulkInsertMutation.mutate(productsToConfirm)} isSubmitting={bulkInsertMutation.isPending} />
    </div>
  );
};

export default ProductsPage;