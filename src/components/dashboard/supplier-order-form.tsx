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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Package, Zap } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { useState } from "react";
import { Label } from "../ui/label";
import { showSuccess, showError } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";

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
}

interface SupplierOrderFormProps {
  onSubmit: (values: SupplierOrderFormValues) => void;
  isSubmitting: boolean;
  products: SelectableItem[];
}

export const SupplierOrderForm = ({ onSubmit, isSubmitting, products }: SupplierOrderFormProps) => {
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

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

  const handleFillLowStock = () => {
    const lowStockItems = products.filter(p => p.stock_quantity <= lowStockThreshold);

    if (lowStockItems.length === 0) {
      showError(`Nenhum item encontrado com estoque menor ou igual a ${lowStockThreshold}.`);
      return;
    }

    const itemsToFill = lowStockItems.map(p => ({
      product_id: p.id,
      variant_id: p.variant_id,
      quantity: 1,
      unit_cost: p.cost_price || 0.01
    }));

    replace(itemsToFill);
    showSuccess(`${lowStockItems.length} itens (incluindo variações) adicionados.`);
  };

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
                <div className="flex gap-2">
                    <Input 
                        type="number" 
                        value={lowStockThreshold} 
                        onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                        className="w-20 h-9"
                    />
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 h-9 border-yellow-200 hover:bg-yellow-100 text-yellow-700"
                        onClick={handleFillLowStock}
                    >
                        Puxar Itens
                    </Button>
                </div>
            </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Package className="h-5 w-5" /> Itens do Pedido</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ product_id: undefined as any, variant_id: null, quantity: 1, unit_cost: 0 })}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar Item
            </Button>
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
                        <Select 
                          onValueChange={(val) => {
                              const isVariant = val.startsWith("var_");
                              const idValue = val.split("_")[1];
                              
                              let item;
                              if (isVariant) {
                                  item = products.find(p => p.variant_id === idValue);
                                  form.setValue(`items.${index}.product_id`, item?.id || 0);
                                  form.setValue(`items.${index}.variant_id`, idValue);
                              } else {
                                  item = products.find(p => p.id === Number(idValue) && !p.variant_id);
                                  form.setValue(`items.${index}.product_id`, Number(idValue));
                                  form.setValue(`items.${index}.variant_id`, null);
                              }

                              if (item) {
                                  const cost = item.cost_price && item.cost_price > 0 ? item.cost_price : 0.01;
                                  form.setValue(`items.${index}.unit_cost`, cost, { shouldValidate: true });
                              }
                          }} 
                          value={currentVariantId ? `var_${currentVariantId}` : currentProductId ? `prod_${currentProductId}` : ""}
                        >
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Selecione um item..." /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products.map((p, idx) => (
                              <SelectItem key={`${p.id}-${p.variant_id}-${idx}`} value={p.variant_id ? `var_${p.variant_id}` : `prod_${p.id}`}>
                                  <div className="flex justify-between w-full gap-8">
                                      <span className={p.is_variant ? "pl-2" : "font-bold"}>{p.name}</span>
                                      <span className="text-muted-foreground text-xs opacity-70">R$ {p.cost_price || '0,00'}</span>
                                  </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
      </form>
    </Form>
  );
};