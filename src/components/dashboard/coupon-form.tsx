import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "../ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { useEffect, useState } from "react";

const formSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(2, "O nome é obrigatório."),
  description: z.string().optional(),
  discount_value: z.coerce.number().min(0.01, "O valor do desconto deve ser positivo."),
  points_cost: z.coerce.number().int().min(0, "O custo em pontos não pode ser negativo."),
  minimum_order_value: z.coerce.number().min(0, "O valor mínimo do pedido não pode ser negativo."),
  // allow -1 to mean infinite, or a non-negative integer
  stock_quantity: z.union([z.literal(-1), z.coerce.number().int().min(0, "O estoque não pode ser negativo.")]),
  is_active: z.boolean().default(true),
});

type CouponFormValues = z.infer<typeof formSchema>;

interface CouponFormProps {
  onSubmit: (values: CouponFormValues) => void;
  isSubmitting: boolean;
  initialData?: Partial<CouponFormValues>;
}

export const CouponForm = ({
  onSubmit,
  isSubmitting,
  initialData,
}: CouponFormProps) => {
  const [infinite, setInfinite] = useState(false);

  const form = useForm<CouponFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: "",
      description: "",
      discount_value: 0,
      points_cost: 0,
      minimum_order_value: 0,
      stock_quantity: 0,
      is_active: true,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
      if (initialData.stock_quantity === -1) setInfinite(true);
    }
  }, [initialData, form]);

  useEffect(() => {
    // keep form value in sync with infinite toggle
    if (infinite) {
      form.setValue('stock_quantity', -1, { shouldValidate: true });
    } else {
      // if toggling off and current value is -1, reset to 0
      const current = form.getValues('stock_quantity');
      if (current === -1) form.setValue('stock_quantity', 0, { shouldValidate: true });
    }
  }, [infinite, form]);

  const handleInternalSubmit = (values: any) => {
    // ensure the value reflects infinite state
    if (infinite) values.stock_quantity = -1;
    onSubmit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleInternalSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Cupom</FormLabel>
              <FormControl>
                <Input placeholder="Ex: DESCONTO10" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Condição de Uso</FormLabel>
              <FormControl>
                <Textarea placeholder="Descreva as condições para usar o cupom (opcional)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="discount_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor do Desconto (R$)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="Ex: 10.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="minimum_order_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Mínimo do Pedido (R$)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="Ex: 100.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="points_cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custo em Pontos</FormLabel>
                <FormControl>
                  <Input type="number" min="0" placeholder="Pontos para resgatar" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="stock_quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estoque</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      placeholder={infinite ? "Ilimitado" : "Cupons disponíveis"}
                      {...field}
                      disabled={infinite}
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant={infinite ? 'destructive' : 'outline'}
                    onClick={() => setInfinite(v => !v)}
                    className="h-9"
                  >
                    {infinite ? 'Ilimitado' : '∞'}
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Cupom Ativo</FormLabel>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : (initialData ? "Salvar Alterações" : "Adicionar Cupom")}
        </Button>
      </form>
    </Form>
  );
};