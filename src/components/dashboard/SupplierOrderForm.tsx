"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Package, Zap, Keyboard } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { useState, useEffect, useCallback } from "react";
import { Label } from "../ui/label";
import { showSuccess, showError } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProductCombobox } from "./ProductCombobox";
import { LowStockPreviewModal } from "./LowStockPreviewModal";

const itemSchema = z.object({
  product_id: z.coerce.number().min(1, "Selecione um produto"),
  variant_id: z.string().nullable().optional(),
  quantity: z.coerce.number().min(1, "Mínimo 1"),
  unit_cost: z.coerce.number().min(0.01, "Mínimo 0.01"),
});

const formSchema = z.object({
  supplier_name: z.string().min(2, "O nome do fornecedor é obrigatório."),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Adicione pelo menos um item"),
});

type SupplierOrderFormValues = z.infer<typeof formSchema>;

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
  category: string | null;
  brand: string | null;
}

interface SupplierOrderFormProps {
  onSubmit: (values: SupplierOrderFormValues) => void;
  isSubmitting: boolean;
  products: SelectableItem[];
}

export const SupplierOrderForm = ({ onSubmit, isSubmitting, products }: SupplierOrderFormProps) => {
  const [filterTypes, setFilterTypes] = useState<Record<number, 'all' | 'products' | 'variants'>>({});
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);

  const form = useForm<SupplierOrderFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplier_name: "",
      notes: "",
      items: [{ product_id: undefined as any, variant_id: null, quantity: 1, unit_cost: 0 }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const total = form.watch("items").reduce((acc, item) => acc + (Number(item.quantity) * Number(item.unit_cost || 0)), 0);

  const handleOpenLowStockModal = () => {
    setIsLowStockModalOpen(true);
  };

  const handleConfirmLowStockItems = (itemsToConfirm: Array<{ product_id: number; variant_id: string | null; quantity: number; unit_cost: number }>) => {
    // Append new items to the existing form
    itemsToConfirm.forEach(item => {
      append(item);
    });
    showSuccess(`${itemsToConfirm.length} itens adicionados ao pedido.`);
  };

  const handleFilterChange = useCallback((index: number, filter: 'all' | 'products' | 'variants') => {
    setFilterTypes(prev => ({
      ...prev,
      [index]: filter
    }));
  }, []);

  // Keyboard shortcut for Alt+Z to add new item
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        e.stopPropagation();
        append({ product_id: undefined as any, variant_id: null, quantity: 1, unit_cost: 0 });
        showSuccess("Nova linha adicionada (Alt+Z)");
      }
    };

    // Use capture phase to intercept before Dialog handles the event
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true } as any);
  }, [append]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <FormField
            control={form.control}
            name="supplier_name"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Nome do Fornecedor</FormLabel>
                <FormControl>
                    <Input placeholder="Ex: Distribuidora Central" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            
            <div className="flex flex-col space-y-2 border p-3 rounded-lg bg-yellow-50/50">
                <Label className="text-xs font-semibold text-yellow-700 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Sugestão de Estoque Baixo
                </Label>
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="w-full h-9 border-yellow-200 hover:bg-yellow-100 text-yellow-700"
                    onClick={handleOpenLowStockModal}
                >
                    <Zap className="h-4 w-4 mr-2" /> Ver Sugestões de Estoque Baixo
                </Button>
            </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Package className="h-5 w-5" /> Itens do Pedido</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => append({ product_id: undefined as any, variant_id: null, quantity: 1, unit_cost: 0 })}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Adicionar Item
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="flex items-center gap-2">
                    <Keyboard className="h-4 w-4" />
                    <span>Alt+Z</span>
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {fields.map((field, index) => {
            const currentVariantId = form.watch(`items.${index}.variant_id`);
            const currentProductId = form.watch(`items.${index}.product_id`);
            
            const selectedItem = products.find(p => 
                currentVariantId ? p.variant_id === currentVariantId : p.id === Number(currentProductId) && !p.variant_id
            );

            return (
              <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end border p-4 rounded-lg bg-gray-50 relative">
                <div className="md:col-span-5">
                  <FormField
                    control={form.control}
                    name={`items.${index}.product_id`}
                    render={({ field: productField }) => (
                      <FormItem>
                        <div className="flex justify-between items-center mb-2">
                            <FormLabel>Produto / Sabor / Tamanho</FormLabel>
                            {selectedItem && (
                                <Badge variant="outline" className="text-[10px] h-5 bg-white">
                                    Estoque: {selectedItem.stock_quantity}
                                </Badge>
                            )}
                        </div>
                        <ProductCombobox
                          products={products}
                          value={currentVariantId ? `var_${currentVariantId}` : currentProductId ? `prod_${currentProductId}` : ""}
                          onChange={(val, item) => {
                            const isVariant = String(val).startsWith("var_");
                            const idValue = String(val).split("_")[1];
                            
                            if (isVariant) {
                              form.setValue(`items.${index}.product_id`, item?.id || 0);
                              form.setValue(`items.${index}.variant_id`, idValue);
                            } else {
                              form.setValue(`items.${index}.product_id`, Number(idValue));
                              form.setValue(`items.${index}.variant_id`, null);
                            }

                            if (item) {
                              const cost = item.cost_price && item.cost_price > 0 ? item.cost_price : 0.01;
                              form.setValue(`items.${index}.unit_cost`, cost, { shouldValidate: true });
                            }
                          }}
                          filterType={filterTypes[index] || 'all'}
                          onFilterChange={(filter) => handleFilterChange(index, filter)}
                          placeholder="Buscar produto..."
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="md:col-span-3">
                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Qtd a Comprar</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="md:col-span-3">
                  <FormField
                    control={form.control}
                    name={`items.${index}.unit_cost`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custo Unit. (R$)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="md:col-span-1 pb-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl><Textarea placeholder="Ex: Prazo de entrega 5 dias..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/10">
          <span className="text-lg font-bold">Total Estimado:</span>
          <span className="text-2xl font-bold text-primary">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}
          </span>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Criando Pedido..." : "Salvar Pedido de Compra"}
        </Button>

        <LowStockPreviewModal
          isOpen={isLowStockModalOpen}
          onClose={() => setIsLowStockModalOpen(false)}
          products={products}
          onConfirm={handleConfirmLowStockItems}
        />
      </form>
    </Form>
  );
};