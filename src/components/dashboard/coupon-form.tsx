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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useEffect } from "react";
import { ShieldCheck } from "lucide-react";

const formSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(2, "O nome é obrigatório."),
  description: z.string().optional(),
  discount_type: z.enum(["product", "shipping", "percentage"]).default("product"),
  discount_value: z.coerce.number().min(0, "O valor do desconto não pode ser negativo."),
  points_cost: z.coerce.number().int().min(0, "O custo em pontos não pode ser negativo."),
  minimum_order_value: z.coerce.number().min(0, "O valor mínimo do pedido não pode ser negativo."),
  stock_quantity: z.coerce.number().int().min(0, "O estoque não pode ser negativo."),
  is_active: z.boolean().default(true),
  is_admin_only: z.boolean().default(false),
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
  const form = useForm<CouponFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      discount_type: "product",
      discount_value: 0,
      points_cost: 0,
      minimum_order_value: 0,
      stock_quantity: 0,
      is_active: true,
      is_admin_only: false,
      ...initialData,
    },
  });

  const discountType = form.watch("discount_type");

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: "",
        description: "",
        discount_type: "product",
        discount_value: 0,
        points_cost: 0,
        minimum_order_value: 0,
        stock_quantity: 0,
        is_active: true,
        is_admin_only: false,
        ...initialData,
      });
    }
  }, [initialData, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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

        <FormField
          control={form.control}
          name="discount_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Desconto</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="product">Valor Fixo (R$)</SelectItem>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="shipping">Frete Grátis</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {discountType !== "shipping" && (
            <FormField
              control={form.control}
              name="discount_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {discountType === "percentage" ? "Percentual de Desconto (%)" : "Valor do Desconto (R$)"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step={discountType === "percentage" ? "1" : "0.01"}
                      min="0"
                      max={discountType === "percentage" ? "100" : undefined}
                      placeholder={discountType === "percentage" ? "Ex: 10" : "Ex: 10.00"}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
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
                <FormControl>
                  <Input type="number" min="0" placeholder="Cupons disponíveis" {...field} />
                </FormControl>
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
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_admin_only"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border border-orange-200 bg-orange-50 p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel className="flex items-center gap-2 text-orange-800">
                  <ShieldCheck className="w-4 h-4" />
                  Exclusivo Admin / Gerente Geral
                </FormLabel>
                <p className="text-xs text-orange-600">
                  Quando ativo, este cupom não aparece para os clientes. Só pode ser atribuído manualmente pelo admin ou gerente geral.
                </p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : (initialData?.id ? "Salvar Alterações" : "Adicionar Cupom")}
        </Button>
      </form>
    </Form>
  );
};
