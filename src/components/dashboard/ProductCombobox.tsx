import * as React from "react";
import { Check, Search, Copy, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
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

export interface SelectableItem {
  id: number;
  variant_id: string | null;
  name: string;
  stock_quantity: number;
  cost_price: number | null;
  is_variant: boolean;
  ohms?: string | null;
  size?: string | null;
  color?: string | null;
  category?: string | null;
  brand?: string | null;
}

interface ProductComboboxProps {
  value: string; // "var_<uuid>" | "prod_<id>" | ""
  selectedItem: SelectableItem | null;
  onSearch: (term: string) => Promise<SelectableItem[]>;
  onChange: (value: string, item: SelectableItem) => void;
  onClear?: () => void;
  placeholder?: string;
  allowWrap?: boolean;
}

export const ProductCombobox = React.memo(function ProductCombobox({
  value,
  selectedItem,
  onSearch,
  onChange,
  onClear,
  placeholder = "Buscar produto...",
  allowWrap = false,
}: ProductComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const [results, setResults] = React.useState<SelectableItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quando o popover abre, busca os primeiros resultados (sem termo)
  React.useEffect(() => {
    if (!open) {
      setSearchValue("");
      setResults([]);
      return;
    }
    // Busca inicial ao abrir
    triggerSearch("");
  }, [open]);

  const triggerSearch = React.useCallback(
    async (term: string) => {
      setIsLoading(true);
      try {
        const data = await onSearch(term);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [onSearch]
  );

  const handleSearchChange = React.useCallback(
    (val: string) => {
      setSearchValue(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        triggerSearch(val);
      }, 350);
    },
    [triggerSearch]
  );

  const handleSelect = React.useCallback(
    (itemValue: string) => {
      const isVariant = itemValue.startsWith("var_");
      const idPart = itemValue.split("_")[1];
      const item = results.find((p) =>
        isVariant ? p.variant_id === idPart : p.id === Number(idPart) && !p.variant_id
      );
      if (item) {
        onChange(itemValue, item);
        setOpen(false);
      }
    },
    [results, onChange]
  );

  const copyToClipboard = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(text);
      showSuccess(`Copiado: ${text}`);
    } catch (err: any) {
      showError(err?.message || "Erro ao copiar");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between px-3 font-normal",
            allowWrap ? "h-auto min-h-10 py-2" : "h-10"
          )}
          title={selectedItem ? selectedItem.name : placeholder}
        >
          <div className={cn(
            "flex items-center justify-between w-full gap-2 min-w-0",
            allowWrap && selectedItem ? "items-start" : "items-center"
          )}>
            <span
              className={cn(
                "flex-1 text-left",
                allowWrap
                  ? "whitespace-normal break-words leading-snug"
                  : "truncate"
              )}
              title={selectedItem?.name ?? placeholder}
            >
              {selectedItem ? selectedItem.name : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </span>
            <div className={cn(
              "flex items-center gap-1 shrink-0",
              allowWrap && selectedItem ? "mt-0.5" : ""
            )}>
              {selectedItem && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 p-0"
                    onClick={(e) => copyToClipboard(selectedItem.name, e)}
                    title="Copiar nome"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Badge variant="outline" className="text-[10px] h-5 bg-white">
                    Est: {selectedItem.stock_quantity}
                  </Badge>
                  {onClear && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onClear();
                      }}
                      title="Limpar seleção"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </>
              )}
              {!selectedItem && <Search className="h-4 w-4 opacity-40" />}
            </div>
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[min(520px,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          {/* Campo de busca */}
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              autoFocus
              placeholder="Digite para buscar..."
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            {isLoading && <Loader2 className="h-4 w-4 animate-spin opacity-50 shrink-0" />}
          </div>

          <CommandList className="max-h-[300px]">
            {isLoading && results.length === 0 ? (
              <div className="py-6 flex flex-col items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mb-2" />
                <p>Buscando...</p>
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>
                {searchValue ? "Nenhum produto encontrado." : "Digite para buscar produtos."}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {results.map((p, idx) => {
                  const itemValue = p.variant_id ? `var_${p.variant_id}` : `prod_${p.id}`;
                  const isSelected = value === itemValue;
                  return (
                    <CommandItem
                      key={`${p.id}-${p.variant_id ?? "base"}-${idx}`}
                      value={itemValue}
                      onSelect={handleSelect}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                      />
                      <div className="flex items-start w-full gap-2 min-w-0">
                        <div className="flex-1 flex flex-col min-w-0">
                          <span
                            className={cn("whitespace-normal break-words leading-snug text-sm", p.is_variant ? "pl-1" : "font-medium")}
                          >
                            {p.name}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Estoque: {p.stock_quantity}</span>
                            {p.cost_price != null && p.cost_price > 0 && (
                              <span>• R$ {Number(p.cost_price).toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={(e) => copyToClipboard(p.name, e)}
                          title="Copiar nome"
                        >
                          <Copy className="h-3 w-3 opacity-60" />
                        </Button>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>

          {results.length > 0 && (
            <div className="border-t px-3 py-2 text-xs text-muted-foreground text-center">
              {results.length} resultado(s) — refine a busca para encontrar mais
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
});