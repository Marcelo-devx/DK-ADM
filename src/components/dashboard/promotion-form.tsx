import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BasicInfoTab } from "./promotion-form/BasicInfoTab";
import { CompositionTab, BreakdownItem } from "./promotion-form/CompositionTab";
import { PricingTab } from "./promotion-form/PricingTab";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(2, "O nome é obrigatório."),
  description: z.string().optional(),
  image_url: z.string().url("URL da imagem inválida.").optional().or(z.literal("")),
  price: z.coerce.number().min(0, "O preço não pode ser negativo."),
  pix_price: z.coerce.number().min(0, "O preço pix não pode ser negativo."),
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

export const PromotionForm = ({ onSubmit, isSubmitting, initialData }: PromotionFormProps) => {
  const [activeTab, setActiveTab] = useState("basic");
  const [maxPossibleStock, setMaxPossibleStock] = useState(0);
  const [itemsTotalBasePrice, setItemsTotalBasePrice] = useState(0);
  const [itemsTotalBasePixPrice, setItemsTotalBasePixPrice] = useState(0);
  const [stockSurplus, setStockSurplus] = useState(0);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);

  const promotionId = initialData?.id;

  // Criar kit básico (Passo 1)
  const handleCreateBasic = async (values: { name: string; description: string; image_url: string }) => {
    const kitValues: Partial<PromotionFormValues> = {
      ...values,
      price: 0,
      pix_price: 0,
      stock_quantity: 0,
      is_active: false,
      discount_percent: 0,
    };

    // Se já tem ID, apenas avança para a próxima aba
    if (promotionId) {
      setActiveTab("composition");
      return;
    }

    // Se não tem ID, precisa criar o kit primeiro
    const { data, error } = await supabase.from("promotions").insert(kitValues).select().single();

    if (error) {
      alert(`Erro ao criar kit: ${error.message}`);
      return;
    }

    // Chama o onSubmit com o novo ID
    onSubmit({ ...kitValues, id: data.id });
  };

  // Recebe os dados da composição (Passo 2)
  const handleCompositionComplete = (surplus: number, totalBase: number, totalBasePix: number, itemsBreakdown: BreakdownItem[]) => {
    setStockSurplus(surplus);
    setItemsTotalBasePrice(totalBase);
    setItemsTotalBasePixPrice(totalBasePix);
    setBreakdown(itemsBreakdown);

    const currentKitStock = initialData?.stock_quantity || 0;
    setMaxPossibleStock(currentKitStock + surplus);

    setActiveTab("pricing");
  };

  // Salvar alterações finais (Passo 3)
  const handleFinalSubmit = async (values: PromotionFormValues) => {
    if (!promotionId) {
      onSubmit(values);
      return;
    }

    // Validação de estoque
    if (values.stock_quantity > maxPossibleStock) {
      alert(`Erro: Você só tem produtos suficientes para montar ${maxPossibleStock} kits no total.`);
      return;
    }

    // Atualiza estoque se necessário
    if (values.stock_quantity !== initialData?.stock_quantity) {
      try {
        const { stock_quantity, discount_percent, ...basicData } = values;
        const { error: basicError } = await supabase
          .from("promotions")
          .update(basicData)
          .eq("id", promotionId);

        if (basicError) throw basicError;

        const { error: stockError } = await supabase.rpc("update_kit_stock_level", {
          p_promotion_id: promotionId,
          p_new_stock: values.stock_quantity,
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger
            value="basic"
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold"
          >
            1. Dados Básicos
          </TabsTrigger>
          <TabsTrigger
            value="composition"
            disabled={!promotionId}
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold disabled:opacity-50"
          >
            2. Composição
          </TabsTrigger>
          <TabsTrigger
            value="pricing"
            disabled={!promotionId}
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold disabled:opacity-50"
          >
            3. Precificação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-0">
          <BasicInfoTab
            onSubmit={handleCreateBasic}
            isSubmitting={isSubmitting && !promotionId}
            initialData={initialData}
          />
        </TabsContent>

        <TabsContent value="composition" className="mt-0">
          <CompositionTab promotionId={promotionId} onNext={handleCompositionComplete} />
        </TabsContent>

        <TabsContent value="pricing" className="mt-0">
          <PricingTab
            initialData={initialData}
            stats={{
              maxPossibleStock,
              stockSurplus,
              itemsTotalBasePrice,
              itemsTotalBasePixPrice,
            }}
            breakdown={breakdown}
            onSubmit={handleFinalSubmit}
            isSubmitting={isSubmitting}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};