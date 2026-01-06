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
import { Switch } from "../ui/switch";
import { useEffect } from "react";
import { ImageUploader } from "./ImageUploader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const formSchema = z.object({
  id: z.number().optional(),
  customer_name: z.string().min(2, "O nome do cliente é obrigatório."),
  product_id: z.coerce.number().optional().nullable(), // Novo campo para o ID do produto
  product_name: z.string().min(2, "O nome do produto é obrigatório."),
  product_image_url: z.string().url("URL da imagem inválida.").optional().or(z.literal('')),
  time_ago: z.string().min(2, "O tempo decorrido é obrigatório (Ex: '5 minutos atrás')."),
  is_active: z.boolean().default(true),
});

type SalesPopupFormValues = z.infer<typeof formSchema>;

interface ProductOption {
  id: number;
  name: string;
  image_url: string | null;
}

interface SalesPopupFormProps {
  onSubmit: (values: SalesPopupFormValues) => void;
  isSubmitting: boolean;
  initialData?: Partial<SalesPopupFormValues>;
  products: ProductOption[];
  isLoadingProducts: boolean;
}

export const SalesPopupForm = ({
  onSubmit,
  isSubmitting,
  initialData,
  products,
  isLoadingProducts,
}: SalesPopupFormProps) => {
  const form = useForm<SalesPopupFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      customer_name: "",
      product_id: null,
      product_name: "",
      product_image_url: "",
      time_ago: "5 minutos atrás",
      is_active: true,
    },
  });

  const selectedProductId = form.watch("product_id");

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  // Efeito para preencher nome e imagem quando o produto é selecionado
  useEffect(() => {
    if (selectedProductId) {
      const selectedProduct = products.find(p => p.id === selectedProductId);
      if (selectedProduct) {
        form.setValue("product_name", selectedProduct.name, { shouldValidate: true });
        form.setValue("product_image_url", selectedProduct.image_url || "", { shouldValidate: true });
      }
    }
  }, [selectedProductId, products, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="customer_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Cliente</FormLabel>
              <FormControl>
                <Input placeholder="Ex: João S." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="product_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Produto Comprado</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(Number(value))}
                value={field.value ? String(field.value) : ""}
                disabled={isLoadingProducts || isSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingProducts ? "Carregando produtos..." : "Selecione um produto"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Campos de fallback/manual se nenhum produto for selecionado */}
        {!selectedProductId && (
          <>
            <FormField
              control={form.control}
              name="product_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Produto (Manual)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Pod Descartável Zomo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="product_image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Imagem do Produto (Manual)</FormLabel>
                  <ImageUploader
                    onUploadSuccess={(url) => field.onChange(url)}
                    initialUrl={field.value}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <FormField
          control={form.control}
          name="time_ago"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tempo Decorrido</FormLabel>
              <FormControl>
                <Input placeholder="Ex: 5 minutos atrás" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Ativo</FormLabel>
                <FormMessage />
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
          {isSubmitting ? "Salvando..." : (initialData ? "Salvar Alterações" : "Adicionar Popup")}
        </Button>
      </form>
    </Form>
  );
};