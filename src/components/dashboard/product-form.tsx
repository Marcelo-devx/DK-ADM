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
import { PlusCircle, Layers, Copy, RefreshCw, Loader2, ListChecks, CheckSquare } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { ImageUploader } from "./ImageUploader";
import { Switch } from "../ui/switch";
import { ProductVariantManager } from "./ProductVariantManager";
import { Separator } from "../ui/separator";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

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
  brand: z.string().optional(),
  image_url: z.string().url("URL da imagem inválida.").optional().or(z.literal('')),
  is_visible: z.boolean().default(true),
});

type ProductFormValues = z.infer<typeof formSchema>;

interface ProductFormProps {
  onSubmit: (values: ProductFormValues, variantsToClone?: any[], subCategoryIds?: number[]) => void;
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
  const queryClient = useQueryClient();
  const [selectedSubIds, setSelectedSubIds] = useState<number[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [variantsToClone, setVariantsToClone] = useState<any[]>([]);
  const [isCloning, setIsCloning] = useState(false);

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
      brand: "",
      image_url: "",
      is_visible: true,
    },
  });

  const selectedCategoryName = form.watch("category");
  const productId = initialData?.id;

  const currentPrice = form.watch("price");
  const currentPixPrice = form.watch("pix_price");
  const currentCostPrice = form.watch("cost_price");

  // Definição da variável hasVariants através de useQuery
  const { data: variants } = useQuery({
    queryKey: ["productVariants", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data } = await supabase.from("product_variants").select("id").eq("product_id", productId);
      return data || [];
    },
    enabled: !!productId,
  });

  const hasVariants = !!(variants && variants.length > 0);

  // Busca as subcategorias já vinculadas ao produto
  const { data: linkedSubs } = useQuery({
    queryKey: ["linkedSubCategories", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data } = await supabase.from("product_sub_categories").select("sub_category_id").eq("product_id", productId);
      return data?.map(d => d.sub_category_id) || [];
    },
    enabled: !!productId,
  });

  useEffect(() => {
    if (linkedSubs) setSelectedSubIds(linkedSubs);
  }, [linkedSubs]);

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  // Filtra subcategorias com base no nome da categoria selecionada (Case Insensitive e Trim)
  const filteredSubCategories = useMemo(() => {
    if (!selectedCategoryName || !categories.length || !subCategories.length) return [];
    
    const normalizedSelected = selectedCategoryName.toLowerCase().replace(/\s/g, '');
    const cat = categories.find(c => c.name.toLowerCase().replace(/\s/g, '') === normalizedSelected);
    
    if (!cat) return [];
    return subCategories.filter(sc => sc.category_id === cat.id);
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

  const handleSubToggle = (id: number) => {
    setSelectedSubIds(prev => {
      const safePrev = Array.isArray(prev) ? prev : [];
      if (safePrev.includes(id)) {
        return safePrev.filter(sid => sid !== id);
      }
      return [...safePrev, id];
    });
  };

  const handleRegenerateSku = () => {
    form.setValue("sku", generateRandomSku());
  };

  const handleCloneProduct = async (productIdStr: string) => {
    setIsCloning(true);
    const productToClone = existingProducts.find(p => String(p.id) === productIdStr);
    
    if (productToClone) {
        const { data: fullVariants } = await supabase
            .from("product_variants")
            .select("*")
            .eq("product_id", productIdStr);
        
        if (fullVariants && fullVariants.length > 0) {
            setVariantsToClone(fullVariants);
        } else {
            setVariantsToClone([]);
        }

        const { id, created_at, updated_at, variants: v, variant_prices, variant_costs, ...cloneData } = productToClone;
        
        form.reset({
            ...cloneData,
            name: `${cloneData.name} (Cópia)`,
            sku: generateRandomSku(), 
            stock_quantity: 0, 
            is_visible: cloneData.is_visible ?? true,
        });
        
        showSuccess(`Dados copiados! ${fullVariants?.length || 0} variações incluídas.`);
    }
    setIsCloning(false);
  };

  return (
    <div className="space-y-6">
      {!initialData && existingProducts.length > 0 && (
        <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg text-primary">
                    {isCloning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Copy className="h-5 w-5" />}
                </div>
                <div>
                    <p className="text-sm font-bold text-primary">Clonar Produto Existente</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Os dados e variações serão copiados para um novo registro</p>
                </div>
            </div>
            <div className="flex-1 w-full">
                <Select onValueChange={handleCloneProduct} disabled={isCloning}>
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

      {variantsToClone.length > 0 && !initialData && (
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-center gap-2 text-sm text-blue-700">
              <Layers className="h-4 w-4" />
              <span>Este produto será criado com <strong>{variantsToClone.length} variações</strong> copiadas do original (com estoque zerado).</span>
          </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit((values) => onSubmit(values, variantsToClone, selectedSubIds))} className="space-y-6">
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
                    <FormLabel>Categoria Principal</FormLabel>
                    <div className="flex items-center gap-2">
                      <Select onValueChange={(value) => { field.onChange(value); }} value={field.value} disabled={isLoadingCategories}>
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

          {/* SUB-CATEGORIAS (MÚLTIPLAS) */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border">
            <Label className="flex items-center gap-2 text-primary font-bold">
                <ListChecks className="w-4 h-4" /> Sub-categorias vinculadas
            </Label>
            {!selectedCategoryName ? (
                <p className="text-xs text-muted-foreground italic">Selecione uma categoria principal primeiro.</p>
            ) : filteredSubCategories.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    Nenhuma subcategoria encontrada para "{selectedCategoryName}". 
                    <br/><span className="text-[10px] opacity-70">(Verifique se as subcategorias estão criadas no menu Catálogo)</span>
                </p>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {filteredSubCategories.map(sc => {
                        const isSelected = selectedSubIds.includes(sc.id);
                        return (
                            <div 
                                key={sc.id} 
                                className={`flex items-center space-x-2 p-2 rounded border shadow-sm transition-all cursor-pointer ${isSelected ? 'bg-primary/5 border-primary' : 'bg-white hover:border-primary/50'}`}
                                onClick={(e) => {
                                    e.preventDefault(); 
                                    handleSubToggle(sc.id);
                                }}
                            >
                                <div className={`w-4 h-4 flex items-center justify-center rounded border ${isSelected ? 'bg-primary border-primary text-white' : 'border-gray-300 bg-white'}`}>
                                    {isSelected && <CheckSquare className="w-3 h-3" />}
                                </div>
                                <span className={`text-xs font-medium select-none ${isSelected ? 'text-primary' : 'text-gray-700'}`}>
                                    {sc.name}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}
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
                {(hasVariants || variantsToClone.length > 0) && (
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
              
              {!initialData ? (
                  <div className="p-4 bg-gray-50 border rounded-lg text-center text-sm text-muted-foreground">
                      {variantsToClone.length > 0 
                        ? "As variações do produto original serão copiadas ao salvar." 
                        : "Salve o produto primeiro para gerenciar variações manualmente."}
                  </div>
              ) : (
                  <ProductVariantManager 
                    productId={productId} 
                    basePrice={currentPrice}
                    basePixPrice={currentPixPrice || 0}
                    baseCostPrice={currentCostPrice || 0}
                  />
              )}
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