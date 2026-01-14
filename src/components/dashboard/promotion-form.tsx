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
import { ImageUploader } from "./ImageUploader";
import { useEffect } from "react";
import { Switch } from "../ui/switch";
import { PromotionComposition } from "./PromotionComposition";
import { Separator } from "../ui/separator";

const formSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(2, "O nome é obrigatório."),
  description: z.string().optional(),
  image_url: z.string().url("URL da imagem inválida.").optional().or(z.literal('')),
  price: z.coerce.number().min(0.01, "O preço deve ser positivo."),
  stock_quantity: z.coerce.number().int().min(0, "O estoque não pode ser negativo."),
  is_active: z.boolean().default(true),
});

type PromotionFormValues = z.infer<typeof formSchema>;

interface PromotionFormProps {
  onSubmit: (values: PromotionFormValues) => void;
  isSubmitting: boolean;
  initialData?: Partial<PromotionFormValues>;
}

export const PromotionForm = ({
  onSubmit,
  isSubmitting,
  initialData,
}: PromotionFormProps) => {
  const form = useForm<PromotionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: "",
      description: "",
      image_url: "",
      price: 0,
      stock_quantity: 0,
      is_active: true,
    },
  });

  const stockQuantity = form.watch("stock_quantity");
  const promotionId = initialData?.id;

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  useEffect(() => {
    if (stockQuantity === 0) {
      form.setValue("is_active", false);
    }
  }, [stockQuantity, form]);

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna da Esquerda: Dados Básicos */}
            <div className="space-y-4">
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nome do Kit/Promoção</FormLabel>
                    <FormControl>
                        <Input placeholder="Ex: Combo Iniciante Zomo" {...field} />
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
                    <FormLabel>Descrição Comercial</FormLabel>
                    <FormControl>
                        <Textarea placeholder="Descreva os benefícios deste kit..." className="min-h-[100px]" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Preço do Kit (R$)</FormLabel>
                            <FormControl>
                            <Input type="number" step="0.01" placeholder="Ex: 89.90" {...field} />
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
                            <FormLabel>Kits Disponíveis</FormLabel>
                            <FormControl>
                            <Input type="number" min="0" placeholder="Limite de vendas" {...field} />
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
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-white">
                    <div className="space-y-0.5">
                        <FormLabel>Ativar no Site</FormLabel>
                    </div>
                    <FormControl>
                        <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={stockQuantity === 0}
                        />
                    </FormControl>
                    </FormItem>
                )}
                />
            </div>

            {/* Coluna da Direita: Imagem */}
            <div className="space-y-4">
                <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Imagem Exclusiva do Kit</FormLabel>
                    <ImageUploader
                        onUploadSuccess={(url) => field.onChange(url)}
                        initialUrl={field.value}
                        label="Capa da Promoção"
                        className="h-[320px] max-w-full"
                    />
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full h-12 font-bold text-lg">
            {isSubmitting ? "Salvando..." : (initialData?.id ? "Salvar Dados Básicos" : "Criar Kit (Para Adicionar Itens)")}
          </Button>
        </form>
      </Form>

      {/* Seção de Composição (Só aparece se já salvou a promoção) */}
      {promotionId && (
        <>
            <Separator className="my-6" />
            <PromotionComposition promotionId={promotionId} />
        </>
      )}
    </div>
  );
};