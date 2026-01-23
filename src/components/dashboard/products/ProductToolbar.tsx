import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Search, DownloadCloud, FileUp, FileDown, Eye, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  isActivatingAll
}: ProductToolbarProps) => {
  return (
    <div className="flex flex-col gap-6 mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Catálogo</h1>
          <Badge variant="secondary" className="h-7 px-3 text-sm font-bold bg-blue-50 text-blue-700 border-blue-100">{totalCount} itens</Badge>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* GRUPO DE EXCEL E AÇÕES EM MASSA */}
          <div className="flex items-center bg-white border p-1 rounded-xl shadow-sm">
              <TooltipProvider>
                  {/* BOTÃO ATIVAR TUDO */}
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
                          <Button variant="ghost" className="h-9 px-3 text-orange-600 hover:bg-orange-50 rounded-lg flex items-center gap-2 font-bold text-xs" onClick={onExport}>
                              <FileDown className="h-4 w-4" />
                              <span>Exportar</span>
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Exportar Catálogo</p></TooltipContent>
                  </Tooltip>
              </TooltipProvider>
          </div>
          
          {/* BOTÃO PRINCIPAL */}
          <Button onClick={onAddProduct} className="bg-primary hover:bg-primary/90 font-bold h-11 px-6 shadow-lg rounded-xl transition-all hover:scale-[1.02] active:scale-95">
              <PlusCircle className="w-5 h-5 mr-2" />
              Adicionar Produto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar produto ou SKU..." className="pl-9 bg-gray-50/50" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
        <Select value={brandFilter} onValueChange={onBrandFilterChange}>
          <SelectTrigger className="bg-gray-50/50"><SelectValue placeholder="Todas as Marcas" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as Marcas</SelectItem>{brands?.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
          <SelectTrigger className="bg-gray-50/50"><SelectValue placeholder="Todas as Categorias" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as Categorias</SelectItem>{categories?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center justify-end"><span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{totalCount} encontrados</span></div>
      </div>
    </div>
  );
};