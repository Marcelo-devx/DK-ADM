import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Filter } from "lucide-react";

export interface OrderFilters {
  clientName: string;
  email: string;
  phone: string;
  status: string;
  dateStart: string;
  dateEnd: string;
}

interface OrderSearchFiltersProps {
  filters: OrderFilters;
  onFilterChange: (filters: OrderFilters) => void;
  onClearFilters: () => void;
}

export function OrderSearchFilters({ filters, onFilterChange, onClearFilters }: OrderSearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof OrderFilters, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = Object.values(filters).some(v => v && v.trim() !== "");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant={isExpanded ? "default" : "outline"}
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          {isExpanded ? "Ocultar Filtros Avançados" : "Filtros Avançados"}
          {hasActiveFilters && (
            <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {Object.values(filters).filter(v => v && v.trim() !== "").length}
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={onClearFilters} className="gap-2 text-sm">
            <X className="h-4 w-4" />
            Limpar Filtros
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="bg-slate-50 border rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Nome do Cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="clientName"
                  placeholder="Nome do cliente..."
                  value={filters.clientName}
                  onChange={(e) => updateFilter("clientName", e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                placeholder="cliente@email.com"
                value={filters.email}
                onChange={(e) => updateFilter("email", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                placeholder="(00) 00000-0000"
                value={filters.phone}
                onChange={(e) => updateFilter("phone", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status do Pedido</Label>
              <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os status</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Em preparo">Em preparo</SelectItem>
                  <SelectItem value="Enviado">Enviado</SelectItem>
                  <SelectItem value="Finalizada">Finalizada</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateStart">Data Inicial</Label>
              <Input
                id="dateStart"
                type="date"
                value={filters.dateStart}
                onChange={(e) => updateFilter("dateStart", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateEnd">Data Final</Label>
              <Input
                id="dateEnd"
                type="date"
                value={filters.dateEnd}
                onChange={(e) => updateFilter("dateEnd", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={onClearFilters} variant="outline" className="gap-2">
              <X className="h-4 w-4" />
              Limpar Todos os Filtros
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
