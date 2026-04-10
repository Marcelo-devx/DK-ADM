import { useForm } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Calculator, QrCode, CreditCard, TrendingDown, Package, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface BreakdownItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitPixPrice: number;
  totalPixPrice: number;
}

interface PricingTabProps {
  initialData?: {
    price?: number;
    pix_price?: number;
    stock_quantity?: number;
    is_active?: boolean;
    discount_percent?: number;
  };
  stats: {
    maxPossibleStock: number;
    stockSurplus: number;
    itemsTotalBasePrice: number;
    itemsTotalBasePixPrice: number;
  };
  breakdown: BreakdownItem[];
  onSubmit: (values: any) => void;
  isSubmitting?: boolean;
}

// Componente auxiliar para label com asterisco obrigatório
const RequiredLabel = ({ children }: { children: React.ReactNode }) => (
  <FormLabel>
    {children}
    <span className="text-red-500 ml-1">*</span>
  </FormLabel>
);

export const PricingTab = ({
  initialData,
  stats,
  breakdown,
  onSubmit,
  isSubmitting = false,
}: PricingTabProps) => {
  const form = useForm({
    defaultValues: {
      price: initialData?.price || 0,
      pix_price: initialData?.pix_price || 0,
      stock_quantity: initialData?.stock_quantity || 0,
      is_active: initialData?.is_active || false,
      discount_percent: initialData?.discount_percent || 0,
    },
  });

  console.log("[PricingTab] Initial data:", {
    initialData,
    stats,
    hasBreakdown: breakdown.length > 0
  });

  const currentDiscount = form.watch("discount_percent");
  const stockQuantity = form.watch("stock_quantity");

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const calculateSavings = () => {
    const total = stats.itemsTotalBasePrice;
    const final = form.getValues("price");
    return Math.max(0, total - final);
  };

  const currentSavings = calculateSavings();

  const handleFormSubmit = (values: any) => {
    // Validações adicionais
    const errors = [];
    
    if (values.price === undefined || values.price === null || values.price < 0) {
      errors.push("Preço Cartão deve ser maior ou igual a 0");
    }
    
    if (values.pix_price === undefined || values.pix_price === null || values.pix_price < 0) {
      errors.push("Preço PIX deve ser maior ou igual a 0");
    }
    
    if (values.stock_quantity === undefined || values.stock_quantity === null || values.stock_quantity < 0) {
      errors.push("Quantidade de Kits deve ser maior ou igual a 0");
    }
    
    if (values.stock_quantity > stats.maxPossibleStock) {
      errors.push(`Quantidade de Kits não pode exceder o máximo possível (${stats.maxPossibleStock})`);
    }

    if (errors.length > 0) {
      alert(`⚠️ Erro de validação:\n\n${errors.join('\n')}`);
      return;
    }

    onSubmit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <div className="flex items-center justify-between mb-2 pb-2 border-b">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-700 uppercase">3. Precificação e Estoque</h3>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="text-red-500">*</span> Campos obrigatórios
          </div>
        </div>

        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            Todos os campos marcados com <span className="text-red-500 font-bold">*</span> são obrigatórios para salvar o kit.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna Esquerda - Precificação */}
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                <Calculator className="w-4 h-4 text-gray-500" />
                <h4 className="text-sm font-semibold">Desconto do Kit</h4>
              </div>

              <FormField
                control={form.control}
                name="discount_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">Percentual de Desconto</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="0"
                          {...field}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            field.onChange(val);
                            
                            // Auto-calcular preços
                            const factor = 1 - val / 100;
                            const newPrice = parseFloat((stats.itemsTotalBasePrice * factor).toFixed(2));
                            const newPixPrice = parseFloat((stats.itemsTotalBasePixPrice * factor).toFixed(2));
                            
                            form.setValue("price", newPrice);
                            form.setValue("pix_price", newPixPrice);
                          }}
                          className="bg-blue-50 border-blue-200 font-bold text-base"
                        />
                        <span className="text-lg font-bold text-blue-700">%</span>
                      </div>
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-2">
                      Digite o percentual para calcular automaticamente os preços
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cartão */}
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                <CreditCard className="w-4 h-4 text-gray-600" />
                <h4 className="text-sm font-semibold text-gray-700">Preço Cartão</h4>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Soma dos Itens</span>
                  <span className="font-medium">{formatCurrency(stats.itemsTotalBasePrice)}</span>
                </div>

                {currentDiscount > 0 && (
                  <div className="flex justify-between items-center text-sm bg-green-50 p-2 rounded border border-green-100">
                    <span className="text-green-700 font-medium">Desconto ({currentDiscount}%)</span>
                    <span className="text-green-700 font-bold">
                      -{formatCurrency(stats.itemsTotalBasePrice - form.getValues("price"))}
                    </span>
                  </div>
                )}

                <Separator className="my-2" />

                <FormField
                  control={form.control}
                  name="price"
                  rules={{ required: "Preço Cartão é obrigatório", min: { value: 0, message: "Preço não pode ser negativo" } }}
                  render={({ field }) => (
                    <FormItem>
                      <RequiredLabel>Preço Final</RequiredLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          className="font-bold text-lg h-11"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {currentSavings > 0 && (
                  <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg border border-green-100">
                    <TrendingDown className="w-4 h-4" />
                    <span className="font-semibold">Economia Total:</span>
                    <span className="font-bold">{formatCurrency(currentSavings)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* PIX */}
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                <QrCode className="w-4 h-4 text-green-600" />
                <h4 className="text-sm font-semibold text-green-700">Preço PIX</h4>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Soma dos Itens</span>
                  <span className="font-medium text-green-700">{formatCurrency(stats.itemsTotalBasePixPrice)}</span>
                </div>

                {currentDiscount > 0 && (
                  <div className="flex justify-between items-center text-sm bg-green-50 p-2 rounded border border-green-100">
                    <span className="text-green-700 font-medium">Desconto ({currentDiscount}%)</span>
                    <span className="text-green-700 font-bold">
                      -{formatCurrency(stats.itemsTotalBasePixPrice - form.getValues("pix_price"))}
                    </span>
                  </div>
                )}

                <Separator className="my-2" />

                <FormField
                  control={form.control}
                  name="pix_price"
                  rules={{ required: "Preço PIX é obrigatório", min: { value: 0, message: "Preço não pode ser negativo" } }}
                  render={({ field }) => (
                    <FormItem>
                      <RequiredLabel>Preço Final</RequiredLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          className="font-bold text-lg h-11 text-green-700 bg-green-50 border-green-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {currentDiscount > 0 && (
                  <div className="flex justify-between items-center text-sm text-green-600 bg-green-50 p-2 rounded border border-green-100">
                    <span>Economia no PIX</span>
                    <span className="font-bold">
                      {formatCurrency(stats.itemsTotalBasePixPrice - form.getValues("pix_price"))}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Detalhamento dos itens */}
            {breakdown.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h5 className="text-xs font-semibold mb-3 text-muted-foreground uppercase">Detalhamento</h5>
                <div className="space-y-2 text-xs">
                  {breakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-muted-foreground truncate max-w-[180px]" title={item.name}>
                        {item.quantity}x {item.name}
                      </span>
                      <div className="text-right">
                        <div className="text-muted-foreground">{formatCurrency(item.totalPrice)}</div>
                        <div className="text-green-700">{formatCurrency(item.totalPixPrice)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Coluna Direita - Estoque */}
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                <Package className="w-4 h-4 text-gray-500" />
                <h4 className="text-sm font-semibold">Controle de Estoque</h4>
              </div>

              <div className="space-y-4">
                {/* Capacidade disponível */}
                <div className="bg-blue-50 p-3 rounded border border-blue-100">
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Kits Atuais</div>
                      <div className="font-bold text-lg">{initialData?.stock_quantity || 0}</div>
                    </div>
                    <div className="flex items-center justify-center text-blue-600 font-bold">
                      +
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Capacidade Extra</div>
                      <div className="font-bold text-lg">{stats.stockSurplus}</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-200 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Estoque Máximo Possível</div>
                    <Badge variant="default" className="bg-blue-600 text-base px-3 py-1">
                      {stats.maxPossibleStock}
                    </Badge>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="stock_quantity"
                  rules={{ 
                    required: "Quantidade de Kits é obrigatória",
                    min: { value: 0, message: "Quantidade não pode ser negativa" },
                    max: { value: stats.maxPossibleStock, message: `Máximo possível: ${stats.maxPossibleStock}` }
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <RequiredLabel>Kits Disponíveis para Venda</RequiredLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max={stats.maxPossibleStock}
                          {...field}
                          className="font-bold text-xl h-12 text-center"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <p className="text-xs text-muted-foreground text-center">
                  Você não pode definir um valor maior que <span className="font-bold text-blue-700">{stats.maxPossibleStock}</span>
                </p>
              </div>
            </div>

            {/* Ativação */}
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-gray-50">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-semibold">Ativar Kit</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Disponibilizar para venda no catálogo
                    </p>
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

        {/* Botão de Salvar */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-14 font-bold text-lg bg-green-600 hover:bg-green-700"
        >
          {isSubmitting ? "Processando..." : "Salvar Alterações e Reservar Estoque"}
        </Button>
      </form>
    </Form>
  );
};