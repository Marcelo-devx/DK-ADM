import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import * as XLSX from 'xlsx';
import { mapRowKeys } from "@/utils/excel-utils";
import { useProductData, ExtendedProduct } from "@/hooks/useProductData";
import { ProductTable } from "@/components/dashboard/products/ProductTable";
import { ProductToolbar } from "@/components/dashboard/products/ProductToolbar";
import { ProductDialogs } from "@/components/dashboard/products/ProductDialogs";
import { showSuccess, showError } from "@/utils/toast";

// Helper para limpeza de dados do Excel
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { products, categories, subCategories, brands, isLoadingProducts, updateProductMutation } = useProductData();
  
  // Local state for filters (no need to be in URL unless requested)
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // States for Import Flow (needs to pass data to modal)
  const [productsToConfirm, setProductsToConfirm] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<any>(null);

  // URL Action Handlers
  const openModal = (mode: string, id?: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("mode", mode);
    if (id) params.set("id", String(id));
    else params.delete("id");
    setSearchParams(params);
  };

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

  // Handlers
  const handleToggleVisibility = (productId: number, isVisible: boolean) => {
    updateProductMutation.mutate({ productId, values: { is_visible: isVisible } });
  };

  // Excel Handlers
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
        openModal("import-confirm");
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const handleExportXLSX = () => {
    if (!products?.length) return;
    const headers = ["SKU", "Nome", "Sabores", "Descrição", "Preço de Custo", "Preço de Venda", "Preço Pix", "Estoque", "Categoria", "Sub-categoria", "Marca", "Imagem", "Publicado (Sim/Não)"];
    const data = products.map(p => [
        p.sku || '', p.name, '', p.description || '', p.cost_price || 0, p.price, p.pix_price || 0,
        p.stock_quantity, p.category || '', p.sub_category || '', p.brand || '', p.image_url || '', p.is_visible ? 'Sim' : 'Não'
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
      <ProductToolbar 
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        brandFilter={brandFilter}
        onBrandFilterChange={setBrandFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        brands={brands}
        categories={categories}
        totalCount={filteredProducts.length}
        onAddProduct={() => openModal("create")}
        onImport={() => document.getElementById('import-input')?.click()}
        onExport={handleExportXLSX}
        onDownloadTemplate={handleDownloadTemplate}
      />
      
      {/* Hidden Input for Import */}
      <input type="file" id="import-input" className="hidden" onChange={handleImportXLSX} accept=".xlsx, .xls" />

      <ProductTable 
        isLoading={isLoadingProducts}
        products={filteredProducts}
        onEdit={(p) => openModal("edit", p.id)}
        onDelete={(p) => openModal("delete", p.id)}
        onViewVariants={(p) => openModal("variants", p.id)}
        onToggleVisibility={handleToggleVisibility}
      />

      <ProductDialogs 
        products={products || []}
        categories={categories || []}
        subCategories={subCategories || []}
        brands={brands || []}
        productsToConfirm={productsToConfirm}
        importResult={importResult}
        setImportResult={setImportResult}
        setProductsToConfirm={setProductsToConfirm}
      />
    </div>
  );
};

export default ProductsPage;