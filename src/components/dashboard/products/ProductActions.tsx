import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  PlusCircle, 
  FileDown, 
  FileUp, 
  DownloadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProductActionsProps {
  totalProducts: number;
  onAddProduct: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onDownloadTemplate: () => void;
}

export const ProductActions = ({
  totalProducts,
  onAddProduct,
  onImport,
  onExport,
  onDownloadTemplate,
}: ProductActionsProps) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Catálogo</h1>
        <Badge variant="secondary" className="h-7 px-3 text-sm font-bold bg-blue-50 text-blue-700 border-blue-100">
          {totalProducts} itens
        </Badge>
      </div>
      
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-white border p-1 rounded-xl shadow-sm">
            <TooltipProvider>
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
                        <Button variant="ghost" className="h-9 px-3 text-green-600 hover:bg-green-50 rounded-lg flex items-center gap-2 font-bold text-xs relative" onClick={() => document.getElementById('import-input')?.click()}>
                            <FileUp className="h-4 w-4" />
                            <span>Importar</span>
                            <input type="file" id="import-input" className="hidden" onChange={onImport} accept=".xlsx, .xls" />
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
        
        <Button onClick={onAddProduct} className="bg-primary hover:bg-primary/90 font-bold h-11 px-6 shadow-lg rounded-xl transition-all hover:scale-[1.02] active:scale-95">
            <PlusCircle className="w-5 h-5 mr-2" />
            Adicionar Produto
        </Button>
      </div>
    </div>
  );
};