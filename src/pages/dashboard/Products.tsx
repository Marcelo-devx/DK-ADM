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
import { AddStockForm } from "../../components/dashboard/AddStockForm";
import { showSuccess, showError } from "../../utils/toast";
import { PlusCircle, MoreHorizontal, ImageOff, FileDown, DatabaseBackup, Upload, FileUp, Leaf, Star, Search, ArrowUpDown, ChevronUp, ChevronDown, Copy, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import * as XLSX from 'xlsx';
import { ImportConfirmationModal } from "@/components/dashboard/ImportConfirmationModal";
import { mapRowKeys } from "@/utils/excel-utils";
import { ProductFlavorViewer } from "@/components/dashboard/ProductFlavorViewer";
import { ProductVariantViewer } from "@/components/dashboard/ProductVariantViewer";
import { cn } from "@/lib/utils";

type Product = {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  cost_price: number | null;
  pix_price: number | null;
  stock_quantity: number;
  category: string | null;
  sub_category: string | null;
  brand: string | null;
  image_url: string | null;
  is_visible: boolean;
  flavor_count: number;
  variant_prices?: number[];
  variant_costs?: (number | null)[];
};

type ProductImportData = Omit<Product, 'id' | 'flavor_count' | 'variant_prices' | 'variant_costs'> & { 
    flavor_names?: string | null;
};

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
    .select("*, flavor_count:product_flavors(count), variants:product_variants(price, cost_price)")
    .order("created_at", { ascending: false });
  
  if (error) throw new Error(error.message);
  
  return data.map(p => {
    const variantsList = Array.isArray(p.variants) ? p.variants : [];
    
    return {
        ...p,
        flavor_count: Array.isArray(p.flavor_count) ? (p.flavor_count[0]?.count || 0) : 0,
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

const generateRandomSku = () => {
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CLONE-${randomStr}`;
};

const cleanAndParseFloat = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const cleaned = value.replace(/\./g, '').replace(/,/g, '.');
        return parseFloat(cleaned);
    }
    return NaN;
};

const ProductsPage = () => {
  const queryClient = useQueryClient();
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Filtros e Ordenação
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product | null, direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc'
  });

  const [isVariantViewerOpen, setIsVariantViewerOpen] = useState(false);
  const [productToViewVariants, setProductToViewVariants] = useState<{ id: number, name: string } | null>(null);

  const [isFlavorViewerOpen, setIsFlavorViewerOpen] = useState(false);
  const [productToViewFlavors, setProductToViewFlavors] = useState<{ id: number, name: string } | null>(null);

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

  const cloneProductMutation = useMutation({
    mutationFn: async (product: Product) => {
        const newSku = generateRandomSku();
        const { data: newProduct, error: productError } = await supabase
            .from("products")
            .insert({
                name: `${product.name} (Cópia)`,
                sku: newSku,
                description: product.description,
                price: product.price,
                pix_price: product.pix_price,
                cost_price: product.cost_price,
                stock_quantity: product.stock_quantity,
                category: product.category,
                sub_category: product.sub_category,
                brand: product.brand,
                image_url: product.image_url,
                is_visible: false,
            })
            .select()
            .single();
        
        if (productError) throw productError;

        const { data: originalVariants } = await supabase
            .from("product_variants")
            .select("*")
            .eq("product_id", product.id);
        
        if (originalVariants && originalVariants.length > 0) {
            const variantsToInsert = originalVariants.map(v => ({
                product_id: newProduct.id,
                flavor_id: v.flavor_id,
                volume_ml: v.volume_ml,
                price: v.price,
                pix_price: v.pix_price,
                cost_price: v.cost_price,
                stock_quantity: v.stock_quantity,
                sku: `${v.sku}-COPY`,
                is_active: v.is_active
            }));
            await supabase.from("product_variants").insert(variantsToInsert);
        }

        const { data: originalFlavors } = await supabase
            .from("product_flavors")
            .select("*")
            .eq("product_id", product.id);
        
        if (originalFlavors && originalFlavors.length > 0) {
            const flavorsToInsert = originalFlavors.map(f => ({
                product_id: newProduct.id,
                flavor_id: f.flavor_id,
                is_visible: f.is_visible
            }));
            await supabase.from("product_flavors").insert(flavorsToInsert);
        }

        return newProduct;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["products"] });
        showSuccess("Produto clonado com sucesso!");
    },
    onError: (err: any) => showError(`Erro ao clonar: ${err.message}`),
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

  const updateStockMutation = useMutation({
    mutationFn: async ({ productId, quantityToAdd, currentStock }: { productId: number; quantityToAdd: number; currentStock: number; }) => {
      const { error } = await supabase.from("products").update({ stock_quantity: currentStock + quantityToAdd }).eq("id", productId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess("Estoque atualizado!");
      setIsAddStockModalOpen(false);
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
  const handleAddStock = (values: { quantity: number }) => selectedProduct && updateStockMutation.mutate({ productId: selectedProduct.id, quantityToAdd: values.quantity, currentStock: selectedProduct.stock_quantity });
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
    const headers = ["SKU", "Nome", "Descrição", "Preço de Custo", "Preço de Venda", "Estoque", "Categoria", "Sub-categoria", "Marca", "Imagem", "Publicado (Sim/Não)"];
    const data = products.map(p => [p.sku || '', p.name, p.description || '', p.cost_price || '', p.price, p.stock_quantity, p.category || '', p.sub_category || '', p.brand || '', p.image_url || '', p.is_visible ? 'Sim' : 'Não']);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Produtos");
    XLSX.writeFile(workbook, "produtos.xlsx");
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
            stock_quantity: parseInt(row.estoque, 10),
            description: row.descrição || null,
            cost_price: cleanAndParseFloat(row.preçodecusto) || null,
            pix_price: cleanAndParseFloat(row.preçopix) || null,
            category: row.categoria || null,
            sub_category: row.subcategoria || null,
            brand: row.marca || null,
            image_url: row.imagem || null,
            is_visible: row.publicado?.toLowerCase() === 'sim',
            flavor_names: row.sabores || null,
        }));
        setProductsToConfirm(productsToInsert);
        setIsImportConfirmationModalOpen(true);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const headers = ["SKU", "Nome", "Preço de Custo", "Preço de Venda", "Preço Pix", "Estoque", "Sabores (Separados por vírgula)", "Categoria", "Sub-categoria", "Marca", "Imagem", "Publicado (Sim/Não)"];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "template_produtos.xlsx");
  };

  const renderSortIcon = (key: keyof Product) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="ml-2 h-4 w-4 text-primary" /> : <ChevronDown className="ml-2 h-4 w-4 text-primary" />;
  };

  return (
    <div>
      <div className="flex flex-col gap-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Produtos</h1>
          <div className="flex flex-wrap items-center gap-2">
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handleDownloadTemplate}><Upload className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Baixar modelo</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => document.getElementById('import-input')?.click()}><FileUp className="h-4 w-4" /><input type="file" id="import-input" className="hidden" onChange={handleImportXLSX} /></Button></TooltipTrigger><TooltipContent><p>Importar</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handleExportXLSX}><FileDown className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Exportar Excel</p></TooltipContent></Tooltip>
            </TooltipProvider>
            
            <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
              <DialogTrigger asChild><Button><PlusCircle className="w-4 h-4 mr-2" />Adicionar Produto</Button></DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Adicionar Novo Produto</DialogTitle></DialogHeader>
                <ProductForm onSubmit={handleAddProduct} isSubmitting={addProductMutation.isPending} categories={categories || []} isLoadingCategories={isLoadingCategories} subCategories={subCategories || []} isLoadingSubCategories={isLoadingSubCategories} brands={brands || []} isLoadingBrands={isLoadingBrands} />
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

      <div className="bg-white rounded-lg shadow">
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
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('sub_category')}>
                <div className="flex items-center">Sub-categoria {renderSortIcon('sub_category')}</div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('brand')}>
                <div className="flex items-center">Marca {renderSortIcon('brand')}</div>
              </TableHead>
              <TableHead>Preço de Custo</TableHead>
              <TableHead>Preço de Venda</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Visibilidade</TableHead>
              <TableHead className="text-center w-[60px]">Sabores</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingProducts ? (
              <TableRow><TableCell colSpan={12} className="text-center">Carregando...</TableCell></TableRow>
            ) : filteredProducts && filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.image_url ? <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded-md object-cover" /> : <div className="h-12 w-12 rounded-md bg-gray-100 flex items-center justify-center"><ImageOff className="h-5 w-5 text-gray-400" /></div>}</TableCell>
                  <TableCell className="font-mono text-sm font-bold">#{product.id}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category || "N/A"}</TableCell>
                  <TableCell>{product.sub_category || "-"}</TableCell>
                  <TableCell>{product.brand || "N/A"}</TableCell>
                  <TableCell>{getPriceDisplay(product, true)}</TableCell>
                  <TableCell>{getPriceDisplay(product)}</TableCell>
                  <TableCell>{product.stock_quantity}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                        <Switch checked={product.is_visible} onCheckedChange={(s) => handleVisibilityChange(product, s)} />
                        <Badge variant={product.is_visible ? "default" : "outline"}>{product.is_visible ? "Visível" : "Oculto"}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {product.flavor_count > 0 ? (
                        <Button variant="ghost" size="icon" onClick={() => { setProductToViewFlavors({ id: product.id, name: product.name }); setIsFlavorViewerOpen(true); }}><Leaf className="h-4 w-4 text-green-600" /></Button>
                    ) : <Button variant="ghost" size="icon" disabled><Leaf className="h-4 w-4 text-gray-300" /></Button>}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={cloneProductMutation.isPending}>
                          <span className="sr-only">Menu</span>
                          {cloneProductMutation.isPending && selectedProduct?.id === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Opções</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => { setSelectedProduct(product); setIsEditModalOpen(true); }}>
                          Editar Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                            className="text-blue-600 font-medium"
                            onSelect={() => { setSelectedProduct(product); cloneProductMutation.mutate(product); }}
                        >
                          <Copy className="w-4 h-4 mr-2" /> Clonar Produto
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onSelect={() => {
                            setSelectedProduct(product);
                            setIsDeleteAlertOpen(true);
                          }}
                        >
                          Remover do Catálogo
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : <TableRow><TableCell colSpan={12} className="text-center py-10">Nenhum produto.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {/* Modais de Edição e Alertas (mantidos conforme original) */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Editar: {selectedProduct?.name}</DialogTitle></DialogHeader>
          <ProductForm onSubmit={handleUpdateProduct} isSubmitting={updateProductMutation.isPending} categories={categories || []} isLoadingCategories={isLoadingCategories} subCategories={subCategories || []} isLoadingSubCategories={isLoadingSubCategories} brands={brands || []} isLoadingBrands={isLoadingBrands} initialData={selectedProduct ? { ...selectedProduct, sku: selectedProduct.sku || '', description: selectedProduct.description || '', category: selectedProduct.category || '', sub_category: selectedProduct.sub_category || '', brand: selectedProduct.brand || '', image_url: selectedProduct.image_url || '', cost_price: selectedProduct.cost_price || 0 } : undefined} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Tem certeza?</AlertDialogTitle><AlertDialogDescription>Essa ação removerá permanentemente o produto.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm}>Remover</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <ImportConfirmationModal isOpen={isImportConfirmationModalOpen} onClose={() => setIsImportConfirmationModalOpen(false)} productsToImport={productsToConfirm} onConfirm={() => bulkInsertMutation.mutate(productsToConfirm)} isSubmitting={bulkInsertMutation.isPending} />
      {productToViewFlavors && <ProductFlavorViewer productId={productToViewFlavors.id} productName={productToViewFlavors.name} isOpen={isFlavorViewerOpen} onClose={() => setIsFlavorViewerOpen(false)} />}
      {productToViewVariants && <ProductVariantViewer productId={productToViewVariants.id} productName={productToViewVariants.name} isOpen={isVariantViewerOpen} onClose={() => setIsVariantViewerOpen(false)} />}
    </div>
  );
};

export default ProductsPage;