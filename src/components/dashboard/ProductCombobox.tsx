import * as React from "react";
import { Check, Search, Copy, Loader2 } from "lucide-react";

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
import { showSuccess, showError } from "@/utils/toast";

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

// Debounce hook customizado
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
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
  const debouncedSearch = useDebounce(searchValue, 300);

  // Filter products based on search and filter type - otimizado
  const filteredProducts = React.useMemo(() => {
    if (!products || products.length === 0) return [];
    
    const searchLower = debouncedSearch.toLowerCase().trim();
    
    // Se não tem busca, aplica apenas o filtro de tipo
    if (!searchLower) {
      if (filterType === 'all') return products;
      if (filterType === 'variants') return products.filter(p => p.is_variant);
      if (filterType === 'products') return products.filter(p => !p.is_variant);
      return products;
    }

    // Com busca, aplica ambos os filtros
    return products.filter((p) => {
      // Apply type filter
      if (filterType === 'variants' && !p.is_variant) return false;
      if (filterType === 'products' && p.is_variant) return false;

      // Apply search filter
      return p.name.toLowerCase().includes(searchLower);
    });
  }, [products, debouncedSearch, filterType]);

  // Check if search is in progress (debounced value differs from current)
  const isSearching = React.useMemo(() => {
    return searchValue.trim() !== "" && searchValue !== debouncedSearch;
  }, [searchValue, debouncedSearch]);

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

  // copy helper
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccess(`Copiado: ${text}`);
    } catch (err: any) {
      console.error(err);
      showError(err?.message || 'Erro ao copiar');
    }
  };

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
            <span className="truncate flex-1" title={selectedItem ? selectedItem.name : placeholder}>
              {selectedItem ? selectedItem.name : placeholder}
            </span>

            {selectedItem && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="p-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    copyToClipboard(selectedItem.name);
                  }}
                  aria-label="Copiar nome do produto"
                  title="Copiar nome"
                >
                  <Copy className="h-4 w-4" />
                </Button>

                <Badge variant="outline" className="text-[10px] h-5 bg-white shrink-0" title={`Estoque: ${selectedItem.stock_quantity}`}>
                  Estoque: {selectedItem.stock_quantity}
                </Badge>
              </div>
            )}

            {!selectedItem && <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
            {selectedItem && <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
          </div>
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
            {isSearching && (
              <Loader2 className="h-4 w-4 animate-spin opacity-50" />
            )}
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
            {isSearching ? (
              <div className="py-6 flex flex-col items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                <p>Buscando...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            ) : (
              filteredProducts.map((p, idx) => {
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
                    <div className="flex items-center w-full gap-2">
                      <div className="flex-1 flex flex-col">
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

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="p-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          copyToClipboard(p.name);
                        }}
                        aria-label={`Copiar nome ${p.name}`}
                        title="Copiar nome"
                      >
                        <Copy className="h-4 w-4 opacity-60" />
                      </Button>
                    </div>
                  </CommandItem>
                );
              })
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});