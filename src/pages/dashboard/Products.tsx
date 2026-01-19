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
import { 
  PlusCircle, 
  MoreHorizontal, 
  ImageOff, 
  FileDown, 
  Upload, 
  FileUp, 
  Star, 
  Search, 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown, 
  Lock, 
  DownloadCloud,
  RefreshCw 
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import * as XLSX from 'xlsx';
import { ImportConfirmationModal } from "@/components/dashboard/ImportConfirmationModal";
import { ImportResultModal } from "@/components/dashboard/ImportResultModal";
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
  allocated_in_kits?: number;
};

type ProductImportData = Omit<Product, 'id' | 'variant_prices' | 'variant_costs' | 'allocated_in_kits'>;

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
  
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

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
    <div className="pb-20">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Catálogo</h1>
            {!isLoadingProducts && <Badge variant="secondary" className="h-7 px-3 text-sm font-bold bg-blue-50 text-blue-700 border-blue-100">{filteredProducts.length} itens</Badge>}
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* GRUPO DE EXCEL */}
            <div className="flex items-center bg-white border p-1 rounded-xl shadow-sm">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50 rounded-lg" onClick={handleDownloadTemplate}>
                                <DownloadCloud className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Baixar Modelo Excel</p></TooltipContent>
                    </Tooltip>
                    
                    <div className="w-[1px] h-4 bg-gray-200 mx-1" />

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-green-600 hover:bg-green-50 rounded-lg" onClick={() => document.getElementById('import-input')?.click()}>
                                <FileUp className="h-5 w-5" />
                                <input type="file" id="import-input" className="hidden" onChange={handleImportXLSX} accept=".xlsx, .xls" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Importar Planilha</p></TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-orange-600 hover:bg-orange-50 rounded-lg" onClick={handleExportXLSX}>
                                <FileDown className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Exportar Catálogo</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            
            {/* BOTÃO PRINCIPAL */}
            <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 font-bold h-11 px-6 shadow-lg rounded-xl transition-all hover:scale-[1.02] active:scale-95">
                    <PlusCircle className="w-5 h-5 mr-2" />
                    Adicionar Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
          </div>
        </div>

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

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow>
              <TableHead className="w-[64px]">Imagem</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Custo</TableHead>
              <TableHead>Venda</TableHead>
              <TableHead className="text-green-600">Pix</TableHead>
              <TableHead>Estoque Disponível</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingProducts ? (
              <TableRow><TableCell colSpan={10} className="text-center py-10"><RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filteredProducts && filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <TableRow key={product.id} className="hover:bg-gray-50/50 transition-colors">
                  <TableCell>{product.image_url ? <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded-lg object-cover shadow-sm border" /> : <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center border border-dashed"><ImageOff className="h-5 w-5 text-gray-400" /></div>}</TableCell>
                  <TableCell className="font-mono text-[10px] font-black text-gray-500">#{product.sku || product.id}</TableCell>
                  <TableCell className="font-bold text-xs truncate max-w-[200px] text-gray-800">{product.name}</TableCell>
                  <TableCell className="text-xs font-medium text-muted-foreground">{product.category || "N/A"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{getPriceDisplay(product, true)}</TableCell>
                  <TableCell className="text-xs font-bold text-gray-700">{getPriceDisplay(product)}</TableCell>
                  <TableCell className="text-xs font-black text-green-700">{product.pix_price ? formatCurrency(product.pix_price) : '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                        <Badge variant={product.stock_quantity <= 5 ? "destructive" : "secondary"} className="h-5 text-[10px] w-fit font-black">
                            {product.stock_quantity} un
                        </Badge>
                        {product.allocated_in_kits ? (
                            <Badge variant="outline" className="h-5 text-[9px] w-fit bg-amber-50 text-amber-700 border-amber-200 gap-1 font-bold" title="Quantidade reservada em Kits">
                                <Lock className="w-2.5 h-2.5" /> + {product.allocated_in_kits} em Kits
                            </Badge>
                        ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="hover:bg-primary/5" onClick={() => { setSelectedProduct(product); setIsEditModalOpen(true); }}><MoreHorizontal className="h-4 w-4 text-primary" /></Button>
                  </TableCell>
                </TableRow>
              ))
            ) : <TableRow><TableCell colSpan={10} className="text-center py-20 text-muted-foreground italic">Nenhum produto encontrado.</TableCell></TableRow>}
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
    </div>
  );
};

export default ProductsPage;