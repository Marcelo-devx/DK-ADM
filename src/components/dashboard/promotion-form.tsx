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
import { supabase } from "@/integrations/supabase/client";

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

  const handleSmartSubmit = async (values: PromotionFormValues) => {
    if (initialData?.id && values.stock_quantity !== initialData.stock_quantity) {
        try {
            const { stock_quantity, ...basicData } = values;
            const { error: basicError } = await supabase
                .from('promotions')
                .update(basicData)
                .eq('id', initialData.id);
            
            if (basicError) throw basicError;

            const { error: stockError } = await supabase.rpc('update_kit_stock_level', {
                p_promotion_id: initialData.id,
                p_new_stock: values.stock_quantity
            });

            if (stockError) throw stockError;
            onSubmit(values); 

        } catch (error: any) {
            console.error("Erro ao atualizar kit:", error);
            alert(`Erro ao atualizar estoque do kit: ${error.message}`);
        }
    } else {
        onSubmit(values);
    }
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSmartSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                            <Input 
                                type="number" 
                                min="0" 
                                placeholder="Limite de vendas" 
                                {...field} 
                            />
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
            {isSubmitting ? "Salvando..." : (initialData?.id ? "Salvar Dados Básicos" : "Criar Kit (Para Liberar Composição)")}
          </Button>
        </form>
      </Form>

      <Separator className="my-6" />
      
      {/* Sempre renderiza, mas o componente trata o estado nulo com uma mensagem */}
      <PromotionComposition promotionId={promotionId} />
    </div>
  );
};