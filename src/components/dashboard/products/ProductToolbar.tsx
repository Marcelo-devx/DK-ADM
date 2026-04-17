import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PlusCircle, Search, DownloadCloud, FileUp, FileDown, Eye, Loader2, SlidersHorizontal, X, FilterX, Package } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ProductToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  brandFilter: string;
  onBrandFilterChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  brands: { id: number; name: string }[] | undefined;
  categories: { id: number; name: string }[] | undefined;
  totalCount: number;
  onAddProduct: () => void;
  onImport: () => void;
  onExport: () => void;
  onDownloadTemplate: () => void;
  onActivateAll: () => void;
  isActivatingAll: boolean;
  isExporting?: boolean;
}

export const ProductToolbar = ({
  searchTerm,
  onSearchChange,
  brandFilter,
  onBrandFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  brands,
  categories,
  totalCount,
  onAddProduct,
  onImport,
  onExport,
  onDownloadTemplate,
  onActivateAll,
  isActivatingAll,
  isExporting = false,
}: ProductToolbarProps) => {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const hasActiveFilters =
    searchTerm || brandFilter !== "all" || categoryFilter !== "all";

  const activeFilterCount = [
    searchTerm ? 1 : 0,
    brandFilter !== "all" ? 1 : 0,
    categoryFilter !== "all" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearAllFilters = () => {
    onSearchChange("");
    onBrandFilterChange("all");
    onCategoryFilterChange("all");
  };

  return (
    <div className="mb-6">
      {/* ── MOBILE header ── */}
      <div className="md:hidden">
        {/* Title row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Catálogo</h1>
            <Badge variant="secondary" className="h-6 px-2 text-xs font-bold bg-blue-50 text-blue-700 border-blue-100">
              {totalCount}
            </Badge>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2">
          {/* Filtros */}
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "flex-1 h-10 gap-2 font-semibold",
                  hasActiveFilters && "border-blue-400 text-blue-700 bg-blue-50"
                )}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filtros
                {hasActiveFilters && (
                  <span className="bg-blue-600 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] overflow-y-auto rounded-t-2xl">
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5" /> Filtros
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                    >
                      <FilterX className="w-3.5 h-3.5" /> Limpar tudo
                    </button>
                  )}
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-4">
                {/* Busca */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Buscar produto ou SKU</label>
                  <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg h-11 overflow-hidden">
                    <Search className="absolute left-3 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Nome ou SKU..."
                      value={searchTerm}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="pl-10 pr-8 py-2 bg-transparent border-none text-sm w-full focus:outline-none focus:ring-0"
                    />
                    {searchTerm && (
                      <button onClick={() => onSearchChange("")} className="absolute right-3 text-gray-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Marca */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Marca</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onBrandFilterChange("all")}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                        brandFilter === "all"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"
                      )}
                    >
                      Todas
                    </button>
                    {brands?.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => onBrandFilterChange(b.name)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                          brandFilter === b.name
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"
                        )}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categoria */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Categoria</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onCategoryFilterChange("all")}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                        categoryFilter === "all"
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
                      )}
                    >
                      Todas
                    </button>
                    {categories?.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => onCategoryFilterChange(c.name)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                          categoryFilter === c.name
                            ? "bg-green-600 text-white border-green-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
                        )}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ações em massa */}
                <div className="pt-2 border-t">
                  <label className="text-xs font-medium text-gray-500 mb-2 block">Ações em Massa</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-10 text-xs gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
                      onClick={() => { onActivateAll(); setMobileFiltersOpen(false); }}
                      disabled={isActivatingAll}
                    >
                      {isActivatingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                      Ativar Tudo
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 text-xs gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                      onClick={() => { onDownloadTemplate(); }}
                    >
                      <DownloadCloud className="h-3.5 w-3.5" /> Modelo Excel
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 text-xs gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
                      onClick={() => { onImport(); setMobileFiltersOpen(false); }}
                    >
                      <FileUp className="h-3.5 w-3.5" /> Importar
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 text-xs gap-1.5 text-orange-700 border-orange-200 hover:bg-orange-50"
                      onClick={() => { onExport(); }}
                      disabled={isExporting}
                    >
                      {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                      Exportar
                    </Button>
                  </div>
                </div>

                <Button
                  className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 mt-2"
                  onClick={() => setMobileFiltersOpen(false)}
                >
                  <Package className="w-4 h-4 mr-2" />
                  Ver {totalCount} produtos
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Botão principal */}
          <Button
            onClick={onAddProduct}
            className="bg-primary hover:bg-primary/90 font-bold h-10 px-4 gap-1.5 text-sm"
          >
            <PlusCircle className="w-4 h-4" /> Adicionar
          </Button>
        </div>

        {/* Chips de filtros ativos */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {searchTerm && (
              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 text-xs">
                "{searchTerm}"
                <button onClick={() => onSearchChange("")}><X className="w-3 h-3 ml-0.5" /></button>
              </span>
            )}
            {brandFilter !== "all" && (
              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 text-xs">
                {brandFilter}
                <button onClick={() => onBrandFilterChange("all")}><X className="w-3 h-3 ml-0.5" /></button>
              </span>
            )}
            {categoryFilter !== "all" && (
              <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 text-xs">
                {categoryFilter}
                <button onClick={() => onCategoryFilterChange("all")}><X className="w-3 h-3 ml-0.5" /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── DESKTOP (original) ── */}
      <div className="hidden md:flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Catálogo</h1>
            <Badge variant="secondary" className="h-7 px-3 text-sm font-bold bg-blue-50 text-blue-700 border-blue-100">
              {totalCount} itens
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-white border p-1 rounded-xl shadow-sm">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-9 px-3 text-green-600 hover:bg-green-50 rounded-lg flex items-center gap-2 font-bold text-xs"
                      onClick={onActivateAll}
                      disabled={isActivatingAll}
                    >
                      {isActivatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                      <span>Ativar Tudo</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Tornar todos os produtos visíveis no site</p></TooltipContent>
                </Tooltip>

                <div className="w-[1px] h-4 bg-gray-200 mx-1" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" className="h-9 px-3 text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2 font-bold text-xs" onClick={onDownloadTemplate}>
                      <DownloadCloud className="h-4 w-4" />
                      <span>Modelo</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Baixar Modelo Excel</p></TooltipContent>
                </Tooltip>

                <div className="w-[1px] h-4 bg-gray-200 mx-1" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" className="h-9 px-3 text-green-600 hover:bg-green-50 rounded-lg flex items-center gap-2 font-bold text-xs relative" onClick={onImport}>
                      <FileUp className="h-4 w-4" />
                      <span>Importar</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Importar Planilha</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-9 px-3 text-orange-600 hover:bg-orange-50 rounded-lg flex items-center gap-2 font-bold text-xs"
                      onClick={onExport}
                      disabled={isExporting}
                    >
                      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                      <span>{isExporting ? "Exportando..." : "Exportar"}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Exportar Catálogo</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <Button onClick={onAddProduct} className="bg-primary hover:bg-primary/90 font-bold h-11 px-6 shadow-lg rounded-xl transition-all hover:scale-[1.02] active:scale-95">
              <PlusCircle className="w-5 h-5 mr-2" />
              Adicionar Produto
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-white p-4 rounded-xl border shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar produto ou SKU..."
              className="pl-9 bg-gray-50/50"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <Select value={brandFilter} onValueChange={onBrandFilterChange}>
            <SelectTrigger className="bg-gray-50/50"><SelectValue placeholder="Todas as Marcas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Marcas</SelectItem>
              {brands?.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
            <SelectTrigger className="bg-gray-50/50"><SelectValue placeholder="Todas as Categorias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>
              {categories?.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-end">
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{totalCount} encontrados</span>
          </div>
        </div>
      </div>
    </div>
  );
};
