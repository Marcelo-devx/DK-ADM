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
import { Input } from "@/components/ui/input";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CategoryForm } from "./category-form";
import { PlusCircle, Layers, Copy, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { ImageUploader } from "./ImageUploader";
import { Switch } from "../ui/switch";
import { ProductVariantManager } from "./ProductVariantManager";
import { Separator } from "../ui/separator";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  id: z.number().optional(),
  sku: z.string().optional(),
  name: z.string().min(2, "O nome é obrigatório."),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "O preço deve ser zero ou positivo."),
  pix_price: z.coerce.number().min(0, "O preço Pix deve ser zero ou positivo.").optional(),
  cost_price: z.coerce.number().min(0, "O preço de custo não pode ser negativo.").optional(),
  stock_quantity: z.coerce.number().int().min(0, "O estoque não pode ser negativo."),
  category: z.string().optional(),
  sub_category: z.string().optional(),
  brand: z.string().optional(),
  image_url: z.string().url("URL da imagem inválida.").optional().or(z.literal('')),
  is_visible: z.boolean().default(true),
});

type ProductFormValues = z.infer<typeof formSchema>;

interface ProductFormProps {
  onSubmit: (values: ProductFormValues) => void;
  isSubmitting: boolean;
  categories: { id: number; name: string }[];
  isLoadingCategories: boolean;
  subCategories: { id: number; name: string; category_id: number }[];
  isLoadingSubCategories: boolean;
  brands: { id: number; name: string }[];
  isLoadingBrands: boolean;
  initialData?: ProductFormValues & { is_visible?: boolean };
  existingProducts?: any[]; 
}

const generateRandomSku = () => {
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PROD-${randomStr}`;
};

export const ProductForm = ({
  onSubmit,
  isSubmitting,
  categories,
  isLoadingCategories,
  subCategories,
  isLoadingSubCategories,
  brands,
  isLoadingBrands,
  initialData,
  existingProducts = [],
}: ProductFormProps) => {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      sku: generateRandomSku(),
      name: "",
      description: "",
      price: 0,
      pix_price: 0,
      cost_price: 0,
      stock_quantity: 0,
      category: "",
      sub_category: "",
      brand: "",
      image_url: "",
      is_visible: true,
    },
  });

  const queryClient = useQueryClient();
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [filteredSubCategories, setFilteredSubCategories] = useState<{ id: number; name: string; }[]>([]);

  const selectedCategoryName = form.watch("category");
  const productId = initialData?.id;

  const currentPrice = form.watch("price");
  const currentPixPrice = form.watch("pix_price");
  const currentCostPrice = form.watch("cost_price");

  const { data: variants } = useQuery({
    queryKey: ["productVariants", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data } = await supabase.from("product_variants").select("id").eq("product_id", productId);
      return data || [];
    },
    enabled: !!productId,
  });

  const hasVariants = variants && variants.length > 0;

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  useEffect(() => {
    if (selectedCategoryName && categories.length > 0) {
      const selectedCategory = categories.find(c => c.name === selectedCategoryName);
      if (selectedCategory) {
        const filtered = subCategories.filter(sc => sc.category_id === selectedCategory.id);
        setFilteredSubCategories(filtered);
      }
    }
  }, [selectedCategoryName, categories, subCategories]);

  const addCategoryMutation = useMutation({
    mutationFn: async (newCategory: { name: string }) => {
      const { error } = await supabase.from("categories").insert([newCategory]).select();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      showSuccess("Categoria adicionada!");
      setIsCategoryModalOpen(false);
    },
    onError: (error) => showError(error.message),
  });

  const handleRegenerateSku = () => {
    form.setValue("sku", generateRandomSku());
  };

  const handleCloneProduct = (productIdStr: string) => {
    const productToClone = existingProducts.find(p => String(p.id) === productIdStr);
    if (productToClone) {
        const { id, created_at, updated_at, flavor_count, variants: v, variant_prices, variant_costs, ...cloneData } = productToClone;
        
        form.reset({
            ...cloneData,
            name: `${cloneData.name} (Cópia)`,
            sku: generateRandomSku(), 
            stock_quantity: 0, 
            is_visible: cloneData.is_visible ?? true,
        });
        showSuccess(`Dados de "${productToClone.name}" copiados! Ajuste o nome e o SKU se desejar.`);
    }
  };

  return (
    <div className="space-y-6">
      {!initialData && existingProducts.length > 0 && (
        <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg text-primary">
                    <Copy className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-sm font-bold text-primary">Clonar Produto Existente</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Os dados serão copiados para um novo registro</p>
                </div>
            </div>
            <div className="flex-1 w-full">
                <Select onValueChange={handleCloneProduct}>
                    <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecione um produto para copiar..." />
                    </SelectTrigger>
                    <SelectContent>
                        {existingProducts.map(p => (
                            <SelectItem key={p.id} value={String(p.id)}>
                                {p.name} {p.brand ? `(${p.brand})` : ''}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>Nome Principal</FormLabel>
                  <FormControl><Input placeholder="Ex: Juice Zomo" {...field} /></FormControl>
                  <FormMessage />
                  </FormItem>
              )}
              />
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU (Código do Produto)</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="Gerado Automático" {...field} />
                      </FormControl>
                      <Button type="button" variant="outline" size="icon" onClick={handleRegenerateSku} title="Gerar novo código">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>Marca</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingBrands}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                      {brands.map((brand) => (<SelectItem key={brand.id} value={brand.name}>{brand.name}</SelectItem>))}
                      </SelectContent>
                  </Select>
                  <FormMessage />
                  </FormItem>
              )}
              />
              
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <div className="flex items-center gap-2">
                      <Select onValueChange={(value) => { field.onChange(value); form.setValue("sub_category", ""); }} value={field.value} disabled={isLoadingCategories}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>{categories.map((c) => (<SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>))}</SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsCategoryModalOpen(true)}><PlusCircle className="h-4 w-4" /></Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="sub_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub-categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCategoryName}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>{filteredSubCategories.map((sc) => (<SelectItem key={sc.id} value={sc.name}>{sc.name}</SelectItem>))}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição Curta</FormLabel>
                <FormControl><Textarea placeholder="Detalhes gerais..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />

          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase text-gray-500">Valores Padrão / Base</p>
                {hasVariants && (
                    <Badge variant="secondary" className="text-[10px]">Usado como padrão para novas variações</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                      <FormItem><FormLabel>Venda</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="pix_price"
                      render={({ field }) => (
                      <FormItem><FormLabel>Preço Pix</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="cost_price"
                      render={({ field }) => (
                      <FormItem><FormLabel>Custo</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="stock_quantity"
                      render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estoque</FormLabel>
                        <FormControl>
                            <Input 
                                type="number" 
                                {...field} 
                                disabled={hasVariants} 
                                className={hasVariants ? "bg-gray-100 opacity-50" : ""}
                            />
                        </FormControl>
                        {hasVariants && <span className="text-[10px] text-muted-foreground">Gerenciado por variação</span>}
                      </FormItem>
                      )}
                  />
              </div>
          </div>

          <div className="border-t pt-6">
              <h4 className="text-sm font-bold flex items-center gap-2 mb-4 text-primary"><Layers className="w-4 h-4" /> Configurações de Variações</h4>
              <ProductVariantManager 
                productId={productId} 
                basePrice={currentPrice}
                basePixPrice={currentPixPrice || 0}
                baseCostPrice={currentCostPrice || 0}
              />
          </div>

          <FormField
            control={form.control}
            name="image_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Imagem Principal</FormLabel>
                <ImageUploader onUploadSuccess={(url) => field.onChange(url)} initialUrl={field.value} />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="is_visible"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-white">
                <FormLabel>Produto Visível no Site</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting} className="w-full h-12 text-lg font-bold">
            {isSubmitting ? "Salvando..." : (initialData ? "Atualizar Cadastro" : "Criar Produto")}
          </Button>
        </form>
      </Form>

      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
          <CategoryForm 
            onSubmit={(v) => addCategoryMutation.mutate({ name: v.name })} 
            isSubmitting={addCategoryMutation.isPending} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};