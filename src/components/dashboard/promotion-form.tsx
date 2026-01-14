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
import { useEffect, useState } from "react";
import { Switch } from "../ui/switch";
import { PromotionComposition } from "./PromotionComposition";
import { Separator } from "../ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Tag, Archive, Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(2, "O nome é obrigatório."),
  description: z.string().optional(),
  image_url: z.string().url("URL da imagem inválida.").optional().or(z.literal('')),
  price: z.coerce.number().min(0, "O preço não pode ser negativo."), 
  stock_quantity: z.coerce.number().int().min(0, "O estoque não pode ser negativo."),
  is_active: z.boolean().default(false),
  discount_percent: z.coerce.number().min(0).max(100).optional(),
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
      discount_percent: 0,
    },
  });

  const [maxPossibleStock, setMaxPossibleStock] = useState(0);
  const [itemsTotalBasePrice, setItemsTotalBasePrice] = useState(0);
  const [stockSurplus, setStockSurplus] = useState(0); // O quanto tem sobrando na prateleira

  const currentStock = form.watch("stock_quantity");
  const currentDiscount = form.watch("discount_percent");
  const promotionId = initialData?.id;

  useEffect(() => {
    if (initialData) {
      // Se já existe, o initialData tem o estoque ATUAL do kit.
      form.reset(initialData);
    }
  }, [initialData, form]);

  useEffect(() => {
    if (stockQuantity === 0) {
      form.setValue("is_active", false);
    }
  }, [currentStock, form]);

  const stockQuantity = form.watch("stock_quantity");

  // Função chamada pelo componente filho quando os itens mudam
  const handleStatsUpdate = (surplus: number, totalBase: number) => {
    setStockSurplus(surplus);
    setItemsTotalBasePrice(totalBase);
    
    // O máximo que podemos ter é o que já temos (initialData.stock) + o que sobra (surplus)
    const currentKitStock = initialData?.stock_quantity || 0;
    setMaxPossibleStock(currentKitStock + surplus);
    
    // Se o novo máximo for menor que o atual (ex: alguém deletou itens do estoque), avisa ou ajusta?
    // Por enquanto deixamos o usuário ver o erro na validação se tentar salvar.
  };

  // Auto-calcular preço quando muda o desconto
  useEffect(() => {
    if (itemsTotalBasePrice > 0) {
        const discount = currentDiscount || 0;
        const newPrice = itemsTotalBasePrice * (1 - (discount / 100));
        form.setValue("price", parseFloat(newPrice.toFixed(2)));
    }
  }, [currentDiscount, itemsTotalBasePrice, form]);

  const handleSmartSubmit = async (values: PromotionFormValues) => {
    if (values.stock_quantity > maxPossibleStock) {
        alert(`Erro: Você só tem produtos suficientes para montar ${maxPossibleStock} kits no total.`);
        return;
    }

    if (initialData?.id && values.stock_quantity !== initialData.stock_quantity) {
        try {
            const { stock_quantity, discount_percent, ...basicData } = values;
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
          
          {/* PASSO 1: DADOS BÁSICOS */}
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
                        className="h-[200px] max-w-full"
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

          {/* PASSO 2 & 3: COMPOSIÇÃO E ESTOQUE */}
          {promotionId && (
            <>
                <Separator className="my-6" />
                <PromotionComposition 
                    promotionId={promotionId} 
                    onStatsChange={handleStatsUpdate}
                />

                <div className="space-y-4 bg-gray-50 p-6 rounded-lg border mt-6">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                        <DollarSign className="w-4 h-4 text-gray-500" />
                        <h3 className="text-sm font-bold text-gray-700 uppercase">3. Precificação Inteligente e Estoque</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* CARD DE PREÇO */}
                        <div className="bg-white p-4 rounded border shadow-sm space-y-4">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Soma dos Itens:</span>
                                <span className="font-bold">R$ {itemsTotalBasePrice.toFixed(2)}</span>
                            </div>
                            
                            <FormField
                                control={form.control}
                                name="discount_percent"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-1"><Calculator className="w-3 h-3" /> Desconto %</FormLabel>
                                    <FormControl>
                                    <Input type="number" min="0" max="100" placeholder="0" {...field} />
                                    </FormControl>
                                </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Preço Final (R$)</FormLabel>
                                    <FormControl>
                                    <Input type="number" step="0.01" {...field} readOnly className="bg-gray-100 font-bold text-green-700" />
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                        </div>

                        {/* CARD DE ESTOQUE */}
                        <div className="bg-white p-4 rounded border shadow-sm space-y-4 md:col-span-2">
                            <div className="flex justify-between items-center bg-blue-50 p-2 rounded text-xs text-blue-800 border border-blue-100">
                                <span className="font-bold">Kits Atuais: {initialData?.stock_quantity || 0}</span>
                                <span className="font-bold">+</span>
                                <span className="font-bold">Capacidade Extra: {stockSurplus}</span>
                                <span className="font-bold">=</span>
                                <Badge variant="default" className="bg-blue-600">Máximo Possível: {maxPossibleStock}</Badge>
                            </div>

                            <FormField
                                control={form.control}
                                name="stock_quantity"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Kits Disponíveis para Venda</FormLabel>
                                    <FormControl>
                                    <Input 
                                        type="number" 
                                        min="0" 
                                        max={maxPossibleStock}
                                        {...field}
                                        className="font-bold text-lg h-12"
                                    />
                                    </FormControl>
                                    <FormMessage />
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Você não pode definir um valor maior que {maxPossibleStock} pois faltariam produtos no estoque.
                                    </p>
                                </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="is_active"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-gray-50">
                                    <div className="space-y-0.5">
                                        <FormLabel>Ativar no Site</FormLabel>
                                        <p className="text-[10px] text-muted-foreground">O kit só aparece se estiver ativo e com estoque.</p>
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
                    </div>
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full h-14 font-black text-lg mt-6 shadow-lg bg-green-600 hover:bg-green-700">
                    {isSubmitting ? "Processando..." : "Salvar Alterações e Reservar Estoque"}
                </Button>
            </>
          )}
        </form>
      </Form>
    </div>
  );
};