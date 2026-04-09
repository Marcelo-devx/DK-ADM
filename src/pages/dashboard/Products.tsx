import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import * as XLSX from 'xlsx';
import { mapRowKeys } from "@/utils/excel-utils";
import { showSuccess, showError } from "@/utils/toast";
import { useProductData } from "@/hooks/useProductData";
import { ProductTable } from "@/components/dashboard/products/ProductTable";
import { ProductToolbar } from "@/components/dashboard/products/ProductToolbar";
import { ProductDialogs } from "@/components/dashboard/products/ProductDialogs";

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
  const { products, categories, subCategories, brands, isLoadingProducts, updateProductMutation, activateAllMutation } = useProductData();
  
  // Local state for filters (no need to be in URL unless requested)
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // States for Import Flow (needs to pass data to modal)
  const [productsToConfirm, setProductsToConfirm] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);

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

  const handleActivateAll = () => {
    if (confirm("Deseja realmente ativar a visibilidade de TODOS os produtos do catálogo?")) {
        activateAllMutation.mutate();
    }
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
        
        // Helpers to detect visibility field and parse its value
        const parseBooleanLike = (val: any) => {
            if (val === undefined || val === null) return false;
            if (typeof val === 'boolean') return val;
            const s = String(val).trim().toLowerCase();
            if (s === '') return false;
            // common true-ish values
            if (['sim', 's', 'yes', 'y', 'true', '1'].includes(s)) return true;
            // words containing these hints
            if (s.includes('sim') || s.includes('public') || s.includes('visiv') || s.includes('vis') || s.includes('publish')) return true;
            return false;
        };

        const findVisibilityValue = (row: any) => {
            // row keys are normalized by mapRowKeys later, but here we inspect the raw keys first
            for (const key in row) {
                const normalizedKey = key
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/\s/g, '')
                  .toLowerCase();
                if (normalizedKey.includes('public') || normalizedKey.includes('visiv') || normalizedKey.includes('vis') || normalizedKey.includes('publicado') || normalizedKey.includes('publicados')) {
                    return row[key];
                }
            }
            // fallback to common normalized names
            return row['Publicado'] ?? row['publicado'] ?? row['publicadossimnao'] ?? row['publicadossimnao'] ?? row['publicadosimnao'] ?? row['publicados'] ?? row['visivel'] ?? row['visivelno'] ?? undefined;
        };

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
            // Determine visibility using flexible detection
            is_visible: parseBooleanLike(findVisibilityValue(row) ?? row.publicadossimnao ?? row.publicado ?? row.visivel ?? row.visivelno ?? row.publicados ?? ''),
            flavor_names: row.sabores || '' 
        }));
        
        setProductsToConfirm(productsToInsert);
        openModal("import-confirm");
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const handleExportXLSX = async () => {
    if (!products?.length) {
        showError("Não há produtos para exportar");
        return;
    }

    setIsExporting(true);

    try {
        const MAX_CELL_LENGTH = 32767;
        let truncatedCount = 0;

        const sanitizeCell = (value: any) => {
          if (value === undefined || value === null) return '';
          // Preserve numbers as numbers
          if (typeof value === 'number') return value;
          const str = typeof value === 'string' ? value : String(value);
          if (str.length > MAX_CELL_LENGTH) {
            truncatedCount++;
            return str.slice(0, MAX_CELL_LENGTH - 3) + '...';
          }
          return str;
        };

        // Exporta todos os produtos (não apenas os filtrados)
        const headers = [
          "SKU Produto",
          "Nome Produto",
          "SKU Variação",
          "Nome Variação",
          "Variant ID",
          "Flavor ID",
          "Volume (ml)",
          "Preço Variação",
          "Preço de Custo Variação",
          "Estoque Variação",
          "Preço Produto",
          "Preço de Custo Produto",
          "Estoque Produto",
          "Categoria",
          "Sub-categoria",
          "Marca",
          "Imagem",
          "Publicado (Sim/Não)"
        ];

        const rows: any[] = [];

        products.forEach((p: any) => {
          const variants = Array.isArray((p as any).variants) ? (p as any).variants : [];

          if (variants.length > 0) {
            variants.forEach((v: any) => {
              const flavor = v.flavors ? (Array.isArray(v.flavors) ? v.flavors[0]?.name : v.flavors?.name) : '';
              const variationName = `${flavor ? flavor : ''}${v.volume_ml ? ` (${v.volume_ml}ml)` : ''}`.trim();

              rows.push([
                sanitizeCell(p.sku || ''),
                sanitizeCell(p.name || ''),
                sanitizeCell(v.sku || ''),
                sanitizeCell(variationName || ''),
                v.id ?? '',
                v.flavor_id ?? '',
                v.volume_ml ?? '',
                v.price ?? p.price ?? 0,
                v.cost_price ?? p.cost_price ?? 0,
                v.stock_quantity ?? 0,
                p.price ?? 0,
                p.cost_price ?? 0,
                p.stock_quantity ?? 0,
                sanitizeCell(p.category || ''),
                sanitizeCell(p.sub_category || ''),
                sanitizeCell(p.brand || ''),
                sanitizeCell(p.image_url || ''),
                p.is_visible ? 'Sim' : 'Não'
              ]);
            });
          } else {
            // product without variants
            rows.push([
              sanitizeCell(p.sku || ''),
              sanitizeCell(p.name || ''),
              '',
              '',
              '',
              '',
              '',
              p.price ?? 0,
              p.cost_price ?? 0,
              p.stock_quantity ?? 0,
              p.price ?? 0,
              p.cost_price ?? 0,
              p.stock_quantity ?? 0,
              sanitizeCell(p.category || ''),
              sanitizeCell(p.sub_category || ''),
              sanitizeCell(p.brand || ''),
              sanitizeCell(p.image_url || ''),
              p.is_visible ? 'Sim' : 'Não'
            ]);
          }
        });

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Produtos");
        XLSX.writeFile(workbook, "produtos_tabacaria.xlsx");

        const succMsg = `Exportação concluída! ${rows.length} linhas exportadas.` + (truncatedCount > 0 ? ` ${truncatedCount} campos longos foram truncados.` : '');
        showSuccess(succMsg);
    } catch (error: any) {
        console.error("Erro ao exportar:", error);
        showError("Erro ao exportar: " + (error?.message ?? String(error)));
    } finally {
        setIsExporting(false);
    }
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
        onActivateAll={handleActivateAll}
        isActivatingAll={activateAllMutation.isPending}
        isExporting={isExporting}
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