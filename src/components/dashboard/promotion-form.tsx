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
import { PromotionComposition, BreakdownItem } from "./PromotionComposition";
import { Separator } from "../ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Tag, Calculator, QrCode, CreditCard, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

const formSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(2, "O nome é obrigatório."),
  description: z.string().optional(),
  image_url: z.string().url("URL da imagem inválida.").optional().or(z.literal('')),
  price: z.coerce.number().min(0, "O preço não pode ser negativo."), 
  pix_price: z.coerce.number().min(0, "O preço pix não pode ser negativo."), // Novo campo
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
      pix_price: 0,
      stock_quantity: 0,
      is_active: false,
      discount_percent: 0,
    },
  });

  const [maxPossibleStock, setMaxPossibleStock] = useState(0);
  const [itemsTotalBasePrice, setItemsTotalBasePrice] = useState(0);
  const [itemsTotalBasePixPrice, setItemsTotalBasePixPrice] = useState(0);
  const [stockSurplus, setStockSurplus] = useState(0); 
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);

  const currentStock = form.watch("stock_quantity");
  const currentDiscount = form.watch("discount_percent");
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
  }, [currentStock, form]);

  const stockQuantity = form.watch("stock_quantity");

  // Recebe os dados calculados da composição
  const handleStatsUpdate = (surplus: number, totalBase: number, totalBasePix: number, itemsBreakdown: BreakdownItem[]) => {
    setStockSurplus(surplus);
    setItemsTotalBasePrice(totalBase);
    setItemsTotalBasePixPrice(totalBasePix);
    setBreakdown(itemsBreakdown);
    
    // O máximo que podemos ter é o que já temos (initialData.stock) + o que sobra (surplus)
    const currentKitStock = initialData?.stock_quantity || 0;
    setMaxPossibleStock(currentKitStock + surplus);
  };

  // Auto-calcular preço quando muda o desconto
  useEffect(() => {
    if (itemsTotalBasePrice > 0 || itemsTotalBasePixPrice > 0) {
        const discount = currentDiscount || 0;
        const factor = (1 - (discount / 100));

        const newPrice = itemsTotalBasePrice * factor;
        const newPixPrice = itemsTotalBasePixPrice * factor;

        // Só atualiza se o valor calculado for diferente para evitar loops (ou se quiser forçar, ok)
        // Aqui estamos forçando a atualização baseada no desconto.
        form.setValue("price", parseFloat(newPrice.toFixed(2)));
        form.setValue("pix_price", parseFloat(newPixPrice.toFixed(2)));
    }
  }, [currentDiscount, itemsTotalBasePrice, itemsTotalBasePixPrice, form]);

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

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

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
                        className="h-[200px] max-w-full"
                    />
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
          </div>

          {!promotionId && (
             <Button type="submit" disabled={isSubmitting} className="w-full h-12 font-bold text-lg bg-blue-600 hover:bg-blue-700">
                {isSubmitting ? "Criando..." : "Criar Kit & Avançar para Composição"}
             </Button>
          )}

          {/* PASSO 2: COMPOSIÇÃO */}
          {promotionId && (
            <>
                <Separator className="my-6" />
                <PromotionComposition 
                    promotionId={promotionId} 
                    onStatsChange={handleStatsUpdate}
                />

                {/* PASSO 3: PREÇO E ESTOQUE */}
                <div className="space-y-4 bg-gray-50 p-6 rounded-lg border mt-6">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                        <DollarSign className="w-4 h-4 text-gray-500" />
                        <h3 className="text-sm font-bold text-gray-700 uppercase">3. Precificação Inteligente e Estoque</h3>
                    </div>

                    {/* Linha do Desconto Geral */}
                    <div className="flex justify-start mb-4">
                        <FormField
                            control={form.control}
                            name="discount_percent"
                            render={({ field }) => (
                            <FormItem className="w-48">
                                <FormLabel className="flex items-center gap-1"><Calculator className="w-3 h-3" /> Desconto no Kit (%)</FormLabel>
                                <FormControl>
                                <Input type="number" min="0" max="100" placeholder="0" {...field} className="bg-white border-blue-200" />
                                </FormControl>
                            </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* COLUNA PREÇOS (CARD x PIX) */}
                        <div className="bg-white p-4 rounded border shadow-sm space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {/* CARTÃO */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <span>Soma Itens:</span>
                                            <HoverCard>
                                                <HoverCardTrigger>
                                                    <Info className="w-3 h-3 cursor-help text-blue-500" />
                                                </HoverCardTrigger>
                                                <HoverCardContent className="w-80">
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4" /> Detalhamento (Cartão)</h4>
                                                        <div className="text-xs space-y-1">
                                                            {breakdown.map((item, idx) => (
                                                                <div key={idx} className="flex justify-between border-b pb-1 last:border-0">
                                                                    <span className="truncate max-w-[150px]" title={item.name}>{item.quantity}x {item.name}</span>
                                                                    <span>{formatCurrency(item.totalPrice)}</span>
                                                                </div>
                                                            ))}
                                                            <div className="border-t pt-2 mt-1 flex justify-between font-bold text-sm">
                                                                <span>Total Base</span>
                                                                <span>{formatCurrency(itemsTotalBasePrice)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </HoverCardContent>
                                            </HoverCard>
                                        </div>
                                        <span className="font-bold">{formatCurrency(itemsTotalBasePrice)}</span>
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="price"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-1 text-xs"><CreditCard className="w-3 h-3" /> Preço Cartão</FormLabel>
                                            <FormControl>
                                            <Input type="number" step="0.01" {...field} className="font-bold" />
                                            </FormControl>
                                        </FormItem>
                                        )}
                                    />
                                </div>

                                {/* PIX */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <span>Soma Itens:</span>
                                            <HoverCard>
                                                <HoverCardTrigger>
                                                    <Info className="w-3 h-3 cursor-help text-green-600" />
                                                </HoverCardTrigger>
                                                <HoverCardContent className="w-80">
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-semibold flex items-center gap-2 text-green-700"><QrCode className="w-4 h-4" /> Detalhamento (Pix)</h4>
                                                        <div className="text-xs space-y-1">
                                                            {breakdown.map((item, idx) => (
                                                                <div key={idx} className="flex justify-between border-b pb-1 last:border-0">
                                                                    <span className="truncate max-w-[150px]" title={item.name}>{item.quantity}x {item.name}</span>
                                                                    <span>{formatCurrency(item.totalPixPrice)}</span>
                                                                </div>
                                                            ))}
                                                            <div className="border-t pt-2 mt-1 flex justify-between font-bold text-sm text-green-700">
                                                                <span>Total Base</span>
                                                                <span>{formatCurrency(itemsTotalBasePixPrice)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </HoverCardContent>
                                            </HoverCard>
                                        </div>
                                        <span className="font-bold">{formatCurrency(itemsTotalBasePixPrice)}</span>
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="pix_price"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-1 text-xs text-green-700"><QrCode className="w-3 h-3" /> Preço Pix</FormLabel>
                                            <FormControl>
                                            <Input type="number" step="0.01" {...field} className="font-bold text-green-700 bg-green-50" />
                                            </FormControl>
                                        </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* COLUNA ESTOQUE */}
                        <div className="bg-white p-4 rounded border shadow-sm space-y-4">
                            <div className="flex justify-between items-center bg-blue-50 p-2 rounded text-xs text-blue-800 border border-blue-100">
                                <span className="font-bold">Kits Atuais: {initialData?.stock_quantity || 0}</span>
                                <span className="font-bold">+</span>
                                <span className="font-bold">Capacidade Extra: {stockSurplus}</span>
                                <span className="font-bold">=</span>
                                <Badge variant="default" className="bg-blue-600">Máx: {maxPossibleStock}</Badge>
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
                                        <FormLabel>Ativar Kit</FormLabel>
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