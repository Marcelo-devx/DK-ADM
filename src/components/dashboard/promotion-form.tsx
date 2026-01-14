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
import { DollarSign, Tag, Archive } from "lucide-react";

const formSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(2, "O nome é obrigatório."),
  description: z.string().optional(),
  image_url: z.string().url("URL da imagem inválida.").optional().or(z.literal('')),
  // Alterado de 0.01 para 0 para permitir a criação inicial sem definir preço
  price: z.coerce.number().min(0, "O preço não pode ser negativo."), 
  stock_quantity: z.coerce.number().int().min(0, "O estoque não pode ser negativo."),
  is_active: z.boolean().default(false), // Padrão false para não ativar sem querer
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
      is_active: false,
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
          
          {/* PASSO 1: DADOS BÁSICOS (Sempre visível) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                    <Tag className="w-4 h-4 text-gray-500" />
                    <h3 className="text-sm font-bold text-gray-700 uppercase">1. Dados Básicos</h3>
                </div>

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
                        className="h-[240px] max-w-full"
                    />
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
          </div>

          {/* Se não tem ID, mostra botão para criar e liberar o resto */}
          {!promotionId && (
             <Button type="submit" disabled={isSubmitting} className="w-full h-12 font-bold text-lg bg-blue-600 hover:bg-blue-700">
                {isSubmitting ? "Criando..." : "Criar Kit & Avançar para Composição"}
             </Button>
          )}

          {/* PASSO 2: COMPOSIÇÃO (Só aparece se já salvou) */}
          {promotionId && (
            <>
                <Separator className="my-6" />
                <PromotionComposition promotionId={promotionId} />

                {/* PASSO 3: PREÇO E ESTOQUE (Só depois de ter o kit) */}
                <div className="space-y-4 bg-gray-50 p-4 rounded-lg border mt-6">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                        <DollarSign className="w-4 h-4 text-gray-500" />
                        <h3 className="text-sm font-bold text-gray-700 uppercase">3. Precificação e Estoque</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="price"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Preço Final do Kit (R$)</FormLabel>
                                <FormControl>
                                <Input type="number" step="0.01" placeholder="Ex: 89.90" {...field} className="bg-white" />
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
                                    placeholder="Ao aumentar, consome estoque dos itens" 
                                    {...field}
                                    className="bg-white" 
                                />
                                </FormControl>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                                    <Archive className="w-3 h-3" /> Ao salvar, o sistema reservará o estoque dos itens acima.
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

                <Button type="submit" disabled={isSubmitting} className="w-full h-12 font-bold text-lg mt-4">
                    {isSubmitting ? "Salvando e Ajustando Estoque..." : "Salvar Alterações do Kit"}
                </Button>
            </>
          )}
        </form>
      </Form>
    </div>
  );
};