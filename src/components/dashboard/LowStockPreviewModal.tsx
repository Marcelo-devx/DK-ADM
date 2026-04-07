"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Zap, Package2, Check, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SelectableItem {
  id: number;
  variant_id: string | null;
  name: string;
  stock_quantity: number;
  cost_price: number | null;
  is_variant: boolean;
  category: string | null;
  brand: string | null;
}

interface LowStockPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: SelectableItem[];
  onConfirm: (items: Array<{ product_id: number; variant_id: string | null; quantity: number; unit_cost: number }>) => void;
}

export const LowStockPreviewModal = ({ isOpen, onClose, products, onConfirm }: LowStockPreviewModalProps) => {
  const [stockThreshold, setStockThreshold] = useState(10);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // State for selected items and their quantities
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});

  // Get unique categories and brands
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    return cats.sort();
  }, [products]);

  const brands = useMemo(() => {
    const br = Array.from(new Set(products.map(p => p.brand).filter(Boolean)));
    return br.sort();
  }, [products]);

  // Filter low stock items
  const filteredItems = useMemo(() => {
    return products.filter(p => {
      // Filter by stock threshold
      if (p.stock_quantity > stockThreshold) return false;

      // Filter by category
      if (selectedCategory !== "all" && p.category !== selectedCategory) return false;

      // Filter by brand
      if (selectedBrand !== "all" && p.brand !== selectedBrand) return false;

      // Filter by search term
      if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

      return true;
    }).sort((a, b) => a.stock_quantity - b.stock_quantity); // Sort by lowest stock first
  }, [products, stockThreshold, selectedCategory, selectedBrand, searchTerm]);

  const uniqueKey = (item: SelectableItem) => `${item.id}-${item.variant_id || "base"}`;

  const handleToggleItem = (item: SelectableItem, checked: boolean) => {
    const key = uniqueKey(item);
    setSelectedItems(prev => {
      const newState = { ...prev };
      if (checked) {
        newState[key] = 1; // Default quantity
      } else {
        delete newState[key];
      }
      return newState;
    });
  };

  const handleUpdateQuantity = (item: SelectableItem, quantity: number) => {
    const key = uniqueKey(item);
    setSelectedItems(prev => ({
      ...prev,
      [key]: Math.max(1, quantity)
    }));
  };

  const handleSelectAll = () => {
    const allSelected: Record<string, number> = {};
    filteredItems.forEach(item => {
      allSelected[uniqueKey(item)] = 1;
    });
    setSelectedItems(allSelected);
  };

  const handleClearSelection = () => {
    setSelectedItems({});
  };

  const handleConfirm = () => {
    const itemsToConfirm = Object.entries(selectedItems).map(([key, quantity]) => {
      const [id, variantId] = key.split("-");
      const item = products.find(p => 
        String(p.id) === id && 
        (variantId === "base" ? !p.variant_id : p.variant_id === variantId)
      );
      
      if (!item) return null;
      
      return {
        product_id: item.id,
        variant_id: item.variant_id,
        quantity,
        unit_cost: item.cost_price || 0.01
      };
    }).filter(Boolean) as Array<{ product_id: number; variant_id: string | null; quantity: number; unit_cost: number }>;

    onConfirm(itemsToConfirm);
    setSelectedItems({});
    onClose();
  };

  const getStockColor = (stock: number) => {
    if (stock === 0) return "text-red-700 bg-red-50";
    if (stock <= 3) return "text-orange-700 bg-orange-50";
    return "text-yellow-700 bg-yellow-50";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-600" />
            Sugestões de Estoque Baixo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Filters Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-yellow-50/50 rounded-lg border border-yellow-200">
            <div>
              <Label className="text-sm font-medium text-yellow-800">Estoque Máximo</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input 
                  type="number" 
                  value={stockThreshold} 
                  onChange={(e) => setStockThreshold(Number(e.target.value))}
                  className="h-9"
                />
                <span className="text-xs text-yellow-700">itens</span>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-yellow-800">Categoria</Label>
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-yellow-300 bg-white text-sm mt-1"
              >
                <option value="all">Todas</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-sm font-medium text-yellow-800">Marca</Label>
              <select 
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-yellow-300 bg-white text-sm mt-1"
              >
                <option value="all">Todas</option>
                {brands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-sm font-medium text-yellow-800">Buscar</Label>
              <Input 
                placeholder="Nome do produto..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 mt-1"
              />
            </div>
          </div>

          {/* Selection Controls */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              <strong>{filteredItems.length}</strong> itens encontrados • <strong>{Object.keys(selectedItems).length}</strong> selecionados
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                <Check className="h-4 w-4 mr-1" /> Selecionar Todos
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearSelection}>
                <X className="h-4 w-4 mr-1" /> Limpar Seleção
              </Button>
            </div>
          </div>

          {/* Table */}
          <ScrollArea className="flex-1 border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 sticky top-0 z-10">
                  <TableHead className="w-12 text-center">Selecionar</TableHead>
                  <TableHead>Produto / Variação</TableHead>
                  <TableHead className="w-28">Tipo</TableHead>
                  <TableHead className="w-24 text-center">Estoque</TableHead>
                  <TableHead className="w-32 text-right">Custo Unit.</TableHead>
                  <TableHead className="w-28 text-right">Qtd a Comprar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum item encontrado com os filtros atuais
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const key = uniqueKey(item);
                    const isSelected = selectedItems[key] !== undefined;
                    const quantity = selectedItems[key] || 1;

                    return (
                      <TableRow key={key} className={isSelected ? "bg-blue-50/50" : ""}>
                        <TableCell className="text-center">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={(checked) => handleToggleItem(item, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <div>{item.name}</div>
                              {item.brand && (
                                <div className="text-xs text-muted-foreground">Marca: {item.brand}</div>
                              )}
                              {item.category && (
                                <div className="text-xs text-muted-foreground">Categoria: {item.category}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.is_variant ? "secondary" : "default"} className="text-xs">
                            {item.is_variant ? (
                              <><Package2 className="h-3 w-3 mr-1" /> Variação</>
                            ) : (
                              <><Package className="h-3 w-3 mr-1" /> Produto</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-xs font-bold ${getStockColor(item.stock_quantity)}`}>
                            {item.stock_quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          R$ {(item.cost_price || 0.01).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {isSelected ? (
                            <Input 
                              type="number" 
                              min="1"
                              value={quantity}
                              onChange={(e) => handleUpdateQuantity(item, Number(e.target.value))}
                              className="h-8 w-20 text-right"
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground text-right block">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <div className="flex items-center gap-4">
            {Object.keys(selectedItems).length > 0 && (
              <div className="text-sm">
                <span className="font-medium">Total Itens:</span> {Object.values(selectedItems).reduce((a, b) => a + b, 0)}
              </div>
            )}
            <Button 
              onClick={handleConfirm} 
              disabled={Object.keys(selectedItems).length === 0}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              <Zap className="h-4 w-4 mr-2" />
              Adicionar {Object.keys(selectedItems).length} Item(ns) ao Pedido
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};