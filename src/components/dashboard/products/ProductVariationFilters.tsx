import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProductFilterVariant } from "@/hooks/useProductData";

export const variationFields = [
  { key: "flavor", label: "Sabor" },
  { key: "volume_ml", label: "Volume (ml)" },
  { key: "color", label: "Cor" },
  { key: "ohms", label: "Resistência (ohms)" },
  { key: "size", label: "Tamanho" },
] as const;

export type VariationField = typeof variationFields[number]["key"];
export type VariationFilters = Partial<Record<VariationField, string>>;
export type VariationOptions = Partial<Record<VariationField, string[]>>;

export const getVariationValue = (variant: ProductFilterVariant, field: VariationField): string => {
  const value = field === "flavor"
    ? (Array.isArray(variant.flavors) ? variant.flavors[0]?.name : variant.flavors?.name)
    : variant[field];
  return value == null ? "" : String(value).trim();
};

interface ProductVariationFiltersProps {
  filters: VariationFilters;
  options: VariationOptions;
  onChange: (field: VariationField, value: string) => void;
}

export const ProductVariationFilters = ({ filters, options, onChange }: ProductVariationFiltersProps) => (
  <>
    {variationFields.map(({ key, label }) => options[key]?.length ? (
      <div key={key} className="space-y-1">
        <label className="block text-xs font-medium text-gray-500">{label}</label>
        <Select value={filters[key] ?? "all"} onValueChange={(value) => onChange(key, value)}>
          <SelectTrigger className="bg-gray-50/50" aria-label={`Filtrar por ${label.toLowerCase()}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos — {label.toLowerCase()}</SelectItem>
            {options[key]?.map((value) => (
              <SelectItem key={value} value={`value:${value}`}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ) : null)}
  </>
);
