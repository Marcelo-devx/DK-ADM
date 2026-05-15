"use client";

import { useForm, useFieldArray, useWatch, UseFormSetValue } from "react-hook-form";
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
import { useState, useEffect, useCallback, memo, useMemo } from "react";
import { showSuccess } from "@/utils/toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProductCombobox, SelectableItem } from "./ProductCombobox";
import { LowStockPreviewModal } from "./LowStockPreviewModal";

// ─── Schema ───────────────────────────────────────────────────────────────────
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

export type SupplierOrderFormValues = z.infer<typeof formSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────
interface SupplierOrderFormProps {
  onSubmit: (values: SupplierOrderFormValues) => void;
  isSubmitting: boolean;
  onSearch: (term: string) => Promise<SelectableItem[]>;
  initialValues?: SupplierOrderFormValues | null;
  preloadedItems?: SelectableItem[];
}

// ─── Linha individual do pedido ───────────────────────────────────────────────
// Componente isolado: re-renders de uma linha NÃO afetam as outras
const OrderItemRow = memo(function OrderItemRow({
  index,
  control,
  setValue,
  onSearch,
  onRemove,
  preloadedItem,
}: {
  index: number;
  control: any;
  setValue: UseFormSetValue<SupplierOrderFormValues>;
  onSearch: (term: string) => Promise<SelectableItem[]>;
  onRemove: () => void;
  preloadedItem?: SelectableItem | null;
}) {
  // Estado local do item selecionado — isolado por linha
  const [selectedItem, setSelectedItem] = useState<SelectableItem | null>(preloadedItem ?? null);

  // Sincroniza se o preloadedItem mudar (ex: ao abrir edição)
  useEffect(() => {
    if (preloadedItem) setSelectedItem(preloadedItem);
  }, [preloadedItem]);

  // Lê apenas os campos desta linha (não re-renderiza outras linhas)
  const productId = useWatch({ control, name: `items.${index}.product_id` });
  const variantId = useWatch({ control, name: `items.${index}.variant_id` });

  const comboValue = variantId
    ? `var_${variantId}`
    : productId
    ? `prod_${productId}`
    : "";

  const handleChange = useCallback(
    (val: string, item: SelectableItem) => {
      const isVariant = val.startsWith("var_");
      const idPart = val.split("_")[1];

      setValue(`items.${index}.product_id`, isVariant ? item.id : Number(idPart));
      setValue(`items.${index}.variant_id`, isVariant ? idPart : null);

      const cost = item.cost_price && item.cost_price > 0 ? item.cost_price : 0.01;
      setValue(`items.${index}.unit_cost`, cost, { shouldValidate: true });

      setSelectedItem(item);
    },
    [setValue, index]
  );

  const handleClear = useCallback(() => {
    setSelectedItem(null);
    setValue(`items.${index}.product_id`, 0 as any);
    setValue(`items.${index}.variant_id`, null);
  }, [setValue, index]);

  return (
    <div className="border p-3 rounded-xl bg-gray-50 space-y-2">
      {/* Produto — linha inteira */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <FormField
            control={control}
            name={`items.${index}.product_id`}
            render={() => (
              <FormItem>
                <FormLabel className="text-[11px] font-bold text-gray-500 uppercase">Produto / Variação</FormLabel>
                <ProductCombobox
                  value={comboValue}
                  selectedItem={selectedItem}
                  onSearch={onSearch}
                  onChange={handleChange}
                  onClear={handleClear}
                  placeholder="Buscar produto..."
                  allowWrap={true}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {/* Botão remover — sempre visível no topo direito */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-red-400 hover:bg-red-50 hover:text-red-600 h-8 w-8 mt-5 shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Qtd + Custo — lado a lado */}
      <div className="grid grid-cols-2 gap-2">
        <FormField
          control={control}
          name={`items.${index}.quantity`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-bold text-gray-500 uppercase">Quantidade</FormLabel>
              <FormControl>
                <Input type="number" min={1} className="h-10 text-sm font-bold" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`items.${index}.unit_cost`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-bold text-gray-500 uppercase">Custo Unit. (R$)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min={0.01} className="h-10 text-sm font-bold" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
});

// ─── Formulário principal ─────────────────────────────────────────────────────
export const SupplierOrderForm = ({
  onSubmit,
  isSubmitting,
  onSearch,
  initialValues = null,
  preloadedItems = [],
}: SupplierOrderFormProps) => {
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<SelectableItem[]>([]);
  const [isLoadingLowStock, setIsLoadingLowStock] = useState(false);

  const form = useForm<SupplierOrderFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues || {
      supplier_name: "",
      notes: "",
      items: [{ product_id: undefined as any, variant_id: null, quantity: 1, unit_cost: 0 }],
    },
  });

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Total calculado de forma eficiente — só recalcula quando items mudam
  const watchedItems = useWatch({ control: form.control, name: "items" });
  const total = useMemo(
    () =>
      (watchedItems || []).reduce(
        (acc, item) => acc + Number(item?.quantity || 0) * Number(item?.unit_cost || 0),
        0
      ),
    [watchedItems]
  );

  // Abre modal de estoque baixo — busca produtos via server-side
  const handleOpenLowStockModal = useCallback(async () => {
    setIsLoadingLowStock(true);
    setIsLowStockModalOpen(true);
    try {
      const data = await onSearch("");
      setLowStockProducts(data);
    } catch {
      setLowStockProducts([]);
    } finally {
      setIsLoadingLowStock(false);
    }
  }, [onSearch]);

  const handleConfirmLowStockItems = useCallback(
    (
      itemsToConfirm: Array<{
        product_id: number;
        variant_id: string | null;
        quantity: number;
        unit_cost: number;
      }>
    ) => {
      itemsToConfirm.forEach((item) => append(item));
      showSuccess(`${itemsToConfirm.length} itens adicionados ao pedido.`);
    },
    [append]
  );

  // Atalho Alt+Z para adicionar linha
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        e.stopPropagation();
        append({ product_id: undefined as any, variant_id: null, quantity: 1, unit_cost: 0 });
        showSuccess("Nova linha adicionada (Alt+Z)");
      }
    };
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, { capture: true } as any);
  }, [append]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Cabeçalho */}
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
            <span className="text-xs font-semibold text-yellow-700 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Sugestão de Estoque Baixo
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-9 border-yellow-200 hover:bg-yellow-100 text-yellow-700"
              onClick={handleOpenLowStockModal}
              disabled={isLoadingLowStock}
            >
              <Zap className="h-4 w-4 mr-2" />
              {isLoadingLowStock ? "Carregando..." : "Ver Sugestões de Estoque Baixo"}
            </Button>
          </div>
        </div>

        {/* Itens */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5" /> Itens do Pedido
            </h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        product_id: undefined as any,
                        variant_id: null,
                        quantity: 1,
                        unit_cost: 0,
                      })
                    }
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

          {fields.map((field, index) => (
            <OrderItemRow
              key={field.id}
              index={index}
              control={form.control}
              setValue={form.setValue}
              onSearch={onSearch}
              onRemove={() => remove(index)}
              preloadedItem={preloadedItems[index] ?? null}
            />
          ))}
        </div>

        {/* Observações */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea placeholder="Ex: Prazo de entrega 5 dias..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Total + Botão — sticky no mobile */}
        <div className="sticky bottom-0 bg-white pt-3 pb-2 -mx-4 px-4 md:static md:mx-0 md:px-0 md:pb-0 md:pt-0 border-t md:border-none space-y-2">
          <div className="flex items-center justify-between p-3 md:p-4 bg-primary/5 rounded-xl border border-primary/10">
            <span className="text-sm md:text-lg font-bold">Total Estimado:</span>
            <span className="text-xl md:text-2xl font-black text-primary">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}
            </span>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full h-12 text-base font-bold rounded-xl">
            {isSubmitting
              ? initialValues ? "Atualizando..." : "Criando..."
              : initialValues ? "✅ Atualizar Pedido" : "✅ Salvar Pedido de Compra"}
          </Button>
        </div>

        <LowStockPreviewModal
          isOpen={isLowStockModalOpen}
          onClose={() => setIsLowStockModalOpen(false)}
          products={lowStockProducts}
          onConfirm={handleConfirmLowStockItems}
        />
      </form>
    </Form>
  );
};