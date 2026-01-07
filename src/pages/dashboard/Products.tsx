import { useState } from "react";
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
import { PlusCircle, MoreHorizontal, ImageOff, FileDown, DatabaseBackup, Upload, FileUp, Leaf, Star, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import * as XLSX from 'xlsx';
import { ImportConfirmationModal } from "@/components/dashboard/ImportConfirmationModal";
import { mapRowKeys } from "@/utils/excel-utils";
import { ProductFlavorViewer } from "@/components/dashboard/ProductFlavorViewer";
import { ProductVariantViewer } from "@/components/dashboard/ProductVariantViewer";

type Product = {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  cost_price: number | null;
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
  
  // Filtros
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [isVariantViewerOpen, setIsVariantViewerOpen] = useState(false);
  const [productToViewVariants, setProductToViewVariants] = useState<{ id: number, name: string } | null>(null);

  const [isFlavorViewerOpen, setIsFlavorViewerOpen] = useState(false);
  const [productToViewFlavors, setProductToViewFlavors] = useState<{ id: number, name: string } | null>(null);

  const [isImportConfirmationModalOpen, setIsImportConfirmationModalOpen] = useState(false);
  const [productsToConfirm, setProductsToConfirm] = useState<ProductImportData[]>([]);

  // Adicionado refetchOnWindowFocus: false para todas as queries
  // Isso impede que a página recarregue dados (e possivelmente resete estados) ao trocar de aba no navegador
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

  const filteredProducts = products?.filter(product => {
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    const matchesBrand = brandFilter === 'all' || product.brand === brandFilter;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (product.sku?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesCategory && matchesBrand && matchesSearch;
  });

  const addProductMutation = useMutation({
    mutationFn: async (newProduct: any) => {
      const productData = { ...newProduct };
      
      // Sanitização: Se SKU estiver vazio, removemos para que o banco gere um automaticamente.
      if (!productData.sku || productData.sku.trim() === "") {
        delete productData.sku;
      }
      
      // Sanitização: URL de imagem vazia vira null
      if (!productData.image_url || productData.image_url.trim() === "") {
        productData.image_url = null;
      }

      const { error } = await supabase.from("products").insert([productData]);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess("Produto adicionado com sucesso!");
      setIsProductModalOpen(false);
    },
    onError: (error) => {
      showError(`Erro ao adicionar produto: ${error.message}`);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({
      productId,
      values,
    }: {
      productId: number;
      values: any;
    }) => {
      const updates = { ...values };
      
      if (updates.sku === "") {
        updates.sku = null;
      }

      if (updates.image_url === "") {
        updates.image_url = null;
      }

      const { error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", productId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess("Produto atualizado com sucesso!");
      setIsEditModalOpen(false);
    },
    onError: (error) => {
      showError(`Erro ao atualizar produto: ${error.message}`);
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess("Produto removido com sucesso!");
      setIsDeleteAlertOpen(false);
    },
    onError: (error) => {
      showError(`Erro ao remover produto: ${error.message}`);
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({
      productId,
      quantityToAdd,
      currentStock,
    }: {
      productId: number;
      quantityToAdd: number;
      currentStock: number;
    }) => {
      const newStock = currentStock + quantityToAdd;
      const { error } = await supabase
        .from("products")
        .update({ stock_quantity: newStock })
        .eq("id", productId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess("Estoque atualizado com sucesso!");
      setIsAddStockModalOpen(false);
    },
    onError: (error) => {
      showError(`Erro ao atualizar estoque: ${error.message}`);
    },
  });

  const bulkInsertMutation = useMutation({
    mutationFn: async (products: ProductImportData[]) => {
      const { data, error } = await supabase.functions.invoke("bulk-product-upsert", {
        body: { products },
      });
      if (error) {
        if (error.context && typeof error.context.json === 'function') {
            const errorJson = await error.context.json();
            if (errorJson.details) throw new Error(errorJson.details);
        }
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["allFlavors"] });
      showSuccess(data.message);
      setIsImportConfirmationModalOpen(false);
      setProductsToConfirm([]);
    },
    onError: (error: Error) => {
      showError(`Erro ao importar produtos: ${error.message}`);
    },
  });

  const handleAddProduct = (values: any) => {
    addProductMutation.mutate(values);
  };

  const handleUpdateProduct = (values: any) => {
    if (!selectedProduct) return;
    updateProductMutation.mutate({ productId: selectedProduct.id, values });
  };

  const handleAddStock = (values: { quantity: number }) => {
    if (!selectedProduct) return;
    updateStockMutation.mutate({
      productId: selectedProduct.id,
      quantityToAdd: values.quantity,
      currentStock: selectedProduct.stock_quantity,
    });
  };

  const handleDeleteConfirm = () => {
    if (!selectedProduct) return;
    deleteProductMutation.mutate(selectedProduct.id);
  };

  const handleVisibilityChange = (product: Product, newStatus: boolean) => {
    updateProductMutation.mutate({
      productId: product.id,
      values: { is_visible: newStatus },
    });
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const openVariantViewer = (product: Product) => {
      setProductToViewVariants({ id: product.id, name: product.name });
      setIsVariantViewerOpen(true);
  };

  const getPriceDisplay = (product: Product, isCost: boolean = false) => {
    if (!product) return "-";

    const costsArray = Array.isArray(product.variant_costs) ? product.variant_costs : [];
    const pricesArray = Array.isArray(product.variant_prices) ? product.variant_prices : [];
    
    const values = isCost 
        ? (costsArray.filter(v => v !== null && v !== undefined) as number[])
        : (pricesArray.filter(v => v !== null && v !== undefined) as number[]);

    const baseValue = isCost ? (product.cost_price ?? 0) : (product.price ?? 0);

    if (values.length === 0) return formatCurrency(baseValue);

    const min = Math.min(...values);
    const max = Math.max(...values);

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
                onClick={() => openVariantViewer(product)}
                className="flex items-center gap-1 hover:bg-primary/5 p-1 rounded-md transition-colors cursor-help group"
            >
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-xs">
                    {min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`}
                </span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Clique para ver todas as {values.length} opções</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const handleExportXLSX = () => {
    if (!products || products.length === 0) {
      showError("Nenhum produto para exportar.");
      return;
    }
    
    const headers = ["SKU", "Nome", "Descrição", "Preço de Custo", "Preço de Venda", "Estoque", "Categoria", "Sub-categoria", "Marca", "Imagem", "Sabores (Separados por vírgula)", "Publicado (Sim/Não)"];
    
    const data = products.map(p => [
      p.sku || '',
      p.name,
      p.description || '',
      p.cost_price || '',
      p.price,
      p.stock_quantity,
      p.category || '',
      p.sub_category || '',
      p.brand || '',
      p.image_url || '',
      '',
      p.is_visible ? 'Sim' : 'Não'
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    worksheet['!cols'] = headers.map(() => ({ wch: 25 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Produtos");
    XLSX.writeFile(workbook, "produtos_exportados.xlsx");
  };

  const handleImportXLSX = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet) as any[];

            if (json.length === 0) {
                showError("O arquivo está vazio ou em formato incorreto.");
                return;
            }

            const productsToProcess = json.map(mapRowKeys);
            
            const productsToInsert: ProductImportData[] = [];
            const validationErrors: string[] = [];
            let rowIndex = 1; 

            for (const row of productsToProcess) {
                rowIndex++;
                
                const name = row.nome;
                const sku = row.sku || '';
                const price = cleanAndParseFloat(row.preçodevenda);
                const cost_price = cleanAndParseFloat(row.preçodecusto);
                const stock_quantity = parseInt(row.estoque, 10);
                const flavor_names = row.sabores || null;

                let rowIsValid = true;
                if (!name) {
                    validationErrors.push(`Linha ${rowIndex}: Nome do produto é obrigatório.`);
                    rowIsValid = false;
                }
                if (isNaN(price) || price < 0) {
                    validationErrors.push(`Linha ${rowIndex}: Preço de Venda inválido.`);
                    rowIsValid = false;
                }
                if (isNaN(stock_quantity) || stock_quantity < 0 || !Number.isInteger(stock_quantity)) {
                    validationErrors.push(`Linha ${rowIndex}: Estoque inválido.`);
                    rowIsValid = false;
                }
                if (!isNaN(cost_price) && cost_price < 0) {
                    validationErrors.push(`Linha ${rowIndex}: Preço de Custo inválido.`);
                    rowIsValid = false;
                }

                if (rowIsValid) {
                    const product: ProductImportData = {
                        sku: sku,
                        name: name,
                        price: price,
                        stock_quantity: stock_quantity,
                        description: row.descrição || null,
                        cost_price: isNaN(cost_price) ? null : cost_price,
                        category: row.category || row.categoria || null,
                        sub_category: row.subcategory || row.subcategoria || null,
                        brand: row.brand || row.marca || null,
                        image_url: row.image_url || row.imagem || null,
                        is_visible: row.publicado?.toLowerCase() === 'sim',
                        flavor_names: flavor_names,
                    };
                    productsToInsert.push(product);
                }
            }

            if (validationErrors.length > 0) {
                showError(`Foram encontrados ${validationErrors.length} erros de validação. Verifique o console para detalhes.`);
                console.error("Erros de validação na importação:", validationErrors);
            }

            if (productsToInsert.length > 0) {
                setProductsToConfirm(productsToInsert);
                setIsImportConfirmationModalOpen(true);
            } else if (validationErrors.length === 0) {
                showError("Nenhum produto válido encontrado para importar.");
            }

        } catch (error: any) {
            console.error("Erro ao processar arquivo:", error);
            showError(`Erro ao processar arquivo: ${error.message}`);
        } finally {
            if (event.target) {
                event.target.value = '';
            }
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = () => {
    if (productsToConfirm.length > 0) {
      bulkInsertMutation.mutate(productsToConfirm);
    }
  };

  const handleExportJSON = () => {
    if (!products || products.length === 0) {
      showError("Nenhum produto para exportar.");
      return;
    }
    const jsonContent = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(products, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", jsonContent);
    link.setAttribute("download", "produtos.json");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const headers = ["SKU", "Nome", "Preço de Custo", "Preço de Venda", "Estoque", "Sabores (Separados por vírgula)", "Categoria", "Sub-categoria", "Marca", "Imagem", "Publicado (Sim/Não)"];
    const exampleRow = [
        "ZOMO-POD-MENTA", 
        "Pod Descartável Zomo Menta", 
        25.00, 
        45.50, 
        150, 
        "Menta, Ice", 
        "Vapes", 
        "Pods Descartáveis", 
        "Zomo", 
        "https://exemplo.com/imagem.jpg", 
        "Sim" 
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    worksheet['!cols'] = headers.map(() => ({ wch: 25 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo de Importação");
    XLSX.writeFile(workbook, "template_importacao_produtos.xlsx");
  };

  const openFlavorViewer = (product: Product) => {
    setProductToViewFlavors({ id: product.id, name: product.name });
    setIsFlavorViewerOpen(true);
  };

  return (
    <div>
      <div className="flex flex-col gap-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Produtos</h1>
          
          <div className="flex flex-wrap items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleDownloadTemplate}>
                    <Upload className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Baixar modelo de importação (.xlsx)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => document.getElementById('import-input')?.click()}>
                    <FileUp className="h-4 w-4" />
                    <input type="file" id="import-input" className="hidden" accept=".xlsx, .xls" onChange={handleImportXLSX} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Importar produtos (.xlsx)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleExportXLSX}>
                    <FileDown className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Exportar para Excel (.xlsx)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleExportJSON}>
                    <DatabaseBackup className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Exportar para JSON (Backup)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Adicionar Produto
                </Button>
              </DialogTrigger>
              <DialogContent 
                className="max-w-4xl max-h-[90vh] overflow-y-auto"
                onInteractOutside={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
              >
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Produto</DialogTitle>
                </DialogHeader>
                <ProductForm
                  onSubmit={handleAddProduct}
                  isSubmitting={addProductMutation.isPending}
                  categories={categories || []}
                  isLoadingCategories={isLoadingCategories}
                  subCategories={subCategories || []}
                  isLoadingSubCategories={isLoadingSubCategories}
                  brands={brands || []}
                  isLoadingBrands={isLoadingBrands}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-white p-4 rounded-lg border shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar produto ou SKU..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Select value={brandFilter} onValueChange={setBrandFilter} disabled={isLoadingBrands}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as Marcas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Marcas</SelectItem>
              {brands?.map((brand) => (
                <SelectItem key={brand.id} value={brand.name}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={isLoadingCategories}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as Categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>
              {categories?.map((category) => (
                <SelectItem key={category.id} value={category.name}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center justify-end md:col-span-3 lg:col-span-1">
             <span className="text-xs text-muted-foreground font-medium">
                {filteredProducts?.length || 0} produtos encontrados
             </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[64px]">Imagem</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Preço de Custo</TableHead>
              <TableHead>Preço de Venda</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Visibilidade</TableHead>
              <TableHead className="text-center w-[60px]">Sabores</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingProducts || isLoadingBrands || isLoadingCategories || isLoadingSubCategories ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center">
                  Carregando produtos...
                </TableCell>
              </TableRow>
            ) : filteredProducts && filteredProducts.length > 0 ? (
              filteredProducts.map((product) => {
                const brandData = brands?.find(b => b.name === product.brand);
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded-md object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-gray-100 flex items-center justify-center">
                          <ImageOff className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-bold">#{product.id}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.category || "N/A"}</TableCell>
                    <TableCell>
                      {brandData?.image_url ? (
                        <img src={brandData.image_url} alt={brandData.name} className="h-10 w-16 rounded-md object-contain" />
                      ) : (
                        product.brand || "N/A"
                      )}
                    </TableCell>
                    <TableCell>
                      {getPriceDisplay(product, true)}
                    </TableCell>
                    <TableCell>
                      {getPriceDisplay(product)}
                    </TableCell>
                    <TableCell>{product.stock_quantity}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={product.is_visible}
                          onCheckedChange={(newStatus) => handleVisibilityChange(product, newStatus)}
                          disabled={updateProductMutation.isPending}
                        />
                        <Badge variant={product.is_visible ? "default" : "outline"}>
                          {product.is_visible ? "Visível" : "Oculto"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {product.flavor_count > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => openFlavorViewer(product)}>
                                <Leaf className="h-4 w-4 text-green-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{product.flavor_count} Sabores</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" disabled>
                                <Leaf className="h-4 w-4 text-gray-300" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Nenhum sabor associado</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedProduct(product); setIsEditModalOpen(true); }} title="Editar">
                            <MoreHorizontal className="h-4 w-4 text-primary" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-10">
                   Nenhum produto encontrado com os filtros aplicados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent 
            className="max-w-4xl max-h-[90vh] overflow-y-auto"
            onInteractOutside={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Editar Produto: {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <ProductForm
            onSubmit={handleUpdateProduct}
            isSubmitting={updateProductMutation.isPending}
            categories={categories || []}
            isLoadingCategories={isLoadingCategories}
            subCategories={subCategories || []}
            isLoadingSubCategories={isLoadingSubCategories}
            brands={brands || []}
            isLoadingBrands={isLoadingBrands}
            initialData={selectedProduct ? {
                ...selectedProduct,
                sku: selectedProduct.sku || '',
                description: selectedProduct.description || '',
                category: selectedProduct.category || '',
                sub_category: selectedProduct.sub_category || '',
                brand: selectedProduct.brand || '',
                image_url: selectedProduct.image_url || '',
                cost_price: selectedProduct.cost_price || 0,
            } : undefined}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isAddStockModalOpen} onOpenChange={setIsAddStockModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adicionar Estoque: {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <AddStockForm
            onSubmit={handleAddStock}
            isSubmitting={updateStockMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso removerá permanentemente o
              produto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportConfirmationModal
        isOpen={isImportConfirmationModalOpen}
        onClose={() => setIsImportConfirmationModalOpen(false)}
        productsToImport={productsToConfirm}
        onConfirm={handleConfirmImport}
        isSubmitting={bulkInsertMutation.isPending}
      />

      {productToViewFlavors && (
        <ProductFlavorViewer
          productId={productToViewFlavors.id}
          productName={productToViewFlavors.name}
          isOpen={isFlavorViewerOpen}
          onClose={() => setIsFlavorViewerOpen(false)}
        />
      )}

      {productToViewVariants && (
        <ProductVariantViewer
            productId={productToViewVariants.id}
            productName={productToViewVariants.name}
            isOpen={isVariantViewerOpen}
            onClose={() => setIsVariantViewerOpen(false)}
        />
      )}
    </div>
  );
};

export default ProductsPage;