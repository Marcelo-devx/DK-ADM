import * as React from "react";
import { Check, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface SelectableItem {
  id: number;
  variant_id: string | null;
  name: string;
  stock_quantity: number;
  cost_price: number | null;
  is_variant: boolean;
  ohms?: string | null;
  size?: string | null;
  color?: string | null;
}

interface ProductComboboxProps {
  products: SelectableItem[];
  value: string;
  onChange: (value: string, item: SelectableItem) => void;
  filterType: 'all' | 'products' | 'variants';
  onFilterChange: (filter: 'all' | 'products' | 'variants') => void;
  placeholder?: string;
}

export const ProductCombobox = React.memo(function ProductCombobox({
  products,
  value,
  onChange,
  filterType,
  onFilterChange,
  placeholder = "Selecione um item...",
}: ProductComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  // Filter products based on search and filter type
  const filteredProducts = React.useMemo(() => {
    const searchLower = searchValue.toLowerCase().trim();
    return products.filter((p) => {
      // Apply type filter
      if (filterType === 'variants' && !p.is_variant) return false;
      if (filterType === 'products' && p.is_variant) return false;

      // Apply search filter
      if (searchLower && !p.name.toLowerCase().includes(searchLower)) return false;

      return true;
    });
  }, [products, searchValue, filterType]);

  // Find selected item for display
  const selectedItem = React.useMemo(() => {
    if (!value) return null;
    const isVariant = String(value).startsWith("var_");
    const idValue = String(value).split("_")[1];
    
    if (isVariant) {
      return products.find(p => p.variant_id === idValue);
    }
    return products.find(p => p.id === Number(idValue) && !p.variant_id);
  }, [value, products]);

  // Handle item selection
  const handleSelect = React.useCallback((currentValue: string) => {
    const isVariant = String(currentValue).startsWith("var_");
    const idValue = String(currentValue).split("_")[1];
    
    let item;
    if (isVariant) {
      item = products.find(p => p.variant_id === idValue);
    } else {
      item = products.find(p => p.id === Number(idValue) && !p.variant_id);
    }

    if (item) {
      onChange(currentValue, item);
      setOpen(false);
      setSearchValue("");
    }
  }, [products, onChange]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10 px-3 font-normal"
          title={selectedItem ? selectedItem.name : placeholder}
        >
          <div className="flex items-center justify-between w-full gap-2">
            <span className="truncate" title={selectedItem ? selectedItem.name : placeholder}>
              {selectedItem ? selectedItem.name : placeholder}
            </span>
            {selectedItem && (
              <Badge variant="outline" className="text-[10px] h-5 bg-white shrink-0" title={`Estoque: ${selectedItem.stock_quantity}`}>
                Estoque: {selectedItem.stock_quantity}
              </Badge>
            )}
          </div>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Buscar produto..."
              value={searchValue}
              onValueChange={setSearchValue}
              onKeyDown={handleKeyDown}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus-visible:ring-0"
            />
          </div>
          
          {/* Filter buttons */}
          <div className="flex border-b">
            <Button
              type="button"
              variant={filterType === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onFilterChange('all')}
              className="flex-1 rounded-none h-9 text-sm"
            >
              Todos
            </Button>
            <Button
              type="button"
              variant={filterType === 'products' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onFilterChange('products')}
              className="flex-1 rounded-none h-9 text-sm"
            >
              Produtos
            </Button>
            <Button
              type="button"
              variant={filterType === 'variants' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onFilterChange('variants')}
              className="flex-1 rounded-none h-9 text-sm"
            >
              Variações
            </Button>
          </div>

          <CommandList>
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            {filteredProducts.map((p, idx) => {
              const itemValue = p.variant_id ? `var_${p.variant_id}` : `prod_${p.id}`;
              const isSelected = value === itemValue;
              
              return (
                <CommandItem
                  key={`${p.id}-${p.variant_id}-${idx}`}
                  value={itemValue}
                  onSelect={handleSelect}
                  className="cursor-pointer"
                  title={p.name}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      isSelected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col flex-1">
                    <span className={cn(p.is_variant ? "pl-2" : "font-medium")} title={p.name}>
                      {p.name}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Estoque: {p.stock_quantity}</span>
                      {p.cost_price && (
                        <span>• R$ {Number(p.cost_price).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});