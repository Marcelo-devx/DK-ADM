import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface ProductFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  brandFilter: string;
  setBrandFilter: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  brands: { id: number; name: string }[] | undefined;
  categories: { id: number; name: string }[] | undefined;
  totalFound: number;
}

export const ProductFilters = ({
  searchTerm,
  setSearchTerm,
  brandFilter,
  setBrandFilter,
  categoryFilter,
  setCategoryFilter,
  brands,
  categories,
  totalFound,
}: ProductFiltersProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-white p-4 rounded-xl border shadow-sm">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar produto ou SKU..."
          className="pl-9 bg-gray-50/50"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <Select value={brandFilter} onValueChange={setBrandFilter}>
        <SelectTrigger className="bg-gray-50/50">
          <SelectValue placeholder="Todas as Marcas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as Marcas</SelectItem>
          {brands?.map((b) => (
            <SelectItem key={b.id} value={b.name}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger className="bg-gray-50/50">
          <SelectValue placeholder="Todas as Categorias" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as Categorias</SelectItem>
          {categories?.map((c) => (
            <SelectItem key={c.id} value={c.name}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center justify-end">
        <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
          {totalFound} encontrados
        </span>
      </div>
    </div>
  );
};